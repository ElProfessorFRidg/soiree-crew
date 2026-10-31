import type { CatalogueDrink, DrinkGroup, GlassName, LocalName } from "./catalogue";

// What young people order by its name rather than by its bottle: shots, mixes and long drinks,
// with the local name where one is said. Strengths are not guessed: a mix's strength and size come
// from its recipe (the alcohol of each part over the whole glass), a bottled drink's from its label.
// `countries` lists where it is a household name (ISO 3166), so the add sheet shows those first.

/** One part of a drink as poured: its strength in percent, its volume in ml. */
type Part = readonly [abvPercent: number, ml: number];

/** The strength of the whole glass, as a fraction to a tenth of a percent. */
export function strengthOf(parts: readonly Part[]): number {
  const total = parts.reduce((sum, [, ml]) => sum + ml, 0);
  const alcohol = parts.reduce((sum, [abv, ml]) => sum + abv * ml, 0);
  return Math.round((alcohol / total) * 10) / 1000;
}

interface Mixed {
  id: string;
  brand: string;
  group: DrinkGroup;
  glass: GlassName;
  /** What goes in the glass: the drink's size and strength come from it. */
  parts: readonly Part[];
  aliases: readonly string[];
  countries: readonly string[];
  names?: readonly LocalName[];
  short?: string;
  sizes?: readonly number[];
}

const mixed = (list: readonly Mixed[]): CatalogueDrink[] =>
  list.map(({ parts, ...drink }) => ({ ...drink, volumeMl: parts.reduce((sum, [, ml]) => sum + ml, 0), abv: strengthOf(parts) }));

interface Combo {
  id: string;
  brand: string;
  /** The catalogue spirit, its label strength in percent and the measure poured, in ml. */
  spirit: readonly [id: string, abvPercent: number, ml: number];
  /** The catalogue mixer and how much of it. */
  mixer: readonly [id: string, ml: number];
  glass: GlassName;
  aliases: readonly string[];
  countries: readonly string[];
  names?: readonly LocalName[];
  short?: string;
}

// A spirit and its mixer, logged as one drink the way the Flash vodka is: the size is the spirit's
// measure (what the bar pours and charges for), the strength the spirit's, the mixer adds none.
const combos = (list: readonly Combo[]): CatalogueDrink[] =>
  list.map(({ spirit: [spiritId, abv, ml], mixer: [mixerId, mixerMl], ...drink }) => ({
    ...drink,
    group: "spirit",
    abv: abv / 100,
    volumeMl: ml,
    combo: { parts: [spiritId, mixerId], mixerMl },
  }));

type Row = [id: string, brand: string, abv: number, volumeMl: number, glass: GlassName, aliases: readonly string[], countries: readonly string[], sizes?: readonly number[]];

const bottled = (group: DrinkGroup, list: readonly Row[]): CatalogueDrink[] =>
  list.map(([id, brand, abv, volumeMl, glass, aliases, countries, sizes]) => ({
    id,
    brand,
    group,
    abv: abv / 100,
    volumeMl,
    glass,
    aliases,
    countries,
    ...(sizes ? { sizes } : {}),
    ...(glass === "can" ? { can: true } : {}),
  }));

