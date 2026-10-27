/**
 * TER-06: titles earned on the territory map. Facts about where people went and
 * what they hold, never about drinking.
 */
export type TitleKind = "mayor" | "conqueror" | "explorer" | "nomad";

export interface Title {
  kind: TitleKind;
  /** The venue, for a mayor. */
  venueId?: string;
}

export const TITLE_RULES = {
  /** Venues held at once this season. */
  conquerorFrom: 3,
  /** Different venues ever checked into. */
  explorerFrom: 8,
  /** Different venues in a single night, at least once this season. */
  nomadFrom: 3,
} as const;

export interface MemberTerritory {
  memberId: string;
  /** Venues where this member is the boss right now. */
  ruled: readonly string[];
  /** Accepted public check-ins: venue and night key. */
  checkIns: readonly { venueId: string; night: string; thisSeason: boolean }[];
}

export interface MemberTitles {
  memberId: string;
  ruled: number;
  visited: number;
  titles: Title[];
}

export function territoryTitles(members: readonly MemberTerritory[]): MemberTitles[] {
  return members
    .map((m) => {
      const visited = new Set(m.checkIns.map((c) => c.venueId)).size;
      const perNight = new Map<string, Set<string>>();
      for (const c of m.checkIns) {
        if (!c.thisSeason) continue;
        const set = perNight.get(c.night) ?? new Set<string>();
        set.add(c.venueId);
        perNight.set(c.night, set);
      }
      const busiestNight = Math.max(0, ...[...perNight.values()].map((s) => s.size));
      const titles: Title[] = m.ruled.map((venueId) => ({ kind: "mayor" as const, venueId }));
      if (m.ruled.length >= TITLE_RULES.conquerorFrom) titles.push({ kind: "conqueror" });
      if (visited >= TITLE_RULES.explorerFrom) titles.push({ kind: "explorer" });
      if (busiestNight >= TITLE_RULES.nomadFrom) titles.push({ kind: "nomad" });
      return { memberId: m.memberId, ruled: m.ruled.length, visited, titles };
    })
    .sort((a, b) => b.ruled - a.ruled || b.visited - a.visited);
}
