import { registerHooks } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

// The app uses extensionless TypeScript imports. Resolve them for this Node 22 build task.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith(".ts") && specifier.startsWith(".")) {
      const url = new URL(specifier, context.parentURL);
      if (!/\.[a-z]+$/i.test(url.pathname) && existsSync(new URL(url.href + ".ts"))) {
        return nextResolve(specifier + ".ts", context);
      }
      if (specifier.endsWith(".json")) {
        return { ...nextResolve(specifier, context), importAttributes: { type: "json" } };
      }
    }
    return nextResolve(specifier, context);
  },
});

const { CORE_DRINK_CATALOGUE, OPEN_BEER_CATALOGUE, BAR_ASSISTANT_CATALOGUE, OPEN_FOOD_FACTS_CATALOGUE, OPEN_FOOD_FACTS_PRODUCTS, TRACK_CAFFEINE_CATALOGUE, OLCC_CATALOGUE } = await import("./src/catalogue.ts");
const { buildNameIndex } = await import("./src/nameIndex.ts");
for (const [filename, catalogue] of [
  ["core-index.json", CORE_DRINK_CATALOGUE],
  ["openbeerdb-index.json", OPEN_BEER_CATALOGUE],
  ["bar-assistant-index.json", BAR_ASSISTANT_CATALOGUE],
  ["openfoodfacts-index.json", OPEN_FOOD_FACTS_CATALOGUE],
  ["openfoodfacts-products-index.json", OPEN_FOOD_FACTS_PRODUCTS],
  ["trackcaffeine-index.json", TRACK_CAFFEINE_CATALOGUE],
  ["olcc-index.json", OLCC_CATALOGUE],
]) {
  const url = new URL(`./src/data/${filename}`, import.meta.url);
  const content = "[\n" + buildNameIndex(catalogue).map(row => JSON.stringify(row)).join(",\n") + "\n]\n";
  if (process.argv.includes("--check")) {
    if (readFileSync(url, "utf8") !== content) throw Error(`${filename} is stale. Run pnpm catalogue:index.`);
  } else {
    writeFileSync(url, content);
  }
}
