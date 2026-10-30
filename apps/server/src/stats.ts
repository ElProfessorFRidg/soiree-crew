/** Pure helpers for crew statistics (N-14, JOY-06, JOY-08). Night keys are YYYY-MM-DD. */

const DAY_MS = 86_400_000;

function dateOf(night: string): Date {
  return new Date(`${night}T12:00:00Z`);
}

/** ISO week of a night, e.g. "2026-W45". Weeks start on Monday. */
export function isoWeek(night: string): string {
  const d = dateOf(night);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / DAY_MS - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function mondayOf(week: string): number {
  const [year, w] = week.split("-W").map(Number) as [number, number];
  const jan4 = new Date(Date.UTC(year, 0, 4));
  return jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * DAY_MS + (w - 1) * 7 * DAY_MS;
}

function previousWeek(week: string): string {
  // Thursday of that ISO week, minus seven days.
  return isoWeek(new Date(mondayOf(week) - 4 * DAY_MS).toISOString().slice(0, 10));
}

/** Calendar month (YYYY-MM) a week belongs to: the month of its Thursday, like the ISO year. */
export function monthOfWeek(week: string): string {
  return new Date(mondayOf(week) + 3 * DAY_MS).toISOString().slice(0, 7);
}

export interface CrewStreak {
  current: number;
  best: number;
  /** JOY-06: quiet weeks of the current run that a freeze saved, oldest first. */
  frozenWeeks: string[];
  /** Whether this month's freeze is still unused. */
  freezeAvailable: boolean;
}

/**
 * JOY-06: consecutive weeks with at least one night out together. The current week
 * does not break the streak until it is over: a streak ending last week still counts.
 * One quiet week per calendar month is frozen instead of breaking the run; two quiet
 * weeks in a row always break it. Frozen weeks keep the run alive but do not add to it.
 */
export function crewStreak(nights: readonly string[], tonight: string): CrewStreak {
  const weeks = new Set(nights.map(isoWeek));
  const thisWeek = isoWeek(tonight);
  const thisMonth = monthOfWeek(thisWeek);
  if (!weeks.size) return { current: 0, best: 0, frozenWeeks: [], freezeAvailable: true };
  // Every week from the first night out to the last finished one (or this one, once it has a night).
  const end = weeks.has(thisWeek) ? thisWeek : previousWeek(thisWeek);
  const first = [...weeks].sort()[0]!;
  const timeline: string[] = [];
  for (let week = end; week >= first; week = previousWeek(week)) timeline.unshift(week);

  let run = 0;
  let best = 0;
  let frozen: string[] = [];
  const usedMonths = new Set<string>();
  timeline.forEach((week, index) => {
    if (weeks.has(week)) {
      run += 1;
      best = Math.max(best, run);
      return;
    }
    const next = timeline[index + 1];
    const month = monthOfWeek(week);
    // A freeze is only worth spending when the run picks up again next week (or this is the last week).
    const worthIt = next === undefined || weeks.has(next);
    if (run > 0 && worthIt && !usedMonths.has(month)) {
      usedMonths.add(month);
      frozen.push(week);
      return;
    }
    run = 0;
    frozen = [];
  });
  return { current: run, best, frozenWeeks: frozen, freezeAvailable: !usedMonths.has(thisMonth) };
}

export const MILESTONES = [1, 10, 25, 50, 100, 250, 500] as const;

/** JOY-08: milestones reached and the next one. */
export function milestones(count: number): { reached: number[]; next: number | null } {
  return { reached: MILESTONES.filter((m) => count >= m), next: MILESTONES.find((m) => count < m) ?? null };
}

/** JOY-08: a moment worth celebrating once. `id` is stable so a phone shows it a single time. */
export interface Moment {
  id: string;
  kind: "nights" | "anniversary" | "firstConquest";
  /** Nights out together, years together, or nothing for a conquest. */
  value: number | null;
  /** Night it happened, YYYY-MM-DD. */
  night: string;
  venueName?: string;
  userId?: string;
  name?: string;
}

/** Years completed since the crew was created, and the night of the last anniversary. */
export function anniversary(createdNight: string, tonight: string): { years: number; night: string | null } {
  const [cy, cm, cd] = createdNight.split("-").map(Number) as [number, number, number];
  const [ty] = tonight.split("-").map(Number) as [number];
  let years = ty - cy;
  // 29 February falls back to 28 February in other years.
  const dateIn = (year: number) => {
    const last = new Date(Date.UTC(year, cm, 0)).getUTCDate();
    return `${year}-${String(cm).padStart(2, "0")}-${String(Math.min(cd, last)).padStart(2, "0")}`;
  };
  if (years > 0 && dateIn(ty) > tonight) years -= 1;
  return years > 0 ? { years, night: dateIn(cy + years) } : { years: 0, night: null };
}

/** JOY-08: night-count milestones and anniversaries, in the order they happened. Never drinks. */
export function milestoneMoments(nights: readonly string[], createdNight: string, tonight: string): Moment[] {
  const sorted = [...new Set(nights)].sort();
  const out: Moment[] = MILESTONES.filter((m) => sorted.length >= m).map((m) => ({ id: `nights-${m}`, kind: "nights", value: m, night: sorted[m - 1]! }));
  const { years } = anniversary(createdNight, tonight);
  for (let y = 1; y <= years; y++) {
    const night = anniversary(createdNight, `${Number(createdNight.slice(0, 4)) + y}-12-31`).night;
    if (night) out.push({ id: `anniversary-${y}`, kind: "anniversary", value: y, night });
  }
  return out.sort((a, b) => a.night.localeCompare(b.night));
}

/** N-14: nights per weekday, Monday first. */
export function byWeekday(nights: readonly string[]): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0];
  for (const n of nights) out[(dateOf(n).getUTCDay() + 6) % 7]! += 1;
  return out;
}

