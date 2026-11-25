import { describe, expect, it } from "vitest";
import { DRINK_CATALOGUE, catalogueSearchCandidates, parseDrinkOrder, type CatalogueDrink } from "./index";
import { buildNameIndex, matchingDrinkIds } from "./nameIndex";

describe("drink name index", () => {
  it("looks up indexed names and prefixes with 10,000 records", () => {
    const input = Array.from({ length: 10_000 }, (_, index): CatalogueDrink => ({
      group: "beer", abv: 0.05, volumeMl: 330, glass: "bottle",
      id: `fixture-${index}`,
      brand: `Fixture ${String(index).padStart(5, "0")}`,
      aliases: [],
    }));
    const index = buildNameIndex(input);
    expect(index).toHaveLength(10_000);
    expect(matchingDrinkIds(index, "fixture 09999")).toEqual(["fixture-9999"]);
    expect(matchingDrinkIds(index, "fixture 0999", true, 2)).toEqual(["fixture-9990", "fixture-9991"]);
    expect(matchingDrinkIds(index, "fixture 10000", true)).toEqual([]);
  });

  it("finds a source beer by prefix and logs the right volume and strength by name", () => {
    expect(catalogueSearchCandidates("magic hat hocus").some(drink => drink.id === "openbeerdb-1")).toBe(true);
    expect(parseDrinkOrder("2 hocus pocus", [])).toMatchObject([
      { quantity: 2, drink: { id: "openbeerdb-1", abv: 0.045, volumeMl: 330 }, guess: false },
    ]);
  });

  it("indexes the original cocktail and soft drink imports", () => {
    expect(catalogueSearchCandidates("starbucks caffè lat").map(drink => drink.id))
      .toContain("trackcaffeine-starbucks-caff-latte-grande");
    expect(parseDrinkOrder("un Irish Maid", [])).toMatchObject([
      { drink: { id: "bar-assistant-irish-maid", abv: 0.18, volumeMl: 144 }, guess: false },
    ]);
    expect(parseDrinkOrder("25 cl d’Afri Cola", [])).toMatchObject([
      { drink: { id: "openfoodfacts-4009228250477", abv: 0 }, volumeMl: 250 },
    ]);
  });
  it("indexes at least 10,000 drinks across all families and keeps source strengths", () => {
    expect(DRINK_CATALOGUE.length).toBeGreaterThanOrEqual(10_000);
    expect(new Set(DRINK_CATALOGUE.map(drink => drink.group)).size).toBe(6);
    expect(catalogueSearchCandidates("folonari italia").map(drink => drink.id))
      .toContain("openfoodfacts-8000160633997");
    expect(parseDrinkOrder("15 cl Folonari Italia Garganega Pinot Grigio", [])).toMatchObject([
      { drink: { id: "openfoodfacts-8000160633997", abv: 0.12 }, volumeMl: 150, guess: false },
    ]);
    expect(parseDrinkOrder("Lucky One Lemonade Peach", [])).toMatchObject([
      { drink: { id: "olcc-99901306837", abv: 0.045, volumeMl: 355 }, guess: false },
    ]);
  });
  it.each([
    ["folnoari italia", "openfoodfacts-8000160633997"],
    ["folonari itlaia", "openfoodfacts-8000160633997"],
    ["ucky one lemonade peach", "olcc-99901306837"],
    ["luckyx one lemonade peach", "olcc-99901306837"],
    ["starbucks caffe lat", "trackcaffeine-starbucks-caff-latte-grande"],
  ])("finds an imported drink when searching for %s", (query, id) => {
    expect(catalogueSearchCandidates(query).map(drink => drink.id)).toContain(id);
  });
});
