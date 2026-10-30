import type { Db } from "./db";

/** Minutes east of UTC for a time zone at a given moment, from the runtime's ICU data. */
export function offsetMinutes(at: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(at));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(at / 1000) * 1000) / 60_000);
}

/** QOL-02: the day boundary of anyone who never picked one. */
export const DEFAULT_DAY_BOUNDARY_HOUR = 6;

/**
 * Night key YYYY-MM-DD: with a 6 am boundary, 2 am on Sunday belongs to Saturday night (QOL-02).
 *
 * Whose boundary applies (QOL-02):
 * - a person's own activity (their check-ins, their nights out) uses that person's boundary;
 * - a crew view ("tonight", this week's window, the radar, the crew's nights together) uses the
 *   boundary of the person asking, since it is their evening the screen describes;
 * - state shared by everyone and computed once for all (territory reigns, community place
 *   figures) uses the default, so the result never depends on who asked.
 */
export function nightOf(at: number, timeZone: string, dayBoundaryHour = DEFAULT_DAY_BOUNDARY_HOUR): string {
  const local = new Date(at + offsetMinutes(at, timeZone) * 60_000 - dayBoundaryHour * 3_600_000);
  return local.toISOString().slice(0, 10);
}

/** A time zone name the runtime knows, e.g. "Europe/Paris". */
export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const validHour = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 12;

/** QOL-02: each person's day boundary, from the settings their phone syncs (PREF-01). */
export async function dayBoundaries(db: Db, userIds: readonly string[]): Promise<Map<string, number>> {
  const ids = [...new Set(userIds)];
  const out = new Map<string, number>(ids.map((id) => [id, DEFAULT_DAY_BOUNDARY_HOUR]));
  if (!ids.length) return out;
  const rows = await db.query<{ user_id: string; data: string }>("select user_id, data from user_preferences where user_id = any($1::uuid[])", [ids]);
  for (const row of rows) {
    try {
      const hour = (JSON.parse(row.data) as { dayBoundaryHour?: unknown }).dayBoundaryHour;
      if (validHour(hour)) out.set(row.user_id, hour);
    } catch {
      // A broken row keeps the default.
    }
  }
  return out;
}

export async function dayBoundaryOf(db: Db, userId: string): Promise<number> {
  return (await dayBoundaries(db, [userId])).get(userId) ?? DEFAULT_DAY_BOUNDARY_HOUR;
}

/** QOL-02: the time zone the person's phone last reported (null if never), and their day boundary. */
export async function userClock(db: Db, userId: string): Promise<{ timeZone: string | null; dayBoundaryHour: number }> {
  const rows = await db.query<{ time_zone: string | null }>("select time_zone from users where id = $1", [userId]);
  return { timeZone: rows[0]?.time_zone ?? null, dayBoundaryHour: await dayBoundaryOf(db, userId) };
}
