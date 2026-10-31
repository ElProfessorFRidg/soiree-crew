import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DANGER_CAP, estimateBac, ethanolGrams, type BodyProfile, type DrinkIntake } from "@crew/bac";
import { seasonBounds } from "@crew/territory";
import { AC_CONFIG, verifyDrinks } from "../anticheat";
import { assertCrewMember, HttpError, requireUser, type Context } from "../context";
import { crewTimeZone, currentSeason } from "../territory";
import { gameWins } from "./games";
import { dayBoundaries, dayBoundaryOf, nightOf, offsetMinutes } from "../time";
import { CITY_MAX, CREW_CATEGORIES, CREW_DESCRIPTION_MAX, CREW_KINDS, oneLine } from "../schemas";
import { assertCleanText } from "../textFilter";
import { checkOvertakes } from "../notifications/producers";

const DAY_MS = 86_400_000;

const querySchema = z.object({
  period: z.enum(["party", "week", "month", "all"]).default("month"),
  metric: z.enum(["drinks", "grams", "nights", "games"]).default("drinks"),
  partyId: z.string().uuid().optional(),
});

interface DrinkRow {
  id: string;
  user_id: string;
  party_id: string | null;
  sealed: string;
  consumed_at: number;
  logged_at: number;
  confirmations: number;
}

/** RANK-09: the drinking leaderboard is on for the crew build and can be switched off for a public release. */
export function drinkingLeaderboardEnabled(): boolean {
  return (process.env.DRINKING_LEADERBOARD ?? "on") !== "off";
}

/** Boards that never count drinks stay on when the drinking boards are switched off. */
const soberMetric = (metric: string) => metric === "nights" || metric === "games";

async function periodBounds(ctx: Context, crewId: string, period: string, partyId: string | undefined, userId: string) {
  const now = ctx.now();
  const timeZone = await crewTimeZone(ctx.db, crewId);
  if (period === "party") {
    if (!partyId) throw new HttpError(400, "invalid");
    const rows = await ctx.db.query<{ starts_at: number; ends_at: number; closed_at: number | null }>(
      "select p.starts_at, p.ends_at, p.closed_at from parties p join crew_members m on m.crew_id = p.crew_id and m.user_id = $2 where p.id = $1 and p.crew_id = $3",
      [partyId, userId, crewId],
    );
    const party = rows[0];
    if (!party) throw new HttpError(404, "not_found");
    return { from: party.starts_at - AC_CONFIG.drinks.partyPreMinutes * 60_000, to: party.closed_at ?? party.ends_at, timeZone };
  }
  if (period === "month") {
    const { start, end } = seasonBounds(currentSeason(now, timeZone), offsetMinutes(now, timeZone));
    return { from: start, to: end, timeZone };
  }
  if (period === "week") {
    // Monday at the day boundary of the person asking (QOL-02), local time, of the current week.
    const boundary = await dayBoundaryOf(ctx.db, userId);
    const night = nightOf(now, timeZone, boundary);
    const date = new Date(`${night}T${String(boundary).padStart(2, "0")}:00:00Z`);
    const day = date.getUTCDay() || 7;
    const monday = date.getTime() - (day - 1) * DAY_MS - offsetMinutes(now, timeZone) * 60_000;
    return { from: monday, to: monday + 7 * DAY_MS, timeZone };
  }
  return { from: 0, to: Number.MAX_SAFE_INTEGER, timeZone };
}

type Metric = z.infer<typeof querySchema>["metric"];

