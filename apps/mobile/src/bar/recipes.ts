// O-66 to O-69: the Bar's recipes. Measures in centilitres; the alcohol strength of a drink is
// worked out from its ingredients, never typed by hand. Names and steps live in ./text/fr.ts and ./text/en.ts.

export type RecipeCategory = "classic" | "shot" | "party" | "zero" | "beer" | "dessert" | "signature";
export const RECIPE_CATEGORIES: readonly RecipeCategory[] = ["classic", "shot", "party", "zero", "beer", "dessert", "signature"];

export type IngredientId =
  | "whiteRum"
  | "darkRum"
  | "vodka"
  | "gin"
  | "tequila"
  | "whisky"
  | "bourbon"
  | "cachaca"
  | "aperol"
  | "campari"
  | "redVermouth"
  | "prosecco"
  | "champagne"
  | "tripleSec"
  | "coffeeLiqueur"
  | "irishCream"
  | "cassis"
  | "whiteWine"
  | "beer"
  | "picon"
  | "jagermeister"
  | "agricoleRum"
  | "gingerBeer"
  | "tonic"
  | "soda"
  | "cola"
  | "lemonade"
  | "limeJuice"
  | "lemonJuice"
  | "orangeJuice"
  | "cranberryJuice"
  | "pineappleJuice"
  | "tomatoJuice"
  | "grapefruitSoda"
  | "coconutCream"
  | "sugarSyrup"
  | "caneSyrup"
  | "grenadine"
  | "espresso"
  | "cream"
  | "energyDrink"
  | "mint"
  | "lime"
  | "orange"
  | "sugar"
  | "salt"
  | "angostura"
  | "hotSauce"
  | "ice";

/** Strength of each ingredient, as a fraction. */
export const INGREDIENT_ABV: Record<IngredientId, number> = {
  whiteRum: 0.4,
  darkRum: 0.4,
  vodka: 0.4,
  gin: 0.4,
  tequila: 0.38,
  whisky: 0.4,
  bourbon: 0.4,
  cachaca: 0.4,
  aperol: 0.11,
  campari: 0.25,
  redVermouth: 0.15,
  prosecco: 0.11,
  champagne: 0.12,
  tripleSec: 0.4,
  coffeeLiqueur: 0.2,
  irishCream: 0.17,
  cassis: 0.16,
  whiteWine: 0.12,
  beer: 0.05,
  picon: 0.18,
  jagermeister: 0.35,
  agricoleRum: 0.5,
  gingerBeer: 0,
  tonic: 0,
  soda: 0,
  cola: 0,
  lemonade: 0,
  limeJuice: 0,
  lemonJuice: 0,
  orangeJuice: 0,
  cranberryJuice: 0,
  pineappleJuice: 0,
  tomatoJuice: 0,
  grapefruitSoda: 0,
  coconutCream: 0,
  sugarSyrup: 0,
  caneSyrup: 0,
  grenadine: 0,
  espresso: 0,
  cream: 0,
  energyDrink: 0,
  mint: 0,
  lime: 0,
  orange: 0,
  sugar: 0,
  salt: 0,
  angostura: 0.45,
  hotSauce: 0,
  ice: 0,
};

/** Never needed to say "you can make it": everyone has some, or it is only a garnish. */
export const STAPLES: ReadonlySet<IngredientId> = new Set(["ice", "salt", "sugar"]);

export type Unit = "leaf" | "wedge" | "tsp" | "dash" | "slice";

export interface RecipeIngredient {
  id: IngredientId;
  /** Liquid measure. A top-up gives its usual volume here so the strength stays right. */
  cl?: number;
  top?: boolean;
  count?: number;
  unit?: Unit;
}

export interface Recipe {
  id: string;
  category: RecipeCategory;
  difficulty: 1 | 2 | 3;
  minutes: number;
  /** Melted ice, as a fraction of the liquid: built drinks a little, shaken ones more. */
  dilution: number;
  colour: string;
  ingredients: readonly RecipeIngredient[];
}

const r = (
  id: string,
  category: RecipeCategory,
  difficulty: 1 | 2 | 3,
  minutes: number,
  dilution: number,
  colour: string,
  ingredients: RecipeIngredient[],
): Recipe => ({ id, category, difficulty, minutes, dilution, colour, ingredients });

