import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertCrewMember, HttpError, requireUser, type Context } from "../context";
import { priceChange, spendPerVisit } from "../hours";
import { byMonth, byWeekday, calendarNights, crewStreak, milestones, nightsBetween, outings } from "../stats";
import { personalClock, personalHabits, sharingPeople } from "../habits";
import { crewTimeZone } from "../territory";
import { dayBoundaryOf, nightOf, offsetMinutes } from "../time";
import { seasonBounds } from "@crew/territory";

/** RANK-09: drinking-based boards follow the same flag as the main leaderboard. */
const drinkingBoards = () => (process.env.DRINKING_LEADERBOARD ?? "on") !== "off";

/** Minutes after noon, local, so a 1 am first drink sorts after 11 pm. */
function minutesAfterNoon(at: number, timeZone: string): number {
  const local = new Date(at + offsetMinutes(at, timeZone) * 60_000);
  return (((local.getUTCHours() - 12 + 24) % 24) * 60 + local.getUTCMinutes()) % (24 * 60);
}

const average = (values: number[]) => (values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : null);

/** N-14: the crew calendar covers 26 weeks, which still fits a phone's width at a readable size. */
const CALENDAR_WEEKS = 26;
const HOUR_MS = 3_600_000;

type TogetherParty = { id: string; starts_at: number; going: number };

/**
 * N-16: narrows a crew's nights together to one venue (a member checked in there, publicly) and/or
 * one person (they were going). The person must be me or someone whose nights I may see (PROF-01).
 */
async function filterCrewNights(
  ctx: Context,
  q: { crewId: string; viewerId: string; timeZone: string; boundary: number; venueId: string | undefined; userId: string | undefined },
  parties: TogetherParty[],
): Promise<{ together: TogetherParty[]; options: { venues: { id: string; name: string }[]; people: { userId: string; name: string }[] } }> {
  const venues = await ctx.db.query<{ id: string; name: string }>(
    `select distinct v.id, v.name from venues v join check_ins c on c.venue_id = v.id and c.verdict = 'accepted' and c.private = false
     join crew_members m on m.crew_id = $1 and m.user_id = c.user_id
     where v.crew_id = $1 and v.kind <> 'home' order by v.name`,
    [q.crewId],
  );
  const people = await sharingPeople(ctx, q.viewerId, q.crewId);
  let together = parties;
  if (q.venueId) {
    if (!venues.some((v) => v.id === q.venueId)) throw new HttpError(404, "not_found");
    const visits = await ctx.db.query<{ at: number; party_id: string | null }>(
      `select c.at, c.party_id from check_ins c join crew_members m on m.crew_id = $1 and m.user_id = c.user_id
       where c.venue_id = $2 and c.verdict = 'accepted' and c.private = false`,
      [q.crewId, q.venueId],
    );
    const nights = new Set(visits.map((v) => nightOf(v.at, q.timeZone, q.boundary)));
    const linked = new Set(visits.map((v) => v.party_id));
    together = together.filter((p) => linked.has(p.id) || nights.has(nightOf(p.starts_at, q.timeZone, q.boundary)));
  }
  if (q.userId) {
    if (q.userId !== q.viewerId && !people.some((p) => p.userId === q.userId)) throw new HttpError(403, "not_visible");
    const going = together.length
      ? await ctx.db.query<{ party_id: string }>("select party_id from party_members where user_id = $1 and response = 'going' and party_id = any($2::uuid[])", [
          q.userId,
          together.map((p) => p.id),
        ])
      : [];
    const theirs = new Set(going.map((g) => g.party_id));
    together = together.filter((p) => theirs.has(p.id));
  }
  return { together, options: { venues, people } };
}

/**
 * N-14: hours out, from what was logged: each night of a party runs from its first sign of life
 * (a drink, a check-in) to its last (a drink, leaving a venue, getting home). Nights with nothing
 * logged are left out rather than guessed.
 */