/** One board over [from, to): verified drinks only, nothing past the danger cap (RANK-06, RANK-07). */
export async function computeBoard(ctx: Context, crewId: string, from: number, to: number, timeZone: string, metric: Metric, viewerId: string) {
  const members = await ctx.db.query<{ user_id: string; display_name: string; sealed: string | null }>(
    `select m.user_id, u.display_name, b.sealed from crew_members m join users u on u.id = m.user_id
     left join body_profiles b on b.user_id = m.user_id
     where m.crew_id = $1 and m.leaderboard_opt_out = false`,
    [crewId],
  );
  const ids = members.map((m) => m.user_id);
  if (!ids.length) return [];

  // Drinks of the crew's parties only, plus a little before (verifyDrinks drops the rest).
  const drinks = await ctx.db.query<DrinkRow>(
    `select d.id, d.user_id, d.party_id, d.sealed, d.consumed_at, d.logged_at,
            (select count(*)::int from drink_confirmations c where c.drink_id = d.id) as confirmations
     from drinks d where d.user_id = any($1::uuid[]) and d.deleted_at is null and d.consumed_at >= $2 and d.consumed_at < $3`,
    [ids, from - DAY_MS, to],
  );
  const parties = await ctx.db.query<{ id: string; starts_at: number; ends_at: number; closed_at: number | null }>(
    "select id, starts_at, ends_at, closed_at from parties where crew_id = $1 and ends_at >= $2 and starts_at < $3",
    [crewId, from - DAY_MS, to],
  );
  const partyById = new Map(parties.map((p) => [p.id, { startsAt: p.starts_at, endsAt: p.closed_at ?? p.ends_at }]));
  const nightsOut = await ctx.db.query<{ user_id: string; starts_at: number }>(
    `select m.user_id, p.starts_at from party_members m join parties p on p.id = m.party_id
     where p.crew_id = $1 and m.response = 'going' and m.last_activity_at is not null and p.starts_at >= $2 and p.starts_at < $3
       and m.last_activity_at between p.starts_at and coalesce(p.closed_at, p.ends_at)`,
    [crewId, from, to],
  );
  // RANK-05: games won, counted from two members up (routes/games.ts).
  const wins = metric === "games" ? await gameWins(ctx.db, crewId, from, to) : new Map<string, number>();

  // QOL-02: a person's nights out are counted with their own day boundary.
  const boundaries = await dayBoundaries(ctx.db, ids);
  const rows = members.map((member) => {
    const mine = drinks.filter((d) => d.user_id === member.user_id);
    const decoded = mine.map((d) => ({ row: d, body: ctx.sealer.open<{ volumeMl: number; abv: number; withFood: boolean }>(d.sealed) }));
    const profile = member.sealed ? ctx.sealer.open<BodyProfile>(member.sealed) : null;
    let count = 0;
    let grams = 0;
    let unverified = 0;
    const byParty = new Map<string | null, typeof decoded>();
    for (const item of decoded) byParty.set(item.row.party_id, [...(byParty.get(item.row.party_id) ?? []), item]);
    for (const [partyId, list] of byParty) {
      const verdicts = verifyDrinks(
        list.map((d) => ({ id: d.row.id, volumeMl: d.body.volumeMl, abv: d.body.abv, consumedAt: d.row.consumed_at, loggedAt: d.row.logged_at, confirmed: d.row.confirmations > 0 })),
        partyId ? (partyById.get(partyId) ?? null) : null,
      );
      for (const d of list) {
        if (d.row.consumed_at < from || d.body.abv <= 0) continue;
        let verified = verdicts.get(d.row.id)?.status === "verified";
        if (verified && profile) {
          // RANK-07: past the danger cap, further drinks earn nothing.
          const before: DrinkIntake[] = decoded
            .filter((o) => o.row.consumed_at < d.row.consumed_at)
            .map((o) => ({ id: o.row.id, volumeMl: o.body.volumeMl, abv: o.body.abv, consumedAt: o.row.consumed_at, withFood: o.body.withFood }));
          if (estimateBac(before, profile, d.row.consumed_at).bac >= DANGER_CAP) verified = false;
        }
        if (verified) {
          count += 1;
          grams += ethanolGrams(d.body.volumeMl, d.body.abv);
        } else unverified += 1;
      }
    }
    const nights = new Set(nightsOut.filter((n) => n.user_id === member.user_id).map((n) => nightOf(n.starts_at, timeZone, boundaries.get(member.user_id)))).size;
    const value = metric === "drinks" ? count : metric === "grams" ? Math.round(grams) : metric === "games" ? (wins.get(member.user_id) ?? 0) : nights;
    return { userId: member.user_id, name: member.display_name, value, unverified: member.user_id === viewerId ? unverified : undefined };
  });

  rows.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  let rank = 0;
  let lastValue = Number.NaN;
  return rows.map((row, index) => {
    if (row.value !== lastValue) rank = index + 1;
    lastValue = row.value;
    return { ...row, rank };
  });
}

