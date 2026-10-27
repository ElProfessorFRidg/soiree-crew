import type { UiLanguage } from "@crew/units";
import { barEn } from "./en";
import { barFr } from "./fr";

export type BarText = typeof barFr;

/** Recipes are written in French and English; other languages read the English ones. */
export function barText(language: UiLanguage): BarText {
  return language === "fr" ? barFr : (barEn as BarText);
}
