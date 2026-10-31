import { convertBac, formatBacValue, formatVolume, type BacUnit, type CountryRules, type VolumeUnit } from "@crew/units";
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

interface Labelled {
  kind: DrinkKind;
  name?: string;
}

export function drinkLabel(drink: Labelled, i18n: Translator): string {
  return drink.kind === "custom" ? (drink.name ?? i18n.t("drinks.custom")) : i18n.t(`drinks.${drink.kind}`);
}

export function againLabel(drink: Labelled, i18n: Translator): string {
  if (drink.kind === "custom") return i18n.t("party.againNamed", { name: drinkLabel(drink, i18n) });
  return i18n.t("party.again", { article: i18n.t(`drinks.again.${drink.kind}`) });
}

/** "une pinte", "a pint", or the custom drink's own name. */
export function drinkWithArticle(drink: Labelled, i18n: Translator): string {
  return drink.kind === "custom" ? drinkLabel(drink, i18n) : i18n.t(`drinks.article.${drink.kind}`);
}

/** "8 %", "8,5 %", "37,5 %": tenths only when the label has them. */
export function strengthText(abv: number, i18n: Translator): string {
  const tenths = Math.round(abv * 1000);
  return i18n.t("drinkCatalogue.abv", { value: i18n.number(tenths / 10, tenths % 10 === 0 ? 0 : 1) });
}

/** "50 cl", "1 L", "16 oz", in the user's drink unit. */
export function sizeText(volumeMl: number, unit: VolumeUnit, i18n: Translator): string {
  if (unit === "cl" && volumeMl >= 1000 && volumeMl % 500 === 0) {
    return i18n.t("drinkCatalogue.litres", { value: new Intl.NumberFormat(i18n.locale, { maximumFractionDigits: 1 }).format(volumeMl / 1000) });
  }
  return `${formatVolume(volumeMl, unit, i18n.locale)} ${unit === "us_fl_oz" ? "oz" : unit}`;
}

/** "50 cl, 8 %", or the size alone for a soft drink. */
export function sizeAndStrength(drink: { volumeMl: number; abv: number }, unit: VolumeUnit, i18n: Translator): string {
  const size = sizeText(drink.volumeMl, unit, i18n);
  return drink.abv > 0 ? i18n.t("drinkCatalogue.sizeAndStrength", { size, abv: strengthText(drink.abv, i18n) }) : size;
}

export { convertBac };
