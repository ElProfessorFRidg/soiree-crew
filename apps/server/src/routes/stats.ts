import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertCrewMember, HttpError, requireUser, type Context } from "../context";
import { anniversary, byMonth, byWeekday, crewStreak, milestoneMoments, milestones, type Moment } from "../stats";
import { crewTimeZone } from "../territory";
import { GAME_WINNER_BADGE, gameWins } from "./games";
import { lastChampions } from "./leaderboards";
import { nightOf, offsetMinutes } from "../time";
import { seasonBounds } from "@crew/territory";

/** RANK-09: drinking-based boards follow the same flag as the main leaderboard. */
const drinkingBoards = () => (process.env.DRINKING_LEADERBOARD ?? "on") !== "off";

/** Minutes after noon, local, so a 1 am first drink sorts after 11 pm. */
function minutesAfterNoon(at: number, timeZone: string): number {
  const local = new Date(at + offsetMinutes(at, timeZone) * 60_000);
  return (((local.getUTCHours() - 12 + 24) % 24) * 60 + local.getUTCMinutes()) % (24 * 60);
}

const average = (values: number[]) => (values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : null);

/**
 * JOY-08: milestones (nights together, anniversaries) and the crew's first venue conquered:
 * the earliest reign at one of its bars. Moments count nights and moments, never drinks.
 */
async function crewMoments(ctx: Context, crewId: string, nights: string[], createdNight: string, tonight: string, timeZone: string): Promise<Moment[]> {
  const moments = milestoneMoments(nights, createdNight, tonight);
  const first = await ctx.db.query<{ started_at: number; user_id: string; display_name: string; name: string }>(
    `select r.started_at, r.user_id, u.display_name, v.name from reigns r join venues v on v.id = r.venue_id and v.crew_id = $1
     join users u on u.id = r.user_id order by r.started_at limit 1`,
    [crewId],
  );
  if (first[0]) {
    moments.push({
      id: "first-conquest",
      kind: "firstConquest",
      value: null,
      night: nightOf(first[0].started_at, timeZone),
      venueName: first[0].name,
      userId: first[0].user_id,
      name: first[0].display_name,
    });
  }
  // push: crew.milestone (once, on the night a moment is reached)
  return moments.sort((a, b) => a.night.localeCompare(b.night));
}

