/**
 * What people actually order in French bars, with the strength on the label and the size it
 * usually comes in. Shared by the order parser ("2 castel", "demi kro") and the add sheet (brand
 * chips, brand search for a new drink). Brand names are proper nouns and stay as written; generic
 * drinks (red wine, rum) carry a `generic` id that the app translates.
 */

import { FIRST_LIST_COUNTRIES, MORE_DRINKS } from "./brands";

export type DrinkGroup = "beer" | "wine" | "spirit" | "cocktail" | "cider" | "soft";

/** The glass drawn for a drink; the same names as the app's glass icons. */
export type GlassName = "pint" | "demi" | "bottle" | "can" | "wine" | "cocktail" | "shot" | "cider" | "soft";

/** Drinks without a brand, named by the app in the user's language. */
export type GenericDrinkId =
  | "redWine"
  | "whiteWine"
  | "roseWine"
  | "champagne"
  | "cider"
  | "whisky"
  | "rum"
  | "vodka"
  | "gin"
  | "tequila"
  | "orangeJuice";

interface CatalogueBase {
  /** Stable id, also the suffix of the logged drink's preset id (`cat:<id>`). */
  id: string;
  group: DrinkGroup;
  /** Fraction, 0.05 for 5 %. */
  abv: number;
  /** The size it usually comes in, in ml. For a combo, the spirit's part only. */
  volumeMl: number;
  glass: GlassName;
  /** Nicknames and spellings people type: "kro", "castel", "polia". */
  aliases: readonly string[];
  /** Sold in cans: "a can of" it means its own size, not 33 cl. */
  can?: boolean;
  /** Where it is a household name (ISO country codes): shown first there. Absent: everywhere. */
  countries?: readonly string[];
  /** Other sizes it comes in, in ml, offered as chips with the group's own. */
  sizes?: readonly number[];
  /**
   * A spirit poured into a mixer, logged as one drink. Only the spirit counts: the mixer adds
   * volume, not alcohol. `parts` are the two catalogue ids it is made of.
   */
  combo?: { parts: readonly [string, string]; mixerMl: number };
}

export type CatalogueDrink = CatalogueBase & ({ brand: string; generic?: undefined } | { generic: GenericDrinkId; brand?: undefined });

const beer = (id: string, brand: string, abv: number, volumeMl: number, glass: GlassName, aliases: readonly string[], can?: boolean): CatalogueDrink => ({
  id,
  brand,
  group: "beer",
  abv,
  volumeMl,
  glass,
  aliases,
  ...(can ? { can } : {}),
});

const cocktail = (id: string, brand: string, abv: number, volumeMl: number, aliases: readonly string[]): CatalogueDrink => ({
  id,
  brand,
  group: "cocktail",
  abv,
  volumeMl,
  glass: "cocktail",
  aliases,
});

const soft = (id: string, brand: string, volumeMl: number, aliases: readonly string[], can?: boolean): CatalogueDrink => ({
  id,
  brand,
  group: "soft",
  abv: 0,
  volumeMl,
  glass: can ? "can" : "soft",
  aliases,
  ...(can ? { can } : {}),
});

