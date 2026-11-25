import { describe, expect, it } from "vitest";
import { getDrinkCatalogue, CORE_DRINK_CATALOGUE, CATALOGUE_COUNT, catalogueDrink, exactCatalogueNames, catalogueSearchCandidates, parseDrinkOrder, type CatalogueDrink } from "./index";
import { buildNameIndex, matchingDrinkIds } from "./nameIndex";

const DRINK_CATALOGUE = getDrinkCatalogue();

describe("drink name index", () => {
  it("keeps short suggestions curated and bounds rare prefix expansion", () => {
    const core = new Set(CORE_DRINK_CATALOGUE.map(drink => drink.id));
    expect(catalogueSearchCandidates("co").some(drink => drink.id === "coca-cola")).toBe(true);
    expect(catalogueSearchCandidates("co").filter(drink => !core.has(drink.id)).map(drink => drink.id))
      .toEqual(exactCatalogueNames("co").filter(drink => !core.has(drink.id)).map(drink => drink.id));
    const results = catalogueSearchCandidates("coca", "soft");
    expect(results.every(drink => drink.group === "soft")).toBe(true);
    expect(results.filter(drink => !core.has(drink.id)).length).toBeLessThanOrEqual(6 * 32 + exactCatalogueNames("coca").length);
  });
  it("resolves every stable ID from the compact catalogue and excludes reviewed non-beverages", () => {
    expect(CATALOGUE_COUNT).toBe(DRINK_CATALOGUE.length);
    expect(new Set(DRINK_CATALOGUE.map(drink => drink.id)).size).toBe(DRINK_CATALOGUE.length);
    for (const drink of DRINK_CATALOGUE) {
      const resolved = catalogueDrink(drink.id);
      if (!resolved || resolved.brand !== drink.brand || resolved.abv !== drink.abv || resolved.volumeMl !== drink.volumeMl || resolved.group !== drink.group) {
        throw new Error(`Unresolvable catalogue ID: ${drink.id}`);
      }
    }
    for (const id of ["00000766", "3036810230341", "5012427091405", "9008700168892"]) {
      expect(catalogueDrink(`openfoodfacts-${id}`)).toBeUndefined();
    }
  });
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
  it("indexes the complete audited snapshot across all families and keeps source strengths", () => {
    expect(DRINK_CATALOGUE.length).toBeGreaterThanOrEqual(44_487);
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
});
