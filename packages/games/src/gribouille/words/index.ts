import type { DrawWordContent } from "../../content/types";
import { gribouilleWords as de } from "./de";
import { gribouilleWords as en } from "./en";
import { gribouilleWords as es } from "./es";
import { gribouilleWords as fr } from "./fr";
import { gribouilleWords as it } from "./it";
import { gribouilleWords as pt } from "./pt";
import { gribouilleWords as ru } from "./ru";

export const GRIBOUILLE_LANGUAGES = ["fr", "en", "es", "it", "de", "pt", "ru"] as const;
export type GribouilleLanguage = (typeof GRIBOUILLE_LANGUAGES)[number];

const WORDS: Readonly<Record<GribouilleLanguage, DrawWordContent>> = { fr, en, es, it, de, pt, ru };

/** Each language has its own bank, written for it: a word is never translated from another one. */
export function gribouilleWordsFor(language: GribouilleLanguage): DrawWordContent {
  return WORDS[language];
}

export function isGribouilleLanguage(value: string): value is GribouilleLanguage {
  return (GRIBOUILLE_LANGUAGES as readonly string[]).includes(value);
}
