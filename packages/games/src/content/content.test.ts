import { describe, expect, it } from "vitest";
import { GAME_LEVELS } from "../core";
import { contentFor, type ContentLanguage } from "./index";
import type { GameContent, Leveled } from "./types";

const LANGUAGES: ContentLanguage[] = ["fr", "en"];

function leveledCount<T>(deck: Leveled<T>): number {
  return GAME_LEVELS.reduce((sum, level) => sum + deck[level].length, 0);
}

/**
 * Cards, questions and dares counted by O-65: the written prompts of the card games. Word pairs and
 * drawing words are single words, so they do not count towards the 500.
 */
function countO65(content: GameContent): number {
  const bigDeck = Object.values(content.bigDeck).reduce((sum, deck) => sum + leveledCount(deck), 0);
  return (
    bigDeck +
    leveledCount(content.pointBlank.open) +
    content.pointBlank.secret.length +
    leveledCount(content.neverEver) +
    leveledCount(content.verdict) +
    leveledCount(content.truthDare.truth) +
    leveledCount(content.truthDare.dare)
  );
}

function allTexts(content: GameContent): string[] {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === "string") out.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === "object") Object.values(node).forEach(walk);
  };
  walk(content);
  return out;
}

describe.each(LANGUAGES)("%s content", (language) => {
  const content = contentFor(language);

  it("has more than 500 cards, questions and dares (O-65)", () => {
    expect(countO65(content)).toBeGreaterThan(500);
  });

  it("has cards at every level of every deck", () => {
    const decks: Leveled<unknown>[] = [
      ...Object.values(content.bigDeck),
      content.pointBlank.open,
      content.neverEver,
      content.verdict,
      content.truthDare.truth,
      content.truthDare.dare,
      content.wordPairs,
      content.drawWords,
      content.fusePrompts,
    ];
    for (const deck of decks) for (const level of GAME_LEVELS) expect(deck[level].length).toBeGreaterThan(0);
    for (const size of ["small", "medium", "large"] as const) expect(content.forfeits[size].length).toBeGreaterThan(0);
  });

  it("only uses the placeholders the engines fill", () => {
    for (const text of allTexts(content)) {
      for (const match of text.matchAll(/\{([^}]*)\}/g)) expect(["player", "other"]).toContain(match[1]);
    }
  });

  it("never puts the same word on both sides of a pair", () => {
    for (const level of GAME_LEVELS) {
      for (const [crew, other] of content.wordPairs[level]) expect(crew.toLocaleLowerCase()).not.toBe(other.toLocaleLowerCase());
    }
  });

  it("has no dash used as a pause and no straight double quote", () => {
    for (const text of allTexts(content)) {
      expect(text).not.toMatch(/[‒-―]/);
      expect(text).not.toMatch(/"/);
    }
  });
});

describe("decks per language", () => {
  it("are written separately: no French card appears in the English deck", () => {
    const fr = new Set(allTexts(contentFor("fr")).map((t) => t.toLocaleLowerCase()));
    // Proper nouns used as words (brands, cities) may legitimately appear in both.
    const shared = allTexts(contentFor("en")).filter((t) => fr.has(t.toLocaleLowerCase()) && t.includes(" "));
    expect(shared).toEqual([]);
  });
});
