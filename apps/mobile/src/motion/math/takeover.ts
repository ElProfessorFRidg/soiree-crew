/** MOT-09: venues whose boss changed between two loads of the map. */

export interface BossSnapshot {
  id: string;
  bossId: string | null;
}

export interface MapTakeover {
  venueId: string;
  bossId: string;
}

/**
 * A takeover is a venue known in both loads whose boss is now someone else. The first load, new
 * venues and a crown that went away (season over, boss left) are not takeovers.
 */
export function takeoversBetween(previous: readonly BossSnapshot[] | null, next: readonly BossSnapshot[]): MapTakeover[] {
  if (!previous) return [];
  const before = new Map(previous.map((venue) => [venue.id, venue.bossId]));
  const out: MapTakeover[] = [];
  for (const venue of next) {
    if (!before.has(venue.id) || !venue.bossId) continue;
    if (before.get(venue.id) !== venue.bossId) out.push({ venueId: venue.id, bossId: venue.bossId });
  }
  return out;
}
