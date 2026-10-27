import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertCrewMember, HttpError, requireUser, type Context } from "../context";
import { crewTimeZone } from "../territory";
import { nightOf } from "../time";

const uuid = z.string().uuid();
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const pollSchema = z.object({
  id: uuid,
  title: z.string().trim().min(1).max(60),
  place: z.string().trim().max(80).default(""),
  plan: z.string().trim().max(200).default(""),
  slots: z.array(z.object({ id: uuid, startsAt: z.number().int(), endsAt: z.number().int() })).min(1).max(10),
});

/** ISO weekday of a night key: Monday 1 ... Sunday 7. */
function weekdayOf(night: string): number {
  return new Date(`${night}T12:00:00Z`).getUTCDay() || 7;
}

async function notifyCrew(ctx: Context, crewId: string): Promise<void> {
  const members = await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1", [crewId]);
  ctx.live.notify(
    members.map((m) => m.user_id),
    { type: "crew.changed", crewId },
  );
}

async function pollForMember(ctx: Context, pollId: string, userId: string) {
  const poll = (
    await ctx.db.query<{ id: string; crew_id: string; created_by: string; title: string; closed_at: number | null }>(
      "select id, crew_id, created_by, title, closed_at from polls where id = $1",
      [uuid.parse(pollId)],
    )
  )[0];
  if (!poll) throw new HttpError(404, "not_found");
  const { role } = await assertCrewMember(ctx, poll.crew_id, userId);
  return { poll, role };
}

