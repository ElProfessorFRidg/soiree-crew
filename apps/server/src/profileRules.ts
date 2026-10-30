/** PROF-01, PROF-02: what each profile section is and who may see it. */

export const SECTIONS = ["identity", "crews", "titles", "venues", "reviews", "drinks", "records", "nights", "games", "birthday"] as const;
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
  // PROF-02: reviews (COM-02) and game wins (N-24) follow the same crew-first default.
  reviews: "crews",
  drinks: "crews",
  records: "me",
  nights: "crews",
  games: "crews",
  // QOL-21: crew mates only, so they can be reminded; the year never leaves the owner.
  birthday: "crews",
};

/**
 * PROF-01 presets: one tap sets every section; sections can then be changed one by one.
 * QOL-21: no preset widens the birthday past crew mates; only a choice made for that section does.
 */
export const PRESETS: Record<"private" | "friends" | "public", Record<Section, Audience>> = {
  private: { identity: "crews", crews: "me", titles: "me", venues: "me", reviews: "me", drinks: "me", records: "me", nights: "me", games: "me", birthday: "crews" },
  friends: {
    identity: "everyone",
    crews: "friends",
    titles: "friends",
    venues: "friends",
    reviews: "friends",
    drinks: "friends",
    records: "friends",
    nights: "friends",
    games: "friends",
    birthday: "crews",
  },
  public: {
    identity: "everyone",
    crews: "everyone",
    titles: "everyone",
    venues: "everyone",
    reviews: "everyone",
    drinks: "everyone",
    records: "friends",
    nights: "everyone",
    games: "everyone",
    birthday: "crews",
  },
};

/**
 * PROF-03: single figures that can be hidden from everyone but me, without closing their section.
 */
export const STATS = ["drinksTotal", "favourites", "usualFirstDrink", "usualPace", "usualLeaving", "highestBac", "biggestNight", "nightsTotal", "nightsRecent", "nightHistory", "gameWins"] as const;
export type Stat = (typeof STATS)[number];

export type ReviewAudience = "public" | "anonymous" | "friends" | "me";

/**
 * PROF-04: a new review's audience follows the profile's reviews section. Reviews have no
 * "crews" audience, so a crews section starts reviews as friends-only, the closest narrower one.
 */
export function defaultReviewAudience(section: Audience): ReviewAudience {
  return section === "everyone" ? "public" : section === "me" ? "me" : "friends";
}

/**
 * PROF-02, PROF-04: whether one review shows on its author's profile. The section audience and
 * the review's own audience must both allow it; an anonymous review never shows there, since the
 * profile would put the name back on it.
 */
export function reviewOnProfile(audience: ReviewAudience, relation: Relation): boolean {
  if (relation.me) return true;
  return audience === "public" || (audience === "friends" && relation.friend);
}

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
