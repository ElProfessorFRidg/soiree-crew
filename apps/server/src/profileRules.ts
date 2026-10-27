/** PROF-01, PROF-02: what each profile section is and who may see it. */

export const SECTIONS = ["identity", "crews", "titles", "venues", "drinks", "records", "nights"] as const;
export type Section = (typeof SECTIONS)[number];

export const AUDIENCES = ["me", "crews", "friends", "everyone"] as const;
export type Audience = (typeof AUDIENCES)[number];

/** How the viewer relates to the profile owner. A viewer can be both a friend and a crew mate. */
export interface Relation {
  me: boolean;
  friend: boolean;
  crewMate: boolean;
}

export const STRANGER: Relation = { me: false, friend: false, crewMate: false };

/** Private by default: crew mates see the basics, records stay with the owner. */
export const DEFAULT_AUDIENCES: Record<Section, Audience> = {
  identity: "crews",
  crews: "crews",
  titles: "crews",
  venues: "crews",
  drinks: "crews",
  records: "me",
  nights: "crews",
};

/** PROF-01 presets: one tap sets every section; sections can then be changed one by one. */
export const PRESETS: Record<"private" | "friends" | "public", Record<Section, Audience>> = {
  private: { identity: "crews", crews: "me", titles: "me", venues: "me", drinks: "me", records: "me", nights: "me" },
  friends: { identity: "everyone", crews: "friends", titles: "friends", venues: "friends", drinks: "friends", records: "friends", nights: "friends" },
  public: { identity: "everyone", crews: "everyone", titles: "everyone", venues: "everyone", drinks: "everyone", records: "friends", nights: "everyone" },
};

export function canSee(audience: Audience, relation: Relation): boolean {
  if (relation.me) return true;
  switch (audience) {
    case "me":
      return false;
    case "crews":
      return relation.crewMate;
    case "friends":
      return relation.friend;
    case "everyone":
      return true;
  }
}

export function audiencesOf(stored: Partial<Record<string, unknown>>): Record<Section, Audience> {
  const out = { ...DEFAULT_AUDIENCES };
  for (const section of SECTIONS) {
    const value = stored[section];
    if (typeof value === "string" && (AUDIENCES as readonly string[]).includes(value)) out[section] = value as Audience;
  }
  return out;
}

/**
 * PROF-05: venue dates show to friends, crew mates and me, never to strangers,
 * so nobody reads a routine from them.
 */
export function seesDates(relation: Relation): boolean {
  return relation.me || relation.friend || relation.crewMate;
}
