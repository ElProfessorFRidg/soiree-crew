/** TER-10: lifetime loyalty at a venue, never lost. Counted nights, as the territory rules count them. */
export type LoyaltyTier = "bronze" | "silver" | "gold";

const TIERS: { tier: LoyaltyTier; nights: number }[] = [
  { tier: "gold", nights: 25 },
  { tier: "silver", nights: 10 },
  { tier: "bronze", nights: 3 },
];

export function loyaltyTier(nights: number): LoyaltyTier | null {
  return TIERS.find((t) => nights >= t.nights)?.tier ?? null;
}

/** The next tier and how many nights it still takes, or null at gold. */
export function nextTier(nights: number): { tier: LoyaltyTier; missing: number } | null {
  const next = [...TIERS].reverse().find((t) => nights < t.nights);
  return next ? { tier: next.tier, missing: next.nights - nights } : null;
}