// Liqueurs as poured in shots: Kahlúa 16 %, Baileys 17 %, Grand Marnier and Cointreau 40 %,
// sambuca 38 %, blue curaçao 21 %, peach schnapps 20 %. Generic spirits as in the catalogue.
const SHOTS = mixed([
  // Tequila, gin and vodka in thirds of a 3 cl shot.
  { id: "tgv", brand: "TGV", group: "spirit", glass: "shot", parts: [[38, 10], [40, 10], [40, 10]], aliases: ["t g v", "tequila gin vodka"], countries: ["FR", "BE"] },
  // Kahlúa, Baileys and Grand Marnier layered, 1.5 cl each.
  { id: "b-52", brand: "B-52", group: "spirit", glass: "shot", parts: [[16, 15], [17, 15], [40, 15]], aliases: ["b52", "b 52", "б52", "б 52"], countries: ["FR", "GB", "RU", "DE", "ES", "IT", "US"], names: [{ name: "Б-52", languages: ["ru"] }] },
  // Vodka, triple sec and lime juice in equal parts.
  { id: "kamikaze", brand: "Kamikaze", group: "spirit", glass: "shot", parts: [[40, 15], [40, 15], [0, 15]], aliases: ["kamikaz", "камикадзе"], countries: ["US", "GB", "FR", "DE", "CA"] },
  // Tequila topped with as much lemonade, slammed on the table and drunk at once.
  {
    id: "tequila-slammer",
    brand: "Tequila slammer",
    short: "Slammer",
    group: "spirit",
    glass: "shot",
    parts: [[38, 30], [0, 30]],
    aliases: ["tequila paf", "tequila boom", "tequila boom boom", "slammer", "текила бум"],
    countries: ["FR", "GB", "ES", "RU", "DE", "IT"],
    names: [
      { name: "Tequila paf", languages: ["fr"] },
      { name: "Текила бум", languages: ["ru"] },
    ],
  },
  // Vodka and spiced tomato juice (Tabasco, pepper) half and half, as a 2 cl Kurzer.
  { id: "mexikaner", brand: "Mexikaner", group: "spirit", glass: "shot", parts: [[37.5, 10], [0, 10]], aliases: ["mexicaner", "mexikana", "mexicano shot"], countries: ["DE"] },
  // Two parts Kahlúa under one part Baileys: a tiny pint of stout.
  { id: "baby-guinness", brand: "Baby Guinness", group: "spirit", glass: "shot", parts: [[16, 20], [17, 10]], aliases: [], countries: ["IE", "GB"] },
  // Sambuca and Baileys, half and half.
  { id: "slippery-nipple", brand: "Slippery Nipple", group: "spirit", glass: "shot", parts: [[38, 15], [17, 15]], aliases: ["slippery"], countries: ["GB", "IE", "US", "AU"] },
  // Three parts vodka, one part lemon juice, the rim sugared.
  { id: "lemon-drop", brand: "Lemon drop", group: "spirit", glass: "shot", parts: [[40, 30], [0, 10]], aliases: ["lemon drop shot"], countries: ["US", "CA", "GB", "SE"] },
  // Kahlúa and sambuca set alight, Baileys and blue curaçao poured in, 1.5 cl each.
  { id: "flaming-lamborghini", brand: "Flaming Lamborghini", group: "spirit", glass: "cocktail", parts: [[16, 15], [38, 15], [17, 15], [21, 15]], aliases: ["lamborghini", "flaming lambo"], countries: ["GB", "AU", "FR", "RU"] },
  // Irish whiskey, peach schnapps and sour mix in thirds.
  { id: "green-tea-shot", brand: "Green tea shot", group: "spirit", glass: "shot", parts: [[40, 15], [20, 15], [0, 15]], aliases: ["green tea"], countries: ["US", "CA"] },
  // Two parts vodka, one part grenadine, drops of Tabasco: the St Petersburg shot.
  { id: "boyarsky", brand: "Boyarsky", group: "spirit", glass: "shot", parts: [[40, 30], [0, 15]], aliases: ["боярский", "boyarskiy", "boyarski"], countries: ["RU"], names: [{ name: "Боярский", languages: ["ru"] }] },
  // Two parts vodka, one part raspberry syrup, drops of Tabasco.
  { id: "wsciekly-pies", brand: "Wściekły pies", group: "spirit", glass: "shot", parts: [[40, 30], [0, 15]], aliases: ["wsciekly pies", "mad dog"], countries: ["PL"] },
]);

