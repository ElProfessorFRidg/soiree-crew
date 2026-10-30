import { ethanolGrams } from "@crew/bac";
import { nightKey } from "@crew/units";
import type { DrinkEntry, WaterEntry } from "@/sync/types";
import type { DrinkKind } from "./presets";

export type DrinkFamily = "all" | "beer" | "wine" | "spirits" | "cocktail" | "other";
export const DRINK_FAMILIES: readonly DrinkFamily[] = ["all", "beer", "wine", "spirits", "cocktail", "other"];

const FAMILY: Record<DrinkKind, Exclude<DrinkFamily, "all">> = {
  demi: "beer",
  beer: "beer",
  pint: "beer",
  halfPint: "beer",
  cider: "beer",
  seltzer: "beer",
  wine: "wine",
  largeWine: "wine",
  shot: "spirits",
  double: "spirits",
  cocktail: "cocktail",
  soft: "other",
  custom: "other",
};

export function familyOf(kind: DrinkKind): Exclude<DrinkFamily, "all"> {
  return FAMILY[kind] ?? "other";
}

export interface MyStats {
  nights: number;
  drinks: number;
  grams: number;
  perNight: number;
  water: number;
  /** Glasses of water per alcoholic drink. */
  waterRatio: number | null;
  byFamily: Record<Exclude<DrinkFamily, "all">, number>;
  /** Nights out per weekday, Monday first. */
  weekdays: number[];
  /** Drinks per bucket, oldest first: weeks for short periods, months for a year. */
  buckets: { start: number; count: number }[];
  topKinds: { kind: DrinkKind; name?: string; count: number }[];
}

/**
 * O-81, N-16: personal figures over a period, from this phone's own history. Soft drinks count
 * as drinks only when "other" is picked; nights are nights with at least one alcoholic drink.
 */
export function myStats(
  drinks: readonly DrinkEntry[],
  water: readonly WaterEntry[],
  options: { from: number; to: number; family: DrinkFamily; dayBoundaryHour: number; bucket: "week" | "month" },
): MyStats {
  const offset = (at: number) => -new Date(at).getTimezoneOffset();
  const inRange = drinks.filter((d) => d.consumedAt >= options.from && d.consumedAt < options.to);
  const alcoholic = inRange.filter((d) => d.abv > 0);
  const picked = options.family === "all" ? alcoholic : inRange.filter((d) => familyOf(d.kind) === options.family);
  const nights = new Set(picked.filter((d) => d.abv > 0).map((d) => nightKey(d.consumedAt, offset(d.consumedAt), options.dayBoundaryHour)));
  const waterIn = water.filter((w) => w.at >= options.from && w.at < options.to).length;
  const byFamily = { beer: 0, wine: 0, spirits: 0, cocktail: 0, other: 0 };
  for (const d of alcoholic) byFamily[familyOf(d.kind)] += 1;

  const weekdays = [0, 0, 0, 0, 0, 0, 0];
  for (const night of nights) weekdays[(new Date(`${night}T12:00:00`).getDay() + 6) % 7]! += 1;

  const buckets: { start: number; count: number }[] = [];
  const first = new Date(options.from);
  let cursor =
    options.bucket === "month" ? new Date(first.getFullYear(), first.getMonth(), 1).getTime() : new Date(first.getFullYear(), first.getMonth(), first.getDate() - ((first.getDay() + 6) % 7)).getTime();
  while (cursor < options.to) {
    const start = cursor;
    const next = options.bucket === "month" ? new Date(new Date(start).getFullYear(), new Date(start).getMonth() + 1, 1).getTime() : start + 7 * 86_400_000;
    buckets.push({ start, count: picked.filter((d) => d.consumedAt >= start && d.consumedAt < next).length });
    cursor = next;
  }

  const kinds = new Map<string, { kind: DrinkKind; name?: string; count: number }>();
  for (const d of picked) {
    const key = d.kind === "custom" ? `custom:${d.name ?? ""}` : d.kind;
    const entry = kinds.get(key) ?? { kind: d.kind, ...(d.name ? { name: d.name } : {}), count: 0 };
    entry.count += 1;
    kinds.set(key, entry);
  }
  const grams = picked.reduce((sum, d) => sum + ethanolGrams(d.volumeMl, d.abv), 0);
  const alcoholicPicked = picked.filter((d) => d.abv > 0).length;
  return {
    nights: nights.size,
    drinks: picked.length,
    grams: Math.round(grams),
    perNight: nights.size ? Math.round((alcoholicPicked / nights.size) * 10) / 10 : 0,
    water: waterIn,
    waterRatio: alcoholic.length ? Math.round((waterIn / alcoholic.length) * 100) / 100 : null,
    byFamily,
    weekdays,
    buckets,
    topKinds: [...kinds.values()].sort((a, b) => b.count - a.count).slice(0, 5),
  };
}

/**
 * Profil board, "Mes stats": nights out per week over the last `weeks` weeks, oldest first, for
 * the year heatmap. A night counts once, whatever was drunk.
 */
export function nightsByWeek(drinks: readonly DrinkEntry[], to: number, dayBoundaryHour: number, weeks = 52): number[] {
  const offset = (at: number) => -new Date(at).getTimezoneOffset();
  const from = to - weeks * 7 * 86_400_000;
  const seen = new Set<string>();
  const counts = new Array<number>(weeks).fill(0);
  for (const d of drinks) {
    if (d.abv <= 0 || d.consumedAt < from || d.consumedAt >= to) continue;
    const night = nightKey(d.consumedAt, offset(d.consumedAt), dayBoundaryHour);
    if (seen.has(night)) continue;
    seen.add(night);
    counts[Math.min(weeks - 1, Math.floor((d.consumedAt - from) / (7 * 86_400_000)))]! += 1;
  }
  return counts;
}
