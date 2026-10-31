/**
 * ADP-05, AI-01 fallback: forgiving text input for a drunk thumb. Accents, case and small typos do
 * not matter; "2 pintes et un shoot" becomes two pints and one shot, "demi kro" a Kronenbourg.
 */

export { bestScore, editDistance, matchScore, normalise, scoreNormalised, search, type Candidate } from "./match";
export { parseDrinkOrder, parseOrder, tokenize, type OrderLine, type OrderOptions } from "./order";
export {
  catalogueDrink,
  catalogueNames,
  comboOf,
  DRINK_CATALOGUE,
  GROUP_SPECS,
  strengthFits,
  type CatalogueDrink,
  type DrinkGroup,
  type GenericDrinkId,
  type GlassName,
  type GroupSpec,
  type ServingId,
  type SizeOption,
} from "./catalogue";