// Strengths are the ones printed on the French label. Sizes: a draught brand comes as a demi
// (25 cl), a Belgian bottle as 33 cl, the strong supermarket beers as 50 cl cans.
const FIRST_LIST: readonly CatalogueDrink[] = [
  beer("kronenbourg", "Kronenbourg", 0.042, 250, "demi", ["kro"]),
  beer("1664", "1664", 0.055, 250, "demi", ["seize", "1664 blonde"]),
  beer("heineken", "Heineken", 0.05, 250, "demi", []),
  beer("desperados", "Desperados", 0.059, 330, "bottle", ["despe", "desperado"]),
  beer("corona", "Corona", 0.045, 355, "bottle", ["corona extra"]),
  beer("carlsberg", "Carlsberg", 0.05, 250, "demi", []),
  beer("leffe-blonde", "Leffe Blonde", 0.066, 330, "bottle", ["leffe"]),
  beer("grimbergen", "Grimbergen", 0.067, 250, "demi", ["grim"]),
  beer("affligem", "Affligem", 0.067, 250, "demi", ["afflighem"]),
  beer("goudale", "La Goudale", 0.072, 250, "bottle", ["goudale"]),
  beer("kasteel-rouge", "Kasteel Rouge", 0.08, 330, "bottle", ["castel", "castel rouge", "kasteel"]),
  beer("la-chouffe", "La Chouffe", 0.08, 330, "bottle", ["chouffe"]),
  beer("karmeliet", "Tripel Karmeliet", 0.084, 330, "bottle", ["karmeliet"]),
  beer("delirium-tremens", "Delirium Tremens", 0.085, 330, "bottle", ["delirium", "tremens"]),
  beer("duvel", "Duvel", 0.085, 330, "bottle", []),
  beer("paix-dieu", "Paix Dieu", 0.1, 330, "bottle", ["paix"]),
  beer("amsterdam-navigator", "Amsterdam Navigator", 0.08, 500, "can", ["amsterdam", "navigator"], true),
  beer("bavaria-8-6", "Bavaria 8.6", 0.086, 500, "can", ["bavaria"], true),
  beer("maximator", "Maximator", 0.116, 500, "can", ["maxi"], true),
  beer("guinness", "Guinness", 0.042, 500, "pint", []),
  beer("hoegaarden", "Hoegaarden", 0.049, 250, "demi", []),
  beer("pelforth-brune", "Pelforth Brune", 0.058, 250, "demi", ["pelforth"]),

  { id: "poliakov", brand: "Poliakov", group: "spirit", abv: 0.375, volumeMl: 200, glass: "bottle", aliases: ["polia"] },
  { id: "jagermeister", brand: "Jägermeister", group: "spirit", abv: 0.35, volumeMl: 30, glass: "shot", aliases: ["jager", "jaeger"] },
  { id: "tequila", generic: "tequila", group: "spirit", abv: 0.38, volumeMl: 30, glass: "shot", aliases: ["tequila", "teq"] },
  { id: "get-27", brand: "Get 27", group: "spirit", abv: 0.179, volumeMl: 40, glass: "shot", aliases: ["get27", "get"] },
  // Pastis is poured as 2 cl and topped up with water: the water adds nothing.
  { id: "ricard", brand: "Ricard", group: "spirit", abv: 0.45, volumeMl: 20, glass: "cider", aliases: ["pastis", "pastaga", "pastis 51"] },
  { id: "whisky", generic: "whisky", group: "spirit", abv: 0.4, volumeMl: 40, glass: "shot", aliases: ["whisky", "whiskey", "scotch"] },
  { id: "rum", generic: "rum", group: "spirit", abv: 0.4, volumeMl: 40, glass: "shot", aliases: ["rhum", "rum", "ron"] },
  { id: "vodka", generic: "vodka", group: "spirit", abv: 0.4, volumeMl: 40, glass: "shot", aliases: ["vodka"] },
  { id: "gin", generic: "gin", group: "spirit", abv: 0.4, volumeMl: 40, glass: "shot", aliases: ["gin"] },
  {
    id: "poliakov-red-bull",
    // What it is called in France: a 20 cl flask of vodka (Poliakov, the usual one) with a Red Bull.
    brand: "Flash vodka",
    group: "spirit",
    abv: 0.375,
    volumeMl: 200,
    glass: "can",
    aliases: ["flash vodka", "flash vodka redbull", "flash vodka red bull", "polia redbull", "polia red bull", "poliakov redbull", "poliakov red bull", "flash redbull", "flash red bull"],
    combo: { parts: ["poliakov", "red-bull"], mixerMl: 250 },
  },
  {
    id: "jagerbomb",
    brand: "Jägerbomb",
    group: "spirit",
    abv: 0.35,
    volumeMl: 40,
    glass: "shot",
    aliases: ["jagerbomb", "jager bomb", "jager redbull", "jager red bull"],
    combo: { parts: ["jagermeister", "red-bull"], mixerMl: 125 },
  },

  { id: "red-wine", generic: "redWine", group: "wine", abv: 0.13, volumeMl: 120, glass: "wine", aliases: ["vin rouge", "rouge", "red wine", "red"] },
  { id: "white-wine", generic: "whiteWine", group: "wine", abv: 0.12, volumeMl: 120, glass: "wine", aliases: ["vin blanc", "blanc", "white wine", "white"] },
  { id: "rose-wine", generic: "roseWine", group: "wine", abv: 0.12, volumeMl: 120, glass: "wine", aliases: ["vin rose", "rose", "rose wine"] },
  { id: "champagne", generic: "champagne", group: "wine", abv: 0.12, volumeMl: 120, glass: "wine", aliases: ["champagne", "champ", "champe", "coupe"] },
  { id: "prosecco", brand: "Prosecco", group: "wine", abv: 0.11, volumeMl: 120, glass: "wine", aliases: ["prosec"] },

  { id: "cider", generic: "cider", group: "cider", abv: 0.045, volumeMl: 330, glass: "cider", aliases: ["cidre", "cider", "cidre brut"] },

  cocktail("spritz", "Spritz", 0.09, 250, ["aperol", "aperol spritz", "spritz aperol"]),
  cocktail("mojito", "Mojito", 0.1, 250, []),
  cocktail("margarita", "Margarita", 0.2, 150, ["marga"]),
  cocktail("pina-colada", "Piña colada", 0.08, 250, ["pina"]),
  cocktail("cuba-libre", "Cuba libre", 0.1, 250, ["rhum coca", "rum coke"]),
  cocktail("gin-tonic", "Gin tonic", 0.1, 250, ["gin and tonic", "gin to"]),
  cocktail("sex-on-the-beach", "Sex on the beach", 0.08, 250, ["sotb"]),
  cocktail("moscow-mule", "Moscow mule", 0.09, 250, ["mule"]),
  cocktail("long-island", "Long Island", 0.15, 300, ["long island iced tea"]),
  cocktail("caipirinha", "Caipirinha", 0.2, 150, ["caipi"]),
  cocktail("ti-punch", "Ti' punch", 0.4, 50, ["ti punch"]),
  { id: "smirnoff-ice", brand: "Smirnoff Ice", group: "cocktail", abv: 0.04, volumeMl: 275, glass: "bottle", aliases: ["smirnoff"] },

  soft("red-bull", "Red Bull", 250, ["redbull", "rb"], true),
  soft("monster", "Monster", 500, ["monster energy"], true),
  soft("coca-cola", "Coca-Cola", 330, ["coca", "coca cola", "coke", "cola"]),
  soft("orangina", "Orangina", 250, []),
  soft("ice-tea", "Ice Tea", 330, ["the glace"]),
  soft("schweppes", "Schweppes", 250, ["tonic"]),
  soft("perrier", "Perrier", 330, []),
  { id: "orange-juice", generic: "orangeJuice", group: "soft", abv: 0, volumeMl: 250, glass: "soft", aliases: ["jus d orange", "jus orange", "orange juice", "jus"] },
];

