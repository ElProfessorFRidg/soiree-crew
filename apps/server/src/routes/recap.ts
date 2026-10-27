import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BacSimulation, distributionVolume, type BodyProfile, type DrinkIntake } from "@crew/bac";
import { HttpError, requireUser, type Context } from "../context";

const HOUR_MS = 3_600_000;
const PRE_PARTY_MS = 12 * HOUR_MS;
const CURVE_STEP_MS = 10 * 60_000;
/** The few reactions the recap offers: a short fixed set reads better than a keyboard at 11 am. */
export const RECAP_EMOJIS = ["🔥", "😂", "🥴", "👑", "💧", "❤️"] as const;

type BadgeKind = "camel" | "goldenDriver" | "newBoss" | "firstIn" | "nightOwl";
type TimelineKind = "start" | "arrival" | "checkIn" | "takeover" | "round" | "homeSafe" | "end";

interface PartyRow {
  id: string;
  crew_id: string;
  name: string;
  mood: string;
  kind: string;
  starts_at: number;
  ends_at: number;
  closed_at: number | null;
}

async function partyForMember(ctx: Context, partyId: string, userId: string): Promise<PartyRow> {
  const rows = await ctx.db.query<PartyRow>(
    "select p.* from parties p join crew_members c on c.crew_id = p.crew_id and c.user_id = $2 where p.id = $1",
    [partyId, userId],
  );
  if (!rows[0]) throw new HttpError(404, "not_found");
  return rows[0];
}

