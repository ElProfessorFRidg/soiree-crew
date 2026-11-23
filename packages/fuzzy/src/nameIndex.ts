import { catalogueNames, type CatalogueDrink } from "./catalogue";
import { normalise } from "./match";

export type NameIndex = readonly (readonly [name: string, drinkId: string])[];

export function buildNameIndex(catalogue: readonly CatalogueDrink[]): NameIndex {
  return catalogue
    .flatMap(drink => [...new Set(catalogueNames(drink).map(normalise).filter(Boolean))].map(name => [name, drink.id] as const))
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
}

/** Lower bound in UTF-16 order, matching the ordering used at build time. */
function lowerBound(index: NameIndex, name: string): number {
  let lo = 0;
  let hi = index.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (index[mid]![0] < name) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function matchingDrinkIds(index: NameIndex, name: string, prefix = false, limit = Infinity): string[] {
  if (!name || limit <= 0) return [];
  const ids = new Set<string>();
  for (let i = lowerBound(index, name); i < index.length && ids.size < limit; i++) {
    const [key, id] = index[i]!;
    if (prefix ? !key.startsWith(name) : key !== name) break;
    ids.add(id);
  }
  return [...ids];
}
