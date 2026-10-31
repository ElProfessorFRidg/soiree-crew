import {
  bestScore,
  DRINK_CATALOGUE,
  GROUP_SPECS,
  parseDrinkOrder,
  type CatalogueDrink,
  type DrinkGroup,
  type OrderLine,
  type SizeOption,
} from "@crew/fuzzy";
import { createTranslator, type Translator } from "@/i18n";
import { drinkLabel, strengthText } from "./display";
import { CATALOGUE_PREFIX, type CustomDrink, type DrinkKind, type DrinkPreset } from "./presets";

const FR = createTranslator("fr");
const EN = createTranslator("en");

/** Which brands and sizes a grid tile opens on. */
export const GROUP_OF_KIND: Readonly<Record<DrinkKind, DrinkGroup | null>> = {
  demi: "beer",
  beer: "beer",
  pint: "beer",
  halfPint: "beer",
  wine: "wine",
  largeWine: "wine",
  shot: "spirit",
  double: "spirit",
  cocktail: "cocktail",
  seltzer: "cocktail",
  cider: "cider",
  soft: "soft",
  custom: null,
};

/** Tiles named after their glass: a brand picked under them keeps the tile's size ("Pinte" + Kasteel is a pint). */
export const SIZED_KINDS: ReadonlySet<DrinkKind> = new Set(["demi", "pint", "halfPint", "largeWine", "shot", "double"]);

/** Draught kinds poured from the bar's tap: the house pint strength applies to them. */
const DRAUGHT_KINDS: ReadonlySet<DrinkKind> = new Set(["demi", "pint", "halfPint"]);

export function catalogueLabel(drink: CatalogueDrink, i18n: Translator): string {
  return drink.brand ?? i18n.t(`drinkCatalogue.generic.${drink.generic}`);
}

export function brandsOf(group: DrinkGroup): CatalogueDrink[] {
  return DRINK_CATALOGUE.filter((drink) => drink.group === group);
}

/** A catalogue drink as something to log, at the size and strength picked. */
export function presetFromCatalogue(drink: CatalogueDrink, i18n: Translator, volumeMl = drink.volumeMl, abv = drink.abv): DrinkPreset {
  return {
    id: `${CATALOGUE_PREFIX}${drink.id}`,
    kind: "custom",
    volumeMl,
    abv,
    icon: drink.glass,
    feminine: false,
    name: catalogueLabel(drink, i18n),
  };
}

/** The bar's house strength on a draught pint or demi, when nothing more precise was said. */
export function withHousePint(preset: DrinkPreset, houseAbv: number | null): DrinkPreset {
  return houseAbv !== null && DRAUGHT_KINDS.has(preset.kind) ? { ...preset, abv: houseAbv } : preset;
}

/**
 * A generic drink of this group at this size: the grid's own preset when one has that size ("Demi"
 * for 25 cl), else the tile resized ("Bière", 1 L).
 */
export function genericAt(tile: DrinkPreset, volumeMl: number, abv: number, presets: readonly DrinkPreset[]): DrinkPreset {
  const group = GROUP_OF_KIND[tile.kind];
  if (tile.volumeMl === volumeMl) return { ...tile, abv };
  const sameSize = presets.find((p) => GROUP_OF_KIND[p.kind] === group && p.volumeMl === volumeMl);
  if (sameSize) return { ...sameSize, abv };
  // A pint tile at 1 L is no longer a pint: the group's plain drink, resized.
  const plain = SIZED_KINDS.has(tile.kind) ? (presets.find((p) => GROUP_OF_KIND[p.kind] === group && !SIZED_KINDS.has(p.kind)) ?? tile) : tile;
  return { ...plain, volumeMl, abv };
}

