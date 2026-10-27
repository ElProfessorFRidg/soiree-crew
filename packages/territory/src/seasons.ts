/** Season = calendar month, starting at 06:00 on the 1st in the crew's time zone (TER-04). */
export function seasonKey(at: number, offsetMinutes: number, boundaryHour = 6): string {
  const local = new Date(at + offsetMinutes * 60_000 - boundaryHour * 3_600_000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** UTC bounds of a season, for queries. */
export function seasonBounds(key: string, offsetMinutes: number, boundaryHour = 6): { start: number; end: number } {
  const [year, month] = key.split("-").map(Number) as [number, number];
  const start = Date.UTC(year, month - 1, 1, boundaryHour) - offsetMinutes * 60_000;
  const end = Date.UTC(year, month, 1, boundaryHour) - offsetMinutes * 60_000;
  return { start, end };
}

/** ISO 8601 week of a night key (YYYY-MM-DD), for the weekly solo cap. */
export function weekKey(night: string): string {
  const [y, m, d] = night.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
