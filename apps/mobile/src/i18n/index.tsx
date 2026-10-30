import { createContext, useContext, useMemo, type ReactNode } from "react";
import { getLocales } from "expo-localization";
import type { UiLanguage } from "@crew/units";
import { de } from "./de";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { it } from "./it";
import { pt } from "./pt";
import { ru } from "./ru";
import type { MessageKey, Messages, PluralForms, PluralKey } from "./types";
import { pluralCategory } from "@crew/units";

export type { MessageKey, PluralKey } from "./types";

const catalogs: Record<UiLanguage, Messages> = { fr, en, es, it, de, pt, ru };
export const localeTags: Record<UiLanguage, string> = { fr: "fr-FR", en: "en-GB", es: "es-ES", it: "it-IT", de: "de-DE", pt: "pt-PT", ru: "ru-RU" };

/**
 * PREF-02: dates and numbers follow the phone's region, not only the app's language: English on a
 * US phone writes 11/7, on a UK phone 07/11. The phone's own locale for that language wins (it carries
 * the region the user chose), then the language with the phone's region if the runtime knows it.
 */
export function regionalLocale(language: UiLanguage): string {
  try {
    const locales = getLocales();
    const own = locales.find((l) => l.languageCode?.toLowerCase() === language && l.regionCode);
    const candidates = [own ? `${language}-${own.regionCode!.toUpperCase()}` : null, locales[0]?.regionCode ? `${language}-${locales[0].regionCode.toUpperCase()}` : null];
    for (const tag of candidates) {
      // Only a region the runtime has data for: "en-XX" without it would fall back to US formats.
      if (tag && new Intl.DateTimeFormat(tag).resolvedOptions().locale.toLowerCase() === tag.toLowerCase()) return tag;
    }
  } catch {
    // No locale data (an old runtime): the language's usual region below.
  }
  return localeTags[language];
}

type Params = Record<string, string | number>;

function lookup(messages: Messages, key: string): unknown {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    node = (node as Record<string, unknown> | undefined)?.[part];
  }
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

export interface Translator {
  language: UiLanguage;
  locale: string;
  t: (key: MessageKey, params?: Params) => string;
  plural: (key: PluralKey, count: number, params?: Params) => string;
  number: (value: number, digits?: number) => string;
}

export function createTranslator(language: UiLanguage): Translator {
  const messages = catalogs[language];
  const locale = regionalLocale(language);
  const integer = new Intl.NumberFormat(locale);
  const number = (value: number, digits = 0) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  const formatParam = (n: number) => integer.format(n);

  return {
    language,
    locale,
    number,
    t(key, params) {
      const value = lookup(messages, key);
      // A missing key is a build-time error through MessageKey; at runtime show the key, never a blank.
      return typeof value === "string" ? interpolate(value, params, formatParam) : key;
    },
    plural(key, count, params) {
      const forms = lookup(messages, key) as PluralForms | undefined;
      if (!forms) return key;
      const category = pluralCategory(language, count);
      const template = forms[category] ?? forms.other;
      return interpolate(template, { count, ...params }, formatParam);
    },
  };
}

const I18nContext = createContext<Translator>(createTranslator("fr"));

export function I18nProvider({ language, children }: { language: UiLanguage; children: ReactNode }) {
  const translator = useMemo(() => createTranslator(language), [language]);
  return <I18nContext.Provider value={translator}>{children}</I18nContext.Provider>;
}

export function useT(): Translator {
  return useContext(I18nContext);
}
