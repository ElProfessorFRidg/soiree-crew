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

/** N-14: nights per month for the last twelve months, oldest first, keyed YYYY-MM. */
export function byMonth(nights: readonly string[], tonight: string): { month: string; count: number }[] {
  const [y, m] = tonight.split("-").map(Number) as [number, number];
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (11 - i), 1));
    return d.toISOString().slice(0, 7);
  });
  return months.map((month) => ({ month, count: nights.filter((n) => n.startsWith(month)).length }));
}
