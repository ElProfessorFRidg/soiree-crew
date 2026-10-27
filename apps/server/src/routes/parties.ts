import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { estimateBac, type BodyProfile, type DrinkIntake } from "@crew/bac";
import { assertCrewMember, HttpError, requireUser, type Context } from "../context";
import { partySchema, responseSchema } from "../schemas";

const HOUR_MS = 3_600_000;
/** Drinks this long before a party starts still count in its live BACs. */
const PRE_PARTY_MS = 12 * HOUR_MS;
/** N-29: a member who has given no sign of life for this long is flagged, gently. */
const QUIET_AFTER_MS = 45 * 60_000;
/** A party never stays open for days (O-40). */
const MAX_PARTY_MS = 18 * HOUR_MS;
const MAX_TRIP_MS = 10 * 24 * HOUR_MS;

interface PartyRow {
  id: string;
  crew_id: string;
  name: string;
  mood: string;
  kind: "party" | "trip";
  starts_at: number;
  ends_at: number;
  closed_at: number | null;
  created_by: string;
}

function partyView(row: PartyRow, now: number) {
  return {
    id: row.id,
    crewId: row.crew_id,
    name: row.name,
    mood: row.mood,
    kind: row.kind,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    closedAt: row.closed_at,
    live: row.closed_at === null && row.starts_at <= now && row.ends_at >= now,
  };
}

/** Closes every party past its end, so nothing stays open for days. */
async function closeEnded(ctx: Context): Promise<void> {
  await ctx.db.query("update parties set closed_at = ends_at where closed_at is null and ends_at < $1", [ctx.now()]);
}

async function loadPartyForMember(ctx: Context, partyId: string, userId: string): Promise<PartyRow> {
  const rows = await ctx.db.query<PartyRow>(
    `select p.* from parties p join crew_members c on c.crew_id = p.crew_id and c.user_id = $2 where p.id = $1`,
    [partyId, userId],
  );
  if (!rows[0]) throw new HttpError(404, "not_found");
  return rows[0];
}

