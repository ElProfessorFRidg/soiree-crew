import { catalogueDrink, CORE_DRINK_CATALOGUE, type DrinkGroup, type CatalogueDrink } from "./catalogue";
import trackCaffeineRows from "./data/trackcaffeine-index.json";
import barAssistantRows from "./data/bar-assistant-index.json";
import openFoodFactsRows from "./data/openfoodfacts-index.json";
import openFoodFactsProductRows from "./data/openfoodfacts-products-index.json";
import olccRows from "./data/olcc-index.json";
import coreRows from "./data/core-index.json";
import openBeerRows from "./data/openbeerdb-index.json";
import { normalise } from "./match";
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
  return [...result.values()];
}
