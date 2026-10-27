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
  | "mezcal"
  | "pisco"
  | "cognac"
  | "calvados"
  | "rye"
  | "peatedWhisky"
  | "absinthe"
  | "pastis"
  | "coconutRum"
  | "sloeGin"
  | "sake"
  | "cinnamonWhisky"
  | "amaretto"
  | "maraschino"
  | "elderflowerLiqueur"
  | "greenChartreuse"
  | "yellowChartreuse"
  | "benedictine"
  | "drambuie"
  | "peachSchnapps"
  | "melonLiqueur"
  | "blueCuracao"
  | "apricotBrandy"
  | "cherryBrandy"
  | "cacaoLiqueur"
  | "mintLiqueur"
  | "raspberryLiqueur"
  | "blackberryLiqueur"
  | "hazelnutLiqueur"
  | "bananaLiqueur"
  | "appleLiqueur"
  | "limoncello"
  | "sambuca"
  | "vanillaLiqueur"
  | "falernum"
  | "pimms"
  | "amaro"
  | "fernet"
  | "gentian"
  | "lillet"
  | "dryVermouth"
  | "orangeBitters"
  | "peychaud"
  | "redWine"
  | "cider"
  | "port"
  | "whitePort"
  | "sherry"
  | "stout"
  | "wheatBeer"
  | "appleJuice"
  | "grapefruitJuice"
  | "passionJuice"
  | "mangoJuice"
  | "peachJuice"
  | "grapeJuice"
  | "watermelonJuice"
  | "coconutWater"
  | "milk"
  | "yogurt"
  | "iceCream"
  | "tea"
  | "greenTea"
  | "gingerAle"
  | "chocolateSyrup"
  | "cocoa"
  | "honeySyrup"
  | "agaveSyrup"
  | "orgeat"
  | "raspberrySyrup"
  | "strawberrySyrup"
  | "mintSyrup"
  | "elderflowerSyrup"
  | "vanillaSyrup"
  | "gingerSyrup"
  | "caramelSyrup"
  | "eggWhite"
  | "egg"
  | "condensedMilk"
  | "butter"
  | "lemon"
  | "cucumber"
  | "strawberry"
  | "raspberry"
  | "banana"
  | "basil"
  | "chili"
  | "cinnamon"
  | "nutmeg"
  | "worcestershire"
  | "olive"
  | "oliveBrine"
  | "cherry"
  | "coffeeBeans"
  | "pickleBrine"
  | "ginger"
  | "water"
  | "roseWine"
  | "soju"
  | "marmalade"
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
  mezcal: 0.4,
  pisco: 0.4,
  cognac: 0.4,
  calvados: 0.4,
  rye: 0.45,
  peatedWhisky: 0.43,
  absinthe: 0.6,
  pastis: 0.45,
  coconutRum: 0.21,
  sloeGin: 0.26,
  sake: 0.15,
  cinnamonWhisky: 0.33,
  amaretto: 0.28,
  maraschino: 0.32,
  elderflowerLiqueur: 0.2,
  greenChartreuse: 0.55,
  yellowChartreuse: 0.4,
  benedictine: 0.4,
  drambuie: 0.4,
  peachSchnapps: 0.2,
  melonLiqueur: 0.2,
  blueCuracao: 0.25,
  apricotBrandy: 0.24,
  cherryBrandy: 0.24,
  cacaoLiqueur: 0.24,
  mintLiqueur: 0.24,
  raspberryLiqueur: 0.165,
  blackberryLiqueur: 0.16,
  hazelnutLiqueur: 0.2,
  bananaLiqueur: 0.2,
  appleLiqueur: 0.18,
  limoncello: 0.3,
  sambuca: 0.38,
  vanillaLiqueur: 0.3,
  falernum: 0.11,
  pimms: 0.25,
  amaro: 0.3,
  fernet: 0.39,
  gentian: 0.15,
  lillet: 0.17,
  dryVermouth: 0.18,
  orangeBitters: 0.28,
  peychaud: 0.35,
  redWine: 0.13,
  cider: 0.05,
  port: 0.2,
  whitePort: 0.19,
  sherry: 0.15,
  stout: 0.042,
  wheatBeer: 0.05,
  appleJuice: 0,
  grapefruitJuice: 0,
  passionJuice: 0,
  mangoJuice: 0,
  peachJuice: 0,
  grapeJuice: 0,
  watermelonJuice: 0,
  coconutWater: 0,
  milk: 0,
  yogurt: 0,
  iceCream: 0,
  tea: 0,
  greenTea: 0,
  gingerAle: 0,
  chocolateSyrup: 0,
  cocoa: 0,
  honeySyrup: 0,
  agaveSyrup: 0,
  orgeat: 0,
  raspberrySyrup: 0,
  strawberrySyrup: 0,
  mintSyrup: 0,
  elderflowerSyrup: 0,
  vanillaSyrup: 0,
  gingerSyrup: 0,
  caramelSyrup: 0,
  eggWhite: 0,
  egg: 0,
  condensedMilk: 0,
  butter: 0,
  lemon: 0,
  cucumber: 0,
  strawberry: 0,
  raspberry: 0,
  banana: 0,
  basil: 0,
  chili: 0,
  cinnamon: 0,
  nutmeg: 0,
  worcestershire: 0,
  olive: 0,
  oliveBrine: 0,
  cherry: 0,
  coffeeBeans: 0,
  pickleBrine: 0,
  ginger: 0,
  water: 0,
  roseWine: 0.12,
  soju: 0.17,
  marmalade: 0,
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
  r("dryMartini", "classic", 2, 3, 0.2, "#E8EEF0", [
    { id: "gin", cl: 6 },
    { id: "dryVermouth", cl: 1 },
    { id: "olive", count: 1 },
    { id: "ice" },
  ]),
  r("dirtyMartini", "classic", 2, 3, 0.2, "#D8DCC0", [
    { id: "gin", cl: 6 },
    { id: "dryVermouth", cl: 1 },
    { id: "oliveBrine", cl: 1.5 },
    { id: "olive", count: 2 },
    { id: "ice" },
  ]),
  r("vesper", "classic", 2, 3, 0.2, "#EDE8C8", [
    { id: "gin", cl: 4.5 },
    { id: "vodka", cl: 1.5 },
    { id: "lillet", cl: 0.75 },
    { id: "lemon", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("martinez", "classic", 2, 3, 0.2, "#B0503A", [
    { id: "gin", cl: 4.5 },
    { id: "redVermouth", cl: 4.5 },
    { id: "maraschino", cl: 0.5 },
    { id: "orangeBitters", count: 2, unit: "dash" },
    { id: "ice" },
  ]),
  r("tuxedo", "classic", 2, 4, 0.2, "#E6E2C8", [
    { id: "gin", cl: 3 },
    { id: "dryVermouth", cl: 3 },
    { id: "maraschino", cl: 0.5 },
    { id: "absinthe", count: 1, unit: "dash" },
    { id: "orangeBitters", count: 3, unit: "dash" },
    { id: "cherry", count: 1 },
    { id: "ice" },
  ]),
  r("gimlet", "classic", 1, 3, 0.25, "#DDF0C0", [
    { id: "gin", cl: 6 },
    { id: "limeJuice", cl: 2 },
    { id: "sugarSyrup", cl: 2 },
    { id: "ice" },
  ]),
  r("tomCollins", "classic", 1, 3, 0.15, "#F0F0D0", [
    { id: "gin", cl: 4.5 },
    { id: "lemonJuice", cl: 3 },
    { id: "sugarSyrup", cl: 1.5 },
    { id: "soda", cl: 6, top: true },
    { id: "lemon", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("ginFizz", "classic", 2, 4, 0.2, "#F4F4E0", [
    { id: "gin", cl: 4.5 },
    { id: "lemonJuice", cl: 3 },
    { id: "sugarSyrup", cl: 1 },
    { id: "soda", cl: 8, top: true },
    { id: "ice" },
  ]),
  r("ramosGinFizz", "classic", 3, 8, 0.25, "#F8F6EE", [
    { id: "gin", cl: 4.5 },
    { id: "lemonJuice", cl: 1.5 },
    { id: "limeJuice", cl: 1.5 },
    { id: "sugarSyrup", cl: 3 },
    { id: "cream", cl: 6 },
    { id: "eggWhite", cl: 3 },
    { id: "soda", cl: 3, top: true },
    { id: "ice" },
  ]),
  r("ginRickey", "classic", 1, 2, 0.1, "#E8F4E0", [
    { id: "gin", cl: 6 },
    { id: "limeJuice", cl: 2 },
    { id: "soda", cl: 12, top: true },
    { id: "lime", count: 1, unit: "wedge" },
    { id: "ice" },
  ]),
  r("bramble", "classic", 2, 4, 0.2, "#8A3060", [
    { id: "gin", cl: 4 },
    { id: "lemonJuice", cl: 1.5 },
    { id: "sugarSyrup", cl: 1 },
    { id: "blackberryLiqueur", cl: 1.5 },
    { id: "ice" },
  ]),
  r("southside", "classic", 2, 4, 0.25, "#CFEAC0", [
    { id: "gin", cl: 6 },
    { id: "limeJuice", cl: 3 },
    { id: "sugarSyrup", cl: 1.5 },
    { id: "mint", count: 6, unit: "leaf" },
    { id: "ice" },
  ]),
  r("aviation", "classic", 2, 3, 0.25, "#D8D8EA", [
    { id: "gin", cl: 4.5 },
    { id: "maraschino", cl: 1.5 },
    { id: "lemonJuice", cl: 1.5 },
    { id: "cherry", count: 1 },
    { id: "ice" },
  ]),
  r("lastWord", "classic", 2, 3, 0.25, "#C8E0A0", [
    { id: "gin", cl: 2.25 },
    { id: "greenChartreuse", cl: 2.25 },
    { id: "maraschino", cl: 2.25 },
    { id: "limeJuice", cl: 2.25 },
    { id: "ice" },
  ]),
  r("cloverClub", "classic", 3, 5, 0.25, "#F0A0B0", [
    { id: "gin", cl: 4.5 },
    { id: "raspberrySyrup", cl: 1.5 },
    { id: "lemonJuice", cl: 1.5 },
    { id: "eggWhite", cl: 2 },
    { id: "ice" },
  ]),
  r("whiteLady", "classic", 2, 3, 0.25, "#F4F0DC", [
    { id: "gin", cl: 4 },
    { id: "tripleSec", cl: 3 },
    { id: "lemonJuice", cl: 2 },
    { id: "ice" },
  ]),
  r("beesKnees", "classic", 1, 3, 0.25, "#F2DFA0", [
    { id: "gin", cl: 5 },
    { id: "lemonJuice", cl: 2 },
    { id: "honeySyrup", cl: 2 },
    { id: "ice" },
  ]),
  r("corpseReviver2", "classic", 2, 4, 0.25, "#EDEACB", [
    { id: "gin", cl: 3 },
    { id: "tripleSec", cl: 3 },
    { id: "lillet", cl: 3 },
    { id: "lemonJuice", cl: 3 },
    { id: "absinthe", count: 1, unit: "dash" },
    { id: "ice" },
  ]),
  r("french75", "classic", 2, 4, 0.2, "#F2EBC0", [
    { id: "gin", cl: 3 },
    { id: "lemonJuice", cl: 1.5 },
    { id: "sugarSyrup", cl: 1.5 },
    { id: "champagne", cl: 6, top: true },
    { id: "ice" },
  ]),
  r("singaporeSling", "classic", 3, 5, 0.2, "#F08A8A", [
    { id: "gin", cl: 3 },
    { id: "cherryBrandy", cl: 1.5 },
    { id: "tripleSec", cl: 0.75 },
    { id: "benedictine", cl: 0.75 },
    { id: "pineappleJuice", cl: 12 },
    { id: "limeJuice", cl: 1.5 },
    { id: "grenadine", cl: 1 },
    { id: "angostura", count: 1, unit: "dash" },
    { id: "ice" },
  ]),
  r("bronx", "classic", 2, 3, 0.25, "#F0B060", [
    { id: "gin", cl: 3 },
    { id: "redVermouth", cl: 1 },
    { id: "dryVermouth", cl: 1 },
    { id: "orangeJuice", cl: 1 },
    { id: "ice" },
  ]),
  r("peguClub", "classic", 2, 3, 0.25, "#EFE8C0", [
    { id: "gin", cl: 4.5 },
    { id: "tripleSec", cl: 1.5 },
    { id: "limeJuice", cl: 1.5 },
    { id: "angostura", count: 1, unit: "dash" },
    { id: "orangeBitters", count: 1, unit: "dash" },
    { id: "ice" },
  ]),
  r("hankyPanky", "classic", 2, 3, 0.2, "#8A3A2A", [
    { id: "gin", cl: 4.5 },
    { id: "redVermouth", cl: 4.5 },
    { id: "fernet", cl: 0.75 },
    { id: "orange", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("monkeyGland", "classic", 2, 3, 0.25, "#F09050", [
    { id: "gin", cl: 5 },
    { id: "orangeJuice", cl: 3 },
    { id: "grenadine", cl: 0.5 },
    { id: "absinthe", count: 1, unit: "dash" },
    { id: "ice" },
  ]),
  r("paradise", "classic", 2, 3, 0.25, "#F4B050", [
    { id: "gin", cl: 3.5 },
    { id: "apricotBrandy", cl: 2 },
    { id: "orangeJuice", cl: 1.5 },
    { id: "ice" },
  ]),
  r("angelFace", "classic", 2, 3, 0.2, "#E8B060", [
    { id: "gin", cl: 3 },
    { id: "apricotBrandy", cl: 3 },
    { id: "calvados", cl: 3 },
    { id: "ice" },
  ]),
  r("casino", "classic", 2, 3, 0.25, "#EEECD8", [
    { id: "gin", cl: 4 },
    { id: "maraschino", cl: 1 },
    { id: "lemonJuice", cl: 1 },
    { id: "orangeBitters", count: 2, unit: "dash" },
    { id: "cherry", count: 1 },
    { id: "ice" },
  ]),
  r("bijou", "classic", 2, 3, 0.2, "#9A6A20", [
    { id: "gin", cl: 3 },
    { id: "greenChartreuse", cl: 3 },
    { id: "redVermouth", cl: 3 },
    { id: "orangeBitters", count: 1, unit: "dash" },
    { id: "ice" },
  ]),
  r("ginBasilSmash", "classic", 2, 4, 0.25, "#9AD080", [
    { id: "gin", cl: 6 },
    { id: "lemonJuice", cl: 2.5 },
    { id: "sugarSyrup", cl: 2 },
    { id: "basil", count: 10, unit: "leaf" },
    { id: "ice" },
  ]),
  r("ginGinMule", "classic", 2, 4, 0.2, "#CFE8C0", [
    { id: "gin", cl: 4.5 },
    { id: "limeJuice", cl: 2 },
    { id: "sugarSyrup", cl: 2 },
    { id: "mint", count: 6, unit: "leaf" },
    { id: "gingerBeer", cl: 4, top: true },
    { id: "ice" },
  ]),
  r("pinkGin", "classic", 1, 2, 0.2, "#F0C8C0", [
    { id: "gin", cl: 6 },
    { id: "angostura", count: 4, unit: "dash" },
    { id: "ice" },
  ]),
  r("armyNavy", "classic", 2, 3, 0.25, "#F2E8D0", [
    { id: "gin", cl: 6 },
    { id: "lemonJuice", cl: 2.25 },
    { id: "orgeat", cl: 1.5 },
    { id: "ice" },
  ]),
  r("saltyDog", "classic", 1, 2, 0.1, "#F8C8B0", [
    { id: "gin", cl: 4.5 },
    { id: "grapefruitJuice", cl: 12 },
    { id: "salt" },
    { id: "ice" },
  ]),
  r("pinkLady", "classic", 3, 5, 0.25, "#F4B0B8", [
    { id: "gin", cl: 4.5 },
    { id: "calvados", cl: 1.5 },
    { id: "lemonJuice", cl: 1.5 },
    { id: "grenadine", cl: 1 },
    { id: "eggWhite", cl: 2 },
    { id: "ice" },
  ]),
  r("whiteNegroni", "classic", 2, 3, 0.2, "#F2EAB0", [
    { id: "gin", cl: 4.5 },
    { id: "gentian", cl: 2 },
    { id: "lillet", cl: 3 },
    { id: "lemon", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("twentiethCentury", "classic", 2, 3, 0.25, "#F0ECD8", [
    { id: "gin", cl: 4.5 },
    { id: "lillet", cl: 2 },
    { id: "cacaoLiqueur", cl: 1.5 },
    { id: "lemonJuice", cl: 1.5 },
    { id: "ice" },
  ]),
  r("alaska", "classic", 2, 3, 0.2, "#F0E070", [
    { id: "gin", cl: 5 },
    { id: "yellowChartreuse", cl: 2 },
    { id: "orangeBitters", count: 2, unit: "dash" },
    { id: "ice" },
  ]),
  r("negroniSbagliato", "classic", 1, 2, 0.1, "#E06A50", [
    { id: "campari", cl: 3 },
    { id: "redVermouth", cl: 3 },
    { id: "prosecco", cl: 3, top: true },
    { id: "orange", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("saturn", "classic", 2, 4, 0.25, "#F4C060", [
    { id: "gin", cl: 4.5 },
    { id: "lemonJuice", cl: 2 },
    { id: "passionJuice", cl: 2 },
    { id: "orgeat", cl: 1 },
    { id: "falernum", cl: 1 },
    { id: "ice" },
  ]),
  r("screwdriver", "classic", 1, 2, 0.1, "#F7B040", [
    { id: "vodka", cl: 5 },
    { id: "orangeJuice", cl: 10 },
    { id: "orange", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("harveyWallbanger", "classic", 1, 3, 0.1, "#F4B030", [
    { id: "vodka", cl: 4.5 },
    { id: "orangeJuice", cl: 9 },
    { id: "vanillaLiqueur", cl: 1.5 },
    { id: "ice" },
  ]),
  r("capeCodder", "classic", 1, 2, 0.1, "#C83050", [
    { id: "vodka", cl: 5 },
    { id: "cranberryJuice", cl: 12 },
    { id: "lime", count: 1, unit: "wedge" },
    { id: "ice" },
  ]),
  r("seaBreeze", "classic", 1, 2, 0.1, "#E86070", [
    { id: "vodka", cl: 4 },
    { id: "cranberryJuice", cl: 12 },
    { id: "grapefruitJuice", cl: 3 },
    { id: "ice" },
  ]),
  r("godmother", "classic", 1, 2, 0.15, "#E8C890", [
    { id: "vodka", cl: 3.5 },
    { id: "amaretto", cl: 3.5 },
    { id: "ice" },
  ]),
  r("frenchMartini", "classic", 2, 3, 0.25, "#D86080", [
    { id: "vodka", cl: 4.5 },
    { id: "raspberryLiqueur", cl: 1.5 },
    { id: "pineappleJuice", cl: 1.5 },
    { id: "ice" },
  ]),
  r("russianSpringPunch", "classic", 2, 4, 0.15, "#B04070", [
    { id: "vodka", cl: 2.5 },
    { id: "lemonJuice", cl: 2.5 },
    { id: "cassis", cl: 1.5 },
    { id: "sugarSyrup", cl: 1 },
    { id: "champagne", cl: 6, top: true },
    { id: "ice" },
  ]),
  r("spicyFifty", "classic", 2, 4, 0.25, "#E8E8B0", [
    { id: "vodka", cl: 5 },
    { id: "elderflowerSyrup", cl: 1.5 },
    { id: "limeJuice", cl: 1.5 },
    { id: "honeySyrup", cl: 1 },
    { id: "chili", count: 2, unit: "slice" },
    { id: "ice" },
  ]),
  r("manhattan", "classic", 2, 3, 0.2, "#A0402A", [
    { id: "rye", cl: 5 },
    { id: "redVermouth", cl: 2 },
    { id: "angostura", count: 1, unit: "dash" },
    { id: "cherry", count: 1 },
    { id: "ice" },
  ]),
  r("robRoy", "classic", 2, 3, 0.2, "#A84A2A", [
    { id: "whisky", cl: 4.5 },
    { id: "redVermouth", cl: 2.5 },
    { id: "angostura", count: 1, unit: "dash" },
    { id: "cherry", count: 1 },
    { id: "ice" },
  ]),
  r("rustyNail", "classic", 1, 2, 0.15, "#C88A3A", [
    { id: "whisky", cl: 4.5 },
    { id: "drambuie", cl: 2.5 },
    { id: "ice" },
  ]),
  r("godfather", "classic", 1, 2, 0.15, "#B87A3A", [
    { id: "whisky", cl: 3.5 },
    { id: "amaretto", cl: 3.5 },
    { id: "ice" },
  ]),
  r("bloodAndSand", "classic", 2, 3, 0.25, "#C0502A", [
    { id: "whisky", cl: 2.5 },
    { id: "cherryBrandy", cl: 2 },
    { id: "redVermouth", cl: 2 },
    { id: "orangeJuice", cl: 2.5 },
    { id: "ice" },
  ]),
  r("penicillin", "classic", 2, 4, 0.25, "#E8C070", [
    { id: "whisky", cl: 5 },
    { id: "lemonJuice", cl: 2 },
    { id: "honeySyrup", cl: 1 },
    { id: "gingerSyrup", cl: 1 },
    { id: "peatedWhisky", cl: 0.75 },
    { id: "ice" },
  ]),
  r("whiskyHighball", "classic", 1, 2, 0.1, "#F0DCA0", [
    { id: "whisky", cl: 5 },
    { id: "soda", cl: 15, top: true },
    { id: "lemon", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("mintJulep", "classic", 2, 4, 0.25, "#C8D890", [
    { id: "bourbon", cl: 6 },
    { id: "sugarSyrup", cl: 1.5 },
    { id: "mint", count: 10, unit: "leaf" },
    { id: "ice" },
  ]),
  r("wardEight", "classic", 2, 3, 0.25, "#E07850", [
    { id: "rye", cl: 6 },
    { id: "lemonJuice", cl: 1.5 },
    { id: "orangeJuice", cl: 1.5 },
    { id: "grenadine", cl: 1 },
    { id: "ice" },
  ]),
  r("newYorkSour", "classic", 3, 5, 0.25, "#A03040", [
    { id: "rye", cl: 6 },
    { id: "lemonJuice", cl: 3 },
    { id: "sugarSyrup", cl: 2.25 },
    { id: "eggWhite", cl: 1.5 },
    { id: "redWine", cl: 3 },
    { id: "ice" },
  ]),
  r("boulevardier", "classic", 2, 3, 0.2, "#B0402A", [
    { id: "bourbon", cl: 4.5 },
    { id: "campari", cl: 3 },
    { id: "redVermouth", cl: 3 },
    { id: "orange", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("oldPal", "classic", 2, 3, 0.2, "#D0603A", [
    { id: "rye", cl: 3 },
    { id: "campari", cl: 3 },
    { id: "dryVermouth", cl: 3 },
    { id: "ice" },
  ]),
  r("brownDerby", "classic", 1, 3, 0.25, "#E8B080", [
    { id: "bourbon", cl: 6 },
    { id: "grapefruitJuice", cl: 3 },
    { id: "honeySyrup", cl: 1.5 },
    { id: "ice" },
  ]),
  r("goldRush", "classic", 1, 3, 0.2, "#E8C060", [
    { id: "bourbon", cl: 6 },
    { id: "lemonJuice", cl: 2.25 },
    { id: "honeySyrup", cl: 2.25 },
    { id: "ice" },
  ]),
  r("paperPlane", "classic", 2, 3, 0.25, "#F09050", [
    { id: "bourbon", cl: 3 },
    { id: "aperol", cl: 3 },
    { id: "amaro", cl: 3 },
    { id: "lemonJuice", cl: 3 },
    { id: "ice" },
  ]),
  r("bobbyBurns", "classic", 2, 3, 0.2, "#A0502A", [
    { id: "whisky", cl: 4.5 },
    { id: "redVermouth", cl: 3 },
    { id: "benedictine", cl: 0.75 },
    { id: "ice" },
  ]),
  r("toronto", "classic", 2, 3, 0.2, "#8A4020", [
    { id: "rye", cl: 6 },
    { id: "fernet", cl: 0.75 },
    { id: "sugarSyrup", cl: 0.5 },
    { id: "angostura", count: 1, unit: "dash" },
    { id: "ice" },
  ]),
  r("rememberTheMaine", "classic", 2, 4, 0.2, "#902A20", [
    { id: "rye", cl: 6 },
    { id: "redVermouth", cl: 2.25 },
    { id: "cherryBrandy", cl: 1 },
    { id: "absinthe", count: 1, unit: "dash" },
    { id: "ice" },
  ]),
  r("hotToddy", "classic", 1, 5, 0, "#E0A060", [
    { id: "whisky", cl: 4 },
    { id: "honeySyrup", cl: 1.5 },
    { id: "lemonJuice", cl: 1.5 },
    { id: "water", cl: 10 },
    { id: "lemon", count: 1, unit: "slice" },
  ]),
  r("whiskySmash", "classic", 2, 4, 0.25, "#D8C080", [
    { id: "bourbon", cl: 6 },
    { id: "lemon", count: 3, unit: "wedge" },
    { id: "sugarSyrup", cl: 2 },
    { id: "mint", count: 6, unit: "leaf" },
    { id: "ice" },
  ]),
  r("sazerac", "classic", 3, 5, 0.2, "#B04A2A", [
    { id: "rye", cl: 5 },
    { id: "sugarSyrup", cl: 0.5 },
    { id: "peychaud", count: 3, unit: "dash" },
    { id: "absinthe", count: 1, unit: "dash" },
    { id: "lemon", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("vieuxCarre", "classic", 3, 4, 0.2, "#A04A2A", [
    { id: "rye", cl: 3 },
    { id: "cognac", cl: 3 },
    { id: "redVermouth", cl: 3 },
    { id: "benedictine", cl: 0.5 },
    { id: "peychaud", count: 2, unit: "dash" },
    { id: "angostura", count: 2, unit: "dash" },
    { id: "ice" },
  ]),
  r("algonquin", "classic", 2, 3, 0.25, "#E8D080", [
    { id: "rye", cl: 4.5 },
    { id: "dryVermouth", cl: 2 },
    { id: "pineappleJuice", cl: 2 },
    { id: "ice" },
  ]),
  r("brooklyn", "classic", 2, 3, 0.2, "#B06030", [
    { id: "rye", cl: 6 },
    { id: "dryVermouth", cl: 2 },
    { id: "maraschino", cl: 0.75 },
    { id: "picon", cl: 0.75 },
    { id: "ice" },
  ]),
  r("blinker", "classic", 1, 3, 0.25, "#E06070", [
    { id: "rye", cl: 6 },
    { id: "grapefruitJuice", cl: 3 },
    { id: "raspberrySyrup", cl: 1.5 },
    { id: "ice" },
  ]),
  r("scofflaw", "classic", 2, 3, 0.25, "#C05040", [
    { id: "rye", cl: 4.5 },
    { id: "dryVermouth", cl: 3 },
    { id: "lemonJuice", cl: 2.25 },
    { id: "grenadine", cl: 1.5 },
    { id: "ice" },
  ]),
  r("tipperary", "classic", 2, 3, 0.2, "#8A6A2A", [
    { id: "whisky", cl: 5 },
    { id: "redVermouth", cl: 2.5 },
    { id: "greenChartreuse", cl: 1.5 },
    { id: "ice" },
  ]),
  r("revolver", "classic", 2, 3, 0.2, "#5A3A20", [
    { id: "bourbon", cl: 6 },
    { id: "coffeeLiqueur", cl: 1.5 },
    { id: "orangeBitters", count: 2, unit: "dash" },
    { id: "orange", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("horsesNeck", "classic", 1, 2, 0.1, "#E8C890", [
    { id: "cognac", cl: 4 },
    { id: "gingerAle", cl: 12, top: true },
    { id: "angostura", count: 1, unit: "dash" },
    { id: "lemon", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("sidecar", "classic", 2, 3, 0.25, "#E8B060", [
    { id: "cognac", cl: 5 },
    { id: "tripleSec", cl: 2 },
    { id: "lemonJuice", cl: 2 },
    { id: "sugar" },
    { id: "ice" },
  ]),
  r("brandyCrusta", "classic", 3, 6, 0.25, "#E8B870", [
    { id: "cognac", cl: 5 },
    { id: "maraschino", cl: 0.75 },
    { id: "tripleSec", cl: 0.5 },
    { id: "lemonJuice", cl: 1.5 },
    { id: "sugarSyrup", cl: 0.5 },
    { id: "angostura", count: 2, unit: "dash" },
    { id: "lemon", count: 1, unit: "slice" },
    { id: "sugar" },
    { id: "ice" },
  ]),
  r("stinger", "classic", 1, 3, 0.2, "#E0E8C0", [
    { id: "cognac", cl: 5 },
    { id: "mintLiqueur", cl: 2 },
    { id: "ice" },
  ]),
  r("betweenTheSheets", "classic", 2, 3, 0.25, "#EDD8A0", [
    { id: "cognac", cl: 3 },
    { id: "whiteRum", cl: 3 },
    { id: "tripleSec", cl: 3 },
    { id: "lemonJuice", cl: 2 },
    { id: "ice" },
  ]),
  r("champsElysees", "classic", 2, 3, 0.25, "#E0D080", [
    { id: "cognac", cl: 4.5 },
    { id: "greenChartreuse", cl: 1.5 },
    { id: "lemonJuice", cl: 2 },
    { id: "sugarSyrup", cl: 0.75 },
    { id: "angostura", count: 1, unit: "dash" },
    { id: "ice" },
  ]),
  r("japaneseCocktail", "classic", 2, 3, 0.2, "#D8A060", [
    { id: "cognac", cl: 6 },
    { id: "orgeat", cl: 1.5 },
    { id: "angostura", count: 2, unit: "dash" },
    { id: "lemon", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("frenchConnection", "classic", 1, 2, 0.15, "#C88040", [
    { id: "cognac", cl: 3.5 },
    { id: "amaretto", cl: 3.5 },
    { id: "ice" },
  ]),
  r("corpseReviver1", "classic", 2, 3, 0.2, "#B0602A", [
    { id: "cognac", cl: 3 },
    { id: "calvados", cl: 1.5 },
    { id: "redVermouth", cl: 1.5 },
    { id: "ice" },
  ]),
  r("jackRose", "classic", 2, 3, 0.25, "#E06070", [
    { id: "calvados", cl: 4.5 },
    { id: "lemonJuice", cl: 2.25 },
    { id: "grenadine", cl: 1.5 },
    { id: "ice" },
  ]),
  r("piscoSour", "classic", 3, 5, 0.25, "#F4F0D0", [
    { id: "pisco", cl: 6 },
    { id: "limeJuice", cl: 3 },
    { id: "sugarSyrup", cl: 2 },
    { id: "eggWhite", cl: 2 },
    { id: "angostura", count: 3, unit: "dash" },
    { id: "ice" },
  ]),
  r("chilcano", "classic", 1, 2, 0.1, "#F0E8C0", [
    { id: "pisco", cl: 5 },
    { id: "limeJuice", cl: 1.5 },
    { id: "gingerAle", cl: 12, top: true },
    { id: "angostura", count: 2, unit: "dash" },
    { id: "ice" },
  ]),
  r("bAndB", "classic", 1, 1, 0, "#C08030", [
    { id: "cognac", cl: 3 },
    { id: "benedictine", cl: 3 },
  ]),
  r("maiTai", "classic", 3, 5, 0.25, "#E0A050", [
    { id: "darkRum", cl: 3 },
    { id: "agricoleRum", cl: 3 },
    { id: "tripleSec", cl: 1.5 },
    { id: "orgeat", cl: 1.5 },
    { id: "limeJuice", cl: 3 },
    { id: "sugarSyrup", cl: 0.75 },
    { id: "mint", count: 4, unit: "leaf" },
    { id: "ice" },
  ]),
  r("plantersPunch", "classic", 1, 4, 0.15, "#D07040", [
    { id: "darkRum", cl: 4.5 },
    { id: "limeJuice", cl: 2 },
    { id: "sugarSyrup", cl: 1.5 },
    { id: "grenadine", cl: 1 },
    { id: "angostura", count: 2, unit: "dash" },
    { id: "soda", cl: 6, top: true },
    { id: "ice" },
  ]),
  r("hemingwayDaiquiri", "classic", 2, 3, 0.25, "#F4E8C8", [
    { id: "whiteRum", cl: 6 },
    { id: "grapefruitJuice", cl: 4 },
    { id: "maraschino", cl: 1.5 },
    { id: "limeJuice", cl: 1.5 },
    { id: "ice" },
  ]),
  r("elPresidente", "classic", 2, 3, 0.2, "#F0A060", [
    { id: "whiteRum", cl: 4.5 },
    { id: "dryVermouth", cl: 1.5 },
    { id: "tripleSec", cl: 1.5 },
    { id: "grenadine", cl: 0.5 },
    { id: "ice" },
  ]),
  r("maryPickford", "classic", 2, 3, 0.25, "#F4C0A0", [
    { id: "whiteRum", cl: 6 },
    { id: "pineappleJuice", cl: 6 },
    { id: "maraschino", cl: 1 },
    { id: "grenadine", cl: 1 },
    { id: "ice" },
  ]),
  r("hotelNacional", "classic", 2, 3, 0.25, "#F2D090", [
    { id: "whiteRum", cl: 4.5 },
    { id: "apricotBrandy", cl: 1.5 },
    { id: "pineappleJuice", cl: 3 },
    { id: "limeJuice", cl: 1.5 },
    { id: "sugarSyrup", cl: 0.75 },
    { id: "ice" },
  ]),
  r("airMail", "classic", 2, 4, 0.2, "#F0D890", [
    { id: "darkRum", cl: 4.5 },
    { id: "limeJuice", cl: 2 },
    { id: "honeySyrup", cl: 2 },
    { id: "champagne", cl: 6, top: true },
    { id: "ice" },
  ]),
  r("oldCuban", "classic", 2, 5, 0.25, "#D8D8A0", [
    { id: "darkRum", cl: 4.5 },
    { id: "limeJuice", cl: 2.25 },
    { id: "sugarSyrup", cl: 3 },
    { id: "mint", count: 6, unit: "leaf" },
    { id: "angostura", count: 2, unit: "dash" },
    { id: "champagne", cl: 6, top: true },
    { id: "ice" },
  ]),
  r("canchanchara", "classic", 1, 3, 0.15, "#F0E0A0", [
    { id: "whiteRum", cl: 6 },
    { id: "limeJuice", cl: 1.5 },
    { id: "honeySyrup", cl: 1.5 },
    { id: "water", cl: 5 },
    { id: "ice" },
  ]),
  r("queensParkSwizzle", "classic", 2, 4, 0.25, "#D8B060", [
    { id: "darkRum", cl: 6 },
    { id: "limeJuice", cl: 2.25 },
    { id: "sugarSyrup", cl: 1.5 },
    { id: "mint", count: 8, unit: "leaf" },
    { id: "angostura", count: 4, unit: "dash" },
    { id: "ice" },
  ]),
  r("navyGrog", "classic", 2, 4, 0.25, "#E0B070", [
    { id: "darkRum", cl: 3 },
    { id: "whiteRum", cl: 3 },
    { id: "limeJuice", cl: 2.25 },
    { id: "grapefruitJuice", cl: 2.25 },
    { id: "honeySyrup", cl: 2.25 },
    { id: "ice" },
  ]),
  r("cornNOil", "classic", 1, 2, 0.15, "#5A3020", [
    { id: "darkRum", cl: 6 },
    { id: "falernum", cl: 1.5 },
    { id: "angostura", count: 2, unit: "dash" },
    { id: "lime", count: 1, unit: "wedge" },
    { id: "ice" },
  ]),
  r("bacardiCocktail", "classic", 1, 3, 0.25, "#F09090", [
    { id: "whiteRum", cl: 4.5 },
    { id: "limeJuice", cl: 2 },
    { id: "grenadine", cl: 1 },
    { id: "ice" },
  ]),
  r("grog", "classic", 1, 5, 0, "#C88040", [
    { id: "darkRum", cl: 4 },
    { id: "lemonJuice", cl: 1.5 },
    { id: "honeySyrup", cl: 1.5 },
    { id: "water", cl: 12 },
    { id: "cinnamon", count: 1 },
  ]),
  r("yellowBird", "classic", 2, 3, 0.25, "#F0D040", [
    { id: "whiteRum", cl: 3 },
    { id: "vanillaLiqueur", cl: 1.5 },
    { id: "tripleSec", cl: 1.5 },
    { id: "limeJuice", cl: 1.5 },
    { id: "ice" },
  ]),
  r("fernandito", "classic", 1, 2, 0.1, "#3A2018", [
    { id: "fernet", cl: 5 },
    { id: "cola", cl: 15, top: true },
    { id: "ice" },
  ]),
  r("jungleBird", "classic", 2, 4, 0.2, "#E07040", [
    { id: "darkRum", cl: 4 },
    { id: "campari", cl: 1.5 },
    { id: "pineappleJuice", cl: 4.5 },
    { id: "limeJuice", cl: 1.5 },
    { id: "sugarSyrup", cl: 1.5 },
    { id: "ice" },
  ]),
  r("trinidadSour", "classic", 3, 4, 0.25, "#B03A2A", [
    { id: "angostura", cl: 4.5 },
    { id: "orgeat", cl: 3 },
    { id: "lemonJuice", cl: 2.25 },
    { id: "rye", cl: 1.5 },
    { id: "ice" },
  ]),
  r("tommysMargarita", "classic", 1, 3, 0.2, "#E8F0B0", [
    { id: "tequila", cl: 6 },
    { id: "limeJuice", cl: 3 },
    { id: "agaveSyrup", cl: 1.5 },
    { id: "ice" },
  ]),
  r("elDiablo", "classic", 1, 3, 0.1, "#B04060", [
    { id: "tequila", cl: 4.5 },
    { id: "cassis", cl: 1.5 },
    { id: "limeJuice", cl: 1.5 },
    { id: "gingerBeer", cl: 10, top: true },
    { id: "ice" },
  ]),
  r("batanga", "classic", 1, 2, 0.1, "#7A4A30", [
    { id: "tequila", cl: 5 },
    { id: "limeJuice", cl: 1.5 },
    { id: "cola", cl: 12, top: true },
    { id: "salt" },
    { id: "ice" },
  ]),
  r("spicyMargarita", "classic", 2, 4, 0.25, "#D8E890", [
    { id: "tequila", cl: 5 },
    { id: "tripleSec", cl: 1.5 },
    { id: "limeJuice", cl: 2.5 },
    { id: "agaveSyrup", cl: 1 },
    { id: "chili", count: 3, unit: "slice" },
    { id: "salt" },
    { id: "ice" },
  ]),
  r("matador", "classic", 1, 3, 0.2, "#F0E070", [
    { id: "tequila", cl: 4.5 },
    { id: "pineappleJuice", cl: 9 },
    { id: "limeJuice", cl: 1.5 },
    { id: "ice" },
  ]),
  r("siesta", "classic", 2, 3, 0.25, "#F08070", [
    { id: "tequila", cl: 4.5 },
    { id: "campari", cl: 1.5 },
    { id: "grapefruitJuice", cl: 2.25 },
    { id: "limeJuice", cl: 1.5 },
    { id: "sugarSyrup", cl: 1 },
    { id: "ice" },
  ]),
  r("oaxacaOldFashioned", "classic", 2, 4, 0.2, "#D8A050", [
    { id: "tequila", cl: 4.5 },
    { id: "mezcal", cl: 1.5 },
    { id: "agaveSyrup", cl: 0.5 },
    { id: "angostura", count: 2, unit: "dash" },
    { id: "orange", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("nakedAndFamous", "classic", 2, 3, 0.25, "#F0A050", [
    { id: "mezcal", cl: 2.25 },
    { id: "yellowChartreuse", cl: 2.25 },
    { id: "aperol", cl: 2.25 },
    { id: "limeJuice", cl: 2.25 },
    { id: "ice" },
  ]),
  r("braveBull", "classic", 1, 2, 0.15, "#4A2A18", [
    { id: "tequila", cl: 4 },
    { id: "coffeeLiqueur", cl: 2 },
    { id: "ice" },
  ]),
  r("divisionBell", "classic", 2, 3, 0.25, "#F09060", [
    { id: "mezcal", cl: 3 },
    { id: "aperol", cl: 2.25 },
    { id: "maraschino", cl: 1.5 },
    { id: "limeJuice", cl: 2.25 },
    { id: "ice" },
  ]),
  r("rosita", "classic", 2, 3, 0.2, "#C04A30", [
    { id: "tequila", cl: 4.5 },
    { id: "campari", cl: 1.5 },
    { id: "redVermouth", cl: 1.5 },
    { id: "dryVermouth", cl: 1.5 },
    { id: "angostura", count: 1, unit: "dash" },
    { id: "ice" },
  ]),
  r("pastis", "classic", 1, 1, 0.1, "#F2E8B0", [
    { id: "pastis", cl: 2 },
    { id: "water", cl: 10 },
    { id: "ice" },
  ]),
  r("perroquet", "classic", 1, 1, 0.1, "#9AD0A0", [
    { id: "pastis", cl: 2 },
    { id: "mintSyrup", cl: 1 },
    { id: "water", cl: 10 },
    { id: "ice" },
  ]),
  r("tomate", "classic", 1, 1, 0.1, "#F0A090", [
    { id: "pastis", cl: 2 },
    { id: "grenadine", cl: 1 },
    { id: "water", cl: 10 },
    { id: "ice" },
  ]),
  r("mauresque", "classic", 1, 1, 0.1, "#F4ECD0", [
    { id: "pastis", cl: 2 },
    { id: "orgeat", cl: 1 },
    { id: "water", cl: 10 },
    { id: "ice" },
  ]),
  r("suzeTonic", "classic", 1, 2, 0.1, "#F4E890", [
    { id: "gentian", cl: 5 },
    { id: "tonic", cl: 10, top: true },
    { id: "lemon", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("lilletTonic", "classic", 1, 2, 0.1, "#F4F0C0", [
    { id: "lillet", cl: 5 },
    { id: "tonic", cl: 10, top: true },
    { id: "cucumber", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("portoTonic", "classic", 1, 2, 0.1, "#F2E8C0", [
    { id: "whitePort", cl: 5 },
    { id: "tonic", cl: 10, top: true },
    { id: "lemon", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("garibaldi", "classic", 1, 2, 0.1, "#F07040", [
    { id: "campari", cl: 4.5 },
    { id: "orangeJuice", cl: 12 },
    { id: "orange", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("absintheDrip", "classic", 2, 4, 0, "#D8E8C0", [
    { id: "absinthe", cl: 3 },
    { id: "water", cl: 9 },
    { id: "sugar", count: 1, unit: "tsp" },
  ]),
  r("bamboo", "classic", 2, 3, 0.2, "#F0E0A0", [
    { id: "sherry", cl: 4.5 },
    { id: "dryVermouth", cl: 4.5 },
    { id: "angostura", count: 1, unit: "dash" },
    { id: "orangeBitters", count: 1, unit: "dash" },
    { id: "ice" },
  ]),
  r("sherryCobbler", "classic", 1, 3, 0.2, "#F0D890", [
    { id: "sherry", cl: 9 },
    { id: "sugarSyrup", cl: 1.5 },
    { id: "orange", count: 2, unit: "slice" },
    { id: "ice" },
  ]),
  r("champagneCocktail", "classic", 1, 2, 0, "#F0D080", [
    { id: "champagne", cl: 9 },
    { id: "cognac", cl: 1 },
    { id: "sugar", count: 1, unit: "tsp" },
    { id: "angostura", count: 2, unit: "dash" },
  ]),
  r("deathInTheAfternoon", "classic", 1, 1, 0, "#E8F0C8", [
    { id: "absinthe", cl: 1.5 },
    { id: "champagne", cl: 12 },
  ]),
  r("amarettoSour", "classic", 2, 4, 0.25, "#F0C070", [
    { id: "amaretto", cl: 4.5 },
    { id: "lemonJuice", cl: 3 },
    { id: "sugarSyrup", cl: 1 },
    { id: "eggWhite", cl: 1.5 },
    { id: "ice" },
  ]),
  r("communard", "party", 1, 1, 0, "#6A1A3A", [
    { id: "redWine", cl: 10 },
    { id: "cassis", cl: 1.5 },
  ]),
  r("kirBreton", "party", 1, 1, 0, "#C06040", [
    { id: "cider", cl: 12 },
    { id: "cassis", cl: 1.5 },
  ]),
  r("sexOnTheBeach", "party", 1, 3, 0.1, "#F08060", [
    { id: "vodka", cl: 4 },
    { id: "peachSchnapps", cl: 2 },
    { id: "cranberryJuice", cl: 4 },
    { id: "orangeJuice", cl: 4 },
    { id: "ice" },
  ]),
  r("blueLagoon", "party", 1, 2, 0.1, "#40A0E0", [
    { id: "vodka", cl: 4 },
    { id: "blueCuracao", cl: 2 },
    { id: "lemonade", cl: 12, top: true },
    { id: "lemon", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("hurricane", "party", 2, 4, 0.15, "#F06040", [
    { id: "darkRum", cl: 4 },
    { id: "whiteRum", cl: 4 },
    { id: "passionJuice", cl: 4 },
    { id: "orangeJuice", cl: 3 },
    { id: "limeJuice", cl: 1.5 },
    { id: "sugarSyrup", cl: 1.5 },
    { id: "grenadine", cl: 1 },
    { id: "ice" },
  ]),
  r("zombie", "party", 3, 5, 0.2, "#E07030", [
    { id: "darkRum", cl: 4.5 },
    { id: "whiteRum", cl: 3 },
    { id: "falernum", cl: 1.5 },
    { id: "limeJuice", cl: 2.25 },
    { id: "grapefruitJuice", cl: 1.5 },
    { id: "grenadine", cl: 0.5 },
    { id: "absinthe", count: 1, unit: "dash" },
    { id: "angostura", count: 1, unit: "dash" },
    { id: "ice" },
  ]),
  r("painkiller", "party", 1, 3, 0.15, "#F0C890", [
    { id: "darkRum", cl: 6 },
    { id: "pineappleJuice", cl: 12 },
    { id: "orangeJuice", cl: 3 },
    { id: "coconutCream", cl: 3 },
    { id: "nutmeg", count: 1, unit: "dash" },
    { id: "ice" },
  ]),
  r("scorpion", "party", 2, 4, 0.2, "#F0B060", [
    { id: "whiteRum", cl: 4.5 },
    { id: "cognac", cl: 3 },
    { id: "orangeJuice", cl: 6 },
    { id: "lemonJuice", cl: 4.5 },
    { id: "orgeat", cl: 1.5 },
    { id: "ice" },
  ]),
  r("sangria", "party", 1, 10, 0.1, "#A02040", [
    { id: "redWine", cl: 10 },
    { id: "orangeJuice", cl: 3 },
    { id: "tripleSec", cl: 1.5 },
    { id: "sugarSyrup", cl: 1 },
    { id: "soda", cl: 4, top: true },
    { id: "orange", count: 1, unit: "slice" },
    { id: "lemon", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("tintoDeVerano", "party", 1, 2, 0.1, "#B03040", [
    { id: "redWine", cl: 9 },
    { id: "lemonade", cl: 9, top: true },
    { id: "lemon", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("kalimotxo", "party", 1, 1, 0.1, "#5A1A20", [
    { id: "redWine", cl: 10 },
    { id: "cola", cl: 10, top: true },
    { id: "ice" },
  ]),
  r("bellini", "party", 1, 2, 0, "#F4C8A0", [
    { id: "prosecco", cl: 10 },
    { id: "peachJuice", cl: 5 },
  ]),
  r("rossini", "party", 1, 3, 0, "#F07080", [
    { id: "prosecco", cl: 10 },
    { id: "strawberry", count: 4 },
  ]),
  r("hugo", "party", 1, 3, 0.1, "#E8F0C0", [
    { id: "prosecco", cl: 10 },
    { id: "elderflowerSyrup", cl: 2 },
    { id: "soda", cl: 4, top: true },
    { id: "mint", count: 6, unit: "leaf" },
    { id: "lime", count: 1, unit: "wedge" },
    { id: "ice" },
  ]),
  r("limoncelloSpritz", "party", 1, 2, 0.1, "#F4E870", [
    { id: "limoncello", cl: 5 },
    { id: "prosecco", cl: 8 },
    { id: "soda", cl: 3, top: true },
    { id: "lemon", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("wooWoo", "party", 1, 2, 0.1, "#E05070", [
    { id: "vodka", cl: 4 },
    { id: "peachSchnapps", cl: 2 },
    { id: "cranberryJuice", cl: 9 },
    { id: "ice" },
  ]),
  r("fuzzyNavel", "party", 1, 2, 0.1, "#F8B050", [
    { id: "peachSchnapps", cl: 4.5 },
    { id: "orangeJuice", cl: 12 },
    { id: "ice" },
  ]),
  r("coconutPineapple", "party", 1, 1, 0.1, "#F8E8A0", [
    { id: "coconutRum", cl: 5 },
    { id: "pineappleJuice", cl: 12 },
    { id: "ice" },
  ]),
  r("bahamaMama", "party", 2, 3, 0.15, "#F09050", [
    { id: "darkRum", cl: 3 },
    { id: "coconutRum", cl: 3 },
    { id: "pineappleJuice", cl: 6 },
    { id: "orangeJuice", cl: 3 },
    { id: "grenadine", cl: 1 },
    { id: "ice" },
  ]),
  r("blueHawaiian", "party", 2, 4, 0.2, "#4A9AD8", [
    { id: "whiteRum", cl: 3 },
    { id: "blueCuracao", cl: 2 },
    { id: "pineappleJuice", cl: 6 },
    { id: "coconutCream", cl: 2 },
    { id: "ice" },
  ]),
  r("punchPlanteur", "party", 1, 5, 0.1, "#F0A040", [
    { id: "agricoleRum", cl: 4 },
    { id: "orangeJuice", cl: 6 },
    { id: "pineappleJuice", cl: 6 },
    { id: "caneSyrup", cl: 1 },
    { id: "cinnamon", count: 1, unit: "dash" },
    { id: "nutmeg", count: 1, unit: "dash" },
    { id: "ice" },
  ]),
  r("strawberryDaiquiri", "party", 2, 4, 0.25, "#F05060", [
    { id: "whiteRum", cl: 5 },
    { id: "limeJuice", cl: 2 },
    { id: "sugarSyrup", cl: 1.5 },
    { id: "strawberry", count: 5 },
    { id: "ice" },
  ]),
  r("passionFruitMartini", "party", 2, 4, 0.2, "#F0C040", [
    { id: "vodka", cl: 4.5 },
    { id: "passionJuice", cl: 3 },
    { id: "limeJuice", cl: 1.5 },
    { id: "vanillaSyrup", cl: 1.5 },
    { id: "prosecco", cl: 6 },
    { id: "ice" },
  ]),
  r("vodkaEnergy", "party", 1, 1, 0.1, "#E8E0A0", [
    { id: "vodka", cl: 4 },
    { id: "energyDrink", cl: 15, top: true },
    { id: "ice" },
  ]),
  r("caipiroska", "party", 1, 4, 0.6, "#D0F0B0", [
    { id: "vodka", cl: 5 },
    { id: "lime", count: 4, unit: "wedge" },
    { id: "sugar", count: 2, unit: "tsp" },
    { id: "ice" },
  ]),
  r("pimmsCup", "party", 1, 4, 0.1, "#C87040", [
    { id: "pimms", cl: 5 },
    { id: "lemonade", cl: 15, top: true },
    { id: "cucumber", count: 2, unit: "slice" },
    { id: "strawberry", count: 2 },
    { id: "mint", count: 4, unit: "leaf" },
    { id: "orange", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("aguaDeValencia", "party", 1, 3, 0.1, "#F8B040", [
    { id: "orangeJuice", cl: 6 },
    { id: "prosecco", cl: 6 },
    { id: "vodka", cl: 1.5 },
    { id: "gin", cl: 1.5 },
    { id: "sugarSyrup", cl: 0.5 },
    { id: "ice" },
  ]),
  r("rebujito", "party", 1, 2, 0.1, "#F0F0C0", [
    { id: "sherry", cl: 5 },
    { id: "lemonade", cl: 10, top: true },
    { id: "mint", count: 3, unit: "leaf" },
    { id: "ice" },
  ]),
  r("bicicletta", "party", 1, 2, 0.1, "#E06040", [
    { id: "campari", cl: 4 },
    { id: "whiteWine", cl: 8 },
    { id: "soda", cl: 4, top: true },
    { id: "orange", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("vinChaud", "party", 1, 15, 0, "#8A1A30", [
    { id: "redWine", cl: 12 },
    { id: "orange", count: 1, unit: "slice" },
    { id: "cinnamon", count: 1 },
    { id: "sugar", count: 2, unit: "tsp" },
  ]),
  r("dirtyShirley", "party", 1, 2, 0.1, "#F06070", [
    { id: "vodka", cl: 4 },
    { id: "lemonade", cl: 12, top: true },
    { id: "grenadine", cl: 1.5 },
    { id: "cherry", count: 1 },
    { id: "ice" },
  ]),
  r("ranchWater", "party", 1, 2, 0.1, "#EEF4E0", [
    { id: "tequila", cl: 5 },
    { id: "limeJuice", cl: 2 },
    { id: "soda", cl: 12, top: true },
    { id: "lime", count: 1, unit: "wedge" },
    { id: "ice" },
  ]),
  r("lynchburgLemonade", "party", 1, 3, 0.1, "#F0D080", [
    { id: "whisky", cl: 4 },
    { id: "tripleSec", cl: 2 },
    { id: "lemonJuice", cl: 2 },
    { id: "lemonade", cl: 10, top: true },
    { id: "ice" },
  ]),
  r("whiskyCola", "party", 1, 1, 0.1, "#8A5030", [
    { id: "whisky", cl: 5 },
    { id: "cola", cl: 12, top: true },
    { id: "ice" },
  ]),
  r("rumRunner", "party", 2, 4, 0.2, "#D05040", [
    { id: "darkRum", cl: 3 },
    { id: "whiteRum", cl: 3 },
    { id: "bananaLiqueur", cl: 1.5 },
    { id: "blackberryLiqueur", cl: 1.5 },
    { id: "pineappleJuice", cl: 4 },
    { id: "limeJuice", cl: 1.5 },
    { id: "grenadine", cl: 1 },
    { id: "ice" },
  ]),
  r("melonSour", "party", 1, 3, 0.2, "#B0E060", [
    { id: "melonLiqueur", cl: 3 },
    { id: "vodka", cl: 3 },
    { id: "lemonJuice", cl: 1.5 },
    { id: "limeJuice", cl: 1.5 },
    { id: "soda", cl: 4, top: true },
    { id: "ice" },
  ]),
  r("japaneseSlipper", "party", 1, 3, 0.25, "#C8E060", [
    { id: "melonLiqueur", cl: 3 },
    { id: "tripleSec", cl: 3 },
    { id: "lemonJuice", cl: 3 },
    { id: "ice" },
  ]),
  r("appletini", "party", 1, 3, 0.25, "#C8F080", [
    { id: "vodka", cl: 4 },
    { id: "appleLiqueur", cl: 2 },
    { id: "lemonJuice", cl: 1 },
    { id: "ice" },
  ]),
  r("mojitoRoyal", "party", 2, 5, 0.15, "#D8F0C0", [
    { id: "whiteRum", cl: 4 },
    { id: "limeJuice", cl: 2 },
    { id: "sugarSyrup", cl: 2 },
    { id: "mint", count: 8, unit: "leaf" },
    { id: "champagne", cl: 6, top: true },
    { id: "ice" },
  ]),
  r("poinsettia", "party", 1, 2, 0, "#D03050", [
    { id: "champagne", cl: 10 },
    { id: "cranberryJuice", cl: 3 },
    { id: "tripleSec", cl: 1.5 },
  ]),
  r("mangoMargarita", "party", 2, 4, 0.25, "#F8B030", [
    { id: "tequila", cl: 4.5 },
    { id: "tripleSec", cl: 1.5 },
    { id: "mangoJuice", cl: 6 },
    { id: "limeJuice", cl: 2 },
    { id: "salt" },
    { id: "ice" },
  ]),
  r("bananaDaiquiri", "party", 2, 4, 0.25, "#F4E090", [
    { id: "whiteRum", cl: 5 },
    { id: "bananaLiqueur", cl: 1.5 },
    { id: "limeJuice", cl: 2 },
    { id: "sugarSyrup", cl: 1 },
    { id: "banana", count: 1 },
    { id: "ice" },
  ]),
  r("barracuda", "party", 2, 3, 0.15, "#F0C060", [
    { id: "darkRum", cl: 4.5 },
    { id: "vanillaLiqueur", cl: 1.5 },
    { id: "pineappleJuice", cl: 6 },
    { id: "limeJuice", cl: 0.5 },
    { id: "prosecco", cl: 6, top: true },
    { id: "ice" },
  ]),
  r("fishHousePunch", "party", 2, 10, 0.15, "#D8A050", [
    { id: "darkRum", cl: 3 },
    { id: "cognac", cl: 3 },
    { id: "peachSchnapps", cl: 1.5 },
    { id: "lemonJuice", cl: 3 },
    { id: "sugarSyrup", cl: 2 },
    { id: "tea", cl: 6 },
    { id: "ice" },
  ]),
  r("frose", "party", 1, 5, 0.2, "#F49090", [
    { id: "roseWine", cl: 12 },
    { id: "strawberry", count: 3 },
    { id: "sugarSyrup", cl: 1 },
    { id: "lemonJuice", cl: 1 },
    { id: "ice" },
  ]),
  r("cantarito", "party", 1, 3, 0.1, "#F8A070", [
    { id: "tequila", cl: 5 },
    { id: "orangeJuice", cl: 3 },
    { id: "grapefruitJuice", cl: 3 },
    { id: "limeJuice", cl: 1.5 },
    { id: "grapefruitSoda", cl: 6, top: true },
    { id: "salt" },
    { id: "ice" },
  ]),
  r("jungleJuice", "party", 1, 5, 0.1, "#F07050", [
    { id: "vodka", cl: 2 },
    { id: "whiteRum", cl: 2 },
    { id: "orangeJuice", cl: 4 },
    { id: "pineappleJuice", cl: 4 },
    { id: "cranberryJuice", cl: 4 },
    { id: "lemonade", cl: 4, top: true },
    { id: "ice" },
  ]),
  r("flirtini", "party", 1, 2, 0, "#F8D8A0", [
    { id: "vodka", cl: 1.5 },
    { id: "pineappleJuice", cl: 3 },
    { id: "champagne", cl: 9 },
  ]),
  r("sloeGinFizz", "party", 1, 3, 0.2, "#C04060", [
    { id: "sloeGin", cl: 4.5 },
    { id: "lemonJuice", cl: 2.5 },
    { id: "sugarSyrup", cl: 1 },
    { id: "soda", cl: 6, top: true },
    { id: "ice" },
  ]),
  r("charlieChaplin", "party", 2, 3, 0.25, "#D06050", [
    { id: "sloeGin", cl: 3 },
    { id: "apricotBrandy", cl: 3 },
    { id: "limeJuice", cl: 3 },
    { id: "ice" },
  ]),
  r("saketini", "party", 1, 3, 0.2, "#F0F0E8", [
    { id: "gin", cl: 4.5 },
    { id: "sake", cl: 3 },
    { id: "cucumber", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("rosePamplemousse", "party", 1, 2, 0.1, "#F8A0A0", [
    { id: "roseWine", cl: 12 },
    { id: "grapefruitJuice", cl: 3 },
    { id: "sugarSyrup", cl: 1 },
    { id: "ice" },
  ]),
  r("hotCider", "party", 1, 10, 0, "#D89040", [
    { id: "cider", cl: 15 },
    { id: "calvados", cl: 2 },
    { id: "honeySyrup", cl: 1 },
    { id: "cinnamon", count: 1 },
  ]),
  r("aperolSour", "party", 2, 4, 0.25, "#F09040", [
    { id: "aperol", cl: 4.5 },
    { id: "lemonJuice", cl: 2.5 },
    { id: "sugarSyrup", cl: 1.5 },
    { id: "eggWhite", cl: 2 },
    { id: "ice" },
  ]),
  r("vampiro", "party", 2, 4, 0.1, "#D04030", [
    { id: "tequila", cl: 5 },
    { id: "tomatoJuice", cl: 2 },
    { id: "orangeJuice", cl: 3 },
    { id: "limeJuice", cl: 1.5 },
    { id: "hotSauce", count: 2, unit: "dash" },
    { id: "grapefruitSoda", cl: 8, top: true },
    { id: "salt" },
    { id: "ice" },
  ]),
  r("babyGuinness", "shot", 2, 2, 0, "#2A1A10", [
    { id: "coffeeLiqueur", cl: 2.5 },
    { id: "irishCream", cl: 1 },
  ]),
  r("mindEraser", "shot", 1, 2, 0.1, "#3A2A1A", [
    { id: "vodka", cl: 2 },
    { id: "coffeeLiqueur", cl: 2 },
    { id: "soda", cl: 2, top: true },
    { id: "ice" },
  ]),
  r("greenTeaShot", "shot", 1, 2, 0.2, "#D0C870", [
    { id: "whisky", cl: 1.5 },
    { id: "peachSchnapps", cl: 1.5 },
    { id: "lemonJuice", cl: 1 },
    { id: "sugarSyrup", cl: 0.5 },
    { id: "lemonade", cl: 1, top: true },
    { id: "ice" },
  ]),
  r("washingtonApple", "shot", 1, 2, 0.2, "#D04050", [
    { id: "whisky", cl: 1.5 },
    { id: "appleLiqueur", cl: 1.5 },
    { id: "cranberryJuice", cl: 1.5 },
    { id: "ice" },
  ]),
  r("purpleHooter", "shot", 1, 2, 0.2, "#C03060", [
    { id: "vodka", cl: 2 },
    { id: "raspberryLiqueur", cl: 1.5 },
    { id: "limeJuice", cl: 1 },
    { id: "ice" },
  ]),
  r("tequilaSaltLime", "shot", 1, 1, 0, "#F4F0D8", [
    { id: "tequila", cl: 4 },
    { id: "salt" },
    { id: "lime", count: 1, unit: "wedge" },
  ]),
  r("bandera", "shot", 1, 3, 0, "#E04030", [
    { id: "tequila", cl: 3 },
    { id: "limeJuice", cl: 3 },
    { id: "tomatoJuice", cl: 2 },
    { id: "orangeJuice", cl: 1 },
    { id: "hotSauce", count: 1, unit: "dash" },
  ]),
  r("flatliner", "shot", 2, 2, 0, "#F0E0A0", [
    { id: "sambuca", cl: 2 },
    { id: "hotSauce", count: 3, unit: "dash" },
    { id: "tequila", cl: 2 },
  ]),
  r("prairieFire", "shot", 1, 1, 0, "#E8A050", [
    { id: "tequila", cl: 4 },
    { id: "hotSauce", count: 4, unit: "dash" },
  ]),
  r("chocolateCakeShot", "shot", 2, 3, 0.2, "#C89050", [
    { id: "vodka", cl: 2 },
    { id: "hazelnutLiqueur", cl: 2 },
    { id: "lemon", count: 1, unit: "wedge" },
    { id: "sugar", count: 1, unit: "tsp" },
    { id: "ice" },
  ]),
  r("applePieShot", "shot", 1, 2, 0.2, "#D09040", [
    { id: "cinnamonWhisky", cl: 2 },
    { id: "appleJuice", cl: 2 },
    { id: "ice" },
  ]),
  r("pineappleUpsideDown", "shot", 1, 2, 0.2, "#F4B060", [
    { id: "vodka", cl: 2 },
    { id: "pineappleJuice", cl: 2 },
    { id: "grenadine", cl: 0.5 },
    { id: "ice" },
  ]),
  r("irishFlag", "shot", 3, 3, 0, "#E8D8B0", [
    { id: "mintLiqueur", cl: 1.5 },
    { id: "irishCream", cl: 1.5 },
    { id: "tripleSec", cl: 1.5 },
  ]),
  r("pousseCafe", "shot", 3, 5, 0, "#D0A050", [
    { id: "grenadine", cl: 1 },
    { id: "cacaoLiqueur", cl: 1 },
    { id: "mintLiqueur", cl: 1 },
    { id: "yellowChartreuse", cl: 1 },
    { id: "cognac", cl: 1 },
  ]),
  r("sambucaMosca", "shot", 1, 1, 0, "#F4F4EC", [
    { id: "sambuca", cl: 3 },
    { id: "coffeeBeans", count: 3 },
  ]),
  r("peppermintPatty", "shot", 1, 2, 0.2, "#E8EEDC", [
    { id: "cacaoLiqueur", cl: 2 },
    { id: "mintLiqueur", cl: 2 },
    { id: "cream", cl: 1 },
    { id: "ice" },
  ]),
  r("vegasBomb", "shot", 1, 2, 0, "#E07050", [
    { id: "whisky", cl: 1.5 },
    { id: "peachSchnapps", cl: 1.5 },
    { id: "cranberryJuice", cl: 1.5 },
    { id: "energyDrink", cl: 5 },
  ]),
  r("mexicanFlag", "shot", 3, 3, 0, "#E04040", [
    { id: "grenadine", cl: 1.5 },
    { id: "mintLiqueur", cl: 1.5 },
    { id: "tequila", cl: 1.5 },
  ]),
  r("miniBeer", "shot", 1, 1, 0, "#F0C040", [
    { id: "vanillaLiqueur", cl: 3 },
    { id: "cream", cl: 1 },
  ]),
  r("hotShot", "shot", 2, 3, 0, "#6A4A30", [
    { id: "vanillaLiqueur", cl: 1.5 },
    { id: "espresso", cl: 1.5 },
    { id: "cream", cl: 1.5 },
  ]),
  r("rattlesnake", "shot", 3, 3, 0, "#5A3A20", [
    { id: "coffeeLiqueur", cl: 1.5 },
    { id: "cacaoLiqueur", cl: 1.5 },
    { id: "irishCream", cl: 1.5 },
  ]),
  r("pickleback", "shot", 1, 1, 0, "#E0C070", [
    { id: "whisky", cl: 4 },
    { id: "pickleBrine", cl: 3 },
  ]),
  r("mezcalOrange", "shot", 1, 1, 0, "#E8D0A0", [
    { id: "mezcal", cl: 4 },
    { id: "orange", count: 1, unit: "slice" },
    { id: "salt" },
    { id: "chili", count: 1, unit: "slice" },
  ]),
  r("madDog", "shot", 1, 2, 0, "#C03040", [
    { id: "raspberrySyrup", cl: 1 },
    { id: "vodka", cl: 3 },
    { id: "hotSauce", count: 3, unit: "dash" },
  ]),
  r("cinnamonRoll", "shot", 1, 2, 0, "#C89870", [
    { id: "cinnamonWhisky", cl: 2 },
    { id: "irishCream", cl: 2 },
    { id: "cinnamon", count: 1, unit: "dash" },
  ]),
  r("keyLimePie", "shot", 2, 3, 0.2, "#E8F0C0", [
    { id: "vanillaLiqueur", cl: 2 },
    { id: "vodka", cl: 1 },
    { id: "limeJuice", cl: 1 },
    { id: "cream", cl: 1.5 },
    { id: "sugar" },
    { id: "ice" },
  ]),
  r("blueShark", "shot", 1, 2, 0.2, "#3A90D8", [
    { id: "vodka", cl: 1.5 },
    { id: "tequila", cl: 1.5 },
    { id: "blueCuracao", cl: 1 },
    { id: "ice" },
  ]),
  r("gummyBear", "shot", 1, 2, 0.2, "#F07080", [
    { id: "vodka", cl: 1.5 },
    { id: "raspberryLiqueur", cl: 1 },
    { id: "peachSchnapps", cl: 1 },
    { id: "lemonade", cl: 1.5, top: true },
    { id: "ice" },
  ]),
  r("birthdayCake", "shot", 2, 3, 0.2, "#F0E0D0", [
    { id: "vodka", cl: 1.5 },
    { id: "cacaoLiqueur", cl: 1.5 },
    { id: "cream", cl: 1.5 },
    { id: "sugar" },
    { id: "ice" },
  ]),
  r("snowshoe", "shot", 1, 1, 0, "#C8D0A0", [
    { id: "bourbon", cl: 2 },
    { id: "mintLiqueur", cl: 2 },
  ]),
  r("mexicanCandy", "shot", 1, 2, 0.2, "#F05060", [
    { id: "tequila", cl: 2 },
    { id: "watermelonJuice", cl: 2 },
    { id: "hotSauce", count: 2, unit: "dash" },
    { id: "salt" },
    { id: "ice" },
  ]),
  r("oatmealCookie", "shot", 1, 2, 0.2, "#C8A070", [
    { id: "irishCream", cl: 1.5 },
    { id: "cinnamonWhisky", cl: 1 },
    { id: "caramelSyrup", cl: 0.5 },
    { id: "ice" },
  ]),
  r("trouNormand", "shot", 1, 1, 0, "#E8C890", [
    { id: "calvados", cl: 3 },
  ]),
  r("royRogers", "zero", 1, 1, 0.1, "#6A2A20", [
    { id: "cola", cl: 15, top: true },
    { id: "grenadine", cl: 1.5 },
    { id: "cherry", count: 1 },
    { id: "ice" },
  ]),
  r("arnoldPalmer", "zero", 1, 10, 0.1, "#C89040", [
    { id: "tea", cl: 10 },
    { id: "lemonJuice", cl: 2.5 },
    { id: "sugarSyrup", cl: 2 },
    { id: "lemon", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("virginMary", "zero", 1, 3, 0.1, "#C0403A", [
    { id: "tomatoJuice", cl: 12 },
    { id: "lemonJuice", cl: 1.5 },
    { id: "worcestershire", count: 2, unit: "dash" },
    { id: "hotSauce", count: 2, unit: "dash" },
    { id: "salt" },
    { id: "ice" },
  ]),
  r("virginMule", "zero", 1, 2, 0.1, "#E8E8C0", [
    { id: "limeJuice", cl: 2 },
    { id: "gingerBeer", cl: 15, top: true },
    { id: "mint", count: 4, unit: "leaf" },
    { id: "lime", count: 1, unit: "wedge" },
    { id: "ice" },
  ]),
  r("cendrillon", "zero", 1, 3, 0.2, "#F8C050", [
    { id: "orangeJuice", cl: 6 },
    { id: "pineappleJuice", cl: 6 },
    { id: "lemonJuice", cl: 2 },
    { id: "ice" },
  ]),
  r("florida", "zero", 1, 3, 0.15, "#F8B860", [
    { id: "orangeJuice", cl: 6 },
    { id: "grapefruitJuice", cl: 4 },
    { id: "lemonJuice", cl: 1 },
    { id: "sugarSyrup", cl: 1 },
    { id: "soda", cl: 4, top: true },
    { id: "ice" },
  ]),
  r("boraBora", "zero", 1, 3, 0.2, "#F8A050", [
    { id: "pineappleJuice", cl: 8 },
    { id: "passionJuice", cl: 4 },
    { id: "lemonJuice", cl: 1 },
    { id: "grenadine", cl: 1 },
    { id: "ice" },
  ]),
  r("sanFrancisco", "zero", 1, 4, 0.2, "#F8B060", [
    { id: "orangeJuice", cl: 4 },
    { id: "pineappleJuice", cl: 4 },
    { id: "lemonJuice", cl: 1 },
    { id: "grenadine", cl: 1 },
    { id: "banana", count: 1 },
    { id: "ice" },
  ]),
  r("pinkLemonade", "zero", 1, 2, 0.1, "#F8A0A8", [
    { id: "lemonade", cl: 12, top: true },
    { id: "cranberryJuice", cl: 4 },
    { id: "lemon", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("diaboloMenthe", "zero", 1, 1, 0.1, "#80D090", [
    { id: "mintSyrup", cl: 2 },
    { id: "lemonade", cl: 15, top: true },
    { id: "ice" },
  ]),
  r("diaboloFraise", "zero", 1, 1, 0.1, "#F07080", [
    { id: "strawberrySyrup", cl: 2 },
    { id: "lemonade", cl: 15, top: true },
    { id: "ice" },
  ]),
  r("mentheEau", "zero", 1, 1, 0.1, "#A0E0B0", [
    { id: "mintSyrup", cl: 2 },
    { id: "water", cl: 18 },
    { id: "ice" },
  ]),
  r("laitFraise", "zero", 1, 1, 0, "#F8C8D0", [
    { id: "milk", cl: 18 },
    { id: "strawberrySyrup", cl: 2.5 },
  ]),
  r("mangoLassi", "zero", 1, 3, 0.1, "#F8C860", [
    { id: "yogurt", cl: 10 },
    { id: "mangoJuice", cl: 8 },
    { id: "milk", cl: 4 },
    { id: "sugar", count: 1, unit: "tsp" },
    { id: "ice" },
  ]),
  r("aguaFresca", "zero", 1, 5, 0.1, "#F87080", [
    { id: "watermelonJuice", cl: 15 },
    { id: "limeJuice", cl: 1.5 },
    { id: "sugarSyrup", cl: 1 },
    { id: "mint", count: 3, unit: "leaf" },
    { id: "ice" },
  ]),
  r("virginMargarita", "zero", 1, 3, 0.2, "#E8F0B0", [
    { id: "limeJuice", cl: 3 },
    { id: "orangeJuice", cl: 3 },
    { id: "agaveSyrup", cl: 1.5 },
    { id: "soda", cl: 3, top: true },
    { id: "salt" },
    { id: "ice" },
  ]),
  r("virginSunrise", "zero", 1, 2, 0.1, "#F8A040", [
    { id: "orangeJuice", cl: 15 },
    { id: "grenadine", cl: 1.5 },
    { id: "ice" },
  ]),
  r("cucumberCooler", "zero", 1, 4, 0.1, "#D0F0C8", [
    { id: "cucumber", count: 4, unit: "slice" },
    { id: "limeJuice", cl: 2 },
    { id: "sugarSyrup", cl: 1.5 },
    { id: "mint", count: 6, unit: "leaf" },
    { id: "soda", cl: 12, top: true },
    { id: "ice" },
  ]),
  r("strawberryBananaSmoothie", "zero", 1, 4, 0.1, "#F8B0B0", [
    { id: "strawberry", count: 6 },
    { id: "banana", count: 1 },
    { id: "milk", cl: 10 },
    { id: "yogurt", cl: 5 },
    { id: "honeySyrup", cl: 1 },
    { id: "ice" },
  ]),
  r("vanillaMilkshake", "zero", 1, 3, 0, "#F8F0E0", [
    { id: "milk", cl: 12 },
    { id: "iceCream", cl: 10 },
    { id: "vanillaSyrup", cl: 1 },
  ]),
  r("chocolateMilkshake", "zero", 1, 3, 0, "#8A5A40", [
    { id: "milk", cl: 12 },
    { id: "iceCream", cl: 10 },
    { id: "chocolateSyrup", cl: 3 },
  ]),
  r("chocolatViennois", "zero", 2, 6, 0, "#6A4030", [
    { id: "milk", cl: 15 },
    { id: "cocoa", count: 2, unit: "tsp" },
    { id: "sugar", count: 2, unit: "tsp" },
    { id: "cream", cl: 3 },
  ]),
  r("cafeFrappe", "zero", 1, 3, 0.2, "#A07850", [
    { id: "espresso", cl: 4 },
    { id: "sugarSyrup", cl: 1.5 },
    { id: "milk", cl: 6 },
    { id: "ice" },
  ]),
  r("espressoTonic", "zero", 1, 2, 0.1, "#8A6040", [
    { id: "tonic", cl: 12 },
    { id: "espresso", cl: 4 },
    { id: "orange", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("peachIcedTea", "zero", 1, 10, 0.1, "#E8A060", [
    { id: "tea", cl: 15 },
    { id: "peachJuice", cl: 4 },
    { id: "lemonJuice", cl: 1 },
    { id: "sugarSyrup", cl: 1 },
    { id: "ice" },
  ]),
  r("mintTea", "zero", 2, 8, 0, "#C8D080", [
    { id: "greenTea", cl: 15 },
    { id: "mint", count: 10, unit: "leaf" },
    { id: "sugar", count: 3, unit: "tsp" },
  ]),
  r("virginCosmo", "zero", 1, 3, 0.2, "#E87080", [
    { id: "cranberryJuice", cl: 6 },
    { id: "orangeJuice", cl: 2 },
    { id: "limeJuice", cl: 1.5 },
    { id: "sugarSyrup", cl: 0.5 },
    { id: "ice" },
  ]),
  r("grapefruitTonic", "zero", 1, 2, 0.1, "#F8C8B8", [
    { id: "grapefruitJuice", cl: 6 },
    { id: "tonic", cl: 10, top: true },
    { id: "lemon", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("virginBellini", "zero", 1, 2, 0, "#F8C8A0", [
    { id: "peachJuice", cl: 6 },
    { id: "lemonade", cl: 9, top: true },
  ]),
  r("virginCaipirinha", "zero", 1, 4, 0.3, "#D8F0B0", [
    { id: "lime", count: 4, unit: "wedge" },
    { id: "sugar", count: 2, unit: "tsp" },
    { id: "gingerAle", cl: 10, top: true },
    { id: "ice" },
  ]),
  r("strawberryBasilLemonade", "zero", 2, 5, 0.1, "#F89098", [
    { id: "strawberry", count: 4 },
    { id: "basil", count: 5, unit: "leaf" },
    { id: "lemonJuice", cl: 3 },
    { id: "sugarSyrup", cl: 2 },
    { id: "soda", cl: 12, top: true },
    { id: "ice" },
  ]),
  r("safeSexOnTheBeach", "zero", 1, 2, 0.1, "#F08870", [
    { id: "peachJuice", cl: 4 },
    { id: "orangeJuice", cl: 6 },
    { id: "cranberryJuice", cl: 6 },
    { id: "ice" },
  ]),
  r("eggCream", "zero", 1, 2, 0, "#A08070", [
    { id: "chocolateSyrup", cl: 3 },
    { id: "milk", cl: 6 },
    { id: "soda", cl: 10, top: true },
  ]),
  r("colaFloat", "zero", 1, 2, 0, "#5A3020", [
    { id: "cola", cl: 20 },
    { id: "iceCream", cl: 6 },
  ]),
  r("affogato", "zero", 1, 2, 0, "#8A6A50", [
    { id: "iceCream", cl: 8 },
    { id: "espresso", cl: 3 },
  ]),
  r("hotAppleJuice", "zero", 1, 8, 0, "#D8A050", [
    { id: "appleJuice", cl: 20 },
    { id: "cinnamon", count: 1 },
    { id: "orange", count: 1, unit: "slice" },
  ]),
  r("mulledGrapeJuice", "zero", 1, 10, 0, "#8A2040", [
    { id: "grapeJuice", cl: 18 },
    { id: "orange", count: 1, unit: "slice" },
    { id: "cinnamon", count: 1 },
    { id: "nutmeg", count: 1, unit: "dash" },
  ]),
  r("virginSangria", "zero", 1, 10, 0.1, "#A03050", [
    { id: "grapeJuice", cl: 10 },
    { id: "orangeJuice", cl: 4 },
    { id: "lemonJuice", cl: 1 },
    { id: "soda", cl: 4, top: true },
    { id: "orange", count: 1, unit: "slice" },
    { id: "lemon", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("virginPaloma", "zero", 1, 2, 0.1, "#F8B0A8", [
    { id: "grapefruitSoda", cl: 12, top: true },
    { id: "limeJuice", cl: 1.5 },
    { id: "salt" },
    { id: "ice" },
  ]),
  r("virginHugo", "zero", 1, 2, 0.1, "#E8F4D0", [
    { id: "elderflowerSyrup", cl: 2.5 },
    { id: "soda", cl: 15, top: true },
    { id: "mint", count: 6, unit: "leaf" },
    { id: "lime", count: 1, unit: "wedge" },
    { id: "ice" },
  ]),
  r("gingerShot", "zero", 1, 4, 0, "#F0D070", [
    { id: "ginger", count: 3, unit: "slice" },
    { id: "lemonJuice", cl: 3 },
    { id: "honeySyrup", cl: 1 },
  ]),
  r("cafeViennois", "zero", 1, 4, 0, "#7A5A40", [
    { id: "espresso", cl: 6 },
    { id: "cream", cl: 3 },
    { id: "cocoa", count: 1, unit: "tsp" },
  ]),
  r("appleGingerFizz", "zero", 1, 2, 0.1, "#E8C870", [
    { id: "appleJuice", cl: 8 },
    { id: "gingerBeer", cl: 8, top: true },
    { id: "limeJuice", cl: 1 },
    { id: "ice" },
  ]),
  r("passionFizz", "zero", 1, 3, 0.15, "#F8D060", [
    { id: "passionJuice", cl: 6 },
    { id: "limeJuice", cl: 1 },
    { id: "sugarSyrup", cl: 1 },
    { id: "soda", cl: 10, top: true },
    { id: "ice" },
  ]),
  r("virginToddy", "zero", 1, 5, 0, "#F0D8A0", [
    { id: "honeySyrup", cl: 2 },
    { id: "lemonJuice", cl: 2 },
    { id: "ginger", count: 2, unit: "slice" },
    { id: "water", cl: 15 },
  ]),
  r("virginEggnog", "zero", 2, 5, 0.1, "#F8F0D0", [
    { id: "milk", cl: 12 },
    { id: "egg", count: 1 },
    { id: "sugarSyrup", cl: 2 },
    { id: "vanillaSyrup", cl: 0.5 },
    { id: "nutmeg", count: 1, unit: "dash" },
    { id: "ice" },
  ]),
  r("coconutLimeCooler", "zero", 1, 2, 0.1, "#F0F4E8", [
    { id: "coconutWater", cl: 15 },
    { id: "limeJuice", cl: 2 },
    { id: "sugarSyrup", cl: 1 },
    { id: "mint", count: 4, unit: "leaf" },
    { id: "ice" },
  ]),
  r("cranberrySpritzer", "zero", 1, 1, 0.1, "#D04060", [
    { id: "cranberryJuice", cl: 8 },
    { id: "soda", cl: 8, top: true },
    { id: "lime", count: 1, unit: "wedge" },
    { id: "ice" },
  ]),
  r("orangeJulius", "zero", 1, 3, 0.1, "#F8D090", [
    { id: "orangeJuice", cl: 12 },
    { id: "milk", cl: 6 },
    { id: "vanillaSyrup", cl: 1 },
    { id: "sugarSyrup", cl: 1 },
    { id: "ice" },
  ]),
  r("tropicalSmoothie", "zero", 1, 4, 0.1, "#F8C850", [
    { id: "mangoJuice", cl: 8 },
    { id: "pineappleJuice", cl: 6 },
    { id: "coconutWater", cl: 4 },
    { id: "banana", count: 1 },
    { id: "ice" },
  ]),
  r("honeyMilk", "zero", 1, 4, 0, "#F4E8C8", [
    { id: "milk", cl: 20 },
    { id: "honeySyrup", cl: 2 },
  ]),
  r("ayran", "zero", 1, 2, 0.1, "#F8F8F0", [
    { id: "yogurt", cl: 10 },
    { id: "water", cl: 10 },
    { id: "salt" },
    { id: "ice" },
  ]),
  r("orangeade", "zero", 1, 3, 0.1, "#F8B040", [
    { id: "orangeJuice", cl: 6 },
    { id: "lemonJuice", cl: 1 },
    { id: "sugarSyrup", cl: 1 },
    { id: "soda", cl: 10, top: true },
    { id: "ice" },
  ]),
  r("icedLatte", "zero", 1, 3, 0.1, "#C8A880", [
    { id: "milk", cl: 12 },
    { id: "espresso", cl: 4 },
    { id: "sugarSyrup", cl: 1 },
    { id: "ice" },
  ]),
  r("virginSpritz", "zero", 1, 2, 0.1, "#F8A060", [
    { id: "grapefruitJuice", cl: 4 },
    { id: "orangeJuice", cl: 4 },
    { id: "tonic", cl: 10, top: true },
    { id: "orange", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("gingerLemonade", "zero", 1, 3, 0.1, "#F4E8A0", [
    { id: "gingerSyrup", cl: 2 },
    { id: "lemonJuice", cl: 2.5 },
    { id: "soda", cl: 15, top: true },
    { id: "lemon", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("chelada", "beer", 1, 2, 0.05, "#F4D870", [
    { id: "beer", cl: 25 },
    { id: "limeJuice", cl: 3 },
    { id: "salt" },
    { id: "ice" },
  ]),
  r("beergarita", "beer", 2, 4, 0.1, "#F0E080", [
    { id: "tequila", cl: 4 },
    { id: "tripleSec", cl: 2 },
    { id: "limeJuice", cl: 2.5 },
    { id: "beer", cl: 15 },
    { id: "salt" },
    { id: "ice" },
  ]),
  r("snakebite", "beer", 1, 1, 0, "#F0D070", [
    { id: "beer", cl: 25 },
    { id: "cider", cl: 25 },
  ]),
  r("snakebiteBlack", "beer", 1, 1, 0, "#B04050", [
    { id: "cassis", cl: 2 },
    { id: "beer", cl: 20 },
    { id: "cider", cl: 20 },
  ]),
  r("blackVelvet", "beer", 2, 2, 0, "#2A1A10", [
    { id: "champagne", cl: 10 },
    { id: "stout", cl: 10 },
  ]),
  r("blackAndTan", "beer", 2, 2, 0, "#4A2A18", [
    { id: "beer", cl: 20 },
    { id: "stout", cl: 20 },
  ]),
  r("boilermaker", "beer", 1, 1, 0, "#E0B050", [
    { id: "beer", cl: 30 },
    { id: "whisky", cl: 4 },
  ]),
  r("shandygaff", "beer", 1, 1, 0, "#E8C870", [
    { id: "beer", cl: 20 },
    { id: "gingerBeer", cl: 20 },
  ]),
  r("diesel", "beer", 1, 1, 0, "#6A3A20", [
    { id: "beer", cl: 25 },
    { id: "cola", cl: 25 },
  ]),
  r("tango", "beer", 1, 1, 0, "#E07050", [
    { id: "grenadine", cl: 2 },
    { id: "beer", cl: 25 },
  ]),
  r("redEye", "beer", 1, 1, 0, "#D06040", [
    { id: "beer", cl: 25 },
    { id: "tomatoJuice", cl: 10 },
  ]),
  r("beermosa", "beer", 1, 1, 0, "#F8C050", [
    { id: "wheatBeer", cl: 20 },
    { id: "orangeJuice", cl: 10 },
  ]),
  r("radler", "beer", 1, 1, 0, "#F4C080", [
    { id: "beer", cl: 25 },
    { id: "grapefruitSoda", cl: 25 },
  ]),
  r("spaghett", "beer", 1, 1, 0, "#F0A050", [
    { id: "beer", cl: 30 },
    { id: "aperol", cl: 3 },
    { id: "lemonJuice", cl: 1.5 },
  ]),
  r("sakeBomb", "beer", 1, 1, 0, "#F0E0A0", [
    { id: "beer", cl: 25 },
    { id: "sake", cl: 4 },
  ]),
  r("porchCrawler", "beer", 1, 2, 0.05, "#F4E090", [
    { id: "beer", cl: 15 },
    { id: "vodka", cl: 3 },
    { id: "lemonade", cl: 10 },
    { id: "ice" },
  ]),
  r("lunchbox", "beer", 1, 2, 0, "#F8B850", [
    { id: "beer", cl: 15 },
    { id: "orangeJuice", cl: 10 },
    { id: "amaretto", cl: 3 },
  ]),
  r("somaek", "beer", 1, 1, 0, "#F0E8B0", [
    { id: "beer", cl: 20 },
    { id: "soju", cl: 5 },
  ]),
  r("goass", "beer", 1, 1, 0, "#4A2018", [
    { id: "beer", cl: 25 },
    { id: "cola", cl: 20 },
    { id: "cherryBrandy", cl: 2 },
  ]),
  r("hangmansBlood", "beer", 2, 3, 0, "#3A1A10", [
    { id: "gin", cl: 1.5 },
    { id: "whiteRum", cl: 1.5 },
    { id: "cognac", cl: 1.5 },
    { id: "port", cl: 1.5 },
    { id: "stout", cl: 15 },
    { id: "champagne", cl: 5 },
  ]),
  r("biereCassis", "beer", 1, 1, 0, "#A03040", [
    { id: "cassis", cl: 2 },
    { id: "beer", cl: 25 },
  ]),
  r("bierePeche", "beer", 1, 1, 0, "#F0B060", [
    { id: "peachSchnapps", cl: 2 },
    { id: "beer", cl: 25 },
  ]),
  r("yorsh", "beer", 1, 1, 0, "#E8C870", [
    { id: "beer", cl: 25 },
    { id: "vodka", cl: 3 },
  ]),
  r("grasshopper", "dessert", 2, 3, 0.25, "#B8E0A0", [
    { id: "mintLiqueur", cl: 3 },
    { id: "cacaoLiqueur", cl: 3 },
    { id: "cream", cl: 3 },
    { id: "ice" },
  ]),
  r("brandyAlexander", "dessert", 2, 3, 0.25, "#D8B890", [
    { id: "cognac", cl: 3 },
    { id: "cacaoLiqueur", cl: 3 },
    { id: "cream", cl: 3 },
    { id: "nutmeg", count: 1, unit: "dash" },
    { id: "ice" },
  ]),
  r("mudslide", "dessert", 1, 3, 0.2, "#A08060", [
    { id: "vodka", cl: 3 },
    { id: "coffeeLiqueur", cl: 3 },
    { id: "irishCream", cl: 3 },
    { id: "cream", cl: 3 },
    { id: "ice" },
  ]),
  r("blackRussian", "dessert", 1, 2, 0.15, "#2A1810", [
    { id: "vodka", cl: 5 },
    { id: "coffeeLiqueur", cl: 2 },
    { id: "ice" },
  ]),
  r("goldenCadillac", "dessert", 2, 3, 0.25, "#F0E0A0", [
    { id: "vanillaLiqueur", cl: 3 },
    { id: "cacaoLiqueur", cl: 3 },
    { id: "cream", cl: 3 },
    { id: "ice" },
  ]),
  r("chocolateMartini", "dessert", 2, 4, 0.25, "#6A4030", [
    { id: "vodka", cl: 4 },
    { id: "cacaoLiqueur", cl: 3 },
    { id: "chocolateSyrup", cl: 1 },
    { id: "ice" },
  ]),
  r("toblerone", "dessert", 2, 4, 0.25, "#B08060", [
    { id: "irishCream", cl: 2 },
    { id: "coffeeLiqueur", cl: 2 },
    { id: "hazelnutLiqueur", cl: 2 },
    { id: "honeySyrup", cl: 1 },
    { id: "cream", cl: 2 },
    { id: "ice" },
  ]),
  r("nuttyIrishman", "dessert", 1, 2, 0.15, "#C8A070", [
    { id: "irishCream", cl: 3 },
    { id: "hazelnutLiqueur", cl: 3 },
    { id: "ice" },
  ]),
  r("dirtyBanana", "dessert", 1, 4, 0.2, "#C8A070", [
    { id: "darkRum", cl: 3 },
    { id: "coffeeLiqueur", cl: 3 },
    { id: "milk", cl: 6 },
    { id: "banana", count: 1 },
    { id: "ice" },
  ]),
  r("bushwacker", "dessert", 2, 4, 0.2, "#B09070", [
    { id: "darkRum", cl: 3 },
    { id: "coffeeLiqueur", cl: 2 },
    { id: "cacaoLiqueur", cl: 2 },
    { id: "coconutCream", cl: 3 },
    { id: "milk", cl: 6 },
    { id: "ice" },
  ]),
  r("eggnog", "dessert", 2, 5, 0.2, "#F4E8C0", [
    { id: "cognac", cl: 2 },
    { id: "darkRum", cl: 2 },
    { id: "milk", cl: 10 },
    { id: "egg", count: 1 },
    { id: "sugarSyrup", cl: 2 },
    { id: "nutmeg", count: 1, unit: "dash" },
    { id: "ice" },
  ]),
  r("punchCoco", "dessert", 1, 5, 0.1, "#F4F0E0", [
    { id: "agricoleRum", cl: 4 },
    { id: "coconutCream", cl: 6 },
    { id: "condensedMilk", cl: 3 },
    { id: "vanillaSyrup", cl: 0.5 },
    { id: "nutmeg", count: 1, unit: "dash" },
  ]),
  r("hotButteredRum", "dessert", 2, 5, 0, "#C89050", [
    { id: "darkRum", cl: 5 },
    { id: "butter", count: 1, unit: "tsp" },
    { id: "sugar", count: 1, unit: "tsp" },
    { id: "cinnamon", count: 1, unit: "dash" },
    { id: "nutmeg", count: 1, unit: "dash" },
    { id: "water", cl: 10 },
  ]),
  r("carajillo", "dessert", 1, 3, 0.2, "#6A4A30", [
    { id: "vanillaLiqueur", cl: 4 },
    { id: "espresso", cl: 4 },
    { id: "ice" },
  ]),
  r("jamaicanCoffee", "dessert", 1, 4, 0, "#6A4A30", [
    { id: "darkRum", cl: 3 },
    { id: "coffeeLiqueur", cl: 2 },
    { id: "espresso", cl: 8 },
    { id: "cream", cl: 3 },
  ]),
  r("mexicanCoffee", "dessert", 1, 4, 0, "#5A3A28", [
    { id: "tequila", cl: 3 },
    { id: "coffeeLiqueur", cl: 2 },
    { id: "espresso", cl: 8 },
    { id: "cream", cl: 3 },
    { id: "cinnamon", count: 1, unit: "dash" },
  ]),
  r("caffeCorretto", "dessert", 1, 2, 0, "#4A3020", [
    { id: "espresso", cl: 3 },
    { id: "sambuca", cl: 1.5 },
  ]),
  r("irishCreamHotChocolate", "dessert", 1, 5, 0, "#8A5A40", [
    { id: "milk", cl: 15 },
    { id: "cocoa", count: 2, unit: "tsp" },
    { id: "irishCream", cl: 4 },
    { id: "cream", cl: 2 },
  ]),
  r("stoutFloat", "dessert", 1, 2, 0, "#3A2010", [
    { id: "iceCream", cl: 8 },
    { id: "stout", cl: 20 },
  ]),
  r("brandyMilkPunch", "dessert", 1, 3, 0.2, "#F0E0C0", [
    { id: "cognac", cl: 5 },
    { id: "milk", cl: 9 },
    { id: "sugarSyrup", cl: 1.5 },
    { id: "vanillaSyrup", cl: 0.5 },
    { id: "nutmeg", count: 1, unit: "dash" },
    { id: "ice" },
  ]),
  r("portoFlip", "dessert", 2, 4, 0.2, "#A05040", [
    { id: "cognac", cl: 1.5 },
    { id: "port", cl: 4.5 },
    { id: "egg", count: 1 },
    { id: "nutmeg", count: 1, unit: "dash" },
    { id: "ice" },
  ]),
  r("saltedCaramelMartini", "dessert", 2, 3, 0.25, "#C89060", [
    { id: "vodka", cl: 4 },
    { id: "caramelSyrup", cl: 2 },
    { id: "irishCream", cl: 2 },
    { id: "salt" },
    { id: "ice" },
  ]),
  r("coloradoBulldog", "dessert", 1, 2, 0.1, "#8A6040", [
    { id: "vodka", cl: 3 },
    { id: "coffeeLiqueur", cl: 3 },
    { id: "cream", cl: 3 },
    { id: "cola", cl: 6, top: true },
    { id: "ice" },
  ]),
  r("goldenDream", "dessert", 2, 3, 0.25, "#F8D080", [
    { id: "vanillaLiqueur", cl: 2 },
    { id: "tripleSec", cl: 2 },
    { id: "orangeJuice", cl: 2 },
    { id: "cream", cl: 1 },
    { id: "ice" },
  ]),
  r("irishCreamMilkshake", "dessert", 1, 3, 0, "#D8C0A0", [
    { id: "irishCream", cl: 4 },
    { id: "iceCream", cl: 10 },
    { id: "milk", cl: 6 },
  ]),
  r("spanishCoffee", "dessert", 2, 4, 0, "#6A4428", [
    { id: "darkRum", cl: 2 },
    { id: "tripleSec", cl: 1.5 },
    { id: "coffeeLiqueur", cl: 1.5 },
    { id: "espresso", cl: 8 },
    { id: "cream", cl: 3 },
    { id: "sugar" },
  ]),
  r("affinity", "classic", 2, 3, 0.2, "#B06A30", [
    { id: "whisky", cl: 3 },
    { id: "redVermouth", cl: 3 },
    { id: "dryVermouth", cl: 3 },
    { id: "angostura", count: 2, unit: "dash" },
    { id: "ice" },
  ]),
  r("monteCarlo", "classic", 2, 3, 0.2, "#B07030", [
    { id: "rye", cl: 6 },
    { id: "benedictine", cl: 1.5 },
    { id: "angostura", count: 2, unit: "dash" },
    { id: "ice" },
  ]),
  r("seelbach", "classic", 2, 3, 0, "#E8C070", [
    { id: "bourbon", cl: 3 },
    { id: "tripleSec", cl: 1.5 },
    { id: "angostura", count: 7, unit: "dash" },
    { id: "peychaud", count: 7, unit: "dash" },
    { id: "champagne", cl: 12, top: true },
  ]),
  r("fogCutter", "classic", 2, 4, 0.2, "#F0B860", [
    { id: "whiteRum", cl: 4.5 },
    { id: "cognac", cl: 3 },
    { id: "gin", cl: 1.5 },
    { id: "orangeJuice", cl: 6 },
    { id: "lemonJuice", cl: 4.5 },
    { id: "orgeat", cl: 1.5 },
    { id: "sherry", cl: 1.5 },
    { id: "ice" },
  ]),
  r("daisyDeSantiago", "classic", 2, 3, 0.2, "#F0E080", [
    { id: "whiteRum", cl: 5 },
    { id: "yellowChartreuse", cl: 1.5 },
    { id: "limeJuice", cl: 2 },
    { id: "sugarSyrup", cl: 1 },
    { id: "soda", cl: 3, top: true },
    { id: "ice" },
  ]),
  r("jasmine", "classic", 2, 3, 0.25, "#F8B8A0", [
    { id: "gin", cl: 4.5 },
    { id: "tripleSec", cl: 0.75 },
    { id: "campari", cl: 0.75 },
    { id: "lemonJuice", cl: 2.25 },
    { id: "ice" },
  ]),
  r("chrysanthemum", "classic", 2, 3, 0.2, "#E8D080", [
    { id: "dryVermouth", cl: 6 },
    { id: "benedictine", cl: 3 },
    { id: "absinthe", count: 1, unit: "dash" },
    { id: "orange", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("ginDaisy", "classic", 1, 3, 0.2, "#F4A0A0", [
    { id: "gin", cl: 4.5 },
    { id: "lemonJuice", cl: 2 },
    { id: "grenadine", cl: 1 },
    { id: "soda", cl: 4, top: true },
    { id: "ice" },
  ]),
  r("vermouthCassis", "classic", 1, 2, 0.1, "#B04060", [
    { id: "dryVermouth", cl: 6 },
    { id: "cassis", cl: 1.5 },
    { id: "soda", cl: 6, top: true },
    { id: "ice" },
  ]),
  r("suzeCassis", "classic", 1, 1, 0.1, "#A03040", [
    { id: "gentian", cl: 5 },
    { id: "cassis", cl: 1.5 },
    { id: "ice" },
  ]),
  r("bayBreeze", "classic", 1, 2, 0.1, "#E87070", [
    { id: "vodka", cl: 4 },
    { id: "cranberryJuice", cl: 9 },
    { id: "pineappleJuice", cl: 6 },
    { id: "ice" },
  ]),
  r("brandyOldFashioned", "classic", 1, 3, 0.15, "#D08040", [
    { id: "cognac", cl: 5 },
    { id: "sugar", count: 1, unit: "tsp" },
    { id: "angostura", count: 3, unit: "dash" },
    { id: "orange", count: 1, unit: "slice" },
    { id: "cherry", count: 1 },
    { id: "lemonade", cl: 6, top: true },
    { id: "ice" },
  ]),
  r("piscoPunch", "classic", 2, 3, 0.25, "#F4E0A0", [
    { id: "pisco", cl: 6 },
    { id: "pineappleJuice", cl: 3 },
    { id: "lemonJuice", cl: 2 },
    { id: "sugarSyrup", cl: 1.5 },
    { id: "ice" },
  ]),
  r("elCapitan", "classic", 2, 3, 0.2, "#B05A30", [
    { id: "pisco", cl: 4.5 },
    { id: "redVermouth", cl: 3 },
    { id: "angostura", count: 2, unit: "dash" },
    { id: "ice" },
  ]),
  r("floradora", "classic", 1, 3, 0.1, "#F0A0A0", [
    { id: "gin", cl: 4.5 },
    { id: "limeJuice", cl: 1.5 },
    { id: "raspberrySyrup", cl: 1.5 },
    { id: "gingerAle", cl: 9, top: true },
    { id: "ice" },
  ]),
  r("morningGloryFizz", "classic", 3, 5, 0.2, "#F4F0E0", [
    { id: "whisky", cl: 5 },
    { id: "lemonJuice", cl: 2 },
    { id: "sugarSyrup", cl: 2 },
    { id: "eggWhite", cl: 2 },
    { id: "absinthe", count: 1, unit: "dash" },
    { id: "soda", cl: 6, top: true },
    { id: "ice" },
  ]),
  r("mulataDaiquiri", "classic", 2, 3, 0.25, "#8A6040", [
    { id: "darkRum", cl: 4.5 },
    { id: "cacaoLiqueur", cl: 1.5 },
    { id: "limeJuice", cl: 2 },
    { id: "sugarSyrup", cl: 0.5 },
    { id: "ice" },
  ]),
  r("bermudaRumSwizzle", "classic", 2, 4, 0.2, "#F09050", [
    { id: "darkRum", cl: 3 },
    { id: "whiteRum", cl: 3 },
    { id: "pineappleJuice", cl: 6 },
    { id: "orangeJuice", cl: 6 },
    { id: "falernum", cl: 1.5 },
    { id: "angostura", count: 2, unit: "dash" },
    { id: "ice" },
  ]),
  r("toreador", "classic", 2, 3, 0.25, "#F0C060", [
    { id: "tequila", cl: 4.5 },
    { id: "apricotBrandy", cl: 1.5 },
    { id: "limeJuice", cl: 1.5 },
    { id: "ice" },
  ]),
  r("widowsKiss", "classic", 2, 3, 0.2, "#E0B050", [
    { id: "calvados", cl: 3 },
    { id: "benedictine", cl: 1.5 },
    { id: "yellowChartreuse", cl: 1.5 },
    { id: "angostura", count: 2, unit: "dash" },
    { id: "ice" },
  ]),
  r("knickerbocker", "classic", 2, 4, 0.2, "#E06070", [
    { id: "darkRum", cl: 6 },
    { id: "raspberrySyrup", cl: 1.5 },
    { id: "tripleSec", cl: 0.75 },
    { id: "limeJuice", cl: 1.5 },
    { id: "raspberry", count: 3 },
    { id: "ice" },
  ]),
  r("blackthorn", "classic", 2, 3, 0.2, "#902A3A", [
    { id: "sloeGin", cl: 4.5 },
    { id: "redVermouth", cl: 3 },
    { id: "orangeBitters", count: 2, unit: "dash" },
    { id: "ice" },
  ]),
  r("diplomat", "classic", 2, 3, 0.2, "#D89050", [
    { id: "dryVermouth", cl: 6 },
    { id: "redVermouth", cl: 3 },
    { id: "maraschino", cl: 0.5 },
    { id: "orangeBitters", count: 2, unit: "dash" },
    { id: "ice" },
  ]),
  r("chancellor", "classic", 2, 3, 0.2, "#8A2A2A", [
    { id: "whisky", cl: 6 },
    { id: "port", cl: 3 },
    { id: "dryVermouth", cl: 1.5 },
    { id: "angostura", count: 1, unit: "dash" },
    { id: "ice" },
  ]),
  r("breakfastMartini", "classic", 2, 3, 0.25, "#F0C060", [
    { id: "gin", cl: 5 },
    { id: "tripleSec", cl: 1.5 },
    { id: "lemonJuice", cl: 1.5 },
    { id: "marmalade", count: 1, unit: "tsp" },
    { id: "ice" },
  ]),
  r("treacle", "classic", 1, 3, 0.15, "#8A5A30", [
    { id: "darkRum", cl: 5 },
    { id: "sugarSyrup", cl: 0.5 },
    { id: "angostura", count: 2, unit: "dash" },
    { id: "appleJuice", cl: 2.5 },
    { id: "ice" },
  ]),
  r("eastside", "classic", 2, 4, 0.25, "#C8F0B8", [
    { id: "gin", cl: 6 },
    { id: "limeJuice", cl: 2.5 },
    { id: "sugarSyrup", cl: 2 },
    { id: "mint", count: 6, unit: "leaf" },
    { id: "cucumber", count: 2, unit: "slice" },
    { id: "ice" },
  ]),
  r("chartreuseSwizzle", "classic", 2, 4, 0.25, "#C0D870", [
    { id: "greenChartreuse", cl: 4.5 },
    { id: "pineappleJuice", cl: 3 },
    { id: "limeJuice", cl: 2 },
    { id: "falernum", cl: 1.5 },
    { id: "ice" },
  ]),
  r("kentuckyBuck", "classic", 2, 4, 0.15, "#E09070", [
    { id: "bourbon", cl: 4.5 },
    { id: "lemonJuice", cl: 2 },
    { id: "sugarSyrup", cl: 1.5 },
    { id: "strawberry", count: 2 },
    { id: "angostura", count: 2, unit: "dash" },
    { id: "gingerBeer", cl: 6, top: true },
    { id: "ice" },
  ]),
  r("industrySour", "classic", 2, 3, 0.25, "#5A6A30", [
    { id: "fernet", cl: 3 },
    { id: "greenChartreuse", cl: 3 },
    { id: "limeJuice", cl: 2.25 },
    { id: "sugarSyrup", cl: 2.25 },
    { id: "ice" },
  ]),
  r("journalist", "classic", 2, 3, 0.25, "#E8C890", [
    { id: "gin", cl: 4.5 },
    { id: "redVermouth", cl: 0.75 },
    { id: "dryVermouth", cl: 0.75 },
    { id: "tripleSec", cl: 0.75 },
    { id: "lemonJuice", cl: 0.75 },
    { id: "angostura", count: 1, unit: "dash" },
    { id: "ice" },
  ]),
  r("fallenAngel", "classic", 2, 3, 0.25, "#E0F0C8", [
    { id: "gin", cl: 4.5 },
    { id: "limeJuice", cl: 2 },
    { id: "mintLiqueur", cl: 0.5 },
    { id: "sugarSyrup", cl: 0.5 },
    { id: "angostura", count: 1, unit: "dash" },
    { id: "ice" },
  ]),
  r("spritzer", "party", 1, 1, 0.1, "#F4F0C8", [
    { id: "whiteWine", cl: 10 },
    { id: "soda", cl: 6, top: true },
    { id: "lemon", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("goombaySmash", "party", 1, 3, 0.15, "#F8B860", [
    { id: "coconutRum", cl: 3 },
    { id: "darkRum", cl: 3 },
    { id: "apricotBrandy", cl: 1.5 },
    { id: "pineappleJuice", cl: 6 },
    { id: "orangeJuice", cl: 3 },
    { id: "ice" },
  ]),
  r("miamiVice", "party", 3, 6, 0.25, "#F49090", [
    { id: "whiteRum", cl: 5 },
    { id: "coconutCream", cl: 3 },
    { id: "pineappleJuice", cl: 6 },
    { id: "strawberry", count: 5 },
    { id: "limeJuice", cl: 1.5 },
    { id: "sugarSyrup", cl: 1 },
    { id: "ice" },
  ]),
  r("lavaFlow", "party", 2, 5, 0.2, "#F06060", [
    { id: "whiteRum", cl: 3 },
    { id: "coconutRum", cl: 3 },
    { id: "strawberry", count: 4 },
    { id: "banana", count: 1 },
    { id: "pineappleJuice", cl: 6 },
    { id: "coconutCream", cl: 3 },
    { id: "ice" },
  ]),
  r("vietnameseIcedCoffee", "zero", 1, 4, 0.15, "#A07850", [
    { id: "condensedMilk", cl: 2 },
    { id: "espresso", cl: 4 },
    { id: "ice" },
  ]),
  r("thaiIcedTea", "zero", 1, 8, 0.1, "#E89050", [
    { id: "tea", cl: 12 },
    { id: "condensedMilk", cl: 2 },
    { id: "milk", cl: 3 },
    { id: "ice" },
  ]),
  r("limonana", "zero", 1, 4, 0.2, "#C8E890", [
    { id: "lemonJuice", cl: 3 },
    { id: "sugarSyrup", cl: 2.5 },
    { id: "mint", count: 10, unit: "leaf" },
    { id: "water", cl: 10 },
    { id: "ice" },
  ]),
  r("virginPainkiller", "zero", 1, 3, 0.15, "#F0D0A0", [
    { id: "pineappleJuice", cl: 12 },
    { id: "orangeJuice", cl: 3 },
    { id: "coconutCream", cl: 3 },
    { id: "nutmeg", count: 1, unit: "dash" },
    { id: "ice" },
  ]),
  r("virginMaiTai", "zero", 1, 3, 0.2, "#F0B060", [
    { id: "orangeJuice", cl: 4 },
    { id: "pineappleJuice", cl: 4 },
    { id: "limeJuice", cl: 2 },
    { id: "orgeat", cl: 1.5 },
    { id: "grenadine", cl: 0.5 },
    { id: "mint", count: 3, unit: "leaf" },
    { id: "ice" },
  ]),
  r("dernierMetro", "signature", 2, 3, 0.25, "#E8B060", [
    { id: "bourbon", cl: 4.5 },
    { id: "amaretto", cl: 1.5 },
    { id: "lemonJuice", cl: 2 },
    { id: "honeySyrup", cl: 1 },
    { id: "ice" },
  ]),
  r("tourneeGenerale", "signature", 1, 5, 0.1, "#F0A050", [
    { id: "aperol", cl: 4 },
    { id: "whiteWine", cl: 6 },
    { id: "orangeJuice", cl: 4 },
    { id: "soda", cl: 4, top: true },
    { id: "orange", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("nuitBlanche", "signature", 2, 3, 0.25, "#F4F0E0", [
    { id: "vodka", cl: 4 },
    { id: "elderflowerLiqueur", cl: 1.5 },
    { id: "lemonJuice", cl: 1.5 },
    { id: "eggWhite", cl: 2 },
    { id: "ice" },
  ]),
  r("apresMinuit", "signature", 2, 3, 0.2, "#5A3A28", [
    { id: "darkRum", cl: 4 },
    { id: "coffeeLiqueur", cl: 1.5 },
    { id: "espresso", cl: 2 },
    { id: "vanillaSyrup", cl: 0.5 },
    { id: "ice" },
  ]),
  r("toastDuCrew", "signature", 1, 2, 0, "#F0D080", [
    { id: "gin", cl: 2 },
    { id: "elderflowerSyrup", cl: 1 },
    { id: "lemonJuice", cl: 1 },
    { id: "prosecco", cl: 9, top: true },
  ]),
  r("leveDuJour", "signature", 1, 3, 0.15, "#F8B040", [
    { id: "tequila", cl: 3 },
    { id: "orangeJuice", cl: 9 },
    { id: "passionJuice", cl: 3 },
    { id: "grenadine", cl: 1 },
    { id: "ice" },
  ]),
  r("apresLeConcert", "signature", 1, 2, 0.1, "#D8E0A0", [
    { id: "gin", cl: 4 },
    { id: "cucumber", count: 3, unit: "slice" },
    { id: "limeJuice", cl: 1.5 },
    { id: "tonic", cl: 12, top: true },
    { id: "ice" },
  ]),
  r("zincNoir", "signature", 2, 3, 0.2, "#3A2418", [
    { id: "rye", cl: 4 },
    { id: "coffeeLiqueur", cl: 1 },
    { id: "amaro", cl: 1.5 },
    { id: "orangeBitters", count: 2, unit: "dash" },
    { id: "ice" },
  ]),
  r("banquetteArriere", "signature", 1, 3, 0.15, "#F09060", [
    { id: "darkRum", cl: 4 },
    { id: "peachJuice", cl: 4 },
    { id: "lemonJuice", cl: 1.5 },
    { id: "gingerBeer", cl: 8, top: true },
    { id: "ice" },
  ]),
  r("rendezVous", "signature", 2, 3, 0.25, "#E07080", [
    { id: "gin", cl: 4 },
    { id: "raspberryLiqueur", cl: 1.5 },
    { id: "lemonJuice", cl: 2 },
    { id: "sugarSyrup", cl: 1 },
    { id: "ice" },
  ]),
  r("pistedeDanse", "signature", 1, 2, 0.1, "#C8E870", [
    { id: "vodka", cl: 4 },
    { id: "melonLiqueur", cl: 2 },
    { id: "limeJuice", cl: 1.5 },
    { id: "lemonade", cl: 10, top: true },
    { id: "ice" },
  ]),
  r("vestiaire", "signature", 1, 2, 0.15, "#C88040", [
    { id: "calvados", cl: 4 },
    { id: "appleJuice", cl: 6 },
    { id: "gingerAle", cl: 6, top: true },
    { id: "cinnamon", count: 1, unit: "dash" },
    { id: "ice" },
  ]),
  r("premierVerre", "signature", 1, 2, 0.1, "#F4D0A0", [
    { id: "lillet", cl: 4 },
    { id: "grapefruitJuice", cl: 4 },
    { id: "tonic", cl: 8, top: true },
    { id: "ice" },
  ]),
  r("bisSurLeZinc", "signature", 2, 3, 0.2, "#E06048", [
    { id: "mezcal", cl: 2 },
    { id: "campari", cl: 3 },
    { id: "redVermouth", cl: 3 },
    { id: "orange", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("crewSour", "signature", 2, 4, 0.25, "#F0C870", [
    { id: "pisco", cl: 5 },
    { id: "passionJuice", cl: 2 },
    { id: "limeJuice", cl: 2 },
    { id: "sugarSyrup", cl: 1.5 },
    { id: "eggWhite", cl: 2 },
    { id: "ice" },
  ]),
  r("lampadaire", "signature", 1, 2, 0.1, "#F8E070", [
    { id: "limoncello", cl: 3 },
    { id: "gin", cl: 2 },
    { id: "soda", cl: 10, top: true },
    { id: "basil", count: 3, unit: "leaf" },
    { id: "ice" },
  ]),
  r("terrasseEte", "signature", 1, 2, 0.1, "#F8B8B0", [
    { id: "roseWine", cl: 9 },
    { id: "elderflowerSyrup", cl: 1.5 },
    { id: "soda", cl: 5, top: true },
    { id: "strawberry", count: 2 },
    { id: "ice" },
  ]),
  r("chaussettesMouillees", "signature", 1, 5, 0, "#C87040", [
    { id: "whisky", cl: 3 },
    { id: "appleJuice", cl: 12 },
    { id: "honeySyrup", cl: 1 },
    { id: "cinnamon", count: 1 },
  ]),
  r("retourAuBercail", "signature", 1, 3, 0, "#E8D0A8", [
    { id: "cognac", cl: 3 },
    { id: "milk", cl: 12 },
    { id: "honeySyrup", cl: 1.5 },
    { id: "nutmeg", count: 1, unit: "dash" },
  ]),
  r("videPoche", "signature", 1, 2, 0.1, "#F0B050", [
    { id: "darkRum", cl: 3 },
    { id: "whiteRum", cl: 2 },
    { id: "orangeJuice", cl: 5 },
    { id: "pineappleJuice", cl: 5 },
    { id: "lime", count: 1, unit: "wedge" },
    { id: "ice" },
  ]),
  r("playlist", "signature", 1, 3, 0.2, "#E86070", [
    { id: "vodka", cl: 3 },
    { id: "cranberryJuice", cl: 4 },
    { id: "raspberrySyrup", cl: 1 },
    { id: "limeJuice", cl: 1.5 },
    { id: "ice" },
  ]),
  r("afterDuZinc", "signature", 2, 3, 0.2, "#6A4030", [
    { id: "cognac", cl: 3 },
    { id: "cacaoLiqueur", cl: 1.5 },
    { id: "espresso", cl: 3 },
    { id: "cream", cl: 1 },
    { id: "ice" },
  ]),
  r("selfieMule", "signature", 1, 2, 0.1, "#E8D890", [
    { id: "vodka", cl: 4 },
    { id: "passionJuice", cl: 3 },
    { id: "limeJuice", cl: 1 },
    { id: "gingerBeer", cl: 9, top: true },
    { id: "ice" },
  ]),
  r("cheersPommes", "signature", 1, 1, 0, "#F4D070", [
    { id: "calvados", cl: 2 },
    { id: "cider", cl: 12 },
  ]),
  r("grandeTablee", "signature", 1, 10, 0.1, "#B03050", [
    { id: "redWine", cl: 8 },
    { id: "cassis", cl: 1 },
    { id: "orangeJuice", cl: 3 },
    { id: "gingerAle", cl: 5, top: true },
    { id: "orange", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("coupDeFoudre", "signature", 2, 3, 0.25, "#F07890", [
    { id: "gin", cl: 4 },
    { id: "strawberry", count: 3 },
    { id: "lemonJuice", cl: 2 },
    { id: "sugarSyrup", cl: 1.5 },
    { id: "basil", count: 3, unit: "leaf" },
    { id: "ice" },
  ]),
  r("pluieDEte", "signature", 1, 2, 0.1, "#D8E8C0", [
    { id: "whiteRum", cl: 4 },
    { id: "elderflowerSyrup", cl: 1.5 },
    { id: "limeJuice", cl: 1.5 },
    { id: "soda", cl: 10, top: true },
    { id: "mint", count: 5, unit: "leaf" },
    { id: "ice" },
  ]),
  r("cartePostale", "signature", 1, 3, 0.15, "#F8C060", [
    { id: "coconutRum", cl: 4 },
    { id: "mangoJuice", cl: 6 },
    { id: "limeJuice", cl: 1.5 },
    { id: "soda", cl: 4, top: true },
    { id: "ice" },
  ]),
  r("rideauRouge", "signature", 2, 3, 0.2, "#A02838", [
    { id: "gin", cl: 3 },
    { id: "campari", cl: 2 },
    { id: "cherryBrandy", cl: 1 },
    { id: "lemonJuice", cl: 1.5 },
    { id: "ice" },
  ]),
  r("cabine", "signature", 1, 1, 0, "#E8C070", [
    { id: "bourbon", cl: 2 },
    { id: "honeySyrup", cl: 0.5 },
    { id: "lemonJuice", cl: 0.5 },
  ]),
  r("feuxDeBengale", "signature", 1, 1, 0, "#E05040", [
    { id: "cinnamonWhisky", cl: 2 },
    { id: "cranberryJuice", cl: 2 },
  ]),
  r("codePin", "signature", 1, 2, 0.2, "#C8E8A0", [
    { id: "tequila", cl: 2 },
    { id: "appleLiqueur", cl: 1.5 },
    { id: "limeJuice", cl: 1 },
    { id: "ice" },
  ]),
  r("bonneNuit", "signature", 1, 2, 0, "#6A4A30", [
    { id: "coffeeLiqueur", cl: 2 },
    { id: "hazelnutLiqueur", cl: 1 },
    { id: "cream", cl: 1 },
  ]),
  r("mousseDuCrew", "signature", 1, 1, 0, "#F0B860", [
    { id: "beer", cl: 25 },
    { id: "apricotBrandy", cl: 2 },
    { id: "orangeJuice", cl: 3 },
  ]),
  r("blancheNuit", "signature", 1, 1, 0, "#F8E0A0", [
    { id: "wheatBeer", cl: 25 },
    { id: "elderflowerSyrup", cl: 1.5 },
    { id: "lemon", count: 1, unit: "slice" },
  ]),
  r("stoutDuDimanche", "signature", 1, 2, 0, "#2A1810", [
    { id: "stout", cl: 20 },
    { id: "coffeeLiqueur", cl: 2 },
    { id: "vanillaSyrup", cl: 0.5 },
  ]),
  r("mojitoDuToit", "signature", 2, 5, 0.15, "#C8E8A0", [
    { id: "whiteRum", cl: 4 },
    { id: "limeJuice", cl: 2 },
    { id: "honeySyrup", cl: 2 },
    { id: "basil", count: 6, unit: "leaf" },
    { id: "soda", cl: 8, top: true },
    { id: "ice" },
  ]),
  r("nuitTropicale", "signature", 2, 4, 0.2, "#F0A050", [
    { id: "agricoleRum", cl: 4 },
    { id: "passionJuice", cl: 3 },
    { id: "orgeat", cl: 1 },
    { id: "limeJuice", cl: 1.5 },
    { id: "ice" },
  ]),
  r("quaiDeGare", "signature", 2, 3, 0.2, "#D09050", [
    { id: "cognac", cl: 4 },
    { id: "gentian", cl: 1.5 },
    { id: "redVermouth", cl: 1.5 },
    { id: "ice" },
  ]),
  r("lumiereNoire", "signature", 1, 2, 0.1, "#4A9AD8", [
    { id: "gin", cl: 4 },
    { id: "blueCuracao", cl: 1 },
    { id: "lemonJuice", cl: 1.5 },
    { id: "tonic", cl: 10, top: true },
    { id: "ice" },
  ]),
  r("souvenirFlou", "signature", 2, 3, 0.25, "#F0B8A0", [
    { id: "vodka", cl: 3 },
    { id: "peachSchnapps", cl: 1.5 },
    { id: "grapefruitJuice", cl: 3 },
    { id: "lemonJuice", cl: 1 },
    { id: "ice" },
  ]),
  r("dancefloorSpritz", "signature", 1, 2, 0.1, "#F4D060", [
    { id: "limoncello", cl: 3 },
    { id: "aperol", cl: 2 },
    { id: "prosecco", cl: 8 },
    { id: "soda", cl: 3, top: true },
    { id: "ice" },
  ]),
  r("laClefDesChamps", "signature", 2, 3, 0.25, "#D8E8A0", [
    { id: "gin", cl: 4 },
    { id: "greenChartreuse", cl: 1 },
    { id: "limeJuice", cl: 2 },
    { id: "honeySyrup", cl: 1.5 },
    { id: "ice" },
  ]),
  r("derniereDanse", "signature", 2, 3, 0.2, "#B04040", [
    { id: "bourbon", cl: 4 },
    { id: "port", cl: 2 },
    { id: "cherryBrandy", cl: 1 },
    { id: "angostura", count: 2, unit: "dash" },
    { id: "ice" },
  ]),
  r("karaoke", "signature", 1, 2, 0.1, "#F8A050", [
    { id: "tequila", cl: 4 },
    { id: "mangoJuice", cl: 6 },
    { id: "limeJuice", cl: 1.5 },
    { id: "chili", count: 1, unit: "slice" },
    { id: "soda", cl: 4, top: true },
    { id: "ice" },
  ]),
  r("brunchDuLendemain", "signature", 1, 3, 0.1, "#D04838", [
    { id: "gin", cl: 3 },
    { id: "tomatoJuice", cl: 9 },
    { id: "lemonJuice", cl: 1 },
    { id: "basil", count: 3, unit: "leaf" },
    { id: "salt" },
    { id: "ice" },
  ]),
  r("cafeDuMatin", "signature", 1, 3, 0.1, "#8A6040", [
    { id: "espresso", cl: 4 },
    { id: "tonic", cl: 10, top: true },
    { id: "gingerSyrup", cl: 1 },
    { id: "lemon", count: 1, unit: "slice" },
    { id: "ice" },
  ]),
  r("designatedDriver", "signature", 1, 3, 0.2, "#F0C870", [
    { id: "pineappleJuice", cl: 6 },
    { id: "passionJuice", cl: 3 },
    { id: "limeJuice", cl: 1.5 },
    { id: "gingerBeer", cl: 6, top: true },
    { id: "mint", count: 4, unit: "leaf" },
    { id: "ice" },
  ]),
  r("eauDeLaPiste", "signature", 1, 2, 0.1, "#E0F0E0", [
    { id: "cucumber", count: 3, unit: "slice" },
    { id: "elderflowerSyrup", cl: 1.5 },
    { id: "limeJuice", cl: 1 },
    { id: "soda", cl: 15, top: true },
    { id: "ice" },
  ]),
  r("roseDesVents", "signature", 1, 2, 0.1, "#F8A8A8", [
    { id: "grapefruitJuice", cl: 6 },
    { id: "raspberrySyrup", cl: 1.5 },
    { id: "tonic", cl: 10, top: true },
    { id: "ice" },
  ]),
  r("petitMatin", "signature", 1, 3, 0.1, "#F8D890", [
    { id: "orangeJuice", cl: 8 },
    { id: "mangoJuice", cl: 4 },
    { id: "coconutWater", cl: 4 },
    { id: "lime", count: 1, unit: "wedge" },
    { id: "ice" },
  ]),
  r("cocktailDuCapitaine", "signature", 1, 3, 0.2, "#F0B060", [
    { id: "appleJuice", cl: 6 },
    { id: "peachJuice", cl: 4 },
    { id: "lemonJuice", cl: 1 },
    { id: "cinnamon", count: 1, unit: "dash" },
    { id: "soda", cl: 4, top: true },
    { id: "ice" },
  ]),
  r("feuDeCamp", "signature", 2, 5, 0, "#C87848", [
    { id: "darkRum", cl: 3 },
    { id: "appleJuice", cl: 10 },
    { id: "caramelSyrup", cl: 1 },
    { id: "cinnamon", count: 1 },
  ]),
  r("cremeDeNuit", "signature", 2, 3, 0.25, "#E8D0B0", [
    { id: "irishCream", cl: 3 },
    { id: "vodka", cl: 2 },
    { id: "caramelSyrup", cl: 1 },
    { id: "espresso", cl: 2 },
    { id: "ice" },
  ]),
  r("pralineMartini", "signature", 2, 3, 0.25, "#C8A070", [
    { id: "hazelnutLiqueur", cl: 3 },
    { id: "vodka", cl: 2 },
    { id: "cream", cl: 2 },
    { id: "cocoa", count: 1, unit: "tsp" },
    { id: "ice" },
  ]),
  r("tarteTatin", "signature", 2, 3, 0.2, "#D09048", [
    { id: "calvados", cl: 3 },
    { id: "caramelSyrup", cl: 1.5 },
    { id: "appleJuice", cl: 4 },
    { id: "cream", cl: 1 },
    { id: "ice" },
  ]),
  r("banoffee", "signature", 2, 4, 0.2, "#D8B080", [
    { id: "darkRum", cl: 3 },
    { id: "bananaLiqueur", cl: 1.5 },
    { id: "caramelSyrup", cl: 1 },
    { id: "milk", cl: 6 },
    { id: "banana", count: 1 },
    { id: "ice" },
  ]),
  r("brioche", "signature", 1, 3, 0.2, "#F0D8A0", [
    { id: "vanillaLiqueur", cl: 3 },
    { id: "milk", cl: 6 },
    { id: "honeySyrup", cl: 1 },
    { id: "nutmeg", count: 1, unit: "dash" },
    { id: "ice" },
  ]),
  r("cerisesNoires", "signature", 2, 3, 0.2, "#6A1A28", [
    { id: "cherryBrandy", cl: 2 },
    { id: "cacaoLiqueur", cl: 2 },
    { id: "cream", cl: 2 },
    { id: "vodka", cl: 2 },
    { id: "ice" },
  ]),
  r("ileFlottante", "signature", 2, 4, 0.25, "#F8F0D8", [
    { id: "vanillaLiqueur", cl: 2 },
    { id: "cognac", cl: 2 },
    { id: "milk", cl: 4 },
    { id: "eggWhite", cl: 2 },
    { id: "caramelSyrup", cl: 0.5 },
    { id: "ice" },
  ]),
  r("lastOrders", "signature", 1, 2, 0.15, "#B87838", [
    { id: "whisky", cl: 4 },
    { id: "amaretto", cl: 1 },
    { id: "appleJuice", cl: 4 },
    { id: "ice" },
  ]),
  r("photoDeGroupe", "signature", 1, 3, 0.1, "#F09070", [
    { id: "vodka", cl: 3 },
    { id: "aperol", cl: 2 },
    { id: "grapefruitJuice", cl: 4 },
    { id: "soda", cl: 6, top: true },
    { id: "ice" },
  ]),
  r("debriefDuLendemain", "signature", 1, 2, 0.1, "#F0E0B0", [
    { id: "gin", cl: 3 },
    { id: "lillet", cl: 2 },
    { id: "appleJuice", cl: 4 },
    { id: "tonic", cl: 6, top: true },
    { id: "ice" },
  ]),
  r("chaiseMusicale", "signature", 2, 3, 0.25, "#E8A048", [
    { id: "darkRum", cl: 3 },
    { id: "apricotBrandy", cl: 1.5 },
    { id: "lemonJuice", cl: 2 },
    { id: "honeySyrup", cl: 1 },
    { id: "ice" },
  ]),
  r("taxiPartage", "signature", 1, 2, 0.1, "#E8C060", [
    { id: "bourbon", cl: 3 },
    { id: "peachJuice", cl: 4 },
    { id: "lemonJuice", cl: 1 },
    { id: "gingerAle", cl: 8, top: true },
    { id: "ice" },
  ]),
  r("salleComble", "signature", 1, 5, 0.1, "#D86048", [
    { id: "whiteRum", cl: 2 },
    { id: "cachaca", cl: 2 },
    { id: "passionJuice", cl: 4 },
    { id: "cranberryJuice", cl: 4 },
    { id: "lemonade", cl: 6, top: true },
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
