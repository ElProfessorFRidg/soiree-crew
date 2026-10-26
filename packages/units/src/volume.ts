import type { UnitSystem } from "./countries";

export const ML_PER_US_FL_OZ = 29.5735;
export const ML_PER_UK_FL_OZ = 28.4131;
export const ML_PER_UK_PINT = 568.261;
export const ML_PER_US_PINT = 473.176;
/** A "pinte" in a French bar. */
export const ML_PER_FR_PINT = 500;

export type VolumeUnit = "cl" | "ml" | "us_fl_oz" | "uk_fl_oz" | "uk_pint";

export function convertVolume(ml: number, unit: VolumeUnit): number {
  switch (unit) {
    case "cl":
      return ml / 10;
    case "ml":
      return ml;
    case "us_fl_oz":
      return ml / ML_PER_US_FL_OZ;
    case "uk_fl_oz":
      return ml / ML_PER_UK_FL_OZ;
    case "uk_pint":
      return ml / ML_PER_UK_PINT;
  }
}

export function toMillilitres(value: number, unit: VolumeUnit): number {
  return value / convertVolume(1, unit);
}

/** Drink-size unit people read on menus in each system. */
export function drinkVolumeUnit(system: UnitSystem): VolumeUnit {
  if (system === "us_customary") return "us_fl_oz";
  if (system === "uk_imperial") return "ml";
  return "cl";
}

export function formatVolume(ml: number, unit: VolumeUnit, locale: string): string {
  const value = convertVolume(ml, unit);
  const digits = unit === "ml" || Number.isInteger(Math.round(value * 10) / 10) ? 0 : 1;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
}

export const KG_PER_LB = 0.45359237;

export function toKilograms(value: number, unit: "kg" | "lb"): number {
  return unit === "kg" ? value : value * KG_PER_LB;
}

export function fromKilograms(kg: number, unit: "kg" | "lb"): number {
  return unit === "kg" ? kg : kg / KG_PER_LB;
}