async function crewHoursOut(ctx: Context, parties: TogetherParty[]): Promise<{ total: number; perNight: number | null; nights: number }> {
  const ids = parties.map((p) => p.id);
  if (!ids.length) return { total: 0, perNight: null, nights: 0 };
  const rows = await ctx.db.query<{ party_id: string; at: number; until: number }>(
    `select d.party_id, d.consumed_at as at, d.consumed_at as until from drinks d
       join party_members m on m.party_id = d.party_id and m.user_id = d.user_id and m.response = 'going'
       where d.party_id = any($1::uuid[]) and d.deleted_at is null and d.consumed_at > 0
     union all
     select c.party_id, c.at, least(coalesce(c.ended_at, c.last_proof_at), c.at + 43200000) as until from check_ins c
       where c.party_id = any($1::uuid[]) and c.verdict = 'accepted'
     union all
     select m.party_id, m.home_safe_at as at, m.home_safe_at as until from party_members m
       where m.party_id = any($1::uuid[]) and m.response = 'going' and m.home_safe_at is not null`,
    [ids],
  );
  const spans = outings(rows.map((r) => ({ key: r.party_id, from: Number(r.at), to: Number(r.until) })))
    .map((s) => (s.last - s.first) / HOUR_MS)
    .filter((h) => h > 0);
  const total = spans.reduce((s, h) => s + h, 0);
  return { total: Math.round(total * 10) / 10, perNight: spans.length ? Math.round((total / spans.length) * 10) / 10 : null, nights: spans.length };
}

