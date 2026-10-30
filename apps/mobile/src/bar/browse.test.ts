import { describe, expect, it } from "vitest";
import { browseRecipes, MAX_RESULTS, recipeCandidates } from "./browse";
import { RECIPES } from "./recipes";
import { barEn } from "./text/en";

const candidates = recipeCandidates(
  (recipe) => barEn.recipes[recipe.id as keyof typeof barEn.recipes].name,
  (id) => barEn.ingredients[id],
);

describe("browsing the Bar (O-68)", () => {
  it("lists the whole catalogue, then one category, in catalogue order", () => {
    expect(browseRecipes("", "all", candidates)).toHaveLength(RECIPES.length);
    const shots = browseRecipes(" ", "shot", candidates);
    expect(shots.length).toBeGreaterThan(0);
    expect(shots.every((r) => r.category === "shot")).toBe(true);
    expect(shots.map((r) => r.id)).toEqual(RECIPES.filter((r) => r.category === "shot").map((r) => r.id));
  });

  it("searches by name with a typo, best match first, and keeps the category filter", () => {
    const found = browseRecipes("mojitp", "all", candidates);
    expect(found[0]?.id).toBe("mojito");
    expect(found.length).toBeLessThanOrEqual(MAX_RESULTS);
    expect(browseRecipes("mojito", "zero", candidates).every((r) => r.category === "zero")).toBe(true);
  });

  it("waits for two characters before searching", () => {
    expect(browseRecipes("m", "all", candidates)).toHaveLength(RECIPES.length);
  });
});
