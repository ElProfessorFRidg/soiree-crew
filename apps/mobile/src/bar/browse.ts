import { search, type Candidate } from "@crew/fuzzy";
import { RECIPES, type Recipe, type RecipeCategory } from "./recipes";

/** Search starts at two characters; below that the whole category shows. */
export const MIN_QUERY = 2;
/** Search results kept, best first. */
export const MAX_RESULTS = 40;

/** Searchable names of a recipe: its own, then each ingredient's, in the reader's language. */
export function recipeCandidates(
  recipeName: (recipe: Recipe) => string,
  ingredientName: (id: Recipe["ingredients"][number]["id"]) => string,
): Candidate<Recipe>[] {
  return RECIPES.map((recipe) => ({ value: recipe, names: [recipeName(recipe), ...recipe.ingredients.map((i) => ingredientName(i.id))] }));
}

/** O-68: what the Bar lists for a query and a category, in catalogue order unless searching. */
export function browseRecipes(query: string, category: RecipeCategory | "all", candidates: readonly Candidate<Recipe>[]): Recipe[] {
  const inCategory = (r: Recipe) => category === "all" || r.category === category;
  if (query.trim().length >= MIN_QUERY) return search(query, candidates, MAX_RESULTS).filter(inCategory);
  return RECIPES.filter(inCategory);
}
