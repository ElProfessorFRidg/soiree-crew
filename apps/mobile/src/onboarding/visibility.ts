import type { IconName } from "@crew/design-tokens";

// PROF-01, PROF-02: the five things a profile can open, each with its own screen in the arrival
// flow and its own row in Settings. Pure, so the order, the audiences and the mapping to the
// server's sections are tested on their own.

export type Audience = "me" | "crews" | "friends" | "everyone";

/** The order of the audiences from the narrowest to the widest. */
export const AUDIENCE_ORDER: readonly Audience[] = ["me", "crews", "friends", "everyone"];

export type VisibilityKey = "venues" | "titles" | "badges" | "find" | "presence";

export interface VisibilityItem {
  key: VisibilityKey;
  /** The server section that stores the audience (apps/server/src/profileRules.ts). */
  section: VisibilityKey;
  icon: IconName;
}

export const VISIBILITY_ITEMS: readonly VisibilityItem[] = [
  { key: "venues", section: "venues", icon: "pin" },
  { key: "titles", section: "titles", icon: "crown" },
  { key: "badges", section: "badges", icon: "star" },
  { key: "find", section: "find", icon: "search" },
  { key: "presence", section: "presence", icon: "moon" },
];

export const VISIBILITY_KEYS: readonly VisibilityKey[] = VISIBILITY_ITEMS.map((item) => item.key);

export function isVisibilityKey(value: string): value is VisibilityKey {
  return (VISIBILITY_KEYS as readonly string[]).includes(value);
}

/**
 * The order the buttons come in on a visibility screen: the widest choice first and highlighted,
 * the private one last, the same size as the others. Nothing is chosen until a tap.
 */
export const CHOICE_ORDER: readonly Audience[] = ["everyone", "friends", "crews", "me"];

/** The buttons of one screen: presence tonight is only ever shown to crew mates, so it never offers "Everyone". */
export function choicesFor(item: VisibilityKey): readonly Audience[] {
  return item === "presence" ? CHOICE_ORDER.filter((audience) => audience !== "everyone") : CHOICE_ORDER;
}

/** Whether the profile shows the thing at all, for someone in the audience asked about. */
export function opensTo(audience: Audience | undefined, viewer: Audience): boolean {
  if (!audience) return false;
  return AUDIENCE_ORDER.indexOf(audience) >= AUDIENCE_ORDER.indexOf(viewer);
}

/**
 * "Who can find and add me": the search is only open to strangers on Everyone, and then the
 * name itself may be searched (findable "search"). Any other choice leaves the exact username as it was.
 */
export function findableFor(audience: Audience): "search" | undefined {
  return audience === "everyone" ? "search" : undefined;
}
