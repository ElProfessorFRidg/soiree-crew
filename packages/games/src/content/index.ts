import { bigDeck as enBigDeck } from "./en/bigDeck";
import { drawWords as enDrawWords } from "./en/drawWords";
import { forfeits as enForfeits } from "./en/forfeits";
import { fusePrompts as enFusePrompts } from "./en/fusePrompts";
import { neverEver as enNeverEver } from "./en/neverEver";
import { pointBlank as enPointBlank } from "./en/pointBlank";
import { truthDare as enTruthDare } from "./en/truthDare";
import { verdict as enVerdict } from "./en/verdict";
import { wordPairs as enWordPairs } from "./en/wordPairs";
import { bigDeck as frBigDeck } from "./fr/bigDeck";
import { drawWords as frDrawWords } from "./fr/drawWords";
import { forfeits as frForfeits } from "./fr/forfeits";
import { fusePrompts as frFusePrompts } from "./fr/fusePrompts";
import { neverEver as frNeverEver } from "./fr/neverEver";
import { pointBlank as frPointBlank } from "./fr/pointBlank";
import { truthDare as frTruthDare } from "./fr/truthDare";
import { verdict as frVerdict } from "./fr/verdict";
import { wordPairs as frWordPairs } from "./fr/wordPairs";
import type { GameContent } from "./types";

export type ContentLanguage = "fr" | "en";

const CONTENT: Readonly<Record<ContentLanguage, GameContent>> = {
  fr: {
    bigDeck: frBigDeck,
    pointBlank: frPointBlank,
    neverEver: frNeverEver,
    verdict: frVerdict,
    truthDare: frTruthDare,
    wordPairs: frWordPairs,
    drawWords: frDrawWords,
    fusePrompts: frFusePrompts,
    forfeits: frForfeits,
  },
  en: {
    bigDeck: enBigDeck,
    pointBlank: enPointBlank,
    neverEver: enNeverEver,
    verdict: enVerdict,
    truthDare: enTruthDare,
    wordPairs: enWordPairs,
    drawWords: enDrawWords,
    fusePrompts: enFusePrompts,
    forfeits: enForfeits,
  },
};

/** Each language has its own decks, written for it (O-65, GC-07): there is no fallback from one to the other. */
export function contentFor(language: ContentLanguage): GameContent {
  return CONTENT[language];
}
