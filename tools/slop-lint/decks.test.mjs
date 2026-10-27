import { describe, expect, it } from "vitest";
import { checkDeck, mixedApostrophes } from "./decks.mjs";

const rules = (cards, options) => checkDeck(cards, options).map((f) => f.rule);

describe("R-20 deck lint", () => {
  it("caps a repeated opening", () => {
    const cards = Array.from({ length: 40 }, (_, i) =>
      i < 6 ? `Who is most likely to forget item ${i}?` : `${"x".repeat((i % 7) * 9 + 5)} card ${i}`,
    );
    expect(rules(cards)).toContain("GC-01 opening cap");
  });

  it("fails a deck where every card has the same length", () => {
    const cards = Array.from({ length: 20 }, (_, i) => `Card number ${String(i).padStart(2, "0")} says the same.`);
    expect(rules(cards)).toContain("GC-04 length spread");
    expect(rules(cards, { lengthSpread: false })).not.toContain("GC-04 length spread");
  });

  it("finds near duplicates and moralising cards", () => {
    expect(rules(["Show the last photo in your gallery", "Show the last photo in your gallery now"])).toContain("GC-10 near duplicate");
    expect(rules(["Do ten squats, and remember to drink water"])).toContain("GC-09 moralising");
    expect(rules(["Fais dix pompes, avec modération"])).toContain("GC-09 moralising");
  });

  it("passes a varied deck", () => {
    const cards = [
      "Moonwalk. Now.",
      "Read your weekly screen time report out loud like it's a eulogy.",
      "Show the oldest selfie on your phone.",
      "Give a one-minute TED talk on the snack closest to you.",
      "Do the robot until someone laughs.",
      "Call the last person you texted and pitch them the snack closest to you in the voice of a late-night infomercial host.",
      "Not one word until your next turn.",
      "Speak only in movie quotes.",
      "Describe your last relationship using only food.",
      "Thumb war with {other}.",
    ];
    expect(checkDeck(cards).filter((f) => f.severity === "error")).toEqual([]);
  });

  it("flags a file mixing straight and curly apostrophes", () => {
    expect(mixedApostrophes(["l'apéro", "aujourd’hui"])).toBe(true);
    expect(mixedApostrophes(["l'apéro", "aujourd'hui"])).toBe(false);
  });
});