export function statsRoutes(app: FastifyInstance, ctx: Context): void {
  /** N-14 habits, JOY-06 streak, JOY-08 milestones and RANK-05 secondary boards for one crew. */
  app.get<{ Params: { id: string } }>("/v1/crews/:id/stats", async (request) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const crewId = request.params.id;
    const timeZone = await crewTimeZone(ctx.db, crewId);
    const now = ctx.now();
    const tonight = nightOf(now, timeZone);

    // A night out together: a party that started, with at least two members going.
    const parties = await ctx.db.query<{ id: string; starts_at: number; going: number }>(
      `select p.id, p.starts_at, (select count(*)::int from party_members m where m.party_id = p.id and m.response = 'going') as going
       from parties p where p.crew_id = $1 and p.starts_at <= $2`,
      [crewId, now],
    );
    const together = parties.filter((p) => p.going >= 2);
    const nights = [...new Set(together.map((p) => nightOf(p.starts_at, timeZone)))];
    const crew = (await ctx.db.query<{ created_at: number; leaderboard_enabled: boolean }>("select created_at, leaderboard_enabled from crews where id = $1", [crewId]))[0]!;

    const topVenues = await ctx.db.query<{ venue_id: string; name: string; visits: number }>(
      `select c.venue_id, v.name, count(*)::int as visits from check_ins c join venues v on v.id = c.venue_id and v.crew_id = $1 and v.kind <> 'home'
       join crew_members m on m.crew_id = $1 and m.user_id = c.user_id
       where c.verdict = 'accepted' and c.private = false group by c.venue_id, v.name order by visits desc limit 5`,
      [crewId],
    );

    // RANK-05: members who stay on the board; each metric counts only what was earned in this crew.
    const members = await ctx.db.query<{ user_id: string; display_name: string }>(
      "select m.user_id, u.display_name from crew_members m join users u on u.id = m.user_id where m.crew_id = $1 and m.leaderboard_opt_out = false",
      [crewId],
    );
    // N-34: seniority and badges for what keeps a crew going, never for drinking.
    const everyone = await ctx.db.query<{ user_id: string; display_name: string; joined_at: number; organised: number; home_safe: number }>(
      `select m.user_id, u.display_name, m.joined_at,
              (select count(*)::int from parties p where p.crew_id = $1 and p.created_by = m.user_id and p.starts_at <= $2) as organised,
              (select count(*)::int from party_members pm join parties p on p.id = pm.party_id
                 where p.crew_id = $1 and pm.user_id = m.user_id and pm.home_safe_at is not null) as home_safe
       from crew_members m join users u on u.id = m.user_id where m.crew_id = $1 order by m.joined_at`,
      [crewId, now],
    );
    const ids = members.map((m) => m.user_id);
    const going = ids.length
      ? await ctx.db.query<{ user_id: string; party_id: string; designated_driver: boolean; home_safe_at: number | null }>(
          `select m.user_id, m.party_id, m.designated_driver, m.home_safe_at from party_members m join parties p on p.id = m.party_id
           where p.crew_id = $1 and m.response = 'going' and m.user_id = any($2::uuid[]) and p.starts_at <= $3`,
          [crewId, ids, now],
        )
      : [];
    const partyIds = [...new Set(going.map((g) => g.party_id))];
    const drinks = partyIds.length
      ? await ctx.db.query<{ user_id: string; party_id: string; consumed_at: number }>(
          "select user_id, party_id, consumed_at from drinks where party_id = any($1::uuid[]) and deleted_at is null and kind <> 'soft'",
          [partyIds],
        )
      : [];
    const water = partyIds.length
      ? await ctx.db.query<{ user_id: string; party_id: string }>("select user_id, party_id from water where party_id = any($1::uuid[]) and deleted_at is null", [partyIds])
      : [];
    const reigns = ids.length
      ? await ctx.db.query<{ user_id: string; n: number }>(
          `select r.user_id, count(*)::int as n from reigns r join venues v on v.id = r.venue_id and v.crew_id = $1
           where r.ended_at is null and r.user_id = any($2::uuid[]) group by r.user_id`,
          [crewId, ids],
        )
      : [];
    // RANK-05, N-34: games won in the crew; RANK-04: champions of last week and last month.
    const wins = await gameWins(ctx.db, crewId);
    const champions = crew.leaderboard_enabled
      ? { nights: await lastChampions(ctx, crewId, user.id, "nights"), games: await lastChampions(ctx, crewId, user.id, "games") }
      : null;

    const boards = members.map((m) => {
      const mine = going.filter((g) => g.user_id === m.user_id);
      const firsts = mine
        .map((g) => drinks.filter((d) => d.user_id === m.user_id && d.party_id === g.party_id).map((d) => d.consumed_at))
        .filter((list) => list.length)
        .map((list) => minutesAfterNoon(Math.min(...list), timeZone));
      const homes = mine.filter((g) => g.home_safe_at !== null).map((g) => minutesAfterNoon(g.home_safe_at!, timeZone));
      const myDrinks = drinks.filter((d) => d.user_id === m.user_id).length;
      const myWater = water.filter((w) => w.user_id === m.user_id).length;
      const drove = mine.filter((g) => g.designated_driver && !drinks.some((d) => d.user_id === m.user_id && d.party_id === g.party_id)).length;
      return {
        userId: m.user_id,
        name: m.display_name,
        nights: mine.length,
        venuesRuled: reigns.find((r) => r.user_id === m.user_id)?.n ?? 0,
        lastHome: average(homes),
        soberDriver: drove,
        gamesWon: wins.get(m.user_id) ?? 0,
        ...(drinkingBoards() && crew.leaderboard_enabled
          ? { firstDrink: average(firsts), hydration: myDrinks >= 5 ? Math.round((myWater / myDrinks) * 100) / 100 : null }
          : {}),
      };
    });

    return {
      timeZone,
      totalNights: nights.length,
      weekdays: byWeekday(nights),
      months: byMonth(nights, tonight),
      topVenues: topVenues.map((v) => ({ venueId: v.venue_id, name: v.name, visits: v.visits })),
      streak: crewStreak(nights, tonight),
      milestones: milestones(nights.length),
      anniversary: anniversary(nightOf(crew.created_at, timeZone), tonight),
      moments: await crewMoments(ctx, crewId, nights, nightOf(crew.created_at, timeZone), tonight, timeZone),
      crewSince: crew.created_at,
      boards,
      honours: everyone.map((m) => {
        const board = boards.find((b) => b.userId === m.user_id);
        const badges: string[] = [];
        if (m.organised >= 3) badges.push("organiser");
        if (m.home_safe >= 5) badges.push("homeSafe");
        if ((board?.soberDriver ?? 0) >= 3) badges.push("soberDriver");
        if (typeof board?.hydration === "number" && board.hydration >= 0.5) badges.push("hydrated");
        if ((board?.venuesRuled ?? 0) >= 1) badges.push("boss");
        if ((wins.get(m.user_id) ?? 0) >= GAME_WINNER_BADGE) badges.push("gameWinner");
        const titles: { period: "week" | "month"; board: "nights" | "games" }[] = [];
        for (const boardName of ["nights", "games"] as const) {
          for (const period of ["week", "month"] as const) if (champions?.[boardName][period].includes(m.user_id)) titles.push({ period, board: boardName });
        }
        if (titles.length) badges.push("champion");
        return { userId: m.user_id, name: m.display_name, joinedAt: m.joined_at, organised: m.organised, homeSafe: m.home_safe, badges, titles };
      }),
    };
  });

  /**
   * N-15: the crew's month or year as a story. Facts about the crew together, never a drinking
   * ranking: drink and water totals only show where the crew keeps the leaderboard on.
   */
  app.get<{ Params: { id: string }; Querystring: { period?: string; key?: string } }>("/v1/crews/:id/wrapped", async (request) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const crewId = request.params.id;
    const timeZone = await crewTimeZone(ctx.db, crewId);
    const now = ctx.now();
    const period = z.enum(["month", "year"]).default("month").parse(request.query.period);
    const thisMonth = nightOf(now, timeZone).slice(0, 7);
    const key = (period === "month" ? z.string().regex(/^\d{4}-\d{2}$/) : z.string().regex(/^\d{4}$/))
      .default(period === "month" ? thisMonth : thisMonth.slice(0, 4))
      .parse(request.query.key);
    const offset = offsetMinutes(Date.parse(`${period === "month" ? key : `${key}-06`}-15T12:00:00Z`), timeZone);
    const from = seasonBounds(period === "month" ? key : `${key}-01`, offset).start;
    const to = period === "month" ? seasonBounds(key, offset).end : seasonBounds(`${Number(key) + 1}-01`, offset).start;

    const parties = await ctx.db.query<{ id: string; name: string; starts_at: number; going: number }>(
      `select p.id, p.name, p.starts_at, (select count(*)::int from party_members m where m.party_id = p.id and m.response = 'going') as going
       from parties p where p.crew_id = $1 and p.starts_at >= $2 and p.starts_at < $3 and p.starts_at <= $4 order by p.starts_at`,
      [crewId, from, to, now],
    );
    const together = parties.filter((p) => p.going >= 2);
    const nights = [...new Set(together.map((p) => nightOf(p.starts_at, timeZone)))];
    const ids = together.map((p) => p.id);
    const presence = ids.length
      ? await ctx.db.query<{ user_id: string; display_name: string; n: number; home: number; hidden: boolean }>(
          // N-37: the story can leave the crew, so people who said no are counted, never named.
          `select m.user_id, u.display_name, count(*)::int as n, count(m.home_safe_at)::int as home, coalesce(bool_or(p.story_opt_out), false) as hidden
           from party_members m join users u on u.id = m.user_id left join profiles p on p.user_id = m.user_id
           where m.party_id = any($1::uuid[]) and m.response = 'going' group by m.user_id, u.display_name order by n desc, u.display_name`,
          [ids],
        )
      : [];
    const venues = await ctx.db.query<{ name: string; visits: number }>(
      `select v.name, count(*)::int as visits from check_ins c join venues v on v.id = c.venue_id and v.crew_id = $1 and v.kind <> 'home'
       join crew_members m on m.crew_id = $1 and m.user_id = c.user_id
       where c.verdict = 'accepted' and c.private = false and c.at >= $2 and c.at < $3 group by v.name order by visits desc, v.name`,
      [crewId, from, to],
    );
    const quote = ids.length
      ? (
          await ctx.db.query<{ text: string; said_by: string | null; votes: number }>(
            `select q.text, q.said_by, (select count(*)::int from party_quote_votes v where v.quote_id = q.id) as votes
             from party_quotes q where q.party_id = any($1::uuid[]) order by votes desc, q.created_at limit 1`,
            [ids],
          )
        )[0]
      : undefined;
    const crew = (await ctx.db.query<{ leaderboard_enabled: boolean }>("select leaderboard_enabled from crews where id = $1", [crewId]))[0]!;
    const showDrinks = drinkingBoards() && crew.leaderboard_enabled && ids.length > 0;
    const totals = showDrinks
      ? (
          await ctx.db.query<{ drinks: number; water: number }>(
            `select (select count(*)::int from drinks where party_id = any($1::uuid[]) and deleted_at is null and kind <> 'soft') as drinks,
                    (select count(*)::int from water where party_id = any($1::uuid[]) and deleted_at is null) as water`,
            [ids],
          )
        )[0]
      : undefined;
    const weekdays = byWeekday(nights);
    const busiest = weekdays.indexOf(Math.max(...weekdays));
    const biggest = [...together].sort((a, b) => b.going - a.going || a.starts_at - b.starts_at)[0];
    const nameOf = async (id: string | null) =>
      id ? ((await ctx.db.query<{ display_name: string }>("select display_name from users where id = $1", [id]))[0]?.display_name ?? null) : null;
    return {
      period,
      key,
      nights: nights.length,
      parties: together.length,
      venuesVisited: venues.length,
      topVenue: venues[0] ? { name: venues[0].name, visits: venues[0].visits } : null,
      regulars: presence.filter((p) => !p.hidden).slice(0, 3).map((p) => ({ userId: p.user_id, name: p.display_name, nights: p.n })),
      homeSafe: presence.reduce((sum, p) => sum + p.home, 0),
      busiestWeekday: nights.length ? busiest + 1 : null,
      biggestNight: biggest ? { name: biggest.name, at: biggest.starts_at, people: biggest.going } : null,
      quote: quote ? { text: quote.text, saidBy: await nameOf(quote.said_by), votes: quote.votes } : null,
      ...(totals ? { drinks: totals.drinks, water: totals.water } : {}),
    };
  });

  /** N-09: the crew's prices at a bar: the median of each person's latest price, per drink, from the last 180 days. */
  app.get<{ Params: { id: string } }>("/v1/venues/:id/prices", async (request) => {
    const user = requireUser(request);
    const venue = (await ctx.db.query<{ crew_id: string }>("select crew_id from venues where id = $1", [request.params.id]))[0];
    if (!venue) throw new HttpError(404, "not_found");
    await assertCrewMember(ctx, venue.crew_id, user.id);
    const rows = await ctx.db.query<{ kind: string; amount: number; currency: string }>(
      "select kind, amount, currency from venue_prices where venue_id = $1 and at > $2",
      [request.params.id, ctx.now() - 180 * 86_400_000],
    );
    const groups = new Map<string, number[]>();
    for (const r of rows) {
      const key = `${r.kind}|${r.currency}`;
      groups.set(key, [...(groups.get(key) ?? []), r.amount]);
    }
    return {
      prices: [...groups.entries()].map(([key, amounts]) => {
        const [kind, currency] = key.split("|") as [string, string];
        const sorted = [...amounts].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
        return { kind, currency, amount: median, reports: amounts.length };
      }),
    };
  });

  app.put<{ Params: { id: string } }>("/v1/venues/:id/prices", async (request) => {
    const user = requireUser(request);
    const venue = (await ctx.db.query<{ crew_id: string }>("select crew_id from venues where id = $1", [request.params.id]))[0];
    if (!venue) throw new HttpError(404, "not_found");
    await assertCrewMember(ctx, venue.crew_id, user.id);
    const input = z
      .object({ kind: z.string().min(1).max(30), amount: z.number().int().positive().max(100_000), currency: z.string().regex(/^[A-Z]{3}$/) })
      .parse(request.body);
    await ctx.db.query(
      `insert into venue_prices (venue_id, user_id, kind, amount, currency, at) values ($1, $2, $3, $4, $5, $6)
       on conflict (venue_id, user_id, kind) do update set amount = excluded.amount, currency = excluded.currency, at = excluded.at`,
      [request.params.id, user.id, input.kind, input.amount, input.currency, ctx.now()],
    );
    return { ok: true };
  });

  /** N-12: what a venue is to the crew: visits, nights, people, and its best nights. */
  app.get<{ Params: { id: string } }>("/v1/venues/:id/stats", async (request) => {
    const user = requireUser(request);
    const venue = (await ctx.db.query<{ crew_id: string }>("select crew_id from venues where id = $1", [request.params.id]))[0];
    if (!venue) throw new HttpError(404, "not_found");
    await assertCrewMember(ctx, venue.crew_id, user.id);
    const timeZone = await crewTimeZone(ctx.db, venue.crew_id);
    const checkIns = await ctx.db.query<{ user_id: string; party_id: string | null; at: number; ended_at: number | null; last_proof_at: number }>(
      "select user_id, party_id, at, ended_at, last_proof_at from check_ins where venue_id = $1 and verdict = 'accepted' and private = false",
      [request.params.id],
    );
    const nights = new Map<string, Set<string>>();
    for (const c of checkIns) {
      const night = nightOf(c.at, timeZone);
      nights.set(night, (nights.get(night) ?? new Set()).add(c.user_id));
    }
    // Drinks logged while someone was checked in here, per person and night.
    const perStay: number[] = [];
    for (const c of checkIns) {
      const until = c.ended_at ?? c.last_proof_at;
      const rows = await ctx.db.query<{ n: number }>(
        "select count(*)::int as n from drinks where user_id = $1 and deleted_at is null and kind <> 'soft' and consumed_at between $2 and $3",
        [c.user_id, c.at, until],
      );
      perStay.push(rows[0]!.n);
    }
    const best = [...nights.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 3);
    return {
      visits: checkIns.length,
      nights: nights.size,
      people: new Set(checkIns.map((c) => c.user_id)).size,
      averageDrinks: perStay.length ? Math.round((perStay.reduce((s, v) => s + v, 0) / perStay.length) * 10) / 10 : null,
      bestNights: best.map(([night, people]) => ({ night, people: people.size })),
    };
  });
}
