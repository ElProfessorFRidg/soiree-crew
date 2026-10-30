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

function previousWeek(week: string): string {
  const [year, w] = week.split("-W").map(Number) as [number, number];
  // Thursday of that ISO week, minus seven days.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * DAY_MS + (w - 1) * 7 * DAY_MS);
  return isoWeek(new Date(monday.getTime() - 4 * DAY_MS).toISOString().slice(0, 10));
}

/**
 * JOY-06: consecutive weeks with at least one night out together. The current week
 * does not break the streak until it is over: a streak ending last week still counts.
 */
export function crewStreak(nights: readonly string[], tonight: string): { current: number; best: number } {
  const weeks = new Set(nights.map(isoWeek));
  let current = 0;
  let week = isoWeek(tonight);
  if (!weeks.has(week)) week = previousWeek(week);
  while (weeks.has(week)) {
    current += 1;
    week = previousWeek(week);
  }
  const sorted = [...weeks].sort();
  let best = 0;
  let run = 0;
  let last: string | null = null;
  for (const w of sorted) {
    run = last !== null && previousWeek(w) === last ? run + 1 : 1;
    best = Math.max(best, run);
    last = w;
  }
  return { current, best: Math.max(best, current) };
}

export const MILESTONES = [1, 10, 25, 50, 100, 250, 500] as const;

/** JOY-08: milestones reached and the next one. */
export function milestones(count: number): { reached: number[]; next: number | null } {
  return { reached: MILESTONES.filter((m) => count >= m), next: MILESTONES.find((m) => count < m) ?? null };
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