export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Minutes since the start of the night (the day boundary, local time), so 2 am sorts after 11 pm. */
export function minutesIntoNight(at: number, offsetMinutes: number, boundaryHour: number): number {
  const local = new Date(at + offsetMinutes * 60_000);
  return ((local.getUTCHours() - boundaryHour + 24) % 24) * 60 + local.getUTCMinutes();
}

/**
 * N-13: the usual time a night ends, as minutes after noon like the usual first drink. The median
 * is taken on the night's own clock (from the day boundary), so 11 pm and 2 am average to past
 * midnight, not to noon.
 */
export function usualTime(times: readonly number[], offsetOf: (at: number) => number, boundaryHour: number): number | null {
  const m = median(times.map((at) => minutesIntoNight(at, offsetOf(at), boundaryHour)));
  return m === null ? null : (((Math.round(m) + boundaryHour * 60 - 12 * 60) % 1440) + 1440) % 1440;
}

/**
 * N-14: continuous stretches of activity per key (a party), split where nothing happened for
 * `gapMs`. A night ends with its last sign of life even past the day boundary, and each night of a
 * trip is its own stretch, with the day in between not counted as out.
 */
export function outings(events: readonly { key: string; from: number; to: number }[], gapMs = 6 * 3_600_000): { key: string; first: number; last: number }[] {
  const byKey = new Map<string, { from: number; to: number }[]>();
  for (const e of events) byKey.set(e.key, [...(byKey.get(e.key) ?? []), { from: e.from, to: Math.max(e.from, e.to) }]);
  const out: { key: string; first: number; last: number }[] = [];
  for (const [key, spans] of byKey) {
    spans.sort((a, b) => a.from - b.from);
    let current = { key, first: spans[0]!.from, last: spans[0]!.to };
    for (const span of spans.slice(1)) {
      if (span.from - current.last > gapMs) {
        out.push(current);
        current = { key, first: span.from, last: span.to };
      } else current.last = Math.max(current.last, span.to);
    }
    out.push(current);
  }
  return out;
}

/** N-14: nights of the last `weeks` weeks (tonight included) with how many outings each, oldest first. */
export function calendarNights(nights: readonly string[], tonight: string, weeks: number): { night: string; count: number }[] {
  const from = new Date(dateOf(tonight).getTime() - (weeks * 7 - 1) * DAY_MS).toISOString().slice(0, 10);
  const counts = new Map<string, number>();
  for (const n of nights) if (n >= from && n <= tonight) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([night, count]) => ({ night, count }));
}

/** N-14: nights from a party's start to its end, one key per night (a trip spans several). */
export function nightsBetween(from: number, to: number, keyOf: (at: number) => string): string[] {
  const keys = new Set<string>([keyOf(from)]);
  // Two weeks at most: a trip longer than that is not a night out.
  const end = Math.min(Math.max(from, to - 1), from + 14 * DAY_MS);
  for (let at = from + DAY_MS; at <= end; at += DAY_MS) keys.add(keyOf(at));
  keys.add(keyOf(end));
  return [...keys];
}

/** N-14: nights per month for the last twelve months, oldest first, keyed YYYY-MM. */
export function byMonth(nights: readonly string[], tonight: string): { month: string; count: number }[] {
  const [y, m] = tonight.split("-").map(Number) as [number, number];
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (11 - i), 1));
    return d.toISOString().slice(0, 7);
  });
  return months.map((month) => ({ month, count: nights.filter((n) => n.startsWith(month)).length }));
}