const LIQUEURS = bottled("spirit", [
  ["saurer-apfel", "Berentzen Saurer Apfel", 16, 20, "shot", ["saurer apfel", "berentzen"], ["DE"], [20, 40, 700]],
  ["sourz", "Sourz", 15, 25, "shot", ["sourz apple", "apple sourz"], ["GB", "IE"], [25, 50, 700]],
  ["jenever", "Jenever", 35, 35, "shot", ["genever", "jonge jenever"], ["NL", "BE"], [35, 700, 1000]],
  ["becherovka", "Becherovka", 38, 40, "shot", ["becher"], ["CZ", "SK", "DE"], [20, 40, 500, 700]],
  ["unicum", "Zwack Unicum", 40, 40, "shot", ["unicum", "zwack"], ["HU"], [20, 40, 500, 700]],
  ["palinka", "Pálinka", 40, 50, "shot", ["palinka"], ["HU"], [20, 40, 50, 500, 700]],
  ["akvavit", "Akvavit", 40, 40, "shot", ["aquavit", "snaps", "linie"], ["SE", "NO", "DE"], [20, 40, 500, 700]],
  ["cachaca", "Cachaça", 40, 50, "shot", ["cachaca", "pinga"], ["BR", "PT"], [50, 700, 1000]],
  ["montenegro", "Amaro Montenegro", 23, 40, "shot", ["montenegro", "amaro"], ["IT"], [40, 700]],
  ["averna", "Averna", 29, 40, "shot", ["amaro averna"], ["IT"], [40, 700]],
  ["bundaberg", "Bundaberg Rum", 37, 30, "shot", ["bundy", "bundaberg"], ["AU", "NZ"], [30, 60, 700, 1000]],
]);

// Pastis with a syrup, topped up with water: as with the plain pastis, only the 2 cl dose counts.
const PASTIS = bottled("spirit", [
  ["perroquet", "Perroquet", 45, 20, "cider", ["pastis menthe"], ["FR"], [20, 40]],
  ["mauresque", "Mauresque", 45, 20, "cider", ["pastis orgeat"], ["FR"], [20, 40]],
  ["tomate", "Tomate", 45, 20, "cider", ["pastis grenadine"], ["FR"], [20, 40]],
]);

const LONG_DRINKS = combos([
  {
    id: "vodka-red-bull",
    brand: "Vodka Red Bull",
    spirit: ["vodka", 40, 40],
    mixer: ["red-bull", 250],
    glass: "cocktail",
    aliases: ["vodka redbull", "vodka rb", "vodka energy", "wodka e", "wodka energy", "wodka red bull", "водка ред булл", "водка редбулл"],
    countries: ["GB", "IE", "FR", "DE", "ES", "NL", "AU"],
    names: [{ name: "Wodka-E", languages: ["de"] }],
  },
  {
    id: "rum-coke",
    brand: "Rum and Coke",
    spirit: ["rum", 40, 40],
    mixer: ["coca-cola", 200],
    glass: "cocktail",
    aliases: ["rum coke", "rhum coca", "rhum coke", "cubata", "ron cola", "ron con cola", "rum cola", "ром кола"],
    countries: ["GB", "US", "FR", "ES", "DE", "IE", "CA"],
    names: [
      { name: "Rhum coca", languages: ["fr"] },
      { name: "Cubata", languages: ["es"] },
      { name: "Rum-Cola", languages: ["de"] },
      { name: "Ром-кола", languages: ["ru"] },
    ],
  },
  {
    id: "whisky-coke",
    brand: "Whisky Coke",
    spirit: ["whisky", 40, 40],
    mixer: ["coca-cola", 200],
    glass: "cocktail",
    aliases: ["whisky coca", "whiskey coke", "whisky cola", "whiscola", "виски кола"],
    countries: ["FR", "ES", "GB", "DE", "RU"],
    names: [
      { name: "Whisky coca", languages: ["fr"] },
      { name: "Whiscola", languages: ["es"] },
      { name: "Whisky-Cola", languages: ["de"] },
      { name: "Виски-кола", languages: ["ru"] },
    ],
  },
  {
    id: "jack-coke",
    brand: "Jack and Coke",
    spirit: ["jack-daniels", 40, 40],
    mixer: ["coca-cola", 200],
    glass: "cocktail",
    aliases: ["jack coke", "jd coke", "jd and coke", "jack coca", "jack cola", "jacky cola"],
    countries: ["US", "GB", "DE", "FR"],
    names: [{ name: "Jacky-Cola", languages: ["de"] }],
  },
  {
    id: "screwdriver",
    brand: "Screwdriver",
    spirit: ["vodka", 40, 40],
    mixer: ["orange-juice", 160],
    glass: "cocktail",
    aliases: ["vodka orange", "vodka jus d orange", "wodka o", "wodka orange", "vodka con naranja", "vodka naranja", "отвертка", "водка апельсин"],
    countries: ["FR", "DE", "RU", "US", "GB", "ES"],
    names: [
      { name: "Vodka orange", languages: ["fr"] },
      { name: "Wodka-O", languages: ["de"] },
      { name: "Vodka con naranja", languages: ["es"] },
      { name: "Отвёртка", languages: ["ru"] },
    ],
  },
  {
    id: "bundy-coke",
    brand: "Bundy and Coke",
    spirit: ["bundaberg", 37, 30],
    mixer: ["coca-cola", 200],
    glass: "cocktail",
    aliases: ["bundy coke", "bundy and coke", "bundaberg coke"],
    countries: ["AU", "NZ"],
  },
]);