/** One understood line of a typed order, as the drink it logs. */
export function presetFromLine(line: OrderLine<string>, presets: readonly DrinkPreset[], i18n: Translator, houseAbv: number | null): DrinkPreset | null {
  const generic = line.preset ? presets.find((p) => p.id === line.preset) : undefined;
  if (line.drink) return presetFromCatalogue(line.drink, i18n, line.volumeMl ?? line.drink.volumeMl, line.abv ?? line.drink.abv);
  if (!generic) return null;
  const sized = line.volumeMl !== null ? { ...generic, volumeMl: line.volumeMl } : generic;
  return line.abv !== null ? { ...sized, abv: line.abv } : withHousePint(sized, houseAbv);
}

/**
 * The add sheet's reading of what was typed: the user's own drinks and the grid's presets in the
 * user's language, French and English, plus the brand catalogue. Custom drinks come back as presets.
 */
export function readOrder(text: string, presets: readonly DrinkPreset[], i18n: Translator): OrderLine<string>[] {
  const candidates = presets.map((p) => ({
    value: p.id,
    names: p.kind === "custom" ? [p.name ?? ""] : [drinkLabel(p, i18n), drinkLabel(p, FR), drinkLabel(p, EN)],
  }));
  const byId = new Map(presets.map((p) => [p.id, p]));
  return parseDrinkOrder(text, candidates, {
    names: (drink) => (drink.generic ? [catalogueLabel(drink, i18n), catalogueLabel(drink, FR), catalogueLabel(drink, EN)] : []),
    presetVolume: (id) => byId.get(id)?.volumeMl ?? 0,
    presetGroup: (id) => {
      const preset = byId.get(id);
      return preset ? GROUP_OF_KIND[preset.kind] : null;
    },
  });
}

/** Brands for a typed name, best first: "cast" finds Kasteel Rouge. Combos answer to their full name too. */
export function searchCatalogue(query: string, i18n: Translator, limit = 6): CatalogueDrink[] {
  if (!query.trim()) return [];
  return DRINK_CATALOGUE.map((drink) => ({ drink, score: bestScore(query, [catalogueLabel(drink, i18n), catalogueLabel(drink, FR), ...drink.aliases]) }))
    .filter((hit) => Number.isFinite(hit.score) && hit.score <= 1)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((hit) => hit.drink);
}

/**
 * The name a drink gets in "Mes boissons": its own for a brand or a saved drink, the generic name
 * with its strength otherwise ("Pinte 8 %"), so two pints at different strengths stay apart.
 */
export function nameToSave(preset: DrinkPreset, i18n: Translator): string {
  if (preset.kind === "custom") return drinkLabel(preset, i18n);
  return preset.abv > 0 ? `${drinkLabel(preset, i18n)} ${strengthText(preset.abv, i18n)}` : drinkLabel(preset, i18n);
}

/** The saved drink that is this one, same name, size and strength. */
export function savedMatch(preset: DrinkPreset, saved: readonly CustomDrink[], i18n: Translator): CustomDrink | undefined {
  const name = nameToSave(preset, i18n).trim().toLowerCase();
  return saved.find((d) => d.name.trim().toLowerCase() === name && d.volumeMl === preset.volumeMl && Math.abs(d.abv - preset.abv) < 0.0005);
}

/** The chips of a group, with the drink's own value added when the list lacks it (a 40 cl whisky, 8.6 %). */
export function sizeOptions(group: DrinkGroup, ...extra: number[]): SizeOption[] {
  const list: SizeOption[] = [...GROUP_SPECS[group].sizes];
  for (const volumeMl of extra) if (volumeMl > 0 && !list.some((s) => s.volumeMl === volumeMl)) list.push({ volumeMl });
  return list.sort((a, b) => a.volumeMl - b.volumeMl);
}

export function strengthOptions(group: DrinkGroup, ...extra: number[]): number[] {
  const list = [...GROUP_SPECS[group].strengths];
  if (!list.length) return [];
  for (const abv of extra) if (abv > 0 && abv <= GROUP_SPECS[group].maxAbv && !list.some((a) => Math.abs(a - abv) < 0.0005)) list.push(abv);
  return list.sort((a, b) => a - b);
}
