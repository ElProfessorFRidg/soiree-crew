/** MOT-13: who stands on the podium, and when each step rises (DESIGN.md §5, Podium). */

export interface Ranked {
  userId: string;
  rank: number;
  value: number;
}

/**
 * The podium takes the first three rows that scored anything; it needs at least two of them, a podium
 * of one is just a list. The rest stay in the list below.
 */
export function splitPodium<T extends Ranked>(rows: readonly T[]): { podium: T[]; rest: T[] } {
  const scored = rows.filter((row) => row.value > 0).slice(0, 3);
  if (scored.length < 2) return { podium: [], rest: [...rows] };
  const onPodium = new Set(scored.map((row) => row.userId));
  return { podium: scored, rest: rows.filter((row) => !onPodium.has(row.userId)) };
}

/** Rise delays per place (0 is the winner): third first, winner last, 0 / 200 / 350 ms. */
export const RISE_DELAYS_MS = [350, 200, 0] as const;

/** When the crown drops on the winner: once the winner's step has risen. */
export function crownDelayMs(riseMs: number): number {
  return RISE_DELAYS_MS[0] + riseMs;
}

/** A new leader replays the podium; the first answer from the server never counts as a change. */
export function leaderChanged(previous: string | null, next: string | null): boolean {
  return previous !== null && next !== null && previous !== next;
}
