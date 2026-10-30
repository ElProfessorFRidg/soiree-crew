import { palette } from "@crew/design-tokens";

/** Same list as the server's party moods (O-35); kept here so the widget task needs no screen code. */
export type Mood = "party" | "birthday" | "champagne" | "sunset" | "costume" | "wine" | "fire" | "night" | "home" | "tropical";

/**
 * JOY-04: the mood picked for a party tints the Party screen band, the Android widget, the iOS
 * Live Activity and the recap. A tint only: text keeps the theme's colours for contrast.
 */
const MOOD_COLOURS: Record<Mood, string> = {
  party: palette.avatar[0]!,
  birthday: palette.avatar[5]!,
  champagne: palette.avatar[6]!,
  sunset: palette.avatar[3]!,
  costume: palette.avatar[4]!,
  wine: palette.avatar[4]!,
  fire: palette.avatar[5]!,
  night: palette.avatar[2]!,
  home: palette.avatar[1]!,
  tropical: palette.avatar[1]!,
};

export function moodColour(mood: string | null | undefined): string {
  return MOOD_COLOURS[(mood ?? "party") as Mood] ?? MOOD_COLOURS.party;
}

interface StoredParty {
  mood: string;
  myResponse: string;
  closedAt: number | null;
  startsAt: number;
  endsAt: number;
}

/** The mood of the party going on now, from the cached party list (the same rule as useLiveParty). */
export function liveMood(parties: readonly StoredParty[], now = Date.now()): string | null {
  const party = parties.find((p) => p.myResponse === "going" && p.closedAt === null && p.startsAt <= now && p.endsAt >= now);
  return party ? party.mood : null;
}
