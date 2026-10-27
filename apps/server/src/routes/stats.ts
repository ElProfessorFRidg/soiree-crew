import type { FastifyInstance } from "fastify";
import { assertCrewMember, HttpError, requireUser, type Context } from "../context";
import { byMonth, byWeekday, crewStreak, milestones } from "../stats";
import { crewTimeZone } from "../territory";
import { nightOf, offsetMinutes } from "../time";

/** RANK-09: drinking-based boards follow the same flag as the main leaderboard. */
const drinkingBoards = () => (process.env.DRINKING_LEADERBOARD ?? "on") !== "off";

/** Minutes after noon, local, so a 1 am first drink sorts after 11 pm. */
function minutesAfterNoon(at: number, timeZone: string): number {
  const local = new Date(at + offsetMinutes(at, timeZone) * 60_000);
  return (((local.getUTCHours() - 12 + 24) % 24) * 60 + local.getUTCMinutes()) % (24 * 60);
}

const average = (values: number[]) => (values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : null);

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
      streak: crewStreak(nights, tonight),
      milestones: milestones(nights.length),
      crewSince: crew.created_at,
      boards,
    };
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
