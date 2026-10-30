import type { GlassIconName } from "@crew/design-tokens";

/** The fields of a custom drink that ordering and the icon guess need (O-21). */
export interface Ordered {
  id: string;
  order: number;
}

/** Glasses offered for a custom drink, in the order of the picker. */
export const CUSTOM_ICONS: readonly GlassIconName[] = ["pint", "demi", "bottle", "can", "wine", "cocktail", "shot", "cider", "soft"];

/** The glass a new drink gets until the user picks one: a shot for spirits, a pint for long drinks. */
export function guessIcon(volumeMl: number, abv: number): GlassIconName {
  if (abv <= 0) return "soft";
  if (abv >= 0.2) return "shot";
  return volumeMl >= 400 ? "pint" : "cocktail";
}

/**
 * Moves one drink up (-1) or down (+1) in the user's order. Returns the drinks whose `order`
 * changed, renumbered 0..n-1 so duplicates left by older versions disappear. Empty when the drink
 * is already at that end.
 */
export function moveInOrder<T extends Ordered>(drinks: readonly T[], id: string, delta: -1 | 1): T[] {
  const sorted = [...drinks].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const index = sorted.findIndex((d) => d.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= sorted.length) return [];
  [sorted[index], sorted[target]] = [sorted[target]!, sorted[index]!];
  return sorted.flatMap((drink, order) => (drink.order === order ? [] : [{ ...drink, order }]));
}