// Beer cut with something: sizes are the beer group's, the strength that of the whole glass.
// Beer at 5 % unless said, lemonade and cola at 0.
const BEER_MIXES = mixed([
  // Beer and lemonade, half and half: Panaché, Radler, Clara, Shandy.
  {
    id: "shandy",
    brand: "Shandy",
    group: "beer",
    glass: "demi",
    parts: [[5, 125], [0, 125]],
    aliases: ["panache", "radler", "clara", "clara con limon", "alster", "alsterwasser"],
    countries: ["FR", "BE", "CH", "LU", "DE", "ES", "PT", "IT", "GB", "IE", "AU", "NZ"],
    sizes: [250, 330, 500, 568],
    names: [
      { name: "Panaché", languages: ["fr"] },
      { name: "Panaché", languages: ["de"], countries: ["CH"] },
      { name: "Radler", languages: ["de"] },
      { name: "Clara", languages: ["es"] },
      { name: "Panaché", languages: ["pt"], countries: ["PT"] },
      { name: "Radler", languages: ["it"] },
    ],
  },
  // A panaché with grenadine.
  { id: "monaco", brand: "Monaco", group: "beer", glass: "demi", parts: [[5, 110], [0, 110], [0, 30]], aliases: ["panache grenadine"], countries: ["FR", "BE", "CH"], sizes: [250, 500] },
  // A demi with 3 cl of Picon Bière (18 %).
  { id: "picon-biere", brand: "Picon bière", group: "beer", glass: "demi", parts: [[5, 220], [18, 30]], aliases: ["picon", "picon biere", "biere picon"], countries: ["FR", "BE"], sizes: [250, 500] },
  // Beer and cola, half and half, by the half litre.
  { id: "diesel", brand: "Diesel", group: "beer", glass: "pint", parts: [[5, 250], [0, 250]], aliases: ["colabier", "cola bier", "bier cola", "krefelder"], countries: ["DE"], sizes: [300, 500, 1000] },
  // The Bavarian Maß: dark beer and cola half and half, 2 cl of cherry liqueur (20 %).
  { id: "goassmass", brand: "Goaßmaß", group: "beer", glass: "pint", parts: [[5, 490], [0, 490], [20, 20]], aliases: ["goassmass", "goasmass", "goass", "goaß"], countries: ["DE"], sizes: [500, 1000] },
  // Lager (4 %) and cider (4.5 %), half and half, by the pint.
  { id: "snakebite", brand: "Snakebite", group: "beer", glass: "pint", parts: [[4, 284], [4.5, 284]], aliases: ["snakebite and black", "snakebite black"], countries: ["GB", "IE"], sizes: [284, 568] },
  // A half litre of beer with a 5 cl stopka of vodka in it.
  { id: "yorsh", brand: "Yorsh", group: "beer", glass: "pint", parts: [[5, 450], [40, 50]], aliases: ["ерш", "ёрш", "yersh", "yorch"], countries: ["RU"], sizes: [500, 1000], names: [{ name: "Ёрш", languages: ["ru"] }] },
]);

