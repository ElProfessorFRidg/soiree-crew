/**
 * ADP-05, AI-01 fallback: forgiving text input for a drunk thumb. Accents, case and small typos do
 * not matter; "2 pintes et un shoot" becomes two pints and one shot, "demi kro" a Kronenbourg.
 */

export { adjacentKeys, bestScore, editDistance, isEverydayWord, jaroWinkler, matchScore, normalise, scoreNormalised, search, soundOf, typoDistance, wordScore, type Candidate } from "./match";
export { parseDrinkOrder, parseOrder, tokenize, type OrderLine, type OrderOptions } from "./order";
export {
  catalogueDrink,
  catalogueNames,
  comboOf,
  countryRank,
  DRINK_CATALOGUE,
  GROUP_SPECS,
  localName,
  SHELF_ORDER,
  shownNames,
  sizesFor,
  strengthFits,
  type CatalogueDrink,
  type DrinkGroup,
  type GenericDrinkId,
  type GlassName,
  type GroupSpec,
  type LocalName,
  type ServingId,
  type ShownName,
  type SizeOption,
} from "./catalogue";
