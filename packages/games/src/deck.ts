import type { ForfeitSize, GameLevel } from "./core";
import type { ForfeitContent, Leveled } from "./content/types";
import { shuffle, type Random } from "./random";

export interface LeveledItem<T> {
  /** Stable within one locale: level and position in the content file. */
  id: string;
  level: GameLevel;
  value: T;
}

const BELOW: Record<GameLevel, GameLevel | null> = { normal: null, hard: "normal", extreme: "hard" };

/** Share of a deck taken from the chosen level; the rest comes from the level just below. */
const OWN_SHARE = 0.65;

/**
 * Builds a shuffled deck for a level: mostly cards of that level, topped up with the level below,
 * so Hard still has some breathing room and Extreme is never a wall of the same intensity.
 * `size` null takes everything eligible.
 */
export function leveledDeck<T>(content: Leveled<T>, level: GameLevel, size: number | null, rng: Random, prefix = ""): LeveledItem<T>[] {
  const tag = (lvl: GameLevel) => (value: T, index: number): LeveledItem<T> => ({ id: `${prefix}${lvl}:${index}`, level: lvl, value });
  const own = shuffle(rng, content[level].map(tag(level)));
  const belowLevel = BELOW[level];
  const below = belowLevel ? shuffle(rng, content[belowLevel].map(tag(belowLevel))) : [];
  const wanted = size ?? own.length + below.length;
  const ownCount = belowLevel ? Math.min(own.length, Math.ceil(wanted * OWN_SHARE)) : Math.min(own.length, wanted);
  const picked = own.slice(0, ownCount);
  picked.push(...below.slice(0, wanted - picked.length));
  // Not enough cards below: fill with the rest of the chosen level.
  if (picked.length < wanted) picked.push(...own.slice(ownCount, ownCount + wanted - picked.length));
  return shuffle(rng, picked);
}

export interface CardNames {
  player?: string;
  other?: string;
}

/** Puts player names into a card text. Unknown placeholders stay as they are, so a typo shows up in review. */
export function fillCard(text: string, names: CardNames): string {
  return text.replace(/\{(player|other)\}/g, (match, key: "player" | "other") => names[key] ?? match);
}

/** A forfeit card the size of the penalty it replaces. */
export function drawForfeit(forfeits: ForfeitContent, size: ForfeitSize, rng: Random): string {
  const pool = forfeits[size].length > 0 ? forfeits[size] : forfeits.small;
  return pool[Math.floor(rng.next() * pool.length)] ?? "";
}

export function usesOther(text: string): boolean {
  return text.includes("{other}");
}
