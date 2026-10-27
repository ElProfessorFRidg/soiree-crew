import { RULES_V1, type TerritoryRules } from "./rules";

// TER-12: one rule modifier per season, announced on the 1st. Each one only scales points the
// engine already gives for presence, discovery, organising or games: no variant can touch drinks,
// because the rules have no input about drinks at all (TER-02).

export const SEASON_VARIANTS = {
  none: {},
  discovery: { discoveryPoints: RULES_V1.discoveryPoints * 2, discoveryPerSeasonCap: RULES_V1.discoveryPerSeasonCap + 2 },
  games: { gameWinPoints: RULES_V1.gameWinPoints * 2 },
  organiser: { organiserPoints: RULES_V1.organiserPoints + 6 },
  regulars: { checkInPoints: RULES_V1.checkInPoints + 5 },
} as const satisfies Record<string, Partial<Record<keyof TerritoryRules, number>>>;

export type SeasonVariant = keyof typeof SEASON_VARIANTS;

const ROTATION: readonly SeasonVariant[] = ["discovery", "none", "games", "organiser", "none", "regulars"];

export const isSeasonVariant = (value: string): value is SeasonVariant => value in SEASON_VARIANTS;

/**
 * The variant of a season ("2026-11"). A remote override (the server's config) wins; otherwise a
 * fixed rotation, so every crew on the same server plays the same month and replays never change.
 */
export function seasonVariant(season: string, overrides: Readonly<Record<string, string>> = {}): SeasonVariant {
  const forced = overrides[season];
  if (forced && isSeasonVariant(forced)) return forced;
  const [year, month] = season.split("-").map(Number) as [number, number];
  return ROTATION[(year * 12 + month - 1) % ROTATION.length]!;
}

/** The rules frozen for a season: v1 plus that month's variant, with the variant in the version. */
export function rulesForSeason(season: string, overrides: Readonly<Record<string, string>> = {}): { rules: TerritoryRules; variant: SeasonVariant } {
  const variant = seasonVariant(season, overrides);
  return { variant, rules: { ...RULES_V1, ...SEASON_VARIANTS[variant] } as TerritoryRules };
}
