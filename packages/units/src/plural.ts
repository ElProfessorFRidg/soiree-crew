import type { UiLanguage } from "./preferences";

export type PluralCategory = "one" | "few" | "many" | "other";

/**
 * CLDR cardinal plural categories for the app's languages. Hermes on iOS has no Intl.PluralRules,
 * so the app carries the rules itself; every platform then agrees on "1 verre" / "2 verres".
 * Large-number "many" forms (French and Spanish millions) are left to "other".
 */
export function pluralCategory(language: UiLanguage, count: number): PluralCategory {
  const n = Math.abs(count);
  const integer = Number.isInteger(n);
  switch (language) {
    case "fr":
      // i = 0 or 1: "0 verre", "1,5 verre".
      return n < 2 ? "one" : "other";
    case "ru": {
      if (!integer) return "other";
      const mod10 = n % 10;
      const mod100 = n % 100;
      if (mod10 === 1 && mod100 !== 11) return "one";
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
      return "many";
    }
    default:
      // en, es, it, de, pt (Portugal): one only for exactly 1.
      return n === 1 ? "one" : "other";
  }
}
