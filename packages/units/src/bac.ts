/** Every BAC display unit used by a supported country's law. Storage is always g/L of blood. */
export type BacUnit =
  | "g_per_l_blood"
  | "mg_per_l_breath"
  | "percent_bac"
  | "mg_per_100ml_blood"
  | "ug_per_100ml_breath"
  | "ug_per_l_breath"
  | "permille";

interface UnitSpec {
  /** Converts g/L of blood to this unit. */
  fromBlood: (gPerL: number, breathRatio: number) => number;
  fractionDigits: number;
}

const SPECS: Record<BacUnit, UnitSpec> = {
  g_per_l_blood: { fromBlood: (c) => c, fractionDigits: 2 },
  mg_per_l_breath: { fromBlood: (c, ratio) => (1000 * c) / ratio, fractionDigits: 2 },
  percent_bac: { fromBlood: (c) => c / 10, fractionDigits: 3 },
  mg_per_100ml_blood: { fromBlood: (c) => 100 * c, fractionDigits: 0 },
  ug_per_100ml_breath: { fromBlood: (c, ratio) => (100_000 * c) / ratio, fractionDigits: 0 },
  ug_per_l_breath: { fromBlood: (c, ratio) => (1_000_000 * c) / ratio, fractionDigits: 0 },
  // Per mille is shown as g/L: the mass/volume difference (about 5 %) is far below the model's uncertainty.
  permille: { fromBlood: (c) => c, fractionDigits: 2 },
};

export function convertBac(gPerLBlood: number, unit: BacUnit, breathRatio: number): number {
  return SPECS[unit].fromBlood(Math.max(0, gPerLBlood), breathRatio);
}

export function bacFractionDigits(unit: BacUnit): number {
  return SPECS[unit].fractionDigits;
}

/** Number only, in the user's locale ("0,25" in French). The unit label lives in the translation files. */
export function formatBacValue(gPerLBlood: number, unit: BacUnit, breathRatio: number, locale: string): string {
  const digits = bacFractionDigits(unit);
  const value = convertBac(gPerLBlood, unit, breathRatio);
  // Values under the display zero read as 0, never as "-0,00" or "0,004".
  const shown = gPerLBlood < 0.005 ? 0 : value;
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(shown);
}