const WINE_MIXES = mixed([
  // Red wine (13 %) and cola, half and half.
  { id: "calimocho", brand: "Calimocho", group: "wine", glass: "cider", parts: [[13, 150], [0, 150]], aliases: ["kalimotxo", "calimotxo", "kalimocho"], countries: ["ES"], sizes: [300, 500, 1000] },
  // One part fino or manzanilla (15 %), two parts lemon soda: the Andalusian feria.
  { id: "rebujito", brand: "Rebujito", group: "wine", glass: "wine", parts: [[15, 70], [0, 140]], aliases: ["rebujo"], countries: ["ES"], sizes: [210, 500, 1000] },
  // White wine (12 %) and soda water, half and half: the kisfröccs.
  { id: "froccs", brand: "Fröccs", group: "wine", glass: "wine", parts: [[12, 100], [0, 100]], aliases: ["froccs", "kisfroccs", "spritzer"], countries: ["HU"], sizes: [200, 300, 500] },
]);

const COCKTAILS = mixed([
  // Gin, Campari (25 %) and red vermouth (16 %), 3 cl each.
  { id: "negroni", brand: "Negroni", group: "cocktail", glass: "cocktail", parts: [[40, 30], [25, 30], [16, 30]], aliases: ["negronni"], countries: ["IT", "GB", "FR", "US", "ES"] },
  // 4 cl of vodka in lemon soda.
  { id: "vodka-lemon", brand: "Vodka lemon", group: "cocktail", glass: "cocktail", parts: [[40, 40], [0, 160]], aliases: ["vodka limone", "vodka lemon soda"], countries: ["IT"] },
  // The caipirinha made with vodka: 5 cl, as much lime and sugar.
  { id: "caipiroska", brand: "Caipiroska", group: "cocktail", glass: "cocktail", parts: [[40, 50], [0, 50]], aliases: ["caipivodka", "caipiroshka"], countries: ["BR", "IT"] },
  // Żubrówka (37.5 %) and apple juice, one to three.
  { id: "szarlotka", brand: "Szarlotka", group: "cocktail", glass: "cocktail", parts: [[37.5, 50], [0, 150]], aliases: ["tatanka"], countries: ["PL", "GB"] },
  // Pimm's No. 1 (25 %) and three times as much lemonade.
  { id: "pimms", brand: "Pimm's", group: "cocktail", glass: "cocktail", parts: [[25, 50], [0, 150]], aliases: ["pimms", "pimms cup"], countries: ["GB"] },
  // A Canadian shot (43 ml) of vodka in Clamato.
  { id: "caesar", brand: "Caesar", group: "cocktail", glass: "cocktail", parts: [[40, 43], [0, 120]], aliases: ["bloody caesar"], countries: ["CA"] },
]);

// Bottled and canned, strength from the label.
const READY = bottled("cocktail", [
  ["vk", "VK", 4, 275, "bottle", ["vodka kick", "vks"], ["GB", "IE"]],
  ["vodka-cruiser", "Vodka Cruiser", 4.6, 275, "bottle", ["cruiser", "cruisers"], ["AU", "NZ"]],
  ["strong-zero", "Strong Zero", 9, 350, "can", ["-196", "chuhai", "chu hi"], ["JP"], [350, 500]],
  ["kaku-highball", "Kaku Highball", 7, 350, "can", ["highball", "kaku"], ["JP"], [350, 500]],
]);

const SAKE = bottled("wine", [["sake", "Sake", 15, 180, "wine", ["saké", "nihonshu"], ["JP", "US", "FR"], [90, 180, 720]]]);

export const MIXES_AND_SHOTS: readonly CatalogueDrink[] = [...SHOTS, ...LIQUEURS, ...LONG_DRINKS, ...PASTIS, ...BEER_MIXES, ...WINE_MIXES, ...COCKTAILS, ...READY, ...SAKE];
