import { useMemo } from "react";
import type { UiLanguage } from "@crew/units";
import { useAppStore } from "@/state/store";
import { en } from "./en";
import { fr } from "./fr";
import type { GameMessageKey, GameMessages, GamePluralKey, PluralForms } from "./types";

export type { GameMessageKey, GamePluralKey } from "./types";

// Same lookup, plural and interpolation rules as src/i18n/index.tsx, on the games catalogues.

const catalogs: Record<UiLanguage, GameMessages> = { fr, en };
const localeTags: Record<UiLanguage, string> = { fr: "fr-FR", en: "en-US" };

type Params = Record<string, string | number>;

function lookup(messages: GameMessages, key: string): unknown {
  let node: unknown = messages;
  for (const part of key.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
  return node;
}

function interpolate(template: string, params: Params | undefined, format: (n: number) => string): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    if (value === undefined) return match;
    return typeof value === "number" ? format(value) : value;
  });
}

export interface GameTranslator {
  language: UiLanguage;
  t: (key: GameMessageKey, params?: Params) => string;
  plural: (key: GamePluralKey, count: number, params?: Params) => string;
}

export function createGameTranslator(language: UiLanguage): GameTranslator {
  const messages = catalogs[language];
  const locale = localeTags[language];
  const rules = new Intl.PluralRules(locale);
  const integer = new Intl.NumberFormat(locale);
  const format = (n: number) => integer.format(n);
  return {
    language,
    t(key, params) {
      const value = lookup(messages, key);
      return typeof value === "string" ? interpolate(value, params, format) : key;
    },
    plural(key, count, params) {
      const forms = lookup(messages, key) as PluralForms | undefined;
      if (!forms) return key;
      return interpolate(rules.select(count) === "one" ? forms.one : forms.other, { count, ...params }, format);
    },
  };
}

/** The games catalogue in the user's language (UserPreferences.language). */
export function useGameT(): GameTranslator {
  const language = useAppStore((s) => s.preferences.language);
  return useMemo(() => createGameTranslator(language), [language]);
}
