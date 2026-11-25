import { catalogueDrink, CORE_DRINK_CATALOGUE, type CatalogueDrink } from "./catalogue";
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

/** Keep fuzzy matching on hand-curated names; find imported names by prefix. */
export function catalogueSearchCandidates(query: string): readonly CatalogueDrink[] {
  const name = normalise(query);
  const imported = importedIndexes.flatMap(index => matchingDrinkIds(index, name, true));
  return imported.length ? [...CORE_DRINK_CATALOGUE, ...imported.map(id => catalogueDrink(id)!)] : CORE_DRINK_CATALOGUE;
}
