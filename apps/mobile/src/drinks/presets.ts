import type { GlassIconName } from "@crew/design-tokens";
import { ML_PER_UK_PINT, ML_PER_US_FL_OZ, type UnitSystem } from "@crew/units";

export type DrinkKind =
  | "demi"
  | "beer"
  | "pint"
  | "halfPint"
  | "wine"
  | "largeWine"
  | "shot"
  | "double"
  | "cocktail"
  | "cider"
  | "seltzer"
  | "soft";

export interface DrinkPreset {
  id: string;
  kind: DrinkKind;
  volumeMl: number;
  /** Fraction, 0.05 for 5 %. */
  abv: number;
  icon: GlassIconName;
  /** French grammatical gender of the label, for "ajouté" / "ajoutée". */
  feminine: boolean;
}

const oz = (n: number) => Math.round(n * ML_PER_US_FL_OZ);

// Sizes per research/bac.md §2.4.1. Strengths are typical values the user can change per drink later.
const METRIC: readonly DrinkPreset[] = [
  { id: "m-demi", kind: "demi", volumeMl: 250, abv: 0.05, icon: "demi", feminine: false },
  { id: "m-beer", kind: "beer", volumeMl: 330, abv: 0.05, icon: "bottle", feminine: true },
  { id: "m-pint", kind: "pint", volumeMl: 500, abv: 0.05, icon: "pint", feminine: true },
  { id: "m-wine", kind: "wine", volumeMl: 120, abv: 0.12, icon: "wine", feminine: false },
  { id: "m-shot", kind: "shot", volumeMl: 30, abv: 0.4, icon: "shot", feminine: false },
  { id: "m-cocktail", kind: "cocktail", volumeMl: 200, abv: 0.1, icon: "cocktail", feminine: false },
  { id: "m-cider", kind: "cider", volumeMl: 330, abv: 0.05, icon: "cider", feminine: false },
  { id: "m-soft", kind: "soft", volumeMl: 330, abv: 0, icon: "soft", feminine: false },
];

const UK: readonly DrinkPreset[] = [
  { id: "uk-half", kind: "halfPint", volumeMl: Math.round(ML_PER_UK_PINT / 2), abv: 0.04, icon: "demi", feminine: true },
  { id: "uk-pint", kind: "pint", volumeMl: Math.round(ML_PER_UK_PINT), abv: 0.04, icon: "pint", feminine: true },
  { id: "uk-bottle", kind: "beer", volumeMl: 330, abv: 0.05, icon: "bottle", feminine: true },
  { id: "uk-wine", kind: "wine", volumeMl: 175, abv: 0.12, icon: "wine", feminine: false },
  { id: "uk-single", kind: "shot", volumeMl: 25, abv: 0.4, icon: "shot", feminine: false },
  { id: "uk-double", kind: "double", volumeMl: 50, abv: 0.4, icon: "shot", feminine: false },
  { id: "uk-cider", kind: "cider", volumeMl: Math.round(ML_PER_UK_PINT), abv: 0.045, icon: "cider", feminine: false },
  { id: "uk-soft", kind: "soft", volumeMl: 330, abv: 0, icon: "soft", feminine: false },
];

const US: readonly DrinkPreset[] = [
  { id: "us-beer", kind: "beer", volumeMl: oz(12), abv: 0.05, icon: "bottle", feminine: true },
  { id: "us-pint", kind: "pint", volumeMl: oz(16), abv: 0.05, icon: "pint", feminine: true },
  { id: "us-wine", kind: "wine", volumeMl: oz(5), abv: 0.12, icon: "wine", feminine: false },
  { id: "us-large-wine", kind: "largeWine", volumeMl: oz(8), abv: 0.12, icon: "wine", feminine: false },
  { id: "us-shot", kind: "shot", volumeMl: oz(1.5), abv: 0.4, icon: "shot", feminine: false },
  { id: "us-cocktail", kind: "cocktail", volumeMl: oz(6), abv: 0.13, icon: "cocktail", feminine: false },
  { id: "us-seltzer", kind: "seltzer", volumeMl: oz(12), abv: 0.05, icon: "can", feminine: false },
  { id: "us-soft", kind: "soft", volumeMl: oz(12), abv: 0, icon: "soft", feminine: false },
];

export function presetsFor(system: UnitSystem): readonly DrinkPreset[] {
  if (system === "us_customary") return US;
  if (system === "uk_imperial") return UK;
  return METRIC;
}

/** The pint in the user's system: what "Encore une pinte" logs before any drink exists. */
export function defaultPreset(system: UnitSystem): DrinkPreset {
  const presets = presetsFor(system);
  return presets.find((preset) => preset.kind === "pint") ?? presets[0]!;
}

export function findPreset(id: string): DrinkPreset | undefined {
  return [...METRIC, ...UK, ...US].find((preset) => preset.id === id);
}