export const RECIPES: readonly Recipe[] = [
  r("mojito", "classic", 1, 5, 0.15, "#9BD8A8", [
    { id: "whiteRum", cl: 5 },
    { id: "limeJuice", cl: 2 },
    { id: "sugarSyrup", cl: 2 },
    { id: "mint", count: 8, unit: "leaf" },
    { id: "soda", cl: 6, top: true },
    { id: "ice" },
  ]),
  r("spritz", "party", 1, 3, 0.1, "#F2C6A0", [
    { id: "aperol", cl: 6 },
    { id: "prosecco", cl: 9 },
    { id: "soda", cl: 3 },
    { id: "orange", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("moscowMule", "classic", 1, 3, 0.1, "#8CCBEA", [
    { id: "vodka", cl: 5 },
    { id: "limeJuice", cl: 1.5 },
    { id: "gingerBeer", cl: 12, top: true },
    { id: "lime", count: 1, unit: "wedge" },
    { id: "ice" },
  ]),
  r("ginTonic", "classic", 1, 2, 0.1, "#CFE6F2", [
    { id: "gin", cl: 5 },
    { id: "tonic", cl: 15, top: true },
    { id: "lime", count: 1, unit: "wedge" },
    { id: "ice" },
  ]),
  r("margarita", "classic", 2, 4, 0.25, "#E6F2A0", [
    { id: "tequila", cl: 5 },
    { id: "tripleSec", cl: 2 },
    { id: "limeJuice", cl: 2.5 },
    { id: "salt" },
    { id: "ice" },
  ]),
  r("daiquiri", "classic", 2, 3, 0.25, "#F2EFC6", [
    { id: "whiteRum", cl: 6 },
    { id: "limeJuice", cl: 2.5 },
    { id: "sugarSyrup", cl: 1.5 },
    { id: "ice" },
  ]),
  // Crushed ice and pressed lime dilute a caipirinha far more than a built drink.
  r("caipirinha", "classic", 1, 4, 0.7, "#C6F2B0", [
    { id: "cachaca", cl: 5 },
    { id: "lime", count: 4, unit: "wedge" },
    { id: "sugar", count: 2, unit: "tsp" },
    { id: "ice" },
  ]),
  r("cubaLibre", "classic", 1, 2, 0.1, "#B08060", [
    { id: "whiteRum", cl: 5 },
    { id: "cola", cl: 12, top: true },
    { id: "lime", count: 1, unit: "wedge" },
    { id: "ice" },
  ]),
  r("negroni", "classic", 2, 3, 0.2, "#E0604A", [
    { id: "gin", cl: 3 },
    { id: "campari", cl: 3 },
    { id: "redVermouth", cl: 3 },
    { id: "orange", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("americano", "classic", 1, 2, 0.1, "#E07A5A", [
    { id: "campari", cl: 3 },
    { id: "redVermouth", cl: 3 },
    { id: "soda", cl: 6, top: true },
    { id: "orange", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("oldFashioned", "classic", 2, 4, 0.2, "#C08040", [
    { id: "bourbon", cl: 6 },
    { id: "sugarSyrup", cl: 0.5 },
    { id: "angostura", count: 2, unit: "dash" },
    { id: "orange", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("whiskySour", "classic", 2, 4, 0.25, "#F2D9A0", [
    { id: "whisky", cl: 5 },
    { id: "lemonJuice", cl: 2.5 },
    { id: "sugarSyrup", cl: 1.5 },
    { id: "ice" },
  ]),
  r("pinaColada", "party", 2, 5, 0.25, "#F7F0D8", [
    { id: "whiteRum", cl: 5 },
    { id: "pineappleJuice", cl: 9 },
    { id: "coconutCream", cl: 3 },
    { id: "ice" },
  ]),
  r("cosmopolitan", "classic", 2, 4, 0.25, "#F28AA0", [
    { id: "vodka", cl: 4 },
    { id: "tripleSec", cl: 1.5 },
    { id: "cranberryJuice", cl: 3 },
    { id: "limeJuice", cl: 1 },
    { id: "ice" },
  ]),
  r("longIsland", "party", 2, 5, 0.15, "#C89060", [
    { id: "vodka", cl: 1.5 },
    { id: "gin", cl: 1.5 },
    { id: "whiteRum", cl: 1.5 },
    { id: "tequila", cl: 1.5 },
    { id: "tripleSec", cl: 1.5 },
    { id: "lemonJuice", cl: 2.5 },
    { id: "cola", cl: 6, top: true },
    { id: "ice" },
  ]),
  r("tequilaSunrise", "party", 1, 3, 0.1, "#F7A04A", [
    { id: "tequila", cl: 4.5 },
    { id: "orangeJuice", cl: 9 },
    { id: "grenadine", cl: 1.5 },
    { id: "ice" },
  ]),
  r("bloodyMary", "classic", 2, 5, 0.1, "#C0403A", [
    { id: "vodka", cl: 4.5 },
    { id: "tomatoJuice", cl: 9 },
    { id: "lemonJuice", cl: 1.5 },
    { id: "hotSauce", count: 2, unit: "dash" },
    { id: "salt" },
    { id: "ice" },
  ]),
  r("paloma", "party", 1, 3, 0.1, "#F7B0A8", [
    { id: "tequila", cl: 5 },
    { id: "limeJuice", cl: 1.5 },
    { id: "grapefruitSoda", cl: 12, top: true },
    { id: "salt" },
    { id: "ice" },
  ]),
  r("darkStormy", "classic", 1, 2, 0.1, "#7A5030", [
    { id: "darkRum", cl: 6 },
    { id: "limeJuice", cl: 1 },
    { id: "gingerBeer", cl: 10, top: true },
    { id: "ice" },
  ]),
  r("tiPunch", "classic", 1, 2, 0, "#E6E0A0", [
    { id: "agricoleRum", cl: 5 },
    { id: "caneSyrup", cl: 1 },
    { id: "lime", count: 1, unit: "wedge" },
  ]),
  r("kir", "party", 1, 1, 0, "#C04070", [
    { id: "whiteWine", cl: 10 },
    { id: "cassis", cl: 1.5 },
  ]),
  r("kirRoyal", "party", 1, 1, 0, "#B03060", [
    { id: "champagne", cl: 10 },
    { id: "cassis", cl: 1.5 },
  ]),
  r("mimosa", "party", 1, 1, 0, "#F7C04A", [
    { id: "champagne", cl: 7.5 },
    { id: "orangeJuice", cl: 7.5 },
  ]),
  r("tequilaPaf", "shot", 1, 1, 0, "#F4B33D", [
    { id: "tequila", cl: 2 },
    { id: "lemonade", cl: 2 },
  ]),
  r("b52", "shot", 3, 3, 0, "#A06030", [
    { id: "coffeeLiqueur", cl: 1.5 },
    { id: "irishCream", cl: 1.5 },
    { id: "tripleSec", cl: 1.5 },
  ]),
  r("kamikaze", "shot", 2, 2, 0.2, "#E6F2C6", [
    { id: "vodka", cl: 2 },
    { id: "tripleSec", cl: 1 },
    { id: "limeJuice", cl: 1 },
    { id: "ice" },
  ]),
  r("jagerbomb", "shot", 1, 1, 0, "#604020", [
    { id: "jagermeister", cl: 2 },
    { id: "energyDrink", cl: 10 },
  ]),
  r("lemonDrop", "shot", 2, 2, 0.2, "#F7F0A0", [
    { id: "vodka", cl: 2.5 },
    { id: "lemonJuice", cl: 1 },
    { id: "sugarSyrup", cl: 0.5 },
    { id: "sugar" },
    { id: "ice" },
  ]),
  r("virginMojito", "zero", 1, 5, 0.15, "#9BD8A8", [
    { id: "limeJuice", cl: 2 },
    { id: "sugarSyrup", cl: 2 },
    { id: "mint", count: 8, unit: "leaf" },
    { id: "soda", cl: 12, top: true },
    { id: "ice" },
  ]),
  r("virginColada", "zero", 1, 4, 0.2, "#F7F0D8", [
    { id: "pineappleJuice", cl: 12 },
    { id: "coconutCream", cl: 4 },
    { id: "limeJuice", cl: 1 },
    { id: "ice" },
  ]),
  r("shirleyTemple", "zero", 1, 2, 0.1, "#F2A0A0", [
    { id: "lemonade", cl: 15, top: true },
    { id: "grenadine", cl: 1.5 },
    { id: "orange", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("citronnade", "zero", 1, 3, 0.1, "#F7F0A0", [
    { id: "lemonJuice", cl: 3 },
    { id: "sugarSyrup", cl: 2 },
    { id: "soda", cl: 15, top: true },
    { id: "mint", count: 4, unit: "leaf" },
    { id: "ice" },
  ]),
  r("panache", "beer", 1, 1, 0, "#F4D36A", [
    { id: "beer", cl: 12.5 },
    { id: "lemonade", cl: 12.5 },
  ]),
  r("monaco", "beer", 1, 1, 0, "#F09060", [
    { id: "beer", cl: 12.5 },
    { id: "lemonade", cl: 12.5 },
    { id: "grenadine", cl: 1.5 },
  ]),
  r("piconBiere", "beer", 1, 1, 0, "#D08030", [
    { id: "beer", cl: 25 },
    { id: "picon", cl: 3 },
  ]),
  r("michelada", "beer", 2, 3, 0.05, "#E07040", [
    { id: "beer", cl: 25 },
    { id: "limeJuice", cl: 2 },
    { id: "tomatoJuice", cl: 4 },
    { id: "hotSauce", count: 2, unit: "dash" },
    { id: "salt" },
    { id: "ice" },
  ]),
  r("espressoMartini", "dessert", 2, 6, 0.25, "#6A4A30", [
    { id: "vodka", cl: 4 },
    { id: "coffeeLiqueur", cl: 2 },
    { id: "espresso", cl: 3 },
    { id: "sugarSyrup", cl: 0.5 },
    { id: "ice" },
  ]),
  r("whiteRussian", "dessert", 1, 3, 0.1, "#E8D8C0", [
    { id: "vodka", cl: 4 },
    { id: "coffeeLiqueur", cl: 2 },
    { id: "cream", cl: 3 },
    { id: "ice" },
  ]),
  r("irishCoffee", "dessert", 2, 5, 0, "#8A6A50", [
    { id: "whisky", cl: 4 },
    { id: "espresso", cl: 8 },
    { id: "sugarSyrup", cl: 1 },
    { id: "cream", cl: 3 },
  ]),
  r("zincSpritz", "signature", 1, 3, 0.1, "#FF9C8A", [
    { id: "campari", cl: 3 },
    { id: "prosecco", cl: 9 },
    { id: "grapefruitSoda", cl: 6, top: true },
    { id: "orange", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("crewMule", "signature", 1, 3, 0.1, "#8CCBEA", [
    { id: "darkRum", cl: 4 },
    { id: "limeJuice", cl: 1.5 },
    { id: "pineappleJuice", cl: 3 },
    { id: "gingerBeer", cl: 9, top: true },
    { id: "ice" },
  ]),
];

/** Final strength after the ice melts, as a fraction. */
export function recipeAbv(recipe: Recipe): number {
  let alcohol = 0;
  let volume = 0;
  for (const i of recipe.ingredients) {
    if (!i.cl) continue;
    alcohol += i.cl * INGREDIENT_ABV[i.id];
    volume += i.cl;
  }
  if (!volume) return 0;
  return alcohol / (volume * (1 + recipe.dilution));
}

/** Total liquid of one glass, centilitres, before the ice melts. */
export function recipeVolume(recipe: Recipe): number {
  return recipe.ingredients.reduce((sum, i) => sum + (i.cl ?? 0), 0);
}

export function ingredientsOf(recipe: Recipe): IngredientId[] {
  return recipe.ingredients.map((i) => i.id).filter((id) => !STAPLES.has(id));
}

/** O-69: what can be made with what is at hand, best first, and what is missing for the rest. */
export function makeable(have: ReadonlySet<IngredientId>): { recipe: Recipe; missing: IngredientId[] }[] {
  return RECIPES.map((recipe) => ({ recipe, missing: ingredientsOf(recipe).filter((id) => !have.has(id)) }))
    .filter((r) => r.missing.length <= 2)
    .sort((a, b) => a.missing.length - b.missing.length || a.recipe.difficulty - b.recipe.difficulty);
}

/** Every ingredient used by a recipe, for the mixer's chips. */
export const MIXER_INGREDIENTS: readonly IngredientId[] = [...new Set(RECIPES.flatMap(ingredientsOf))];
