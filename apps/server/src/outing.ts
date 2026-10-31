import type { Context } from "./context";
import { claimMark, inQuietHours, loadRecipients, notifyUsers } from "./notifications/notify";
import { offsetMinutes } from "./time";

// "Me détecter avec mon crew" and the learning behind every "go out?" nudge. The phone sends a
// coarse position while it lingers somewhere at night; the server keeps only the latest one for
// 30 min, never shows it, and uses it for one thing: noticing crew members together at night,
// then nudging those of them with no night going on. Each nudge, from here or from the phone's
// own outing reminder, gets an outcome once the night is over, and the outcome tunes the next ones.

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** A position older than this is gone. */
export const WHEREABOUTS_TTL_MS = 30 * MINUTE_MS;
/** The phone sends at most one position this often; earlier ones are ignored. */
export const REPORT_EVERY_MS = 9 * MINUTE_MS;
/** Members this close to each other are together. */
export const TOGETHER_M = 200;
/** This many members of a crew together make a gathering. */
export const MIN_GATHERING = 2;
/** Never two nudges closer than this, whatever their source. */
export const NUDGE_GAP_MS = 45 * MINUTE_MS;
/** The budget of a night, counted over this window. */
const NIGHT_WINDOW_MS = 12 * HOUR_MS;
/** The same gathering nudges once in this time. */
const SAME_GATHERING_MS = 4 * HOUR_MS;
/** Something logged within this time after a nudge: it was forgotten. */
export const FORGOT_WITHIN_MS = 90 * MINUTE_MS;
/** A drink in the last hours: a night is going on. */
const NIGHT_GOING_MS = 6 * HOUR_MS;
/** The outcome of a nudge is read once its night is over. */
const SETTLE_AFTER_MS = 12 * HOUR_MS;
/** Weight of the newest outcome in the moving average. */
const ALPHA = 0.3;
const FORGETFUL_FROM = 0.6;
const NO_LOG_UNDER = 0.3;
/** Nights in a row with a nudge and nothing logged before the nudges pause. */
const IGNORED_NIGHTS_PAUSE = 4;
const PAUSE_MS = 14 * DAY_MS;
/** Local hours of the night: 8 pm to 4 am. */
const NIGHT_FROM_HOUR = 20;
const NIGHT_TO_HOUR = 4;
/** Written variants of each crew nudge line (SLOP-11). */
export const CREW_VARIANTS = 8;

export type HabitProfile = "forgetful" | "usual" | "noLog";

export interface OutingHabit {
  profile: HabitProfile;
  /** Minutes still somewhere before the phone's own nudge. */
  stayMinutes: number;
  maxPerNight: number;
  pausedUntil: number | null;
}

export interface HabitRow {
  score: number;
  ignored_streak: number;
  last_ignored_at: number | null;
  paused_until: number | null;
}

export function habitOf(row: HabitRow | undefined, now: number): OutingHabit {
  const score = row?.score ?? 0.5;
  const pausedUntil = row?.paused_until && row.paused_until > now ? row.paused_until : null;
  if (score >= FORGETFUL_FROM) return { profile: "forgetful", stayMinutes: 10, maxPerNight: 3, pausedUntil };
  if (score < NO_LOG_UNDER) return { profile: "noLog", stayMinutes: 20, maxPerNight: 1, pausedUntil };
  return { profile: "usual", stayMinutes: 20, maxPerNight: 3, pausedUntil };
}

export type Outcome = "forgot" | "unused" | "logged";

/**
 * What followed a nudge, from the person's drinks (when drunk, when logged) and the parties they
 * started or joined. Forgot: something logged within 90 min, or back-dated to before the nudge.
 * Unused: nothing at all that night. Logged: logged later, which says neither.
 */
export function outcomeOf(at: number, drinks: readonly { consumed_at: number; logged_at: number }[], partiesStarted: readonly number[]): Outcome {
  const soon = (t: number) => t >= at && t <= at + FORGOT_WITHIN_MS;
  if (partiesStarted.some(soon)) return "forgot";
  for (const d of drinks) {
    if (soon(d.logged_at) || soon(d.consumed_at)) return "forgot";
    // Back-dated: logged after the nudge, drunk before it, the same night.
    if (d.logged_at >= at && d.consumed_at < at && d.consumed_at >= at - NIGHT_GOING_MS) return "forgot";
  }
  const night = drinks.some((d) => d.consumed_at >= at - NIGHT_GOING_MS && d.consumed_at <= at + SETTLE_AFTER_MS);
  return night || partiesStarted.some((t) => t >= at - NIGHT_GOING_MS && t <= at + SETTLE_AFTER_MS) ? "logged" : "unused";
}