/** Every drink the app knows: the French list first, then the other countries' (brands.ts). */
export const DRINK_CATALOGUE: readonly CatalogueDrink[] = [
  ...FIRST_LIST.map((drink) => {
    const countries = FIRST_LIST_COUNTRIES[drink.id] ?? ["FR"];
    return countries.length ? { ...drink, countries } : drink;
  }),
  ...MORE_DRINKS,
];

/** Names a size chip or a typed word can carry. The app translates them. */
export type ServingId = "demi" | "pint" | "halfPint" | "litre" | "glass" | "largeGlass" | "bottle" | "dose" | "shot" | "double" | "flash" | "flask" | "can";

export interface SizeOption {
  volumeMl: number;
  /** Shown before the volume when the size has a name of its own: "Pinte 50 cl". */
  serving?: ServingId;
}

export interface GroupSpec {
  /** Sizes offered as chips, smallest first. */
  sizes: readonly SizeOption[];
  /** Strengths offered as chips, as fractions. Empty for soft drinks. */
  strengths: readonly number[];
  /** Above this, a strength typed or picked for the group is a mistake (no 40 % beer). */
  maxAbv: number;
}

export const GROUP_SPECS: Readonly<Record<DrinkGroup, GroupSpec>> = {
  beer: {
    sizes: [{ volumeMl: 250, serving: "demi" }, { volumeMl: 330 }, { volumeMl: 500, serving: "pint" }, { volumeMl: 1000, serving: "litre" }],
    strengths: [0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.12],
    maxAbv: 0.16,
  },
  wine: {
    sizes: [{ volumeMl: 120, serving: "glass" }, { volumeMl: 180, serving: "largeGlass" }, { volumeMl: 750, serving: "bottle" }],
    strengths: [0.11, 0.12, 0.13, 0.14, 0.15],
    maxAbv: 0.22,
  },
  spirit: {
    sizes: [
      { volumeMl: 20, serving: "dose" },
      { volumeMl: 30, serving: "shot" },
      { volumeMl: 60, serving: "double" },
      { volumeMl: 200, serving: "flash" },
      { volumeMl: 350, serving: "flask" },
      { volumeMl: 700, serving: "bottle" },
    ],
    strengths: [0.18, 0.25, 0.35, 0.375, 0.4, 0.45],
    maxAbv: 0.8,
  },
  cocktail: {
    sizes: [{ volumeMl: 150 }, { volumeMl: 250 }, { volumeMl: 330 }],
    strengths: [0.04, 0.06, 0.08, 0.1, 0.15, 0.2],
    maxAbv: 0.4,
  },
  cider: {
    sizes: [{ volumeMl: 250 }, { volumeMl: 330 }, { volumeMl: 500, serving: "pint" }],
    strengths: [0.02, 0.04, 0.045, 0.05, 0.06],
    maxAbv: 0.12,
  },
  soft: {
    sizes: [{ volumeMl: 250 }, { volumeMl: 330 }, { volumeMl: 500 }],
    strengths: [],
    maxAbv: 0,
  },
};