export function pollRoutes(app: FastifyInstance, ctx: Context): void {
  /** N-04: a poll with up to ten slots in the coming two months. */
  app.post<{ Params: { id: string } }>("/v1/crews/:id/polls", async (request, reply) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const input = pollSchema.parse(request.body);
    const now = ctx.now();
    for (const slot of input.slots) {
      if (slot.endsAt <= slot.startsAt || slot.endsAt - slot.startsAt > DAY_MS) throw new HttpError(400, "invalid_dates");
      if (slot.endsAt < now || slot.startsAt > now + 62 * DAY_MS) throw new HttpError(400, "invalid_dates");
    }
    if ((await ctx.db.query("select 1 from polls where id = $1", [input.id])).length) throw new HttpError(409, "exists");
    await ctx.db.transaction(async (tx) => {
      await tx.query("insert into polls (id, crew_id, created_by, title, place, plan, created_at) values ($1, $2, $3, $4, $5, $6, $7)", [
        input.id,
        request.params.id,
        user.id,
        input.title,
        input.place,
        input.plan,
        now,
      ]);
      for (const slot of input.slots) {
        await tx.query("insert into poll_slots (id, poll_id, starts_at, ends_at) values ($1, $2, $3, $4)", [slot.id, input.id, slot.startsAt, slot.endsAt]);
        // Whoever proposes a slot can make it.
        await tx.query("insert into poll_votes (slot_id, user_id, answer, at) values ($1, $2, 'yes', $3)", [slot.id, user.id, now]);
      }
    });
    await notifyCrew(ctx, request.params.id);
    return reply.status(201).send({ id: input.id });
  });

  /** Open polls and the ones closed in the last week, with every answer. */
  app.get<{ Params: { id: string } }>("/v1/crews/:id/polls", async (request) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const polls = await ctx.db.query<{
      id: string;
      created_by: string;
      title: string;
      place: string;
      plan: string;
      created_at: number;
      closed_at: number | null;
      party_id: string | null;
    }>(
      "select id, created_by, title, place, plan, created_at, closed_at, party_id from polls where crew_id = $1 and (closed_at is null or closed_at > $2) order by created_at desc",
      [request.params.id, ctx.now() - 7 * DAY_MS],
    );
    const ids = polls.map((p) => p.id);
    const slots = ids.length
      ? await ctx.db.query<{ id: string; poll_id: string; starts_at: number; ends_at: number }>(
          "select id, poll_id, starts_at, ends_at from poll_slots where poll_id = any($1::uuid[]) order by starts_at",
          [ids],
        )
      : [];
    const votes = slots.length
      ? await ctx.db.query<{ slot_id: string; user_id: string; answer: string }>("select slot_id, user_id, answer from poll_votes where slot_id = any($1::uuid[])", [
          slots.map((s) => s.id),
        ])
      : [];
    return {
      polls: polls.map((p) => ({
        id: p.id,
        createdBy: p.created_by,
        title: p.title,
        place: p.place,
        plan: p.plan,
        createdAt: p.created_at,
        closedAt: p.closed_at,
        partyId: p.party_id,
        slots: slots
          .filter((s) => s.poll_id === p.id)
          .map((s) => ({
            id: s.id,
            startsAt: s.starts_at,
            endsAt: s.ends_at,
            answers: votes.filter((v) => v.slot_id === s.id).map((v) => ({ userId: v.user_id, answer: v.answer })),
          })),
      })),
    };
  });

  /** My answers, slot by slot. */
  app.put<{ Params: { id: string } }>("/v1/polls/:id/votes", async (request) => {
    const user = requireUser(request);
    const { poll } = await pollForMember(ctx, request.params.id, user.id);
    if (poll.closed_at !== null) throw new HttpError(409, "conflict");
    const input = z.object({ votes: z.record(uuid, z.enum(["yes", "maybe", "no"])) }).parse(request.body);
    const slotIds = new Set((await ctx.db.query<{ id: string }>("select id from poll_slots where poll_id = $1", [poll.id])).map((s) => s.id));
    const now = ctx.now();
    for (const [slotId, answer] of Object.entries(input.votes)) {
      if (!slotIds.has(slotId)) throw new HttpError(400, "invalid");
      await ctx.db.query(
        "insert into poll_votes (slot_id, user_id, answer, at) values ($1, $2, $3, $4) on conflict (slot_id, user_id) do update set answer = $3, at = $4",
        [slotId, user.id, answer, now],
      );
    }
    await notifyCrew(ctx, poll.crew_id);
    return { ok: true };
  });

  /**
   * Closing on a slot creates the party: the whole crew invited, everyone who said yes going.
   * Only the poll's author or a crew admin closes it.
   */
  app.post<{ Params: { id: string } }>("/v1/polls/:id/close", async (request) => {
    const user = requireUser(request);
    const { poll, role } = await pollForMember(ctx, request.params.id, user.id);
    if (poll.created_by !== user.id && role !== "admin") throw new HttpError(403, "forbidden");
    if (poll.closed_at !== null) throw new HttpError(409, "conflict");
    const { slotId, partyId } = z.object({ slotId: uuid, partyId: uuid }).parse(request.body);
    const slot = (
      await ctx.db.query<{ starts_at: number; ends_at: number }>("select starts_at, ends_at from poll_slots where id = $1 and poll_id = $2", [slotId, poll.id])
    )[0];
    if (!slot) throw new HttpError(404, "not_found");
    const now = ctx.now();
    await ctx.db.transaction(async (tx) => {
      await tx.query(
        "insert into parties (id, crew_id, name, mood, kind, starts_at, ends_at, created_by, created_at) values ($1, $2, $3, 'party', 'party', $4, $5, $6, $7)",
        [partyId, poll.crew_id, poll.title, slot.starts_at, slot.ends_at, user.id, now],
      );
      await tx.query(
        `insert into party_members (party_id, user_id, response)
         select $1, m.user_id,
                case when m.user_id = $2 or exists (select 1 from poll_votes v where v.slot_id = $4 and v.user_id = m.user_id and v.answer = 'yes')
                     then 'going' else 'invited' end
         from crew_members m where m.crew_id = $3`,
        [partyId, user.id, poll.crew_id, slotId],
      );
      await tx.query("update polls set closed_at = $2, party_id = $3 where id = $1", [poll.id, now, partyId]);
    });
    await notifyCrew(ctx, poll.crew_id);
    return { partyId };
  });

  app.delete<{ Params: { id: string } }>("/v1/polls/:id", async (request, reply) => {
    const user = requireUser(request);
    const { poll, role } = await pollForMember(ctx, request.params.id, user.id);
    if (poll.created_by !== user.id && role !== "admin") throw new HttpError(403, "forbidden");
    await ctx.db.query("delete from polls where id = $1", [poll.id]);
    await notifyCrew(ctx, poll.crew_id);
    return reply.status(204).send();
  });

  /** N-05: the nights I usually go out, for this crew. */
  app.put<{ Params: { id: string } }>("/v1/crews/:id/usual-nights", async (request) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const { weekdays } = z.object({ weekdays: z.array(z.number().int().min(1).max(7)).max(7) }).parse(request.body);
    const clean = [...new Set(weekdays)].sort();
    await ctx.db.query(
      "insert into usual_nights (crew_id, user_id, weekdays) values ($1, $2, $3) on conflict (crew_id, user_id) do update set weekdays = $3",
      [request.params.id, user.id, JSON.stringify(clean)],
    );
    return { weekdays: clean };
  });

  /** N-05: everyone's usual nights and, for the next 14 nights, who usually goes out then. */
  app.get<{ Params: { id: string } }>("/v1/crews/:id/usual-nights", async (request) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const rows = await ctx.db.query<{ user_id: string; display_name: string; weekdays: string | null }>(
      `select m.user_id, u.display_name, n.weekdays from crew_members m join users u on u.id = m.user_id
       left join usual_nights n on n.crew_id = m.crew_id and n.user_id = m.user_id where m.crew_id = $1 order by u.display_name`,
      [request.params.id],
    );
    const members = rows.map((r) => ({ userId: r.user_id, name: r.display_name, weekdays: r.weekdays ? (JSON.parse(r.weekdays) as number[]) : [] }));
    const timeZone = await crewTimeZone(ctx.db, request.params.id);
    const tonight = nightOf(ctx.now(), timeZone);
    const nights = Array.from({ length: 14 }, (_, i) => {
      const night = new Date(Date.parse(`${tonight}T12:00:00Z`) + i * DAY_MS).toISOString().slice(0, 10);
      const weekday = weekdayOf(night);
      return { night, weekday, usually: members.filter((m) => m.weekdays.includes(weekday)).map((m) => m.userId) };
    });
    return { members, nights, timeZone };
  });
}