export function recapRoutes(app: FastifyInstance, ctx: Context): void {
  /** Closed parties of my crews, newest first: recaps are kept (O-41). */
  app.get("/v1/recaps", async (request) => {
    const user = requireUser(request);
    const rows = await ctx.db.query<PartyRow & { going: number; seen: number | null }>(
      `select p.*, (select count(*)::int from party_members g where g.party_id = p.id and g.response = 'going') as going, m.recap_seen_at as seen
       from parties p
       join crew_members c on c.crew_id = p.crew_id and c.user_id = $1
       left join party_members m on m.party_id = p.id and m.user_id = $1
       where p.closed_at is not null
       order by p.starts_at desc limit 60`,
      [user.id],
    );
    return {
      recaps: rows.map((p) => ({ id: p.id, crewId: p.crew_id, name: p.name, mood: p.mood, startsAt: p.starts_at, closedAt: p.closed_at, going: p.going, seenAt: p.seen })),
    };
  });

  /**
   * O-41, N-22: the recap of one party, computed from what the server already
   * keeps. Only people actually present show up: going and with some sign of
   * the night (a drink, a water, a check-in or a heartbeat).
   */
  app.get<{ Params: { id: string } }>("/v1/parties/:id/recap", async (request) => {
    const user = requireUser(request);
    const party = await partyForMember(ctx, request.params.id, user.id);
    const now = ctx.now();
    const to = party.closed_at ?? Math.min(now, party.ends_at);

    const members = await ctx.db.query<{
      user_id: string;
      display_name: string;
      designated_driver: boolean;
      home_safe_at: number | null;
      last_activity_at: number | null;
      sealed: string | null;
    }>(
      `select m.user_id, u.display_name, m.designated_driver, m.home_safe_at, m.last_activity_at, b.sealed
       from party_members m join users u on u.id = m.user_id left join body_profiles b on b.user_id = m.user_id
       where m.party_id = $1 and m.response = 'going' order by u.display_name`,
      [party.id],
    );
    const ids = members.map((m) => m.user_id);
    const drinkRows = ids.length
      ? await ctx.db.query<{ id: string; user_id: string; sealed: string; consumed_at: number; party_id: string | null }>(
          `select id, user_id, sealed, consumed_at, party_id from drinks
           where user_id = any($1::uuid[]) and deleted_at is null and consumed_at between $2 and $3 order by consumed_at`,
          [ids, party.starts_at - PRE_PARTY_MS, to],
        )
      : [];
    const waterRows = await ctx.db.query<{ user_id: string; at: number }>("select user_id, at from water where party_id = $1 and deleted_at is null", [party.id]);
    const checkIns = await ctx.db.query<{ user_id: string; at: number; venue_id: string; venue_name: string }>(
      `select c.user_id, c.at, c.venue_id, v.name as venue_name from check_ins c join venues v on v.id = c.venue_id
       where c.party_id = $1 and c.verdict = 'accepted' and c.private = false order by c.at`,
      [party.id],
    );
    const takeovers = ids.length
      ? await ctx.db.query<{ user_id: string; started_at: number; venue_name: string }>(
          `select r.user_id, r.started_at, v.name as venue_name from reigns r join venues v on v.id = r.venue_id
           where v.crew_id = $1 and r.user_id = any($2::uuid[]) and r.started_at between $3 and $4 order by r.started_at`,
          [party.crew_id, ids, party.starts_at, to],
        )
      : [];
    const rounds = await ctx.db.query<{ payer_id: string; member_ids: string; created_at: number }>(
      "select payer_id, member_ids, created_at from rounds where party_id = $1 order by created_at",
      [party.id],
    );
    const reactions = await ctx.db.query<{ from_id: string; to_id: string; emoji: string }>("select from_id, to_id, emoji from recap_reactions where party_id = $1", [party.id]);

    const partyDrinks = drinkRows.filter((d) => d.party_id === party.id);
    const present = members.filter(
      (m) =>
        partyDrinks.some((d) => d.user_id === m.user_id) ||
        waterRows.some((w) => w.user_id === m.user_id) ||
        checkIns.some((c) => c.user_id === m.user_id) ||
        (m.last_activity_at !== null && m.last_activity_at >= party.starts_at),
    );

    const firstDrink = partyDrinks[0]?.consumed_at;
    const from = Math.min(party.starts_at, firstDrink ?? party.starts_at);
    // Curves run until everyone is back to zero, capped at 10 hours after the end.
    const curveEnd = to + 10 * HOUR_MS;

    const participants = present.map((m) => {
      const mine = drinkRows.filter((d) => d.user_id === m.user_id);
      const intakes: DrinkIntake[] = mine.map((d) => {
        const body = ctx.sealer.open<{ volumeMl: number; abv: number; withFood: boolean }>(d.sealed);
        return { id: d.id, volumeMl: body.volumeMl, abv: body.abv, consumedAt: d.consumed_at, withFood: body.withFood };
      });
      const profile = m.sealed ? ctx.sealer.open<BodyProfile>(m.sealed) : null;
      let curve: [number, number][] = [];
      let peak: number | null = null;
      if (profile && intakes.length) {
        const sim = new BacSimulation(intakes, distributionVolume(profile), Math.max(to, now));
        const samples = sim.sample(from, curveEnd, CURVE_STEP_MS);
        let last = samples.length - 1;
        while (last > 0 && samples[last]!.bac <= 0 && samples[last - 1]!.bac <= 0) last -= 1;
        curve = samples.slice(0, last + 1).map((p) => [p.at, Math.round(p.bac * 1000) / 1000]);
        peak = curve.reduce((best, [, bac]) => Math.max(best, bac), 0);
      }
      return {
        userId: m.user_id,
        name: m.display_name,
        drinks: mine.filter((d) => d.party_id === party.id).length,
        water: waterRows.filter((w) => w.user_id === m.user_id).length,
        peak,
        curve,
        designatedDriver: m.designated_driver,
        homeSafeAt: m.home_safe_at,
      };
    });

    const peaks = participants.map((p) => p.peak).filter((p): p is number => p !== null && p > 0);
    const figures = {
      participants: participants.length,
      drinks: participants.reduce((s, p) => s + p.drinks, 0),
      averagePeak: peaks.length ? Math.round((peaks.reduce((s, p) => s + p, 0) / peaks.length) * 100) / 100 : null,
    };

    // Badges are facts about the night, never about the highest BAC (PROF-06).
    const badges: { kind: BadgeKind; userId: string; value?: number; venueName?: string }[] = [];
    const camel = [...participants].sort((a, b) => b.water - a.water)[0];
    if (camel && camel.water >= 3) badges.push({ kind: "camel", userId: camel.userId, value: camel.water });
    for (const p of participants) if (p.designatedDriver && p.drinks === 0) badges.push({ kind: "goldenDriver", userId: p.userId });
    for (const t of takeovers) badges.push({ kind: "newBoss", userId: t.user_id, venueName: t.venue_name });
    if (checkIns[0]) badges.push({ kind: "firstIn", userId: checkIns[0].user_id, venueName: checkIns[0].venue_name });
    const lastHome = participants.filter((p) => p.homeSafeAt !== null).sort((a, b) => b.homeSafeAt! - a.homeSafeAt!)[0];
    if (lastHome && participants.length > 1) badges.push({ kind: "nightOwl", userId: lastHome.userId });

    const timeline: { at: number; kind: TimelineKind; userId?: string; venueName?: string; count?: number }[] = [{ at: party.starts_at, kind: "start" }];
    const presentIds = new Set(participants.map((p) => p.userId));
    for (const p of participants) {
      const firstSign = [partyDrinks.find((d) => d.user_id === p.userId)?.consumed_at, checkIns.find((c) => c.user_id === p.userId)?.at]
        .filter((t): t is number => t !== undefined)
        .sort((a, b) => a - b)[0];
      if (firstSign !== undefined) timeline.push({ at: firstSign, kind: "arrival", userId: p.userId });
      if (p.homeSafeAt !== null) timeline.push({ at: p.homeSafeAt, kind: "homeSafe", userId: p.userId });
    }
    for (const c of checkIns) timeline.push({ at: c.at, kind: "checkIn", userId: c.user_id, venueName: c.venue_name });
    for (const t of takeovers) timeline.push({ at: t.started_at, kind: "takeover", userId: t.user_id, venueName: t.venue_name });
    for (const r of rounds) timeline.push({ at: r.created_at, kind: "round", userId: r.payer_id, count: (JSON.parse(r.member_ids) as string[]).length });
    if (party.closed_at !== null) timeline.push({ at: party.closed_at, kind: "end" });
    timeline.sort((a, b) => a.at - b.at);

    if (party.closed_at !== null) {
      await ctx.db.query("update party_members set recap_seen_at = $3 where party_id = $1 and user_id = $2 and recap_seen_at is null", [party.id, user.id, now]);
    }

    return {
      party: { id: party.id, crewId: party.crew_id, name: party.name, mood: party.mood, startsAt: party.starts_at, endsAt: party.ends_at, closedAt: party.closed_at },
      ready: party.closed_at !== null,
      window: { from, to },
      figures,
      participants,
      badges,
      timeline: timeline.filter((t) => !t.userId || presentIds.has(t.userId)),
      reactions: reactions.map((r) => ({ fromId: r.from_id, toId: r.to_id, emoji: r.emoji })),
    };
  });

  /** O-41: one reaction per person per participant; null removes it. */
  app.put<{ Params: { id: string } }>("/v1/parties/:id/recap/reactions", async (request) => {
    const user = requireUser(request);
    const party = await partyForMember(ctx, request.params.id, user.id);
    const input = z.object({ toId: z.string().uuid(), emoji: z.enum(RECAP_EMOJIS).nullable() }).parse(request.body);
    const target = await ctx.db.query("select 1 from party_members where party_id = $1 and user_id = $2 and response = 'going'", [party.id, input.toId]);
    if (!target.length) throw new HttpError(404, "not_found");
    if (input.emoji === null) {
      await ctx.db.query("delete from recap_reactions where party_id = $1 and from_id = $2 and to_id = $3", [party.id, user.id, input.toId]);
    } else {
      await ctx.db.query(
        `insert into recap_reactions (party_id, from_id, to_id, emoji, at) values ($1, $2, $3, $4, $5)
         on conflict (party_id, from_id, to_id) do update set emoji = excluded.emoji, at = excluded.at`,
        [party.id, user.id, input.toId, input.emoji, ctx.now()],
      );
    }
    const members = await ctx.db.query<{ user_id: string }>("select user_id from party_members where party_id = $1 and response = 'going'", [party.id]);
    ctx.live.notify(members.map((m) => m.user_id), { type: "party.changed", partyId: party.id });
    return { ok: true };
  });
}