/** The habit after one more outcome. */
export function learn(row: HabitRow | undefined, outcome: Outcome, at: number): HabitRow {
  const base: HabitRow = row ?? { score: 0.5, ignored_streak: 0, last_ignored_at: null, paused_until: null };
  if (outcome === "forgot") return { ...base, score: base.score + ALPHA * (1 - base.score), ignored_streak: 0 };
  if (outcome === "logged") return { ...base, ignored_streak: 0 };
  // Several nudges of one night count as one ignored night.
  const newNight = base.last_ignored_at === null || at - base.last_ignored_at > NIGHT_WINDOW_MS;
  const streak = newNight ? base.ignored_streak + 1 : base.ignored_streak;
  const next: HabitRow = { ...base, score: base.score + ALPHA * (0 - base.score), ignored_streak: streak, last_ignored_at: at };
  if (streak >= IGNORED_NIGHTS_PAUSE) return { ...next, ignored_streak: 0, paused_until: at + PAUSE_MS };
  return next;
}

export function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** About 100 m: three decimals of a degree. */
export const coarse = (value: number) => Math.round(value * 1000) / 1000;

export function atNight(at: number, timeZone: string): boolean {
  let hour: number;
  try {
    hour = new Date(at + offsetMinutes(at, timeZone) * MINUTE_MS).getUTCHours();
  } catch {
    hour = new Date(at).getUTCHours();
  }
  return hour >= NIGHT_FROM_HOUR || hour < NIGHT_TO_HOUR;
}

async function habitRow(ctx: Context, userId: string): Promise<HabitRow | undefined> {
  return (await ctx.db.query<HabitRow>("select score, ignored_streak, last_ignored_at, paused_until from outing_habits where user_id = $1", [userId]))[0];
}

/** Nudges of the current night, oldest first. */
async function nudgesTonight(ctx: Context, userId: string, now: number): Promise<number[]> {
  const rows = await ctx.db.query<{ at: number }>("select at from outing_nudges where user_id = $1 and at > $2 order by at", [userId, now - NIGHT_WINDOW_MS]);
  return rows.map((r) => Number(r.at));
}

/** What the phone needs for its own nudge: the habit and tonight's nudges, to share one budget. */
export async function outingState(ctx: Context, userId: string): Promise<{ habit: OutingHabit; nudges: number[] }> {
  const now = ctx.now();
  return { habit: habitOf(await habitRow(ctx, userId), now), nudges: await nudgesTonight(ctx, userId, now) };
}

export async function recordNudge(ctx: Context, userId: string, at: number, source: "local" | "crew"): Promise<void> {
  await ctx.db.query("insert into outing_nudges (user_id, at, source) values ($1, $2, $3) on conflict do nothing", [userId, at, source]);
}