export function partyRoutes(app: FastifyInstance, ctx: Context): void {
  app.post("/v1/parties", async (request, reply) => {
    const user = requireUser(request);
    const input = partySchema.parse(request.body);
    await assertCrewMember(ctx, input.crewId, user.id);
    const span = input.endsAt - input.startsAt;
    if (span <= 0 || span > (input.kind === "trip" ? MAX_TRIP_MS : MAX_PARTY_MS)) throw new HttpError(400, "invalid_dates");
    const now = ctx.now();
    const existing = await ctx.db.query("select 1 from parties where id = $1", [input.id]);
    if (existing.length) throw new HttpError(409, "exists");
    await ctx.db.transaction(async (tx) => {
      await tx.query(
        `insert into parties (id, crew_id, name, mood, kind, starts_at, ends_at, created_by, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [input.id, input.crewId, input.name, input.mood, input.kind, input.startsAt, input.endsAt, user.id, now],
      );
      // The whole crew is invited; the creator is going.
      await tx.query(
        `insert into party_members (party_id, user_id, response)
         select $1, m.user_id, case when m.user_id = $2 then 'going' else 'invited' end from crew_members m where m.crew_id = $3`,
        [input.id, user.id, input.crewId],
      );
    });
    const members = await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1", [input.crewId]);
    ctx.live.notify(members.map((m) => m.user_id), { type: "crew.changed", crewId: input.crewId });
    const rows = await ctx.db.query<PartyRow>("select * from parties where id = $1", [input.id]);
    return reply.status(201).send({ party: partyView(rows[0]!, now) });
  });

  /** Upcoming and live parties of my crews, plus my invitation state (O-36). */
  app.get("/v1/parties", async (request) => {
    const user = requireUser(request);
    await closeEnded(ctx);
    const now = ctx.now();
    const rows = await ctx.db.query<PartyRow & { response: string }>(
      `select p.*, m.response from parties p join party_members m on m.party_id = p.id and m.user_id = $1
       where p.closed_at is null or p.closed_at > $2 order by p.starts_at`,
      [user.id, now - 24 * HOUR_MS],
    );
    return { parties: rows.map((row) => ({ ...partyView(row, now), myResponse: row.response })) };
  });

  app.post<{ Params: { id: string } }>("/v1/parties/:id/response", async (request) => {
    const user = requireUser(request);
    const party = await loadPartyForMember(ctx, request.params.id, user.id);
    const { response } = responseSchema.parse(request.body);
    await ctx.db.query(
      `insert into party_members (party_id, user_id, response) values ($1, $2, $3)
       on conflict (party_id, user_id) do update set response = $3`,
      [party.id, user.id, response],
    );
    const members = await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1", [party.crew_id]);
    ctx.live.notify(members.map((m) => m.user_id), { type: "party.changed", partyId: party.id });
    return { response };
  });

  /** Small status flags a member sets on themself: home safe (N-25, O-82), designated driver (N-26), low battery (QOL-10). */
  app.post<{ Params: { id: string } }>("/v1/parties/:id/status", async (request) => {
    const user = requireUser(request);
    const party = await loadPartyForMember(ctx, request.params.id, user.id);
    const input = z
      .object({ homeSafe: z.boolean().optional(), designatedDriver: z.boolean().optional(), batteryLow: z.boolean().optional() })
      .parse(request.body);
    const now = ctx.now();
    if (input.homeSafe !== undefined) {
      await ctx.db.query("update party_members set home_safe_at = $3, last_activity_at = $4 where party_id = $1 and user_id = $2", [
        party.id,
        user.id,
        input.homeSafe ? now : null,
        now,
      ]);
    }
    if (input.designatedDriver !== undefined) {
      await ctx.db.query("update party_members set designated_driver = $3 where party_id = $1 and user_id = $2", [party.id, user.id, input.designatedDriver]);
    }
    if (input.batteryLow !== undefined) {
      await ctx.db.query("update party_members set battery_low = $3, last_activity_at = $4 where party_id = $1 and user_id = $2", [
        party.id,
        user.id,
        input.batteryLow,
        now,
      ]);
    }
    const members = await ctx.db.query<{ user_id: string }>("select user_id from party_members where party_id = $1 and response = 'going'", [party.id]);
    ctx.live.notify(members.map((m) => m.user_id), { type: "party.changed", partyId: party.id });
    return { ok: true };
  });

  /**
   * O-37 live dashboard. BACs are computed here with @crew/bac from each member's
   * own drinks, so every phone shows the same numbers. Only crew members reach it.
   */
  app.get<{ Params: { id: string } }>("/v1/parties/:id/live", async (request) => {
    const user = requireUser(request);
    await closeEnded(ctx);
    const party = await loadPartyForMember(ctx, request.params.id, user.id);
    const now = ctx.now();
    const at = party.closed_at ?? now;

    const members = await ctx.db.query<{
      user_id: string;
      display_name: string;
      response: string;
      designated_driver: boolean;
      home_safe_at: number | null;
      last_activity_at: number | null;
      battery_low: boolean;
      sealed: string | null;
    }>(
      `select m.user_id, u.display_name, m.response, m.designated_driver, m.home_safe_at, m.last_activity_at, m.battery_low, b.sealed
       from party_members m join users u on u.id = m.user_id left join body_profiles b on b.user_id = m.user_id
       where m.party_id = $1 order by u.display_name`,
      [party.id],
    );
    const going = members.filter((m) => m.response === "going").map((m) => m.user_id);
    const drinkRows = going.length
      ? await ctx.db.query<{ id: string; user_id: string; sealed: string; consumed_at: number; party_id: string | null }>(
          `select id, user_id, sealed, consumed_at, party_id from drinks
           where user_id = any($1::uuid[]) and deleted_at is null and consumed_at between $2 and $3`,
          [going, party.starts_at - PRE_PARTY_MS, at],
        )
      : [];
    const waterRows = going.length
      ? await ctx.db.query<{ user_id: string }>("select user_id from water where party_id = $1 and deleted_at is null", [party.id])
      : [];

    const view = members.map((m) => {
      const base = {
        userId: m.user_id,
        displayName: m.display_name,
        response: m.response,
        designatedDriver: m.designated_driver,
        homeSafeAt: m.home_safe_at,
        batteryLow: m.battery_low,
        lastActivityAt: m.last_activity_at,
      };
      if (m.response !== "going") return { ...base, bac: null, trend: null, drinks: 0, water: 0, quiet: false };
      const mine = drinkRows.filter((d) => d.user_id === m.user_id);
      const intakes: DrinkIntake[] = mine.map((d) => {
        const body = ctx.sealer.open<{ volumeMl: number; abv: number; withFood: boolean }>(d.sealed);
        return { id: d.id, volumeMl: body.volumeMl, abv: body.abv, consumedAt: d.consumed_at, withFood: body.withFood };
      });
      const profile = m.sealed ? ctx.sealer.open<BodyProfile>(m.sealed) : null;
      const estimate = profile ? estimateBac(intakes, profile, at) : null;
      const quiet =
        party.closed_at === null &&
        m.home_safe_at === null &&
        m.last_activity_at !== null &&
        now - m.last_activity_at > QUIET_AFTER_MS;
      return {
        ...base,
        bac: estimate ? Math.round(estimate.bac * 1000) / 1000 : null,
        trend: estimate?.trend ?? null,
        drinks: mine.filter((d) => d.party_id === party.id).length,
        water: waterRows.filter((w) => w.user_id === m.user_id).length,
        quiet,
      };
    });

    return { party: partyView(party, now), members: view, serverTime: now };
  });

  /** O-40: the creator or an admin can close early; a closed party takes no new drinks. */
  app.post<{ Params: { id: string } }>("/v1/parties/:id/close", async (request) => {
    const user = requireUser(request);
    const party = await loadPartyForMember(ctx, request.params.id, user.id);
    const { role } = await assertCrewMember(ctx, party.crew_id, user.id);
    if (party.created_by !== user.id && role !== "admin") throw new HttpError(403, "forbidden");
    await ctx.db.query("update parties set closed_at = $2 where id = $1 and closed_at is null", [party.id, ctx.now()]);
    const members = await ctx.db.query<{ user_id: string }>("select user_id from party_members where party_id = $1", [party.id]);
    ctx.live.notify(members.map((m) => m.user_id), { type: "party.changed", partyId: party.id });
    return { ok: true };
  });
}
