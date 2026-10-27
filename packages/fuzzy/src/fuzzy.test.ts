import { describe, expect, it } from "vitest";
import { editDistance, matchScore, normalise, parseOrder, search } from "./index";

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