/** A night is going on: a recent drink, or a party they go to that is live now. */
async function nightGoingOn(ctx: Context, userId: string, now: number): Promise<boolean> {
  const rows = await ctx.db.query<{ n: number }>(
    `select (select count(*) from drinks where user_id = $1 and deleted_at is null and consumed_at > $2 and consumed_at <= $3)
          + (select count(*) from party_members m join parties p on p.id = m.party_id
             where m.user_id = $1 and m.response = 'going' and p.closed_at is null and p.starts_at <= $3 and p.ends_at > $3) as n`,
    [userId, now - NIGHT_GOING_MS, now],
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

/** May this person get one more nudge now? Budget, gap, pause, mute, quiet hours and the night. */
async function mayNudge(ctx: Context, userId: string, now: number, mutedUntil: number | null): Promise<boolean> {
  if (mutedUntil !== null && mutedUntil > now) return false;
  const habit = habitOf(await habitRow(ctx, userId), now);
  if (habit.pausedUntil !== null) return false;
  const tonight = await nudgesTonight(ctx, userId, now);
  if (tonight.length >= habit.maxPerNight) return false;
  if (tonight.length && tonight[tonight.length - 1]! > now - NUDGE_GAP_MS) return false;
  const recipient = (await loadRecipients(ctx, [userId], null)).get(userId)!;
  if (recipient.types.crewNearby === false) return false;
  if (!atNight(now, recipient.timeZone)) return false;
  return !inQuietHours(now, recipient.timeZone, recipient.quiet.from, recipient.quiet.to);
}

/**
 * Called after a position came in: the crews of this person, the members together with them
 * right now, and a nudge to those of them with no night going on.
 */
export async function matchCrews(ctx: Context, userId: string): Promise<void> {
  const now = ctx.now();
  const crews = await ctx.db.query<{ crew_id: string }>("select crew_id from crew_members where user_id = $1", [userId]);
  const me = (await ctx.db.query<{ lat: number; lng: number }>("select lat, lng from whereabouts where user_id = $1", [userId]))[0];
  if (!me) return;
  for (const { crew_id: crewId } of crews) {
    const around = await ctx.db.query<{ user_id: string; lat: number; lng: number; muted_until: number | null; display_name: string }>(
      `select w.user_id, w.lat, w.lng, w.muted_until, u.display_name from whereabouts w
       join crew_members m on m.user_id = w.user_id and m.crew_id = $1 join users u on u.id = w.user_id
       where w.at > $2`,
      [crewId, now - WHEREABOUTS_TTL_MS],
    );
    const together = around.filter((w) => metersBetween(me, w) <= TOGETHER_M);
    if (together.length < MIN_GATHERING || !together.some((w) => w.user_id === userId)) continue;
    const live: typeof together = [];
    const idle: typeof together = [];
    for (const w of together) ((await nightGoingOn(ctx, w.user_id, now)) ? live : idle).push(w);
    for (const w of idle) {
      if (!(await mayNudge(ctx, w.user_id, now, w.muted_until === null ? null : Number(w.muted_until)))) continue;
      if (!(await claimMark(ctx, w.user_id, `crewNearby:${crewId}`, SAME_GATHERING_MS))) continue;
      const first = live[0];
      await recordNudge(ctx, w.user_id, now, "crew");
      await notifyUsers(ctx, [w.user_id], {
        kind: "crewNearby",
        crewId,
        actorId: first?.user_id ?? null,
        params: { live: Boolean(first), name: first?.display_name ?? "", v: 1 + Math.floor(Math.random() * CREW_VARIANTS) },
      });
    }
  }
}

/** The sweeper: old positions go, settled nudges teach the habit. */
export async function sweepOuting(ctx: Context): Promise<void> {
  const now = ctx.now();
  await ctx.db.query("delete from whereabouts where at <= $1", [now - WHEREABOUTS_TTL_MS]);
  const open = await ctx.db.query<{ user_id: string; at: number }>("select user_id, at from outing_nudges where outcome is null and at <= $1 order by user_id, at", [
    now - SETTLE_AFTER_MS,
  ]);
  for (const nudge of open) {
    const at = Number(nudge.at);
    const drinks = await ctx.db.query<{ consumed_at: number; logged_at: number }>(
      "select consumed_at, logged_at from drinks where user_id = $1 and deleted_at is null and ((consumed_at between $2 and $3) or (logged_at between $2 and $3))",
      [nudge.user_id, at - NIGHT_GOING_MS, at + SETTLE_AFTER_MS],
    );
    const parties = await ctx.db.query<{ t: number }>(
      `select greatest(p.starts_at, p.created_at) as t from parties p join party_members m on m.party_id = p.id
       where m.user_id = $1 and m.response = 'going' and p.starts_at between $2 and $3`,
      [nudge.user_id, at - NIGHT_GOING_MS, at + SETTLE_AFTER_MS],
    );
    const outcome = outcomeOf(
      at,
      drinks.map((d) => ({ consumed_at: Number(d.consumed_at), logged_at: Number(d.logged_at) })),
      parties.map((p) => Number(p.t)),
    );
    const next = learn(await habitRow(ctx, nudge.user_id), outcome, at);
    await ctx.db.query("update outing_nudges set outcome = $3 where user_id = $1 and at = $2", [nudge.user_id, at, outcome]);
    await ctx.db.query(
      `insert into outing_habits (user_id, score, ignored_streak, last_ignored_at, paused_until, updated_at) values ($1, $2, $3, $4, $5, $6)
       on conflict (user_id) do update set score = excluded.score, ignored_streak = excluded.ignored_streak,
         last_ignored_at = excluded.last_ignored_at, paused_until = excluded.paused_until, updated_at = excluded.updated_at`,
      [nudge.user_id, next.score, next.ignored_streak, next.last_ignored_at, next.paused_until, now],
    );
  }
}