/**
 * RANK-04, N-34: champions of the last finished week and month on one board, for the titles
 * shown with the crew's honours. Ties share the title; a board with nobody above zero has none.
 */
export async function lastChampions(ctx: Context, crewId: string, viewerId: string, metric: Metric): Promise<{ week: string[]; month: string[] }> {
  const now = ctx.now();
  const { from: thisWeek, timeZone } = await periodBounds(ctx, crewId, "week", undefined, viewerId);
  const top = async (from: number, to: number) =>
    (await computeBoard(ctx, crewId, from, to, timeZone, metric, viewerId)).filter((r) => r.rank === 1 && r.value > 0).map((r) => r.userId);
  const [year, month] = currentSeason(now, timeZone).split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(year, month - 2, 15, 12));
  const key = `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, "0")}`;
  const { start, end } = seasonBounds(key, offsetMinutes(last.getTime(), timeZone));
  return { week: await top(thisWeek - 7 * DAY_MS, thisWeek), month: await top(start, end) };
}

export function leaderboardRoutes(app: FastifyInstance, ctx: Context): void {
  /** RANK-01, RANK-06, RANK-07, RANK-08: crew-only, verified drinks only, nothing above the danger cap. */
  app.get<{ Params: { id: string } }>("/v1/crews/:id/leaderboard", async (request) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const query = querySchema.parse(request.query);
    const crew = await ctx.db.query<{ leaderboard_enabled: boolean }>("select leaderboard_enabled from crews where id = $1", [request.params.id]);
    if (!crew[0]?.leaderboard_enabled || (!drinkingLeaderboardEnabled() && !soberMetric(query.metric))) {
      return { disabled: true, rows: [] };
    }
    const { from, to, timeZone } = await periodBounds(ctx, request.params.id, query.period, query.partyId, user.id);

    return { disabled: false, rows: await computeBoard(ctx, request.params.id, from, to, timeZone, query.metric, user.id) };
  });

  /**
   * RANK-04: the crew's honours list. Champions of the last 8 finished weeks and 6 finished months,
   * ties shared, and the weekly winning streaks they make. Same switches as the live board.
   */
  app.get<{ Params: { id: string } }>("/v1/crews/:id/leaderboard/history", async (request) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const metric = querySchema.shape.metric.parse((request.query as { metric?: string }).metric);
    const crewId = request.params.id;
    const crew = await ctx.db.query<{ leaderboard_enabled: boolean }>("select leaderboard_enabled from crews where id = $1", [crewId]);
    if (!crew[0]?.leaderboard_enabled || (!drinkingLeaderboardEnabled() && !soberMetric(metric))) return { disabled: true, weeks: [], months: [], streaks: [] };
    const now = ctx.now();
    const { from: thisWeek, timeZone } = await periodBounds(ctx, crewId, "week", undefined, user.id);
    const champions = async (from: number, to: number) => {
      const rows = await computeBoard(ctx, crewId, from, to, timeZone, metric, user.id);
      return rows.filter((r) => r.rank === 1 && r.value > 0).map((r) => ({ userId: r.userId, name: r.name, value: r.value }));
    };
    const weeks = [];
    for (let k = 1; k <= 8; k++) {
      const from = thisWeek - k * 7 * DAY_MS;
      weeks.push({ from, champions: await champions(from, from + 7 * DAY_MS) });
    }
    const months = [];
    const [year, month] = currentSeason(now, timeZone).split("-").map(Number) as [number, number];
    for (let k = 1; k <= 6; k++) {
      const date = new Date(Date.UTC(year, month - 1 - k, 15, 12));
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      const { start, end } = seasonBounds(key, offsetMinutes(date.getTime(), timeZone));
      months.push({ season: key, champions: await champions(start, end) });
    }
    // Weeks in a row as champion, counted back from last week, and the longest run in the window.
    const streaks = new Map<string, { name: string; current: number; best: number; run: number; broken: boolean }>();
    for (const week of weeks) {
      const ids = new Set(week.champions.map((c) => c.userId));
      for (const c of week.champions) if (!streaks.has(c.userId)) streaks.set(c.userId, { name: c.name, current: 0, best: 0, run: 0, broken: false });
      for (const [id, st] of streaks) {
        if (ids.has(id)) {
          st.run += 1;
          if (!st.broken) st.current = st.run;
        } else {
          st.broken = true;
          st.run = 0;
        }
        st.best = Math.max(st.best, st.run);
      }
    }
    return {
      disabled: false,
      weeks,
      months,
      streaks: [...streaks.entries()]
        .map(([userId, st]) => ({ userId, name: st.name, current: st.current, best: st.best }))
        .sort((a, b) => b.best - a.best || b.current - a.current),
    };
  });

  /**
   * AC-07: a friend present confirms a drink. When the drinker checked in somewhere, the friend
   * must have an accepted check-in at the same venue within 30 min; otherwise any member going
   * to the same live party may confirm (ASSUMPTIONS A-ORCH-4).
   */
  app.post<{ Params: { id: string } }>("/v1/drinks/:id/confirm", async (request) => {
    const user = requireUser(request);
    const rows = await ctx.db.query<{ user_id: string; party_id: string | null; consumed_at: number }>(
      "select user_id, party_id, consumed_at from drinks where id = $1 and deleted_at is null",
      [request.params.id],
    );
    const drink = rows[0];
    if (!drink || !drink.party_id || drink.user_id === user.id) throw new HttpError(404, "not_found");
    const going = await ctx.db.query("select 1 from party_members where party_id = $1 and user_id = $2 and response = 'going'", [drink.party_id, user.id]);
    if (!going.length) throw new HttpError(404, "not_found");
    const now = ctx.now();
    if (now - drink.consumed_at > 2 * 3_600_000) throw new HttpError(400, "too_late");

    const window = AC_CONFIG.drinks.confirmWindowMinutes * 60_000;
    const drinkerVenue = await ctx.db.query<{ venue_id: string }>(
      "select venue_id from check_ins where user_id = $1 and verdict = 'accepted' and at between $2 and $3 order by at desc limit 1",
      [drink.user_id, drink.consumed_at - 3 * 3_600_000, drink.consumed_at + window],
    );
    if (drinkerVenue[0]) {
      const together = await ctx.db.query(
        "select 1 from check_ins where user_id = $1 and venue_id = $2 and verdict = 'accepted' and at between $3 and $4",
        [user.id, drinkerVenue[0].venue_id, drink.consumed_at - 3 * 3_600_000, drink.consumed_at + window],
      );
      if (!together.length) throw new HttpError(403, "not_together");
    }
    // At most 20 confirmations per confirmer per party.
    const given = await ctx.db.query<{ n: number }>(
      "select count(*)::int as n from drink_confirmations c join drinks d on d.id = c.drink_id where c.confirmer_id = $1 and d.party_id = $2",
      [user.id, drink.party_id],
    );
    if ((given[0]?.n ?? 0) >= 20) throw new HttpError(429, "too_many");
    await ctx.db.query("insert into drink_confirmations (drink_id, confirmer_id, at) values ($1, $2, $3) on conflict do nothing", [
      request.params.id,
      user.id,
      now,
    ]);
    const members = await ctx.db.query<{ user_id: string }>("select user_id from party_members where party_id = $1 and response = 'going'", [drink.party_id]);
    ctx.live.notify(members.map((m) => m.user_id), { type: "party.changed", partyId: drink.party_id });
    // A confirmation can make a drink count (AC-07), and so move the board.
    await checkOvertakes(ctx, drink.party_id);
    return { ok: true };
  });

  /** Drinks of a live party that a member can confirm (the confirmer's own drinks excluded). */
  app.get<{ Params: { id: string } }>("/v1/parties/:id/confirmable", async (request) => {
    const user = requireUser(request);
    const going = await ctx.db.query("select 1 from party_members where party_id = $1 and user_id = $2 and response = 'going'", [request.params.id, user.id]);
    if (!going.length) throw new HttpError(404, "not_found");
    const rows = await ctx.db.query<{ id: string; user_id: string; display_name: string; kind: string; consumed_at: number; mine: number }>(
      `select d.id, d.user_id, u.display_name, d.kind, d.consumed_at,
              (select count(*)::int from drink_confirmations c where c.drink_id = d.id and c.confirmer_id = $2) as mine
       from drinks d join users u on u.id = d.user_id
       where d.party_id = $1 and d.user_id <> $2 and d.deleted_at is null and d.consumed_at > $3 order by d.consumed_at desc limit 30`,
      [request.params.id, user.id, ctx.now() - 2 * 3_600_000],
    );
    return { drinks: rows.map((r) => ({ id: r.id, userId: r.user_id, name: r.display_name, kind: r.kind, consumedAt: r.consumed_at, confirmedByMe: r.mine > 0 })) };
  });

  app.patch<{ Params: { id: string } }>("/v1/crews/:id/settings", async (request) => {
    const user = requireUser(request);
    const { role } = await assertCrewMember(ctx, request.params.id, user.id);
    if (role !== "admin") throw new HttpError(403, "forbidden");
    const input = z
      .object({
        leaderboardEnabled: z.boolean().optional(),
        timeZone: z.string().min(3).max(60).optional(),
        aiEnabled: z.boolean().optional(),
        publicName: z.boolean().optional(),
        kind: z.enum(CREW_KINDS).optional(),
        open: z.boolean().optional(),
        description: z.string().max(CREW_DESCRIPTION_MAX * 2).transform(oneLine).pipe(z.string().max(CREW_DESCRIPTION_MAX)).optional(),
        category: z.enum(CREW_CATEGORIES).nullable().optional(),
        city: z.string().max(CITY_MAX * 2).transform(oneLine).pipe(z.string().max(CITY_MAX)).nullable().optional(),
      })
      .parse(request.body);
    // COM-08: what the public listing shows is read by strangers: it goes through the filters,
    // and a crew whose name would not pass is not listed.
    assertCleanText(input.description);
    assertCleanText(input.city);
    if (input.open) {
      const name = (await ctx.db.query<{ name: string }>("select name from crews where id = $1", [request.params.id]))[0]?.name;
      assertCleanText(name);
    }
    if (input.kind !== undefined) await ctx.db.query("update crews set kind = $2 where id = $1", [request.params.id, input.kind]);
    // Turning a crew private takes it out of the listing at once: the listing reads this column.
    if (input.open !== undefined) await ctx.db.query("update crews set open = $2 where id = $1", [request.params.id, input.open]);
    if (input.description !== undefined) await ctx.db.query("update crews set description = $2 where id = $1", [request.params.id, input.description]);
    if (input.category !== undefined) await ctx.db.query("update crews set category = $2 where id = $1", [request.params.id, input.category]);
    if (input.city !== undefined) await ctx.db.query("update crews set city = $2 where id = $1", [request.params.id, input.city || null]);
    if (input.open !== undefined || input.description !== undefined || input.category !== undefined || input.city !== undefined || input.kind !== undefined) {
      // The rest of the crew sees the public / private tag and the new details without pulling.
      const members = await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1", [request.params.id]);
      ctx.live.notify(members.map((m) => m.user_id), { type: "crew.changed", crewId: request.params.id });
    }
    if (input.publicName !== undefined) await ctx.db.query("update crews set public_name = $2 where id = $1", [request.params.id, input.publicName]);
    if (input.aiEnabled !== undefined) await ctx.db.query("update crews set ai_enabled = $2 where id = $1", [request.params.id, input.aiEnabled]);
    if (input.leaderboardEnabled !== undefined) {
      await ctx.db.query("update crews set leaderboard_enabled = $2 where id = $1", [request.params.id, input.leaderboardEnabled]);
    }
    if (input.timeZone !== undefined) {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: input.timeZone });
      } catch {
        throw new HttpError(400, "invalid");
      }
      await ctx.db.query("update crews set time_zone = $2 where id = $1", [request.params.id, input.timeZone]);
    }
    return { ok: true };
  });
}
