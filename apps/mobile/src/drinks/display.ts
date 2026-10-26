import { convertBac, formatBacValue, type BacUnit, type CountryRules } from "@crew/units";
import { palette } from "@crew/design-tokens";
import type { Translator } from "@/i18n";
import type { DrinkKind } from "./presets";

export interface BacText {
  value: string;
  unit: string;
}

export function bacText(gPerL: number, unit: BacUnit, ratio: number, i18n: Translator): BacText {
  return { value: formatBacValue(gPerL, unit, ratio, i18n.locale), unit: i18n.t(`units.${unit}`) };
}

/** The other unit the country uses, shown under the BAC ("soit 0,21 mg/L d'air"). */
export function alternateUnit(rules: CountryRules, current: BacUnit): BacUnit | null {
  return rules.bacUnits.find((unit) => unit !== current) ?? null;
}

/** Units the user can flip through by tapping the BAC: the country's, then g/L and mg/L. */
export function unitCycle(rules: CountryRules, preferred: BacUnit): BacUnit[] {
  const units: BacUnit[] = [preferred];
  for (const unit of [...rules.bacUnits, "g_per_l_blood", "mg_per_l_breath"] as BacUnit[]) {
    if (!units.includes(unit)) units.push(unit);
  }
  return units.slice(0, 2);
}

/**
 * Curve and number colour by threshold (O-24): bands at 0.25 and 0.60 mg/L of
 * breath (0.50 and 1.20 g/L of blood), with the low band starting at the user's
 * own legal limit when it is lower, so nobody over their limit sees the safe colour.
 */
export function bacColor(gPerL: number, legalLimit: number): string {
  const lowBandTop = Math.min(0.5, legalLimit > 0 ? legalLimit : 0.005);
  if (gPerL < lowBandTop) return palette.bacThreshold.low;
  if (gPerL < 1.2) return palette.bacThreshold.mid;
  return palette.bacThreshold.high;
}

export function drinkLabel(kind: DrinkKind, i18n: Translator): string {
  return i18n.t(`drinks.${kind}`);
}

export function againLabel(kind: DrinkKind, i18n: Translator): string {
  return i18n.t("party.again", { article: i18n.t(`drinks.again.${kind}` as const) });
}

export { convertBac };
