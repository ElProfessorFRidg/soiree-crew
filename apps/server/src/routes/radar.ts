import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertCrewMember, HttpError, requireUser, type Context } from "../context";
import { newId } from "../crypto";
import { crewTimeZone } from "../territory";
import { nightOf } from "../time";

const night = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const statusSchema = z.object({
  night,
  status: z.enum(["going_out", "maybe", "home", "unavailable"]),
  fromMinute: z.number().int().min(0).max(36 * 60).nullable().optional(),
  toMinute: z.number().int().min(0).max(36 * 60).nullable().optional(),
  place: z.string().trim().max(60).optional(),
});

function addDays(key: string, days: number): string {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Everyone who shares a crew with the user: the only people who may see their status. */
async function crewMates(ctx: Context, userId: string): Promise<string[]> {
  const rows = await ctx.db.query<{ user_id: string }>(
    `select distinct m2.user_id from crew_members m1 join crew_members m2 on m2.crew_id = m1.crew_id where m1.user_id = $1`,
    [userId],
  );
  return rows.map((r) => r.user_id);
}

export function radarRoutes(app: FastifyInstance, ctx: Context): void {
  /** N-01: one gesture sets tonight's (or another night's) status. It expires with its night. */
  app.put("/v1/status", async (request) => {
    const user = requireUser(request);
    const input = statusSchema.parse(request.body);
    await ctx.db.query(
      `insert into night_statuses (user_id, night, status, from_minute, to_minute, place, updated_at) values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (user_id, night) do update set status = $3, from_minute = $4, to_minute = $5, place = $6, updated_at = $7`,
      [user.id, input.night, input.status, input.fromMinute ?? null, input.toMinute ?? null, input.place ?? "", ctx.now()],
    );
    const mates = await crewMates(ctx, user.id);
    const crews = await ctx.db.query<{ crew_id: string }>("select crew_id from crew_members where user_id = $1", [user.id]);
    for (const crew of crews) ctx.live.notify(mates, { type: "crew.changed", crewId: crew.crew_id });
    return { ok: true };
  });

  app.delete<{ Params: { night: string } }>("/v1/status/:night", async (request, reply) => {
    const user = requireUser(request);
    await ctx.db.query("delete from night_statuses where user_id = $1 and night = $2", [user.id, night.parse(request.params.night)]);
    return reply.status(204).send();
  });

  /** N-02 crew board: statuses for the next 7 nights and tonight's out calls with their replies. */
  app.get<{ Params: { id: string } }>("/v1/crews/:id/radar", async (request) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const timeZone = await crewTimeZone(ctx.db, request.params.id);
    const tonight = nightOf(ctx.now(), timeZone);
    const last = addDays(tonight, 6);
    const members = await ctx.db.query<{ user_id: string; display_name: string }>(
      "select m.user_id, u.display_name from crew_members m join users u on u.id = m.user_id where m.crew_id = $1 order by u.display_name",
      [request.params.id],
    );
    const statuses = await ctx.db.query<{ user_id: string; night: string; status: string; from_minute: number | null; to_minute: number | null; place: string }>(
      `select s.user_id, s.night, s.status, s.from_minute, s.to_minute, s.place from night_statuses s
       join crew_members m on m.user_id = s.user_id and m.crew_id = $1 where s.night between $2 and $3`,
      [request.params.id, tonight, last],
    );
    const calls = await ctx.db.query<{ id: string; user_id: string; night: string; note: string; party_id: string | null; created_at: number }>(
      "select id, user_id, night, note, party_id, created_at from out_calls where crew_id = $1 and night = $2 order by created_at desc",
      [request.params.id, tonight],
    );
    const replies = calls.length
      ? await ctx.db.query<{ call_id: string; user_id: string; reply: string }>("select call_id, user_id, reply from out_call_replies where call_id = any($1::uuid[])", [
          calls.map((c) => c.id),
        ])
      : [];
    return {
      tonight,
      nights: Array.from({ length: 7 }, (_, i) => addDays(tonight, i)),
      members: members.map((m) => ({ userId: m.user_id, name: m.display_name })),
      statuses: statuses.map((s) => ({ userId: s.user_id, night: s.night, status: s.status, fromMinute: s.from_minute, toMinute: s.to_minute, place: s.place })),
      calls: calls.map((c) => ({
        id: c.id,
        userId: c.user_id,
        note: c.note,
        partyId: c.party_id,
        at: c.created_at,
        replies: replies.filter((r) => r.call_id === c.id).map((r) => ({ userId: r.user_id, reply: r.reply })),
      })),
    };
  });

  /** N-03 "I'm going out, who's in?": sets my status and asks the crew in one tap. */
  app.post<{ Params: { id: string } }>("/v1/crews/:id/out-calls", async (request, reply) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const input = z.object({ note: z.string().trim().max(80).optional() }).parse(request.body ?? {});
    const timeZone = await crewTimeZone(ctx.db, request.params.id);
    const tonight = nightOf(ctx.now(), timeZone);
    const id = newId();
    await ctx.db.query("insert into out_calls (id, crew_id, user_id, night, note, created_at) values ($1, $2, $3, $4, $5, $6)", [
      id,
      request.params.id,
      user.id,
      tonight,
      input.note ?? "",
      ctx.now(),
    ]);
    await ctx.db.query(
      `insert into night_statuses (user_id, night, status, updated_at) values ($1, $2, 'going_out', $3)
       on conflict (user_id, night) do update set status = 'going_out', updated_at = $3`,
      [user.id, tonight, ctx.now()],
    );
    const members = await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1", [request.params.id]);
    ctx.live.notify(members.map((m) => m.user_id), { type: "crew.changed", crewId: request.params.id });
    return reply.status(201).send({ id });
  });

  app.post<{ Params: { id: string } }>("/v1/out-calls/:id/reply", async (request) => {
    const user = requireUser(request);
    const input = z.object({ reply: z.enum(["in", "maybe", "no"]) }).parse(request.body);
    const rows = await ctx.db.query<{ crew_id: string; night: string }>("select crew_id, night from out_calls where id = $1", [request.params.id]);
    const call = rows[0];
    if (!call) throw new HttpError(404, "not_found");
    await assertCrewMember(ctx, call.crew_id, user.id);
    await ctx.db.query(
      `insert into out_call_replies (call_id, user_id, reply, at) values ($1, $2, $3, $4)
       on conflict (call_id, user_id) do update set reply = $3, at = $4`,
      [request.params.id, user.id, input.reply, ctx.now()],
    );
    const status = input.reply === "in" ? "going_out" : input.reply === "maybe" ? "maybe" : "home";
    await ctx.db.query(
      `insert into night_statuses (user_id, night, status, updated_at) values ($1, $2, $3, $4)
       on conflict (user_id, night) do update set status = $3, updated_at = $4`,
      [user.id, call.night, status, ctx.now()],
    );
    const members = await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1", [call.crew_id]);
    ctx.live.notify(members.map((m) => m.user_id), { type: "crew.changed", crewId: call.crew_id });
    return { ok: true };
  });

  /** Links a call to the party it turned into (N-03 "turns into a party in one tap"). */
  app.post<{ Params: { id: string } }>("/v1/out-calls/:id/party", async (request) => {
    const user = requireUser(request);
    const input = z.object({ partyId: z.string().uuid() }).parse(request.body);
    const rows = await ctx.db.query<{ crew_id: string }>("select crew_id from out_calls where id = $1 and user_id = $2", [request.params.id, user.id]);
    if (!rows[0]) throw new HttpError(404, "not_found");
    await ctx.db.query("update out_calls set party_id = $2 where id = $1", [request.params.id, input.partyId]);
    // Everyone who said "in" is already going.
    await ctx.db.query(
      `update party_members set response = 'going' where party_id = $1 and user_id in (select user_id from out_call_replies where call_id = $2 and reply = 'in')`,
      [input.partyId, request.params.id],
    );
    return { ok: true };
  });

  /**
   * N-28 SOS: alerts the crew of the party (or every crew) at once. The location, when the
   * user shares it, is sealed and goes to crew members only.
   */
  app.post("/v1/sos", async (request, reply) => {
    const user = requireUser(request);
    const input = z
      .object({ partyId: z.string().uuid().optional(), location: z.object({ lat: z.number(), lng: z.number(), accuracy: z.number() }).optional() })
      .parse(request.body ?? {});
    const crews = input.partyId
      ? await ctx.db.query<{ crew_id: string }>("select crew_id from parties where id = $1", [input.partyId])
      : await ctx.db.query<{ crew_id: string }>("select crew_id from crew_members where user_id = $1", [user.id]);
    const ids: string[] = [];
    for (const crew of crews) {
      await assertCrewMember(ctx, crew.crew_id, user.id);
      const id = newId();
      ids.push(id);
      await ctx.db.query(
        "insert into sos_alerts (id, user_id, crew_id, party_id, sealed_location, created_at) values ($1, $2, $3, $4, $5, $6)",
        [id, user.id, crew.crew_id, input.partyId ?? null, input.location ? ctx.sealer.seal(input.location) : null, ctx.now()],
      );
      const members = await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1 and user_id <> $2", [crew.crew_id, user.id]);
      ctx.live.notify(members.map((m) => m.user_id), { type: "crew.changed", crewId: crew.crew_id });
    }
    return reply.status(201).send({ ids });
  });

  /** Open SOS alerts of my crews, with the location when it was shared. */
  app.get("/v1/sos", async (request) => {
    const user = requireUser(request);
    const rows = await ctx.db.query<{ id: string; user_id: string; display_name: string; sealed_location: string | null; created_at: number }>(
      `select a.id, a.user_id, u.display_name, a.sealed_location, a.created_at from sos_alerts a join users u on u.id = a.user_id
       join crew_members m on m.crew_id = a.crew_id and m.user_id = $1
       where a.resolved_at is null and a.user_id <> $1 and a.created_at > $2 order by a.created_at desc`,
      [user.id, ctx.now() - 12 * 3_600_000],
    );
    return {
      alerts: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        name: r.display_name,
        at: r.created_at,
        location: r.sealed_location ? ctx.sealer.open<{ lat: number; lng: number; accuracy: number }>(r.sealed_location) : null,
      })),
    };
  });

  app.post<{ Params: { id: string } }>("/v1/sos/:id/resolve", async (request) => {
    const user = requireUser(request);
    await ctx.db.query(
      `update sos_alerts set resolved_at = $3 where id = $1 and (user_id = $2 or crew_id in (select crew_id from crew_members where user_id = $2))`,
      [request.params.id, user.id, ctx.now()],
    );
    return { ok: true };
  });
}
