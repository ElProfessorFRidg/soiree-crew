import { catalogueDrink, CORE_DRINK_CATALOGUE, type CatalogueDrink } from "./catalogue";
import coreRows from "./data/core-index.json";
import openBeerRows from "./data/openbeerdb-index.json";
import { normalise } from "./match";
import { matchingDrinkIds, type NameIndex } from "./nameIndex";

const coreIndex = coreRows as unknown as NameIndex;
const openBeerIndex = openBeerRows as unknown as NameIndex;

export const indexedNameWordLimit = Math.max(4, ...[coreIndex, openBeerIndex].map(index =>
  index.reduce((max, [name]) => Math.max(max, name.split(" ").length), 0),
));

export function exactCatalogueNames(normalisedName: string): CatalogueDrink[] {
  return [...matchingDrinkIds(coreIndex, normalisedName), ...matchingDrinkIds(openBeerIndex, normalisedName)]
    .map(id => catalogueDrink(id)!);
}

/** Keep fuzzy matching on hand-curated names; find imported names by prefix. */
export function catalogueSearchCandidates(query: string): readonly CatalogueDrink[] {
  const imported = matchingDrinkIds(openBeerIndex, normalise(query), true);
  return imported.length ? [...CORE_DRINK_CATALOGUE, ...imported.map(id => catalogueDrink(id)!)] : CORE_DRINK_CATALOGUE;
}
