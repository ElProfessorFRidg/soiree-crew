import { describe, expect, it } from "vitest";
import { adjacentKeys, countryRank, jaroWinkler, parseDrinkOrder, soundOf, DRINK_CATALOGUE, editDistance, matchScore, normalise, parseOrder, search, sizesFor, strengthFits } from "./index";

// parseOrder is the brand-aware parser restricted to generic drinks; these cases predate the brands.

const drinks = [
  { value: "pint", names: ["Pinte", "Pint"] },
  { value: "shot", names: ["Shot", "Shooter"] },
  { value: "wine", names: ["Verre de vin", "Glass of wine"] },
  { value: "largeWine", names: ["Grand verre de vin", "Large glass of wine"] },
  { value: "cocktail", names: ["Cocktail"] },
  { value: "spritz", names: ["Spritz maison"] },
];

describe("fuzzy input (ADP-05)", () => {
  it("ignores accents, case and punctuation", () => {
    expect(normalise("  Bière, s'il te plaît ! ")).toBe("biere s il te plait");
  });

  it("counts a swapped pair of letters as one typo", () => {
    expect(editDistance("pinte", "pitne")).toBe(1);
    expect(editDistance("cocktail", "coktail")).toBe(1);
  });

  it("finds drinks through typos, plurals and prefixes", () => {
    expect(search("coktail", drinks)[0]).toBe("cocktail");
    expect(search("pintes", drinks)[0]).toBe("pint");
    expect(search("spr", drinks)[0]).toBe("spritz");
    expect(search("vin", drinks)).toEqual(expect.arrayContaining(["wine", "largeWine"]));
    expect(search("xyz", drinks)).toEqual([]);
    expect(matchScore("ab", "cocktail")).toBeNull();
  });

  it("reads an order with quantities in French or English", () => {
    expect(parseOrder("2 pintes et un shoot", drinks)).toEqual([
      { quantity: 2, value: "pint" },
      { quantity: 1, value: "shot" },
    ]);
    expect(parseOrder("two pints and a large glass of wine", drinks)).toEqual([
      { quantity: 2, value: "pint" },
      { quantity: 1, value: "largeWine" },
    ]);
    expect(parseOrder("trois cocktails", drinks)).toEqual([{ quantity: 3, value: "cocktail" }]);
    expect(parseOrder("bonjour", drinks)).toEqual([]);
  });

  it("reads orders in the other interface languages, Cyrillic included", () => {
    const local = [
      { value: "pint", names: ["Pinte", "Pint", "Caña", "Großes Bier", "Пинта"] },
      { value: "shot", names: ["Shot", "Chupito", "Шот"] },
    ];
    expect(parseOrder("dos cañas y un chupito", local)).toEqual([
      { quantity: 2, value: "pint" },
      { quantity: 1, value: "shot" },
    ]);
    expect(parseOrder("zwei große Bier und ein Shot", local)).toEqual([
      { quantity: 2, value: "pint" },
      { quantity: 1, value: "shot" },
    ]);
    expect(parseOrder("две пинты и шот", local)).toEqual([
      { quantity: 2, value: "pint" },
      { quantity: 1, value: "shot" },
    ]);
  });
});

describe("typos from a phone keyboard (AZERTY and QWERTY)", () => {
  it("forgives a neighbouring key, a doubled or dropped letter, and spaces", () => {
    expect(adjacentKeys("a", "z")).toBe(true); // AZERTY
    expect(adjacentKeys("a", "s")).toBe(true); // QWERTY
    expect(adjacentKeys("a", "p")).toBe(false);
    expect(matchScore("jqck", "jack")).not.toBeNull();
    expect(matchScore("abslut", "absolut")).not.toBeNull();
    expect(matchScore("jaggermeister", "jagermeister")).not.toBeNull();
    expect(matchScore("redbull", "red bull")).not.toBeNull();
    expect(matchScore("heinekn", "heineken")).not.toBeNull();
    expect(matchScore("heinejen", "heineken")).not.toBeNull(); // j and k are neighbours
    // A different word is still a different word.
    expect(matchScore("vin", "gin")).toBeNull();
  });
});