export function statsRoutes(app: FastifyInstance, ctx: Context): void {
  /** N-14 habits, JOY-06 streak, JOY-08 milestones and RANK-05 secondary boards for one crew. */
  app.get<{ Params: { id: string }; Querystring: { venueId?: string; userId?: string } }>("/v1/crews/:id/stats", async (request) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const crewId = request.params.id;
    const filter = z.object({ venueId: z.string().uuid().optional(), userId: z.string().uuid().optional() }).parse(request.query);
    const timeZone = await crewTimeZone(ctx.db, crewId);
    // QOL-02: nights as the person asking counts them.
    const boundary = await dayBoundaryOf(ctx.db, user.id);
    const now = ctx.now();
    const tonight = nightOf(now, timeZone, boundary);

    // A night out together: a party that started, with at least two members going.
    const parties = await ctx.db.query<{ id: string; starts_at: number; going: number }>(
      `select p.id, p.starts_at, (select count(*)::int from party_members m where m.party_id = p.id and m.response = 'going') as going
       from parties p where p.crew_id = $1 and p.starts_at <= $2`,
      [crewId, now],
    );
    const allTogether = parties.filter((p) => p.going >= 2);
    // JOY-06, JOY-08: the streak and milestones belong to the whole crew, whatever the filter.
    const allNights = [...new Set(allTogether.map((p) => nightOf(p.starts_at, timeZone, boundary)))];
    const filtered = await filterCrewNights(ctx, { crewId, viewerId: user.id, timeZone, boundary, venueId: filter.venueId, userId: filter.userId }, allTogether);
    const together = filtered.together;
    const nights = [...new Set(together.map((p) => nightOf(p.starts_at, timeZone, boundary)))];
    const hoursOut = await crewHoursOut(ctx, together);
    const crew = (await ctx.db.query<{ created_at: number; leaderboard_enabled: boolean }>("select created_at, leaderboard_enabled from crews where id = $1", [crewId]))[0]!;

    const topVenues = await ctx.db.query<{ venue_id: string; name: string; visits: number }>(
      `select c.venue_id, v.name, count(*)::int as visits from check_ins c join venues v on v.id = c.venue_id and v.crew_id = $1 and v.kind <> 'home'
       join crew_members m on m.crew_id = $1 and m.user_id = c.user_id
       where c.verdict = 'accepted' and c.private = false and ($2::uuid is null or c.user_id = $2) group by c.venue_id, v.name order by visits desc limit 5`,
      [crewId, filter.userId ?? null],
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
      streak: crewStreak(allNights, tonight),
      milestones: milestones(allNights.length),
      // N-16: all nights together, when the figures above are filtered.
      allNights: allNights.length,
      // N-14: half a year of nights for the calendar; the phone lays the weeks out from its own first weekday.
      tonight,
      calendar: calendarNights(nights, tonight, CALENDAR_WEEKS),
      hoursOut,
      // N-16: what the figures above can be narrowed to.
      filters: filtered.options,
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
        return { userId: m.user_id, name: m.display_name, joinedAt: m.joined_at, organised: m.organised, homeSafe: m.home_safe, badges };
      }),
    };
  });

  /**
   * N-13, N-16: my habits (usual first drink, pace, usual leaving time) and the nights a venue or a
   * person narrows my figures to. The phone keeps my drinks; the server knows where I was and
   * with whom, so it hands back night keys (my boundary, my time zone) for the phone to filter on.
   */
  app.get<{ Querystring: { venueId?: string; withUserId?: string } }>("/v1/me/stats", async (request) => {
    const user = requireUser(request);
    const filter = z.object({ venueId: z.string().uuid().optional(), withUserId: z.string().uuid().optional() }).parse(request.query);
    const clock = await personalClock(ctx, user.id);
    const keyOf = (at: number) => nightOf(at, clock.timeZone, clock.dayBoundaryHour);
    const venues = await ctx.db.query<{ id: string; name: string }>(
      `select distinct v.id, v.name from check_ins c join venues v on v.id = c.venue_id
       join crew_members m on m.crew_id = v.crew_id and m.user_id = c.user_id
       where c.user_id = $1 and c.verdict = 'accepted' order by v.name`,
      [user.id],
    );
    const people = await sharingPeople(ctx, user.id);
    let nights: Set<string> | null = null;
    const narrow = (keys: Iterable<string>) => {
      const next = new Set(keys);
      nights = nights === null ? next : new Set([...nights].filter((k) => next.has(k)));
    };
    if (filter.venueId) {
      if (!venues.some((v) => v.id === filter.venueId)) throw new HttpError(404, "not_found");
      const visits = await ctx.db.query<{ at: number }>("select at from check_ins where user_id = $1 and venue_id = $2 and verdict = 'accepted'", [user.id, filter.venueId]);
      narrow(visits.map((v) => keyOf(Number(v.at))));
    }
    if (filter.withUserId) {
      if (!people.some((p) => p.userId === filter.withUserId)) throw new HttpError(403, "not_visible");
      const shared = await ctx.db.query<{ starts_at: number; ends_at: number; closed_at: number | null }>(
        `select p.starts_at, p.ends_at, p.closed_at from parties p
         join party_members a on a.party_id = p.id and a.user_id = $1 and a.response = 'going'
         join party_members b on b.party_id = p.id and b.user_id = $2 and b.response = 'going'
         where p.starts_at <= $3`,
        [user.id, filter.withUserId, ctx.now()],
      );
      narrow(shared.flatMap((p) => nightsBetween(Number(p.starts_at), Math.min(Number(p.closed_at ?? p.ends_at), Number(p.ends_at), ctx.now()), keyOf)));
    }
    const only: Set<string> | null = nights;
    return {
      timeZone: clock.timeZone,
      dayBoundaryHour: clock.dayBoundaryHour,
      filters: { venues, people },
      nights: only === null ? null : [...only].sort(),
      habits: await personalHabits(ctx, user.id, clock, only ?? undefined),
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
    // QOL-02: nights as the person asking counts them.
    const boundary = await dayBoundaryOf(ctx.db, user.id);
    const now = ctx.now();
    const period = z.enum(["month", "year"]).default("month").parse(request.query.period);
    const thisMonth = nightOf(now, timeZone, boundary).slice(0, 7);
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
    const nights = [...new Set(together.map((p) => nightOf(p.starts_at, timeZone, boundary)))];
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
    // N-09: every price ever noted here, and the last change, flagged when it is recent.
    const history = await ctx.db.query<{ kind: string; amount: number; currency: string; at: number }>(
      "select kind, amount, currency, at from venue_price_history where venue_id = $1 order by at",
      [request.params.id],
    );
    return {
      prices: [...groups.entries()].map(([key, amounts]) => {
        const [kind, currency] = key.split("|") as [string, string];
        const sorted = [...amounts].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
        const points = history.filter((h) => h.kind === kind && h.currency === currency);
        const change = priceChange(points, ctx.now());
        return {
          kind,
          currency,
          amount: median,
          reports: amounts.length,
          change,
          history: points.slice(-10).reverse().map((p) => ({ amount: p.amount, at: Number(p.at) })),
        };
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
    await ctx.db.transaction(async (tx) => {
      await tx.query(
        `insert into venue_prices (venue_id, user_id, kind, amount, currency, at) values ($1, $2, $3, $4, $5, $6)
         on conflict (venue_id, user_id, kind) do update set amount = excluded.amount, currency = excluded.currency, at = excluded.at`,
        [request.params.id, user.id, input.kind, input.amount, input.currency, ctx.now()],
      );
      // N-09: the history keeps every note; the row above is only each person's latest.
      await tx.query("insert into venue_price_history (id, venue_id, user_id, kind, amount, currency, at) values ($1, $2, $3, $4, $5, $6, $7)", [
        randomUUID(),
        request.params.id,
        user.id,
        input.kind,
        input.amount,
        input.currency,
        ctx.now(),
      ]);
    });
    return { ok: true };
  });

  /** N-12: what a venue is to the crew: visits, nights, people, and its best nights. */
  app.get<{ Params: { id: string } }>("/v1/venues/:id/stats", async (request) => {
    const user = requireUser(request);
    const venue = (await ctx.db.query<{ crew_id: string }>("select crew_id from venues where id = $1", [request.params.id]))[0];
    if (!venue) throw new HttpError(404, "not_found");
    await assertCrewMember(ctx, venue.crew_id, user.id);
    const timeZone = await crewTimeZone(ctx.db, venue.crew_id);
    // QOL-02: nights as the person asking counts them.
    const boundary = await dayBoundaryOf(ctx.db, user.id);
    const checkIns = await ctx.db.query<{ user_id: string; party_id: string | null; at: number; ended_at: number | null; last_proof_at: number }>(
      "select user_id, party_id, at, ended_at, last_proof_at from check_ins where venue_id = $1 and verdict = 'accepted' and private = false",
      [request.params.id],
    );
    const nights = new Map<string, Set<string>>();
    for (const c of checkIns) {
      const night = nightOf(c.at, timeZone, boundary);
      nights.set(night, (nights.get(night) ?? new Set()).add(c.user_id));
    }
    // Drinks logged while someone was checked in here, per person and night.
    const perStay: number[] = [];
    const stayKinds: string[][] = [];
    for (const c of checkIns) {
      const until = c.ended_at ?? c.last_proof_at;
      const rows = await ctx.db.query<{ kind: string }>(
        "select kind from drinks where user_id = $1 and deleted_at is null and consumed_at between $2 and $3",
        [c.user_id, c.at, until],
      );
      perStay.push(rows.filter((r) => r.kind !== "soft").length);
      stayKinds.push(rows.map((r) => r.kind));
    }
    // N-12: average spend per visit, the drinks of each stay at the crew's prices here.
    const priceRows = await ctx.db.query<{ kind: string; amount: number; currency: string }>(
      "select kind, amount, currency from venue_prices where venue_id = $1 and at > $2",
      [request.params.id, ctx.now() - 180 * 86_400_000],
    );
    const averageSpend = spendPerVisit(stayKinds, priceRows);
    const best = [...nights.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 3);
    return {
      visits: checkIns.length,
      nights: nights.size,
      people: new Set(checkIns.map((c) => c.user_id)).size,
      averageDrinks: perStay.length ? Math.round((perStay.reduce((s, v) => s + v, 0) / perStay.length) * 10) / 10 : null,
      averageSpend,
      bestNights: best.map(([night, people]) => ({ night, people: people.size })),
    };
  });
}