/**
 * Sizes a country pours that the group's list lacks: the British pint and half pint, American
 * ounces, the Spanish caña, the Italian media, the German Maß, the Russian 1.5 L bottle.
 */
const COUNTRY_SIZES: Readonly<Record<string, Partial<Record<DrinkGroup, readonly SizeOption[]>>>> = {
  GB: { beer: [{ volumeMl: 284, serving: "halfPint" }, { volumeMl: 440, serving: "can" }, { volumeMl: 568, serving: "pint" }], cider: [{ volumeMl: 284, serving: "halfPint" }, { volumeMl: 568, serving: "pint" }], wine: [{ volumeMl: 175 }, { volumeMl: 250, serving: "largeGlass" }], spirit: [{ volumeMl: 25, serving: "shot" }, { volumeMl: 50, serving: "double" }] },
  IE: { beer: [{ volumeMl: 284, serving: "halfPint" }, { volumeMl: 568, serving: "pint" }], cider: [{ volumeMl: 568, serving: "pint" }] },
  US: { beer: [{ volumeMl: 355 }, { volumeMl: 473, serving: "pint" }, { volumeMl: 710, serving: "can" }], wine: [{ volumeMl: 150, serving: "glass" }], spirit: [{ volumeMl: 44, serving: "shot" }, { volumeMl: 88, serving: "double" }, { volumeMl: 750, serving: "bottle" }], cocktail: [{ volumeMl: 355 }] },
  CA: { beer: [{ volumeMl: 341 }, { volumeMl: 473, serving: "pint" }], spirit: [{ volumeMl: 43, serving: "shot" }] },
  DE: { beer: [{ volumeMl: 300 }, { volumeMl: 400 }, { volumeMl: 1000, serving: "litre" }], spirit: [{ volumeMl: 20, serving: "dose" }] },
  AT: { beer: [{ volumeMl: 300 }, { volumeMl: 1000, serving: "litre" }] },
  ES: { beer: [{ volumeMl: 200, serving: "demi" }, { volumeMl: 330 }, { volumeMl: 500, serving: "pint" }] },
  IT: { beer: [{ volumeMl: 200, serving: "demi" }, { volumeMl: 400, serving: "pint" }, { volumeMl: 660, serving: "bottle" }] },
  PT: { beer: [{ volumeMl: 200, serving: "demi" }, { volumeMl: 400 }, { volumeMl: 500, serving: "pint" }] },
  RU: { beer: [{ volumeMl: 450 }, { volumeMl: 1500, serving: "bottle" }], spirit: [{ volumeMl: 50, serving: "shot" }, { volumeMl: 100, serving: "double" }, { volumeMl: 500, serving: "bottle" }] },
  BE: { beer: [{ volumeMl: 250, serving: "demi" }, { volumeMl: 330 }, { volumeMl: 750, serving: "bottle" }] },
  NL: { beer: [{ volumeMl: 250, serving: "demi" }, { volumeMl: 500, serving: "pint" }] },
};

