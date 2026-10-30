/** JOY-08: which crew moment to celebrate now. Pure, so it is tested without a phone. */

export interface CrewMoment {
  id: string;
  kind: "nights" | "anniversary" | "firstConquest";
  value: number | null;
  /** YYYY-MM-DD, the crew's night. */
  night: string;
  venueName?: string;
  userId?: string;
  name?: string;
}

/** A moment older than this is history: listed, never celebrated. */
export const CELEBRATE_WITHIN_DAYS = 14;
const DAY_MS = 86_400_000;

/**
 * The most recent moment not celebrated yet on this phone, if it happened in the last two weeks.
 * Several new at once (a phone back after a while) give one celebration, the latest; the others
 * are marked seen with it so they never pop up one after another.
 */
export function momentToCelebrate(moments: readonly CrewMoment[], seen: readonly string[], now: number): CrewMoment | null {
  const done = new Set(seen);
  const fresh = moments.filter((m) => !done.has(m.id) && now - Date.parse(`${m.night}T12:00:00Z`) <= CELEBRATE_WITHIN_DAYS * DAY_MS);
  return [...fresh].sort((a, b) => b.night.localeCompare(a.night))[0] ?? null;
}
