import { convertVolume, formatVolume, toMillilitres, type VolumeUnit } from "@crew/units";

/**
 * O-21, a mixed glass: half whisky, half rum, topped with cola. A saved drink keeps its recipe;
 * what is logged stays one entry with a volume and a strength, so the BAC estimate reads the same
 * grams of alcohol as the pours added up one by one. Pure, so the maths is tested on its own.
 */

/** One pour of the glass: a spirit, or the soft it is topped with (abv 0). */
export interface DrinkPart {
  name: string;
  volumeMl: number;
  /** Fraction, 0.4 for 40 %; 0 for the soft. */
  abv: number;
}

/** A spirit row of the editor, in the user's menu unit (cl, fl oz or ml). */
export interface Pour {
  key: string;
  name: string;
  volume: number;
  /** Tenths of a percent, so 37.5 % is exact. */
  abvTenths: number;
}

/** The editor's mixed glass: one or more spirits, and the soft that tops them up (0 for none). */
export interface Mix {
  pours: Pour[];
  softName: string;
  softVolume: number;
}

export const MIX_BOUNDS = {
  pours: 4,
  /** A spirit row starts at half a percent: 0 % is the soft's line. */
  pourAbvTenths: { min: 5, max: 800 },
  pourMl: { min: 10, max: 300 },
  softMl: { max: 1000 },
} as const;

/** What a new mixed glass starts from: one spirit pour and a long drink's worth of soft. */
const DEFAULT_POUR_ML = 40;
const DEFAULT_SOFT_ML = 200;
const DEFAULT_ABV_TENTHS = 400;

/** Steppers of the pours: a cl, half an ounce, 5 ml. The soft moves in bigger steps. */
export function pourStep(unit: VolumeUnit): number {
  if (unit === "us_fl_oz" || unit === "uk_fl_oz") return 0.5;
  return unit === "ml" ? 5 : 1;
}

export function softStep(unit: VolumeUnit): number {
  return unit === "ml" ? 25 : 1;
}

/** Millilitres in the unit, on the stepper's grid. */
export function toStep(ml: number, unit: VolumeUnit, step: number): number {
  return Number((Math.round(convertVolume(ml, unit) / step) * step).toFixed(1));
}

let nextKey = 0;
const pourKey = () => `pour-${(nextKey += 1)}`;

export function newPour(unit: VolumeUnit, from?: Partial<DrinkPart>): Pour {
  return {
    key: pourKey(),
    name: from?.name ?? "",
    volume: Math.max(toStep(MIX_BOUNDS.pourMl.min, unit, pourStep(unit)), toStep(from?.volumeMl ?? DEFAULT_POUR_ML, unit, pourStep(unit))),
    abvTenths: from?.abv !== undefined ? Math.round(from.abv * 1000) : DEFAULT_ABV_TENTHS,
  };
}

export function defaultMix(unit: VolumeUnit, first?: Partial<DrinkPart>): Mix {
  return { pours: [newPour(unit, first)], softName: "", softVolume: toStep(DEFAULT_SOFT_ML, unit, softStep(unit)) };
}

/** Volume is the sum of the pours; strength is the pure alcohol over that volume. */
export function mixTotals(parts: readonly DrinkPart[]): { volumeMl: number; abv: number } {
  const volumeMl = parts.reduce((sum, part) => sum + part.volumeMl, 0);
  const alcoholMl = parts.reduce((sum, part) => sum + part.volumeMl * part.abv, 0);
  // Five decimals: the grams of alcohol stay exact to a hundredth of a millilitre.
  return { volumeMl, abv: volumeMl > 0 ? Math.round((alcoholMl / volumeMl) * 100_000) / 100_000 : 0 };
}

/** The editor's rows as stored parts, in whole millilitres; a soft of 0 is left out. */
export function mixToParts(mix: Mix, unit: VolumeUnit): DrinkPart[] {
  const parts: DrinkPart[] = mix.pours.map((pour) => ({ name: pour.name.trim(), volumeMl: Math.round(toMillilitres(pour.volume, unit)), abv: pour.abvTenths / 1000 }));
  if (mix.softVolume > 0) parts.push({ name: mix.softName.trim(), volumeMl: Math.round(toMillilitres(mix.softVolume, unit)), abv: 0 });
  return parts;
}

/** A saved recipe back in the editor; several softs (none made here) become one line. */
export function partsToMix(parts: readonly DrinkPart[], unit: VolumeUnit): Mix {
  const spirits = parts.filter((part) => part.abv > 0);
  const softs = parts.filter((part) => part.abv <= 0);
  return {
    pours: spirits.map((part) => newPour(unit, part)),
    softName: softs.map((part) => part.name).filter(Boolean).join(", ").slice(0, 40),
    softVolume: toStep(softs.reduce((sum, part) => sum + part.volumeMl, 0), unit, softStep(unit)),
  };
}

/**
 * "Moitié-moitié": two spirits poured alike. From one pour, a second one of the same size joins it
 * (4 cl of whisky, then 4 cl of rum); from several, the first two share what was poured.
 */
export function halfAndHalf(mix: Mix, unit: VolumeUnit): Mix {
  const step = pourStep(unit);
  const [first, second] = mix.pours;
  if (!first) return mix;
  const each = second ? Math.max(step, Math.round(mix.pours.reduce((sum, pour) => sum + pour.volume, 0) / 2 / step) * step) : first.volume;
  const half = Number(each.toFixed(1));
  return { ...mix, pours: [{ ...first, volume: half }, { ...(second ?? newPour(unit, { abv: first.abvTenths / 1000 })), volume: half }] };
}

/** The recipe stored on an older or a foreign copy: kept only when every pour makes sense. */
export function readParts(drink: { parts?: unknown }): DrinkPart[] | null {
  const parts = drink.parts;
  if (!Array.isArray(parts) || parts.length === 0) return null;
  const valid = parts.every(
    (part: unknown) =>
      typeof part === "object" &&
      part !== null &&
      typeof (part as DrinkPart).name === "string" &&
      Number.isFinite((part as DrinkPart).volumeMl) &&
      (part as DrinkPart).volumeMl > 0 &&
      Number.isFinite((part as DrinkPart).abv) &&
      (part as DrinkPart).abv >= 0 &&
      (part as DrinkPart).abv <= 1,
  );
  return valid && parts.some((part: DrinkPart) => part.abv > 0) ? (parts as DrinkPart[]) : null;
}

/** "Whisky 4 cl, Rhum 4 cl, Cola 20 cl". A pour without a name takes `unnamed`, the soft `soft`. */
export function recipeText(parts: readonly DrinkPart[], unit: VolumeUnit, locale: string, labels: { unnamed: string; soft: string }): string {
  const suffix = unit === "us_fl_oz" || unit === "uk_fl_oz" ? "oz" : unit;
  return parts
    .map((part) => `${part.name || (part.abv > 0 ? labels.unnamed : labels.soft)} ${formatVolume(part.volumeMl, unit, locale)} ${suffix}`)
    .join(", ");
}

/** A name for a glass left unnamed: its pours as typed, "Whisky + Rhum + Cola". */
export function nameFromParts(parts: readonly DrinkPart[]): string {
  return parts
    .map((part) => part.name.trim())
    .filter(Boolean)
    .join(" + ")
    .slice(0, 40)
    .trim();
}
