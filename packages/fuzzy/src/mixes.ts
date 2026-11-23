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
  // Shooters built from their recipe: each strength is the glass's, from the parts' own strengths.
  { id: "buttery-nipple", brand: "Buttery Nipple", group: "spirit", glass: "shot", parts: [[20, 15], [17, 15]], aliases: ["buttery", "butter nipple"], countries: ["US", "GB", "FR", "DE"] },
  { id: "sex-on-the-beach-shot", brand: "Sex on the beach shot", short: "SOTB shot", group: "spirit", glass: "shot", parts: [[40, 15], [20, 15], [0, 15]], aliases: ["sotb shot", "shot sotb", "sex on the beach shooter"], countries: ["US", "GB", "FR", "DE"] },
  { id: "washington-apple", brand: "Washington apple", group: "spirit", glass: "shot", parts: [[40, 15], [15, 15], [0, 15]], aliases: ["washington", "washington apple shot"], countries: ["US", "GB", "FR"] },
  { id: "fuzzy-navel-shot", brand: "Fuzzy navel shot", group: "spirit", glass: "shot", parts: [[20, 20], [0, 20]], aliases: ["fuzzy navel", "fuzzy"], countries: ["US", "GB", "FR"] },
  { id: "mind-eraser", brand: "Mind eraser", group: "spirit", glass: "shot", parts: [[40, 30], [16, 15], [0, 15]], aliases: ["mind eraser shot"], countries: ["US", "GB", "FR"] },
  { id: "orgasm", brand: "Orgasm", group: "spirit", glass: "shot", parts: [[16, 15], [28, 15], [17, 15]], aliases: ["orgasme", "orgasm shot"], countries: ["FR", "GB", "US"], names: [{ name: "Orgasme", languages: ["fr"] }] },
  { id: "pickle-back", brand: "Pickle back", group: "spirit", glass: "shot", parts: [[40, 30], [0, 30]], aliases: ["pickleback", "pickle"], countries: ["US", "GB", "CA"] },
  { id: "apple-pie-shot", brand: "Apple pie", group: "spirit", glass: "shot", parts: [[33, 30], [15, 15]], aliases: ["apple pie shot", "tarte aux pommes"], countries: ["US", "GB", "FR"] },
  { id: "rusty-nail-shot", brand: "Rusty nail", group: "spirit", glass: "shot", parts: [[40, 30], [40, 15]], aliases: ["rusty nail shot", "rusty"], countries: ["GB", "US", "FR"] },
  { id: "peppermint-patty", brand: "Peppermint patty", group: "spirit", glass: "shot", parts: [[24, 15], [17, 15]], aliases: ["peppermint"], countries: ["US", "GB", "FR"] },
  { id: "tequila-sunrise-shot", brand: "Tequila sunrise shot", group: "spirit", glass: "shot", parts: [[38, 30], [0, 30]], aliases: ["tequila sunrise", "sunrise shot"], countries: ["US", "GB", "FR", "ES"] },
  { id: "sour-apple-shot", brand: "Sour apple shot", group: "spirit", glass: "shot", parts: [[15, 30], [40, 15]], aliases: ["sour apple", "pomme sure shot"], countries: ["GB", "US", "FR", "DE"] },
  { id: "cherry-bomb", brand: "Cherry bomb", group: "spirit", glass: "shot", parts: [[25, 30], [40, 15]], aliases: ["cherry bomb shot", "cherry bomb vodka"], countries: ["GB", "US", "FR"] },
  { id: "mudslide-shot", brand: "Mudslide shot", group: "spirit", glass: "shot", parts: [[17, 15], [16, 15], [40, 15]], aliases: ["mudslide", "mud slide shot"], countries: ["US", "GB", "FR"] },
  { id: "amaretto-sour-shot", brand: "Amaretto sour shot", group: "spirit", glass: "shot", parts: [[28, 30], [0, 15]], aliases: ["amaretto sour shooter"], countries: ["US", "GB", "FR", "IT"] },
  { id: "woo-woo-shot", brand: "Woo woo shot", group: "spirit", glass: "shot", parts: [[40, 15], [20, 15], [0, 15]], aliases: ["woo woo", "woo-woo"], countries: ["US", "GB", "FR"] },
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
  // Typical bar pours, including mixer, juice or dilution in the total volume.
  { id: "daiquiri", brand: "Daiquiri", group: "cocktail", glass: "cocktail", parts: [[40, 60], [0, 25], [0, 15]], aliases: ["daikiri"], countries: ["CU", "FR", "GB", "US"] },
  { id: "whisky-sour", brand: "Whisky Sour", group: "cocktail", glass: "cocktail", parts: [[40, 45], [0, 25], [0, 20], [0, 20]], aliases: ["whiskey sour"], countries: ["US", "GB", "FR"] },
  { id: "espresso-martini", brand: "Espresso Martini", group: "cocktail", glass: "cocktail", parts: [[40, 50], [16, 30], [0, 30], [0, 10]], aliases: ["martini espresso"], countries: ["GB", "FR", "US"] },
  { id: "pornstar-martini", brand: "Pornstar Martini", group: "cocktail", glass: "cocktail", parts: [[40, 45], [20, 15], [0, 40], [0, 15]], aliases: ["porn star martini", "passion fruit martini"], countries: ["GB", "FR", "US"] },
  { id: "dry-martini", brand: "Dry Martini", group: "cocktail", glass: "cocktail", parts: [[40, 60], [18, 10], [0, 15]], aliases: ["martini dry cocktail"], countries: ["GB", "US", "FR"] },
  { id: "dirty-martini", brand: "Dirty Martini", group: "cocktail", glass: "cocktail", parts: [[40, 60], [18, 10], [0, 20], [0, 10]], aliases: [], countries: ["US", "GB", "FR"] },
  { id: "old-fashioned", brand: "Old Fashioned", group: "cocktail", glass: "cocktail", parts: [[45, 45], [45, 2], [0, 15]], aliases: ["old fashion"], countries: ["US", "FR", "GB"] },
  { id: "manhattan", brand: "Manhattan", group: "cocktail", glass: "cocktail", parts: [[45, 50], [16, 20], [45, 2], [0, 15]], aliases: ["manhattan cocktail"], countries: ["US", "CA", "GB", "FR"] },
  { id: "boulevardier", brand: "Boulevardier", group: "cocktail", glass: "cocktail", parts: [[45, 45], [25, 30], [16, 30], [0, 15]], aliases: [], countries: ["US", "FR", "GB"] },
  { id: "paper-plane", brand: "Paper Plane", group: "cocktail", glass: "cocktail", parts: [[45, 25], [11, 25], [35, 25], [0, 25]], aliases: ["paper plane cocktail"], countries: ["US", "GB", "FR"] },
  { id: "bloody-mary", brand: "Bloody Mary", group: "cocktail", glass: "cocktail", parts: [[40, 45], [0, 90], [0, 15], [0, 10]], aliases: ["bloody mary cocktail"], countries: ["US", "FR", "GB"] },
  { id: "paloma", brand: "Paloma", group: "cocktail", glass: "cocktail", parts: [[40, 50], [0, 100], [0, 5]], aliases: ["tequila paloma"], countries: ["MX", "US", "FR"] },
  { id: "tequila-sunrise", brand: "Tequila Sunrise", group: "cocktail", glass: "cocktail", parts: [[40, 45], [0, 90], [0, 15]], aliases: ["teq sunrise"], countries: ["US", "MX", "FR"] },
  { id: "mai-tai", brand: "Mai Tai", group: "cocktail", glass: "cocktail", parts: [[40, 30], [40, 30], [40, 15], [0, 30], [0, 15], [0, 15]], aliases: ["maitai"], countries: ["US", "GB", "FR"] },
  { id: "hurricane-cocktail", brand: "Hurricane", group: "cocktail", glass: "cocktail", parts: [[40, 60], [40, 60], [0, 30], [0, 30], [0, 15], [0, 30]], aliases: ["hurricane cocktail"], countries: ["US", "GB"] },
  { id: "dark-n-stormy", brand: "Dark 'n' Stormy", group: "cocktail", glass: "cocktail", parts: [[40, 60], [0, 100], [0, 10]], aliases: ["dark and stormy", "dark n stormy"], countries: ["GB", "US", "FR"] },
  { id: "pisco-sour", brand: "Pisco Sour", group: "cocktail", glass: "cocktail", parts: [[40, 60], [0, 30], [0, 20], [0, 20]], aliases: [], countries: ["PE", "CL", "US", "FR"] },
  { id: "canchanchara", brand: "Canchánchara", group: "cocktail", glass: "cocktail", parts: [[40, 60], [0, 15], [0, 15], [0, 25]], aliases: ["canchanchara"], countries: ["CU", "FR"] },
  { id: "cosmopolitan", brand: "Cosmopolitan", group: "cocktail", glass: "cocktail", parts: [[40, 40], [40, 15], [0, 15], [0, 30], [0, 15]], aliases: ["cosmo"], countries: ["US", "FR", "GB"] },
  { id: "mimosa", brand: "Mimosa", group: "cocktail", glass: "cocktail", parts: [[12, 75], [0, 75]], aliases: ["champagne orange"], countries: ["FR", "GB", "US"] },
  { id: "bellini", brand: "Bellini", group: "cocktail", glass: "cocktail", parts: [[11, 100], [0, 50]], aliases: ["bellini cocktail"], countries: ["IT", "FR", "GB", "US"] },
  { id: "kir-royal", brand: "Kir Royal", group: "cocktail", glass: "cocktail", parts: [[12, 90], [20, 10]], aliases: ["kir royale"], countries: ["FR", "GB"] },
  { id: "campari-spritz", brand: "Campari Spritz", group: "cocktail", glass: "cocktail", parts: [[25, 60], [11, 90], [0, 30]], aliases: [], countries: ["IT", "FR"] },
  { id: "hugo-spritz", brand: "Hugo Spritz", group: "cocktail", glass: "cocktail", parts: [[20, 30], [11, 90], [0, 30]], aliases: ["spritz hugo"], countries: ["IT", "DE", "FR"] },
  { id: "americano-cocktail", brand: "Americano", group: "cocktail", glass: "cocktail", parts: [[25, 30], [16, 30], [0, 30]], aliases: ["americano cocktail"], countries: ["IT", "FR", "GB"] },
  { id: "garibaldi", brand: "Garibaldi", group: "cocktail", glass: "cocktail", parts: [[25, 45], [0, 120]], aliases: ["campari orange"], countries: ["IT", "US", "FR"] },
  { id: "french-75", brand: "French 75", group: "cocktail", glass: "cocktail", parts: [[40, 30], [12, 60], [0, 15], [0, 15]], aliases: ["soixante quinze", "french seventy five"], countries: ["FR", "GB", "US"] },
  { id: "sidecar", brand: "Sidecar", group: "cocktail", glass: "cocktail", parts: [[40, 50], [40, 20], [0, 20], [0, 15]], aliases: [], countries: ["FR", "GB", "US"] },
  { id: "malibu-ananas", brand: "Malibu Ananas", group: "cocktail", glass: "cocktail", parts: [[21, 40], [0, 120]], aliases: ["malibou ananas", "malibu pineapple"], countries: ["FR", "GB", "US"] },
  { id: "malibu-coca", brand: "Malibu Coca", group: "cocktail", glass: "cocktail", parts: [[21, 40], [0, 120]], aliases: ["malibou coca", "malibu coke", "malibu cola"], countries: ["FR", "GB", "US"] },
  { id: "malibu-orange", brand: "Malibu Orange", group: "cocktail", glass: "cocktail", parts: [[21, 40], [0, 120]], aliases: ["malibou orange", "malibu jus d orange"], countries: ["FR", "GB", "US"] },
  { id: "blue-lagoon", brand: "Blue Lagoon", group: "cocktail", glass: "cocktail", parts: [[40, 40], [21, 20], [0, 100]], aliases: ["lagon bleu"], countries: ["GB", "FR", "US"] },
  { id: "sea-breeze", brand: "Sea Breeze", group: "cocktail", glass: "cocktail", parts: [[40, 40], [0, 120], [0, 30]], aliases: [], countries: ["US", "GB", "FR"] },
  { id: "bramble", brand: "Bramble", group: "cocktail", glass: "cocktail", parts: [[40, 50], [20, 15], [0, 25], [0, 15]], aliases: [], countries: ["GB", "FR", "US"] },
  { id: "tom-collins", brand: "Tom Collins", group: "cocktail", glass: "cocktail", parts: [[40, 45], [0, 30], [0, 15], [0, 60]], aliases: ["gin collins"], countries: ["US", "GB", "FR"] },
  { id: "white-russian", brand: "White Russian", group: "cocktail", glass: "cocktail", parts: [[40, 50], [16, 20], [0, 30]], aliases: ["russe blanc"], countries: ["US", "FR", "GB"] },
  { id: "black-russian", brand: "Black Russian", group: "cocktail", glass: "cocktail", parts: [[40, 50], [16, 20]], aliases: ["russe noir"], countries: ["US", "FR", "GB"] },
  { id: "gin-fizz", brand: "Gin Fizz", group: "cocktail", glass: "cocktail", parts: [[40, 45], [0, 30], [0, 10], [0, 80]], aliases: [], countries: ["US", "FR", "GB"] },
  { id: "sherry-cobbler", brand: "Sherry Cobbler", group: "cocktail", glass: "cocktail", parts: [[15, 90], [0, 15], [0, 35]], aliases: [], countries: ["US", "GB", "ES"] },
  { id: "sazerac", brand: "Sazerac", group: "cocktail", glass: "cocktail", parts: [[40, 50], [55, 2], [45, 2], [0, 15]], aliases: [], countries: ["US", "FR", "GB"] },
  { id: "vieux-carre", brand: "Vieux Carré", group: "cocktail", glass: "cocktail", parts: [[45, 30], [40, 30], [16, 30], [40, 5], [45, 2], [0, 15]], aliases: [], countries: ["US", "GB", "FR"] },
  { id: "last-word", brand: "Last Word", group: "cocktail", glass: "cocktail", parts: [[40, 22.5], [55, 22.5], [32, 22.5], [0, 22.5], [0, 10]], aliases: ["the last word"], countries: ["US", "FR", "GB"] },
  { id: "penicillin-cocktail", brand: "Penicillin", group: "cocktail", glass: "cocktail", parts: [[43, 60], [46, 8], [0, 45], [0, 15]], aliases: ["penicillin cocktail"], countries: ["US", "GB", "FR"] },
  { id: "ramos-gin-fizz", brand: "Ramos Gin Fizz", group: "cocktail", glass: "cocktail", parts: [[40, 45], [0, 90], [0, 60]], aliases: ["ramos fizz"], countries: ["US", "GB", "FR"] },
  { id: "amaretto-sour", brand: "Amaretto Sour", group: "cocktail", glass: "cocktail", parts: [[28, 45], [40, 20], [0, 30], [0, 20], [0, 20]], aliases: ["amaretto sour cocktail"], countries: ["US", "GB", "FR"] },
  { id: "french-martini", brand: "French Martini", group: "cocktail", glass: "cocktail", parts: [[40, 45], [16.5, 15], [0, 60]], aliases: [], countries: ["US", "GB", "FR"] },
  { id: "vesper-martini", brand: "Vesper Martini", group: "cocktail", glass: "cocktail", parts: [[40, 45], [40, 15], [17, 7.5], [0, 17.5]], aliases: ["vesper"], countries: ["GB", "US", "FR"] },
  { id: "gibson", brand: "Gibson", group: "cocktail", glass: "cocktail", parts: [[40, 60], [18, 10], [0, 15]], aliases: ["gibson martini"], countries: ["GB", "US", "FR"] },
  { id: "aviation", brand: "Aviation", group: "cocktail", glass: "cocktail", parts: [[40, 45], [32, 15], [20, 5], [0, 25], [0, 15]], aliases: ["aviation cocktail"], countries: ["US", "GB", "FR"] },
  { id: "corpse-reviver-2", brand: "Corpse Reviver No. 2", group: "cocktail", glass: "cocktail", parts: [[40, 25], [40, 25], [17, 25], [0, 25], [0, 15]], aliases: ["corpse reviver"], countries: ["GB", "US", "FR"] },
  { id: "clover-club", brand: "Clover Club", group: "cocktail", glass: "cocktail", parts: [[40, 45], [0, 15], [0, 15], [0, 25]], aliases: [], countries: ["US", "GB", "FR"] },
  { id: "brandy-alexander", brand: "Brandy Alexander", group: "cocktail", glass: "cocktail", parts: [[40, 30], [25, 30], [0, 30], [0, 15]], aliases: ["alexander cocktail"], countries: ["US", "GB", "FR"] },
  { id: "grasshopper-cocktail", brand: "Grasshopper", group: "cocktail", glass: "cocktail", parts: [[25, 30], [25, 30], [0, 30], [0, 15]], aliases: ["grasshopper cocktail"], countries: ["US", "GB", "FR"] },
  { id: "gin-basil-smash", brand: "Gin Basil Smash", group: "cocktail", glass: "cocktail", parts: [[40, 50], [0, 25], [0, 15], [0, 15]], aliases: ["basil smash"], countries: ["DE", "FR", "GB"] },
  { id: "southside", brand: "Southside", group: "cocktail", glass: "cocktail", parts: [[40, 60], [0, 30], [0, 15], [0, 15]], aliases: ["south side"], countries: ["US", "GB", "FR"] },
  { id: "bee-s-knees", brand: "Bee’s Knees", group: "cocktail", glass: "cocktail", parts: [[40, 50], [0, 25], [0, 20], [0, 15]], aliases: ["bees knees"], countries: ["FR", "US", "GB"] },
  { id: "singapore-sling", brand: "Singapore Sling", group: "cocktail", glass: "cocktail", parts: [[40, 30], [25, 15], [40, 7.5], [40, 7.5], [0, 155]], aliases: [], countries: ["SG", "GB", "US", "FR"] },
  { id: "jungle-bird", brand: "Jungle Bird", group: "cocktail", glass: "cocktail", parts: [[40, 45], [25, 22.5], [0, 67.5], [0, 15]], aliases: [], countries: ["MY", "US", "GB", "FR"] },
  { id: "zombie-cocktail", brand: "Zombie", group: "cocktail", glass: "cocktail", parts: [[40, 45], [40, 45], [57, 30], [0, 60], [0, 30]], aliases: ["zombie cocktail"], countries: ["US", "GB", "FR"] },
  { id: "painkiller-cocktail", brand: "Painkiller", group: "cocktail", glass: "cocktail", parts: [[40, 60], [0, 120], [0, 30], [0, 30]], aliases: ["painkiller cocktail"], countries: ["US", "GB", "FR"] },
  { id: "blue-hawaiian", brand: "Blue Hawaiian", group: "cocktail", glass: "cocktail", parts: [[40, 45], [25, 15], [0, 120]], aliases: [], countries: ["US", "GB", "FR"] },
  { id: "melon-ball", brand: "Melon Ball", group: "cocktail", glass: "cocktail", parts: [[20, 45], [40, 30], [0, 120]], aliases: [], countries: ["US", "GB", "FR"] },
  { id: "midori-sour", brand: "Midori Sour", group: "cocktail", glass: "cocktail", parts: [[20, 45], [40, 30], [0, 90]], aliases: ["melon sour"], countries: ["US", "GB", "FR"] },
  { id: "trinidad-sour", brand: "Trinidad Sour", group: "cocktail", glass: "cocktail", parts: [[44.7, 45], [45, 15], [0, 55], [0, 15]], aliases: [], countries: ["US", "GB", "FR"] },
  { id: "gold-rush", brand: "Gold Rush", group: "cocktail", glass: "cocktail", parts: [[45, 60], [0, 25], [0, 20], [0, 15]], aliases: ["gold rush cocktail"], countries: ["US", "GB", "FR"] },
  { id: "mint-julep", brand: "Mint Julep", group: "cocktail", glass: "cocktail", parts: [[45, 60], [0, 25]], aliases: ["julep"], countries: ["US", "GB", "FR"] },
  { id: "irish-coffee", brand: "Irish Coffee", group: "cocktail", glass: "cocktail", parts: [[40, 50], [0, 150]], aliases: ["cafe irlandais"], countries: ["IE", "GB", "FR", "US"] },
  { id: "hot-toddy", brand: "Hot Toddy", group: "cocktail", glass: "cocktail", parts: [[40, 45], [0, 150]], aliases: ["whisky chaud"], countries: ["GB", "IE", "US", "FR"] },
  { id: "carajillo", brand: "Carajillo", group: "cocktail", glass: "cocktail", parts: [[31, 50], [0, 50], [0, 15]], aliases: ["carajillo licor 43"], countries: ["MX", "ES", "US"] },
  { id: "mule-kentucky", brand: "Kentucky Mule", group: "cocktail", glass: "cocktail", parts: [[45, 45], [0, 135]], aliases: ["bourbon mule"], countries: ["US", "GB", "FR"] },
  { id: "el-diablo", brand: "El Diablo", group: "cocktail", glass: "cocktail", parts: [[40, 45], [20, 15], [0, 105]], aliases: ["tequila diablo"], countries: ["MX", "US", "FR"] },
  { id: "daiquiri-fraise", brand: "Daiquiri fraise", group: "cocktail", glass: "cocktail", parts: [[40, 50], [0, 110]], aliases: ["strawberry daiquiri", "daiquiri strawberry"], countries: ["FR", "GB", "US"] },
  { id: "punch-planteur", brand: "Planteur", group: "cocktail", glass: "cocktail", parts: [[50, 40], [0, 160]], aliases: ["punch planteur", "rhum planteur"], countries: ["FR"] },
  { id: "bora-bora", brand: "Bora Bora", group: "soft", glass: "cocktail", parts: [[0, 200]], aliases: ["bora bora sans alcool"], countries: ["FR", "BE", "GB"] },
  { id: "virgin-mary", brand: "Virgin Mary", group: "soft", glass: "cocktail", parts: [[0, 150]], aliases: ["bloody mary sans alcool"], countries: ["FR", "GB", "US"] },
  { id: "embuscade", brand: "Embuscade", group: "cocktail", glass: "cocktail", parts: [[40, 20], [12, 30], [5, 150], [0, 20]], aliases: ["embuscade caennaise"], countries: ["FR"] },
  { id: "soupe-champenoise", brand: "Soupe champenoise", group: "cocktail", glass: "cocktail", parts: [[12, 100], [40, 15], [0, 30]], aliases: ["soupe de champagne"], countries: ["FR"] },
  { id: "jacqueline-cocktail", brand: "Jacqueline", group: "cocktail", glass: "cocktail", parts: [[12, 100], [0, 80], [0, 20]], aliases: ["vin blanc limonade grenadine"], countries: ["FR"] },
  { id: "grog-au-rhum", brand: "Grog au rhum", group: "cocktail", glass: "cocktail", parts: [[40, 40], [0, 160], [0, 20]], aliases: ["grog rhum"], countries: ["FR", "GB"] },
  { id: "get-perrier", brand: "Get Perrier", group: "cocktail", glass: "cocktail", parts: [[17.9, 40], [0, 160]], aliases: ["get 27 perrier", "get perrier menthe"], countries: ["FR"] },
  { id: "porto-tonic", brand: "Porto tonic", group: "cocktail", glass: "cocktail", parts: [[19.5, 50], [0, 100]], aliases: ["white port tonic", "porto branco tonica"], countries: ["PT", "FR", "GB"] },
  { id: "white-lady", brand: "White Lady", group: "cocktail", glass: "cocktail", parts: [[40, 40], [40, 30], [0, 20], [0, 15]], aliases: ["white lady cocktail"], countries: ["GB", "FR", "US"] },
  { id: "st-germain-spritz", brand: "St-Germain Spritz", group: "cocktail", glass: "cocktail", parts: [[20, 40], [11, 60], [0, 60]], aliases: ["spritz saint germain"], countries: ["FR", "GB", "US"] },
  { id: "mango-lassi", brand: "Mango Lassi", group: "soft", glass: "soft", parts: [[0, 250]], aliases: ["lassi mangue"], countries: ["IN", "GB", "FR"] },
  { id: "chocolat-chaud", brand: "Chocolat chaud", group: "soft", glass: "soft", parts: [[0, 200]], aliases: ["hot chocolate"], countries: ["FR"] },
  { id: "espresso-coffee", brand: "Espresso", group: "soft", glass: "soft", parts: [[0, 30]], aliases: ["expresso", "cafe espresso", "cafe expresso"], countries: ["IT", "FR", "GB"] },
  { id: "cafe-allonge", brand: "Café allongé", group: "soft", glass: "soft", parts: [[0, 100]], aliases: ["cafe lungo"], countries: ["FR"] },
  { id: "cafe-latte", brand: "Café latte", group: "soft", glass: "soft", parts: [[0, 250]], aliases: ["caffe latte"], countries: ["FR", "IT", "GB"] },
  { id: "cappuccino", brand: "Cappuccino", group: "soft", glass: "soft", parts: [[0, 150]], aliases: ["capuccino"], countries: ["IT", "FR", "GB"] },
  { id: "matcha-latte", brand: "Matcha latte", group: "soft", glass: "soft", parts: [[0, 250]], aliases: ["latte matcha"], countries: ["JP", "FR", "GB"] },
  { id: "chai-latte", brand: "Chaï latte", group: "soft", glass: "soft", parts: [[0, 250]], aliases: ["chai latte", "latte chai"], countries: ["IN", "FR", "GB"] },
  { id: "citronnade", brand: "Citronnade", group: "soft", glass: "soft", parts: [[0, 250]], aliases: ["citronnade maison"], countries: ["FR"] },
  { id: "virgin-passion-martini", brand: "Virgin Passion Martini", group: "soft", glass: "cocktail", parts: [[0, 120]], aliases: ["pornstar sans alcool"], countries: ["FR", "GB"] },
  { id: "nojito-framboise", brand: "Virgin Mojito Framboise", group: "soft", glass: "cocktail", parts: [[0, 250]], aliases: ["mojito framboise sans alcool"], countries: ["FR"] },
  { id: "naked-and-famous", brand: "Naked and Famous", group: "cocktail", glass: "cocktail", parts: [[45, 22.5], [43, 22.5], [11, 22.5], [0, 32.5]], aliases: [], countries: ["US", "FR"] },
  { id: "blood-and-sand", brand: "Blood and Sand", group: "cocktail", glass: "cocktail", parts: [[40, 25], [16, 25], [24, 25], [0, 35]], aliases: [], countries: ["GB", "US", "FR"] },
  { id: "rob-roy", brand: "Rob Roy", group: "cocktail", glass: "cocktail", parts: [[40, 50], [16, 20], [45, 2], [0, 18]], aliases: [], countries: ["US", "GB", "FR"] },
  { id: "godfather-cocktail", brand: "Godfather", group: "cocktail", glass: "cocktail", parts: [[40, 50], [28, 20], [0, 15]], aliases: [], countries: ["US", "GB", "FR"] },
  { id: "godmother-cocktail", brand: "Godmother", group: "cocktail", glass: "cocktail", parts: [[40, 50], [28, 20], [0, 15]], aliases: [], countries: ["US", "GB", "FR"] },
  { id: "rusty-nail-cocktail", brand: "Rusty Nail Cocktail", group: "cocktail", glass: "cocktail", parts: [[40, 45], [40, 25], [0, 15]], aliases: [], countries: ["GB", "US", "FR"] },
  { id: "matador-cocktail", brand: "Matador", group: "cocktail", glass: "cocktail", parts: [[40, 45], [0, 120]], aliases: [], countries: ["MX", "US"] },
  { id: "hemingway-daiquiri", brand: "Hemingway Daiquiri", group: "cocktail", glass: "cocktail", parts: [[40, 60], [32, 15], [0, 55]], aliases: [], countries: ["CU", "US", "FR"] },
  { id: "airmail-cocktail", brand: "Airmail", group: "cocktail", glass: "cocktail", parts: [[40, 45], [12, 60], [0, 30]], aliases: [], countries: ["US", "FR"] },
  { id: "jack-rose-cocktail", brand: "Jack Rose", group: "cocktail", glass: "cocktail", parts: [[40, 45], [0, 45]], aliases: [], countries: ["US", "GB"] },
  { id: "champagne-cocktail", brand: "Champagne Cocktail", group: "cocktail", glass: "cocktail", parts: [[12, 90], [40, 10], [45, 2]], aliases: [], countries: ["FR", "GB", "US"] },
  { id: "floradora", brand: "Floradora", group: "cocktail", glass: "cocktail", parts: [[40, 50], [0, 125]], aliases: [], countries: ["US", "GB"] },
  { id: "john-collins", brand: "John Collins", group: "cocktail", glass: "cocktail", parts: [[40, 45], [0, 105]], aliases: [], countries: ["GB", "US"] },
  { id: "long-vodka", brand: "Long Vodka", group: "cocktail", glass: "cocktail", parts: [[40, 50], [45, 2], [0, 150]], aliases: [], countries: ["GB"] },
  { id: "white-negroni", brand: "White Negroni", group: "cocktail", glass: "cocktail", parts: [[40, 45], [17, 25], [15, 25], [0, 15]], aliases: [], countries: ["FR", "GB", "US"] },
  { id: "black-velvet", brand: "Black Velvet", group: "cocktail", glass: "cocktail", parts: [[4.2, 75], [12, 75]], aliases: [], countries: ["GB", "IE", "FR"] },
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
