/**
 * N-11, TER-08, COM-10: "Where to?" ranks the options and says why the first one wins.
 * Pure, so the ranking is tested without a database.
 */

export type WhereToReason = "happyNow" | "friendsHere" | "wanted" | "close" | "cheap" | "favourite" | "toConquer" | "openNow";

export interface WhereToCandidate {
  venueId: string;
  /** Null when nobody entered hours. */
  openNow: boolean | null;
  happyNow: boolean;
  /** Minor units, in the crew's main currency. */
  pint: number | null;
  average: number | null;
  distanceM: number | null;
  /** On the crew's "want to go" list. */
  wanted: boolean;
  /** Crew members checked in there right now. */
  hereNow: number;
  /** Crew nights there, ever. */
  visits: number;
  /** TER-08: never visited by the crew. */
  explored: boolean;
}

export interface WhereToFilters {
  openNow?: boolean;
  happyNow?: boolean;
  /** Pint, or the average drink when no pint is known, at most this (minor units). */
  maxPrice?: number;
}

export interface RankedOption {
  venueId: string;
  score: number;
  reasons: WhereToReason[];
}

const CHEAP_PINT = 600;

export function passes(c: WhereToCandidate, filters: WhereToFilters): boolean {
  if (filters.openNow && c.openNow !== true) return false;
  if (filters.happyNow && !c.happyNow) return false;
  if (filters.maxPrice !== undefined) {
    const price = c.pint ?? c.average;
    if (price === null || price > filters.maxPrice) return false;
  }
  return true;
}

/** Score and reasons, strongest reason first. A place known to be closed never wins. */
export function rank(candidates: WhereToCandidate[], filters: WhereToFilters): RankedOption[] {
  const out: RankedOption[] = [];
  for (const c of candidates) {
    if (!passes(c, filters)) continue;
    const parts: [WhereToReason, number][] = [];
    if (c.happyNow) parts.push(["happyNow", 25]);
    if (c.hereNow > 0) parts.push(["friendsHere", Math.min(30, 12 * c.hereNow)]);
    if (c.wanted) parts.push(["wanted", 20]);
    if (c.distanceM !== null && c.distanceM < 3000) parts.push(["close", Math.round(20 * (1 - c.distanceM / 3000))]);
    const price = c.pint ?? c.average;
    if (price !== null && price <= CHEAP_PINT) parts.push(["cheap", Math.min(15, Math.round((CHEAP_PINT + 200 - price) / 20))]);
    if (c.visits > 0) parts.push(["favourite", Math.min(12, c.visits)]);
    if (!c.explored) parts.push(["toConquer", 8]);
    if (c.openNow === true) parts.push(["openNow", 10]);
    const closed = c.openNow === false ? -100 : 0;
    parts.sort((a, b) => b[1] - a[1]);
    out.push({ venueId: c.venueId, score: parts.reduce((s, p) => s + p[1], 0) + closed, reasons: parts.map((p) => p[0]) });
  }
  return out.sort((a, b) => b.score - a.score || a.venueId.localeCompare(b.venueId));
}

/** The pick: the best option not known to be closed; and the best never-visited one to conquer (TER-08). */
export function picks(ranked: RankedOption[], candidates: WhereToCandidate[]): { suggestion: string | null; conquest: string | null } {
  const byId = new Map(candidates.map((c) => [c.venueId, c]));
  const open = ranked.filter((r) => byId.get(r.venueId)?.openNow !== false);
  const suggestion = open[0]?.venueId ?? null;
  const conquest = open.find((r) => !byId.get(r.venueId)?.explored && r.venueId !== suggestion)?.venueId ?? (open[0] && !byId.get(open[0].venueId)?.explored ? open[0].venueId : null);
  return { suggestion, conquest };
}
