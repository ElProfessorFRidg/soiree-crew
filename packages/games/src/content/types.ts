// Shapes of the localised content files (O-65). Each locale has one file per game, with no runtime import,
// so tools/slop-lint can load them directly with Node's type stripping.

import type { ForfeitSize, GameLevel } from "../core";

export type Leveled<T> = Readonly<Record<GameLevel, readonly T[]>>;

/** Card texts may use {player} (whose turn it is) and {other} (another player, drawn by the engine). */
export interface BigDeckContent {
  dare: Leveled<string>;
  rule: Leveled<string>;
  vote: Leveled<string>;
  minigame: Leveled<string>;
}

/** Questions everyone answers by pointing. `secret` cards are only read by the reader (Extreme). */
export interface PointBlankContent {
  open: Leveled<string>;
  secret: readonly string[];
}

/** Completes the game's prompt (« Je n'ai jamais... », "Never have I ever..."). */
export type NeverEverContent = Leveled<string>;

/** Completes "Which of these two...". */
export type VerdictContent = Leveled<string>;

export interface TruthDareContent {
  truth: Leveled<string>;
  dare: Leveled<string>;
}

/** [word of the crew, word of the intruder or mole, category shown as the Normal hint]. Level = how close the words are. */
export type WordPair = readonly [crew: string, other: string, category: string];
export type WordPairContent = Leveled<WordPair>;

export type DrawWordContent = Leveled<string>;

/** A category (Normal), a sound to fit in the word (Hard), or a category with a twist (Extreme). */
export type FusePromptContent = Leveled<string>;

/** Non-drinking alternatives to a penalty, sized to the sips they replace. */
export type ForfeitContent = Readonly<Record<ForfeitSize, readonly string[]>>;

export interface GameContent {
  bigDeck: BigDeckContent;
  pointBlank: PointBlankContent;
  neverEver: NeverEverContent;
  verdict: VerdictContent;
  truthDare: TruthDareContent;
  wordPairs: WordPairContent;
  drawWords: DrawWordContent;
  fusePrompts: FusePromptContent;
  forfeits: ForfeitContent;
}
