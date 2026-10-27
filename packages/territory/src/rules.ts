// territory_rules_v1 (research/territories.md §3). A season freezes the version in force at its start,
// so these numbers never change under players mid-month. No input here is about drinks, grams or BAC:
// the engine does not even receive those events (TER-02).

export const RULES_V1 = {
  version: 1,
  checkInPoints: 10,
  vestingMinutes: 15,
  timeCapMinutes: 180,
  soloTimeCapMinutes: 60,
  organiserPoints: 12,
  organiserQuorum: 3,
  organiserMaxVenuesPerParty: 2,
  gameWinPoints: 5,
  gameWinsPerNightCap: 2,
  gameWinsPerSeasonCap: 6,
  discoveryPoints: 20,
  discoveryShareWindowMinutes: 15,
  discoveryPerSeasonCap: 3,
  bossMinimumPoints: 15,
  maxCheckInsPerNight: 6,
  minMinutesBetweenCheckIns: 20,
  soloNightsPerWeek: 2,
  proofGraceMinutes: 20,
  alertGapPoints: 10,
} as const;

export type TerritoryRules = typeof RULES_V1;

/** Points for minutes credited at a venue in one night: concave, capped (§3.2 table). */
export function timePoints(minutes: number, rules: TerritoryRules = RULES_V1): number {
  const m = Math.min(Math.floor(minutes), rules.timeCapMinutes);
  if (m < 15) return 0;
  if (m <= 60) return Math.floor((m - 15) / 5);
  if (m <= 120) return 9 + Math.floor((m - 60) / 10);
  return 15 + Math.floor((m - 120) / 20);
}
