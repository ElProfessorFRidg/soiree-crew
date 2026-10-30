import { describe, expect, it } from "vitest";
import { pluralCategory } from "./plural";

describe("pluralCategory (CLDR cardinals, no Intl.PluralRules on iOS)", () => {
  it("matches Intl.PluralRules wherever Node has it", () => {
    const tags = { fr: "fr-FR", en: "en-GB", es: "es-ES", it: "it-IT", de: "de-DE", pt: "pt-PT", ru: "ru-RU" } as const;
    for (const [language, tag] of Object.entries(tags) as [keyof typeof tags, string][]) {
      const rules = new Intl.PluralRules(tag);
      for (const n of [0, 1, 2, 3, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111, 1.5, 0.5]) {
        expect([language, n, pluralCategory(language, n)]).toEqual([language, n, rules.select(n)]);
      }
    }
  });
});