/**
 * The size chips of a group in a country: the country's own measures first replace a size the
 * group already has under the same volume, then everything is sorted, smallest first.
 */
export function sizesFor(group: DrinkGroup, country?: string | null): SizeOption[] {
  const local = (country && COUNTRY_SIZES[country]?.[group]) || [];
  const list = new Map<number, SizeOption>();
  for (const size of GROUP_SPECS[group].sizes) list.set(size.volumeMl, size);
  for (const size of local) list.set(size.volumeMl, size);
  return [...list.values()].sort((a, b) => a.volumeMl - b.volumeMl);
}

/** 0 when the drink is a household name in the country (or everywhere), 1 otherwise: for sorting. */
export function countryRank(drink: CatalogueDrink, country?: string | null): number {
  if (!drink.countries || !drink.countries.length || !country) return 0;
  return drink.countries.includes(country) ? 0 : 1;
}

/** Whether a strength makes sense for the group: 8 % is a beer, 40 % is not. */
export function strengthFits(group: DrinkGroup, abv: number): boolean {
  return abv >= 0 && abv <= GROUP_SPECS[group].maxAbv;
}

/**
 * Every name a catalogue drink answers to, for matching. Generic drinks add the app's translations.
 * A combo answers to its aliases only: its full name could be read as its spirit alone,
 * and "flash polia" means the spirit alone.
 */
export function catalogueNames(drink: CatalogueDrink, translated: readonly string[] = []): string[] {
  return [...(drink.brand && !drink.combo ? [drink.brand] : []), ...translated, ...drink.aliases];
}

export function catalogueDrink(id: string, catalogue: readonly CatalogueDrink[] = DRINK_CATALOGUE): CatalogueDrink | undefined {
  return catalogue.find((drink) => drink.id === id);
}

/** The combo made of these two drinks, in either order: Poliakov and Red Bull make one drink. */
export function comboOf(a: CatalogueDrink, b: CatalogueDrink, catalogue: readonly CatalogueDrink[] = DRINK_CATALOGUE): CatalogueDrink | undefined {
  return catalogue.find((drink) => drink.combo && drink.combo.parts.includes(a.id) && drink.combo.parts.includes(b.id) && a.id !== b.id);
}
