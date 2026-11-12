import type { Context } from "./context";
import { audiencesOf, canSee } from "./profileRules";
import { median, usualTime } from "./stats";
import { nightOf, offsetMinutes, userClock } from "./time";

const HOUR_MS = 3_600_000;

export interface PersonalClock {
  timeZone: string;
  dayBoundaryHour: number;
}

/**
 * QOL-02: a person's own nights use their own boundary and the time zone their phone reported;
 * before any report, the time zone of their first crew stands in.
 */
export async function personalClock(ctx: Context, userId: string): Promise<PersonalClock> {
  const clock = await userClock(ctx.db, userId);
  if (clock.timeZone) return { timeZone: clock.timeZone, dayBoundaryHour: clock.dayBoundaryHour };
  const crew = await ctx.db.query<{ time_zone: string }>(
    "select c.time_zone from crew_members m join crews c on c.id = m.crew_id where m.user_id = $1 order by m.joined_at limit 1",
    [userId],
  );
  return { timeZone: crew[0]?.time_zone ?? "Europe/Paris", dayBoundaryHour: clock.dayBoundaryHour };
}

/**
 * N-16: the people a viewer may filter figures by: crew mates whose "nights" profile section is
 * open to them (PROF-01), never someone either side blocked. The viewer is never in the list.
 */
export async function sharingPeople(ctx: Context, viewerId: string, crewId?: string): Promise<{ userId: string; name: string }[]> {
  const rows = await ctx.db.query<{ user_id: string; display_name: string; audiences: string | null }>(
    `select distinct u.id as user_id, u.display_name, p.audiences from crew_members me
     join crew_members m on m.crew_id = me.crew_id and m.user_id <> me.user_id
     join users u on u.id = m.user_id left join profiles p on p.user_id = u.id
     where me.user_id = $1 and ($2::uuid is null or me.crew_id = $2)
       and not exists (select 1 from blocks b where (b.blocker = $1 and b.blocked = u.id) or (b.blocker = u.id and b.blocked = $1))
     order by u.display_name`,
    [viewerId, crewId ?? null],
  );
  const friends = new Set(
    (
      await ctx.db.query<{ other: string }>(
        "select case when user_a = $1 then user_b else user_a end as other from friendships where (user_a = $1 or user_b = $1) and status = 'accepted'",
        [viewerId],
      )
    ).map((f) => f.other),
  );
  return rows
    .filter((r) => canSee(audiencesOf(r.audiences ? (JSON.parse(r.audiences) as Record<string, unknown>) : {}).nights, { me: false, crewMate: true, friend: friends.has(r.user_id) }))
    .map((r) => ({ userId: r.user_id, name: r.display_name }));
}

export interface OwnNight {
  /** Night key on the person's own boundary and time zone. */
  key: string;
  /** Alcoholic drinks of the night, in time order. Empty for a party spent without alcohol. */
  times: number[];
  /** When the night happened: its last drink, or the party's start when nothing was drunk. */
  at: number;
  withCrew: boolean;
}

/**
 * Outside a crew party we trust the person: a night is any night with an alcoholic drink of their own,
 * party or not, on their own day boundary and time zone, plus any party they went to, drinking or not. It is "with the crew" when one of its drinks belongs
 * to a party or they were going to a party that night; otherwise it is solo.
 */
export async function ownNights(ctx: Context, ownerId: string): Promise<{ nights: OwnNight[]; timeZone: string }> {
  const clock = await personalClock(ctx, ownerId);
  const keyOf = (at: number) => nightOf(at, clock.timeZone, clock.dayBoundaryHour);
  const drinks = await ctx.db.query<{ party_id: string | null; consumed_at: number }>(
    "select party_id, consumed_at from drinks where user_id = $1 and deleted_at is null and kind <> 'soft' and consumed_at > 0 order by consumed_at",
    [ownerId],
  );
  const going = await ctx.db.query<{ starts_at: number }>(
    "select p.starts_at from party_members m join parties p on p.id = m.party_id where m.user_id = $1 and m.response = 'going'",
    [ownerId],
  );
  const crewKeys = new Set(going.map((g) => keyOf(Number(g.starts_at))));
  const byKey = new Map<string, OwnNight>();
  for (const d of drinks) {
    const key = keyOf(Number(d.consumed_at));
    const entry = byKey.get(key) ?? { key, times: [], at: 0, withCrew: crewKeys.has(key) };
    entry.times.push(Number(d.consumed_at));
    entry.at = Number(d.consumed_at);
    if (d.party_id) entry.withCrew = true;
    byKey.set(key, entry);
  }
  // A party spent on water or soft drinks is still a night out.
  const now = ctx.now();
  for (const g of going) {
    const at = Number(g.starts_at);
    const key = keyOf(at);
    if (at <= now && !byKey.has(key)) byKey.set(key, { key, times: [], at, withCrew: true });
  }
  return { nights: [...byKey.values()], timeZone: clock.timeZone };
}

