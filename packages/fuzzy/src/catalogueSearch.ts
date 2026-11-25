import { catalogueDrink, CORE_DRINK_CATALOGUE, type DrinkGroup, type CatalogueDrink } from "./catalogue";
import trackCaffeineRows from "./data/trackcaffeine-index.json";
import barAssistantRows from "./data/bar-assistant-index.json";
import openFoodFactsRows from "./data/openfoodfacts-index.json";
import openFoodFactsProductRows from "./data/openfoodfacts-products-index.json";
import olccRows from "./data/olcc-index.json";
import coreRows from "./data/core-index.json";
import openBeerRows from "./data/openbeerdb-index.json";
import { normalise, scoreNormalised } from "./match";
import { matchingDrinkIds, type NameIndex } from "./nameIndex";

const coreIndex = coreRows as unknown as NameIndex;
const importedIndexes = [openBeerRows, barAssistantRows, openFoodFactsRows, trackCaffeineRows, openFoodFactsProductRows, olccRows] as unknown as readonly NameIndex[];

export const indexedNameWordLimit = Math.max(4, ...[coreIndex, ...importedIndexes].map(index =>
  index.reduce((max, [name]) => Math.max(max, name.split(" ").length), 0),
));

export function exactCatalogueNames(normalisedName: string): CatalogueDrink[] {
  return [coreIndex, ...importedIndexes].flatMap(index => matchingDrinkIds(index, normalisedName))
    .map(id => catalogueDrink(id)!);
}

const PREFIX_LENGTH = 6;
const MIN_TYPO_QUERY = 4;
const MAX_CORRECTIONS = 60;

function deletionKeys(prefix: string): string[] {
  return [prefix, ...Array.from({ length: prefix.length }, (_, i) => prefix.slice(0, i) + prefix.slice(i + 1))];
}

/** A single edit in a partial name, including a transposition or an omitted first letter. */
function editedPrefix(query: string, name: string): boolean {
  let i = 0;
  while (i < query.length && query[i] === name[i]) i++;
  const typed = query.slice(i);
  const expected = name.slice(i);
  if (!typed || !expected) return typed.length === 1;
  return expected.startsWith(typed.slice(1)) ||
    expected.slice(1).startsWith(typed) ||
    expected.slice(1).startsWith(typed.slice(1)) ||
    (typed.length >= 2 && typed[0] === expected[1] && typed[1] === expected[0] &&
      expected.slice(2).startsWith(typed.slice(2)));
}

export function catalogueTypoScore(query: string, name: string): number | null {
  const typed = normalise(query);
  if (typed.length < MIN_TYPO_QUERY || typed.length > 90) return null;
  return editedPrefix(typed, normalise(name)) ? 1 : null;
}

let prefixCorrections: Map<string, Set<string>> | undefined;

function correctionIndex(): Map<string, Set<string>> {
  if (prefixCorrections) return prefixCorrections;
  const index = new Map<string, Set<string>>();
  const prefixes = new Set(importedIndexes.flatMap(rows => rows.map(([name]) => name.slice(0, PREFIX_LENGTH))));
  for (const prefix of prefixes) {
    for (const width of [PREFIX_LENGTH, PREFIX_LENGTH - 1, MIN_TYPO_QUERY]) {
      if (prefix.length < width) continue;
      const short = prefix.slice(0, width);
      for (const key of deletionKeys(short)) {
        if (!index.has(key)) index.set(key, new Set());
        index.get(key)!.add(short);
      }
    }
  }
  prefixCorrections = index;
  return index;
}

/**
 * Curated entries are the default popularity tier, not measured sales.
 * Short prefixes avoid the large imported indexes; exact imported names remain reachable.
 * Longer prefixes are bounded per source after applying the optional group filter.
 */
export function catalogueSearchCandidates(query: string, group?: DrinkGroup): readonly CatalogueDrink[] {
  const name = normalise(query);
  if (!name) return group ? CORE_DRINK_CATALOGUE.filter(drink => drink.group === group) : CORE_DRINK_CATALOGUE;
  const accept = (id: string) => !group || catalogueDrink(id)?.group === group;
  const popular = name.length <= 2
    ? [...matchingDrinkIds(coreIndex, name, true, Infinity, accept).map(id => catalogueDrink(id)!), ...CORE_DRINK_CATALOGUE.filter(drink => drink.generic && (!group || drink.group === group))]
    : CORE_DRINK_CATALOGUE.filter(drink => !group || drink.group === group);
  const exact = importedIndexes.flatMap(index => matchingDrinkIds(index, name, false, Infinity, accept));
  const prefixes = name.length < 3 ? [] : importedIndexes.flatMap(index => matchingDrinkIds(index, name, true, 32, accept));
  const result = new Map(popular.map(drink => [drink.id, drink]));
  for (const id of [...exact, ...prefixes]) {
    if (result.has(id)) continue;
    const drink = catalogueDrink(id);
    if (drink) result.set(id, drink);
  }
  if (name.length >= MIN_TYPO_QUERY && name.length <= 90 && result.size - popular.length < MAX_CORRECTIONS) {
    const prefix = name.slice(0, PREFIX_LENGTH);
    const corrections = new Set(deletionKeys(prefix).flatMap(key => [...(correctionIndex().get(key) ?? [])]));
    const ranked = [...corrections].flatMap(candidate => {
      if (candidate === prefix) return [{ candidate, score: 0 }];
      if (editedPrefix(prefix, candidate) || (prefix.length > MIN_TYPO_QUERY && editedPrefix(prefix.slice(0, -1), candidate))) return [{ candidate, score: 1 }];
      const score = scoreNormalised(prefix, candidate);
      return score === null || score > 1.5 ? [] : [{ candidate, score }];
    }).sort((a, b) => a.score - b.score);
    const matches = new Map<string, number>();
    for (const { candidate } of ranked.slice(0, MAX_CORRECTIONS)) {
      for (const index of importedIndexes) {
        for (const id of matchingDrinkIds(index, candidate, true, MAX_CORRECTIONS, accept)) {
          if (result.has(id) || matches.has(id)) continue;
          const brand = normalise(catalogueDrink(id)!.brand ?? "");
          const score = scoreNormalised(name, brand) ?? (editedPrefix(name, brand) ? 1 : null);
          if (score !== null && score <= 1.5) matches.set(id, score);
        }
      }
    }
    for (const [id] of [...matches].sort((a, b) => a[1] - b[1]).slice(0, MAX_CORRECTIONS)) result.set(id, catalogueDrink(id)!);
  }
  return [...result.values()];
}
