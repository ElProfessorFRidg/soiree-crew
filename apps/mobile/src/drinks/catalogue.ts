import {
  bestScore,
  countryRank,
  normalise,
  DRINK_CATALOGUE,
  GROUP_SPECS,
  sizesFor,
  parseDrinkOrder,
  type CatalogueDrink,
  type DrinkGroup,
  type OrderLine,
  type SizeOption,
} from "@crew/fuzzy";
import { createTranslator, type Translator } from "@/i18n";
import { useAppStore } from "@/state/store";
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

/** The group's brands, those known in the user's country first (the order of the list otherwise). */
export function brandsOf(group: DrinkGroup, country?: string | null): CatalogueDrink[] {
  return DRINK_CATALOGUE.filter((drink) => drink.group === group)
    .map((drink, index) => ({ drink, index, rank: countryRank(drink, country) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((hit) => hit.drink);
}

/** Brands of the group whose name or nickname is close to what was typed, typos forgiven. */
export function filterBrands(brands: readonly CatalogueDrink[], query: string, i18n: Translator): CatalogueDrink[] {
  if (!query.trim()) return [...brands];
  return brands
    .map((drink) => ({ drink, score: bestScore(query, [catalogueLabel(drink, i18n), catalogueLabel(drink, FR), ...drink.aliases]) }))
    .filter((hit) => Number.isFinite(hit.score) && hit.score <= MAX_SCORE)
    .sort((a, b) => a.score - b.score)
    .map((hit) => hit.drink);
}

/** How far a name may be from what was typed: a word of slips, or one real typo per short word. */
const MAX_SCORE = 1.5;

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
/** Spellings learnt from picked guesses, at most this many: the oldest go first. */
const MAX_LEARNED = 300;

/** ADP-05: the person picked this drink for what they typed; next time the word is read exactly. */
export function learnSpelling(typed: string, drinkId: string): void {
  const key = normalise(typed);
  if (key.length < 3) return;
  const current = useAppStore.getState().learnedSpellings;
  if (current[key] === drinkId) return;
  const entries = Object.entries(current).filter(([word]) => word !== key);
  useAppStore.setState({ learnedSpellings: Object.fromEntries([...entries.slice(-(MAX_LEARNED - 1)), [key, drinkId]]) });
}

/**
 * Between near ties, the drink this person logs most comes first (up to 0.2), then one known in
 * their country (0.1). Read from this phone's own history; it never turns a far name into a match.
 */
function habitBonus(): (drink: CatalogueDrink) => number {
  const { drinks, preferences } = useAppStore.getState();
  const counts = new Map<string, number>();
  for (const entry of drinks.slice(-400)) {
    if (entry.presetId.startsWith(CATALOGUE_PREFIX)) {
      const id = entry.presetId.slice(CATALOGUE_PREFIX.length);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const most = Math.max(1, ...counts.values());
  return (drink) => ((counts.get(drink.id) ?? 0) / most) * 0.2 + (countryRank(drink, preferences.legalCountry) === 0 ? 0.1 : 0);
}

export function readOrder(text: string, presets: readonly DrinkPreset[], i18n: Translator): OrderLine<string>[] {
  const learned = new Map<string, string[]>();
  for (const [word, id] of Object.entries(useAppStore.getState().learnedSpellings)) learned.set(id, [...(learned.get(id) ?? []), word]);
  const candidates = presets.map((p) => ({
    value: p.id,
    names: p.kind === "custom" ? [p.name ?? ""] : [drinkLabel(p, i18n), drinkLabel(p, FR), drinkLabel(p, EN)],
  }));
  const byId = new Map(presets.map((p) => [p.id, p]));
  return parseDrinkOrder(text, candidates, {
    names: (drink) => [...(drink.generic ? [catalogueLabel(drink, i18n), catalogueLabel(drink, FR), catalogueLabel(drink, EN)] : []), ...(learned.get(drink.id) ?? [])],
    bonus: habitBonus(),
    presetVolume: (id) => byId.get(id)?.volumeMl ?? 0,
    presetGroup: (id) => {
      const preset = byId.get(id);
      return preset ? GROUP_OF_KIND[preset.kind] : null;
    },
  });
}

/**
 * Brands for a typed name, best first: "cast" finds Kasteel Rouge, "abslut" Absolut, "jqck" Jack
 * Daniel's (a neighbouring key). At equal distance, a drink known in the user's country comes first.
 */
export function searchCatalogue(query: string, i18n: Translator, limit = 6, country?: string | null): CatalogueDrink[] {
  if (!query.trim()) return [];
  return DRINK_CATALOGUE.map((drink) => ({ drink, score: bestScore(query, [catalogueLabel(drink, i18n), catalogueLabel(drink, FR), ...drink.aliases]) + countryRank(drink, country) * 0.3 }))
    .filter((hit) => Number.isFinite(hit.score) && hit.score <= MAX_SCORE)
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

/**
 * The size chips of a group in the user's country (a British pint, a Spanish caña), with the
 * sizes the brand comes in and the drink's own value added when the list lacks them.
 */
export function sizeOptions(group: DrinkGroup, country: string | null | undefined, ...extra: number[]): SizeOption[] {
  const list: SizeOption[] = sizesFor(group, country);
  for (const volumeMl of extra) if (volumeMl > 0 && !list.some((s) => s.volumeMl === volumeMl)) list.push({ volumeMl });
  return list.sort((a, b) => a.volumeMl - b.volumeMl);
}

export function strengthOptions(group: DrinkGroup, ...extra: number[]): number[] {
  const list = [...GROUP_SPECS[group].strengths];
  if (!list.length) return [];
  for (const abv of extra) if (abv > 0 && abv <= GROUP_SPECS[group].maxAbv && !list.some((a) => Math.abs(a - abv) < 0.0005)) list.push(abv);
  return list.sort((a, b) => a - b);
}