export interface Habits {
  /** Nights with something logged that the figures come from. */
  nights: number;
  /** Minutes after noon, local. */
  usualFirstDrink: number | null;
  usualPacePerHour: number | null;
  /** N-13: median end of the night, minutes after noon, local. */
  usualLeaving: number | null;
}

/**
 * N-13: a person's habits from what the server holds: drinks, check-ins and "home safe". A night
 * ends with its last sign of life: the last drink, leaving a venue, or getting home. Check-ins and
 * getting home belong to the night they started in, even when they end after the day boundary.
 * `only` restricts the figures to some nights (N-16 filters).
 */
export async function personalHabits(ctx: Context, userId: string, clock: PersonalClock, only?: ReadonlySet<string>): Promise<Habits> {
  const keyOf = (at: number) => nightOf(at, clock.timeZone, clock.dayBoundaryHour);
  const drinks = await ctx.db.query<{ consumed_at: number }>(
    "select consumed_at from drinks where user_id = $1 and deleted_at is null and kind <> 'soft' and consumed_at > 0 order by consumed_at",
    [userId],
  );
  const checkIns = await ctx.db.query<{ at: number; until: number }>(
    "select at, coalesce(ended_at, last_proof_at) as until from check_ins where user_id = $1 and verdict = 'accepted'",
    [userId],
  );
  const homes = await ctx.db.query<{ starts_at: number; home_safe_at: number }>(
    "select p.starts_at, m.home_safe_at from party_members m join parties p on p.id = m.party_id where m.user_id = $1 and m.home_safe_at is not null",
    [userId],
  );

  const nights = new Map<string, { drinks: number[]; end: number }>();
  const touch = (night: string, at: number) => {
    if (only && !only.has(night)) return null;
    const entry = nights.get(night) ?? { drinks: [], end: at };
    entry.end = Math.max(entry.end, at);
    nights.set(night, entry);
    return entry;
  };
  for (const d of drinks) touch(keyOf(d.consumed_at), d.consumed_at)?.drinks.push(d.consumed_at);
  // A check-in left open for days says nothing about when the night ended: twelve hours at most.
  for (const c of checkIns) touch(keyOf(c.at), Math.min(Number(c.until), Number(c.at) + 12 * HOUR_MS));
  for (const h of homes) if (Number(h.home_safe_at) >= Number(h.starts_at)) touch(keyOf(Number(h.starts_at)), Number(h.home_safe_at));

  const offsetOf = (at: number) => offsetMinutes(at, clock.timeZone);
  const firsts: number[] = [];
  const paces: number[] = [];
  const ends: number[] = [];
  for (const night of nights.values()) {
    ends.push(night.end);
    if (!night.drinks.length) continue;
    firsts.push(night.drinks[0]!);
    const span = (night.drinks[night.drinks.length - 1]! - night.drinks[0]!) / HOUR_MS;
    if (night.drinks.length >= 2 && span >= 0.5) paces.push(night.drinks.length / span);
  }
  const pace = median(paces);
  return {
    nights: nights.size,
    usualFirstDrink: usualTime(firsts, offsetOf, clock.dayBoundaryHour),
    usualPacePerHour: pace === null ? null : Math.round(pace * 10) / 10,
    usualLeaving: usualTime(ends, offsetOf, clock.dayBoundaryHour),
  };
}
