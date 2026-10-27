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

const DAY_BOUNDARY_HOUR = 6;

/** Night key YYYY-MM-DD: 2 am on Sunday belongs to Saturday night (QOL-02). */
export function nightOf(at: number, timeZone: string): string {
  const local = new Date(at + offsetMinutes(at, timeZone) * 60_000 - DAY_BOUNDARY_HOUR * 3_600_000);
  return local.toISOString().slice(0, 10);
}