describe("catalogue across countries", () => {
  it("knows brands from several countries, with sane strengths and unique ids", () => {
    const ids = DRINK_CATALOGUE.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const name of ["Absolut", "Eristoff", "Jack Daniel's", "Estrella Damm", "Baltika 7", "Bud Light", "Strongbow", "Aperol"]) {
      expect(DRINK_CATALOGUE.some((d) => d.brand === name)).toBe(true);
    }
    for (const drink of DRINK_CATALOGUE) expect(strengthFits(drink.group, drink.abv)).toBe(true);
  });

  it("offers the country's own sizes and ranks its household names first", () => {
    expect(sizesFor("beer", "GB").some((s) => s.volumeMl === 568 && s.serving === "pint")).toBe(true);
    expect(sizesFor("beer", "ES").some((s) => s.volumeMl === 200)).toBe(true);
    expect(sizesFor("spirit", null).some((s) => s.volumeMl === 700)).toBe(true);
    const baltika = DRINK_CATALOGUE.find((d) => d.id === "baltika-7")!;
    expect(countryRank(baltika, "RU")).toBe(0);
    expect(countryRank(baltika, "FR")).toBe(1);
  });
});

describe("spelling by ear, without any alias written for it", () => {
  const presets = [{ value: "m-pint", names: ["pinte", "pint"] }];
  const brandOf = (text: string) => parseDrinkOrder(text, presets).map((line) => line.drink?.id ?? line.preset);

  it("finds a brand written the way it sounds", () => {
    expect(brandOf("2 zubrikov")).toEqual(["zubrowka"]);
    expect(brandOf("un jeger")).toEqual(["jagermeister"]);
    expect(brandOf("une guiness")).toEqual(["guinness"]);
    expect(brandOf("un tekila")).toEqual(["tequila"]);
    expect(brandOf("une bakardi")).toEqual(["bacardi"]);
    expect(brandOf("un hennesi")).toEqual(["cognac-hennessy"]);
    expect(brandOf("une smirnof")).toEqual(["smirnoff"]);
  });

  it("leaves everyday words alone", () => {
    expect(brandOf("bonjour la team")).toEqual([]);
    expect(brandOf("merci beaucoup")).toEqual([]);
    expect(matchScore("vin", "gin")).toBeNull();
  });

  it("measures likeness and sound", () => {
    expect(jaroWinkler("zubrikov", "zubrowka")).toBeGreaterThan(0.86);
    expect(soundOf("guiness")).toEqual(soundOf("guinness"));
  });
});

describe("a wrong first letter, guesses and everyday words", () => {
  const presets = [{ value: "m-pint", names: ["pinte", "pint"] }, { value: "m-shot", names: ["shot"] }];
  const read = (text: string) => parseDrinkOrder(text, presets).map((line) => [line.drink?.id ?? line.preset, line.guess]);

  it("finds a name whose first letter is wrong, and says it is a guess", () => {
    expect(read("xubrikov")).toEqual([["zubrowka", true]]);
    expect(read("habsolut")).toEqual([["absolut", true]]);
    expect(read("dacardi")).toEqual([["bacardi", true]]);
    expect(read("beineken")).toEqual([["heineken", true]]);
  });

  it("is sure of exact names, nicknames, starts and plurals", () => {
    expect(read("2 kro")).toEqual([["kronenbourg", false]]);
    expect(read("2 pintes et un shot")).toEqual([["m-pint", false], ["m-shot", false]]);
    expect(read("sex on the beach")).toEqual([["sex-on-the-beach", false]]);
  });

  it("keeps everyday words, days and chatter out", () => {
    for (const text of ["on se voit demain", "mardi", "lundi soir", "bonjour la team", "merci beaucoup", "hola amigos", "danke"]) expect(read(text)).toEqual([]);
  });

  it("lets habits tip a near tie, never a far name", () => {
    const tie = parseDrinkOrder("jager", presets, { bonus: (d) => (d.id === "jagerbomb" ? 0.3 : 0) });
    expect(tie[0]!.drink?.id).toBe("jagermeister");
    expect(parseDrinkOrder("merci", presets, { bonus: () => 0.3 })).toEqual([]);
  });
});
