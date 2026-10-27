import { describe, expect, it } from "vitest";
import { INGREDIENT_ABV, RECIPE_CATEGORIES, RECIPES, recipeAbv, type IngredientId } from "./recipes";
import { barEn } from "./text/en";
import { barFr } from "./text/fr";

// O-66: the Bar's catalogue stays consistent with its two text files.

const catalogues = { fr: barFr, en: barEn } as const;
type RecipeText = { name: string; steps: readonly string[] };

describe("recipes", () => {
  it("has unique ids", () => {
    const ids = RECIPES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has at least 470 recipes", () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(470);
  });

  it("uses every category", () => {
    for (const category of RECIPE_CATEGORIES) expect(RECIPES.some((r) => r.category === category), category).toBe(true);
  });

  for (const [lang, text] of Object.entries(catalogues)) {
    const recipes = text.recipes as Record<string, RecipeText | undefined>;
    const ingredients = text.ingredients as Record<string, string | undefined>;

    it(`names every recipe in ${lang}, with 2 to 4 steps`, () => {
      for (const recipe of RECIPES) {
        const entry = recipes[recipe.id];
        expect(entry?.name, recipe.id).toBeTruthy();
        expect(entry?.steps.length ?? 0, recipe.id).toBeGreaterThanOrEqual(2);
        expect(entry?.steps.length ?? 0, recipe.id).toBeLessThanOrEqual(4);
      }
    });

    it(`names every ingredient in ${lang}`, () => {
      for (const id of Object.keys(INGREDIENT_ABV) as IngredientId[]) expect(ingredients[id], id).toBeTruthy();
    });
  }

  it("keeps alcohol-free recipes at zero", () => {
    for (const recipe of RECIPES.filter((r) => r.category === "zero")) expect(recipeAbv(recipe), recipe.id).toBe(0);
  });

  it("keeps every strength between 0 and 45%", () => {
    for (const recipe of RECIPES) {
      const abv = recipeAbv(recipe);
      expect(abv, recipe.id).toBeGreaterThanOrEqual(0);
      expect(abv, recipe.id).toBeLessThanOrEqual(0.45);
    }
  });
});
