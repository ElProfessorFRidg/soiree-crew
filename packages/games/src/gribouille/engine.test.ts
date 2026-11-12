import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import {
  GRIBOUILLE_PRESENCE_MS,
  GRIBOUILLE_REVEAL_MS,
  GribouilleError,
  addGribouilleStrokes,
  advanceGribouille,
  coalesceDrawingEvents,
  createGribouille,
  guessGribouille,
  joinGribouille,
  judgeGuess,
  leaveGribouille,
  startGribouille,
  swapGribouilleWord,
  touchGribouille,
  viewGribouille,
  wordMask,
  type GribouilleRoom,
} from "./engine";
import { GRIBOUILLE_LANGUAGES, gribouilleWordsFor } from "./words";

const rng = () => seededRandom(7);
const T0 = 1_000_000;

function lobby(names: string[], rounds = 1): GribouilleRoom {
  const room = createGribouille({ id: "r", code: "ABCD", hostId: names[0] as string, hostName: names[0] as string, crewId: null, language: "en", level: "normal", rounds, now: T0 });
  for (const n of names.slice(1)) joinGribouille(room, n, n, T0);
  return room;
}
function started(names = ["a", "b", "c"], rounds = 1): GribouilleRoom {
  const room = lobby(names, rounds);
  startGribouille(room, names[0] as string, T0, rng());
  return room;
}
/** Everybody pings, as phones polling do. */
const ping = (room: GribouilleRoom, now: number) => {
  for (const p of room.players) if (!p.left) touchGribouille(room, p.id, now);
};
const guessersOf = (room: GribouilleRoom) => room.players.filter((p) => p.id !== room.turn!.drawerId).map((p) => p.id);

describe("word banks", () => {
  it("exist in all 7 languages with no repeats and no dashes", () => {
    for (const language of GRIBOUILLE_LANGUAGES) {
      const bank = gribouilleWordsFor(language);
      const all = [...bank.normal, ...bank.hard, ...bank.extreme];
      expect(all.length).toBeGreaterThanOrEqual(50);
      expect(new Set(all.map((w) => w.toLowerCase())).size).toBe(all.length);
      for (const w of all) expect(w).not.toMatch(/[–—]/);
    }
  });
});

describe("guessing", () => {
  it("ignores accents, case, articles and punctuation", () => {
    expect(judgeGuess("bonhomme de neige", "Bonhomme de Neige!")).toBe("correct");
    expect(judgeGuess("vélo", "velo")).toBe("correct");
    expect(judgeGuess("ice cream", "icecream")).toBe("correct");
    expect(judgeGuess("giraffe", "the giraffe")).toBe("correct");
    expect(judgeGuess("Zahnbürste", "zahnburste")).toBe("correct");
  });
  it("calls one slip close and anything else wrong", () => {
    expect(judgeGuess("giraffe", "giraffee")).toBe("close");
    expect(judgeGuess("giraffe", "elephant")).toBe("wrong");
    expect(judgeGuess("key", "kay")).toBe("wrong");
    expect(judgeGuess("key", "")).toBe("wrong");
  });
});

describe("a game", () => {
  it("needs three connected players and the host to start", () => {
    const room = lobby(["a", "b"]);
    expect(() => startGribouille(room, "a", T0, rng())).toThrow(GribouilleError);
    joinGribouille(room, "c", "c", T0);
    expect(() => startGribouille(room, "b", T0, rng())).toThrowError("not_host");
    startGribouille(room, "a", T0, rng());
    expect(room.phase).toBe("drawing");
    expect(room.order).toHaveLength(3);
  });

  it("caps the table at 8 and locks it once started", () => {
    const room = lobby(["a", "b", "c", "d", "e", "f", "g", "h"]);
    expect(() => joinGribouille(room, "i", "i", T0)).toThrowError("full");
    startGribouille(room, "a", T0, rng());
    expect(() => joinGribouille(room, "z", "z", T0)).toThrowError("started");
  });

  it("never shows the word to a guesser who has not found it", () => {
    const room = started();
    const turn = room.turn!;
    const guesser = guessersOf(room)[0]!;
    expect(viewGribouille(room, turn.drawerId, T0).turn!.word).toBe(turn.word);
    const seen = viewGribouille(room, guesser, T0);
    expect(seen.turn!.word).toBeNull();
    expect(JSON.stringify(seen)).not.toContain(turn.word);
    expect(seen.turn!.mask.join("")).toMatch(/^[_ \-']+$/);
  });

  it("scores the guesser by speed, pays the drawer, and ends the turn when everyone found it", () => {
    const room = started();
    const turn = room.turn!;
    const [g1, g2] = guessersOf(room) as [string, string];
    const fast = guessGribouille(room, g1, turn.word, T0 + 1_000);
    const slow = guessGribouille(room, g2, turn.word.toUpperCase(), T0 + 60_000);
    expect(fast.result).toBe("correct");
    expect(slow.result).toBe("correct");
    if (fast.result === "correct" && slow.result === "correct") expect(fast.points).toBeGreaterThan(slow.points);
    expect(room.players.find((p) => p.id === turn.drawerId)!.score).toBe(100);
    ping(room, T0 + 61_000);
    expect(advanceGribouille(room, T0 + 61_000, rng())).toBe(true);
    expect(room.phase).toBe("reveal");
    expect(room.turn!.endReason).toBe("allFound");
    expect(viewGribouille(room, g2, T0 + 61_000).turn!.word).toBe(turn.word);
  });

  it("counts a word once, and the drawer cannot guess", () => {
    const room = started();
    const turn = room.turn!;
    const g = guessersOf(room)[0]!;
    expect(guessGribouille(room, turn.drawerId, turn.word, T0 + 1).result).toBe("ignored");
    guessGribouille(room, g, turn.word, T0 + 2);
    const score = room.players.find((p) => p.id === g)!.score;
    expect(guessGribouille(room, g, turn.word, T0 + 3).result).toBe("ignored");
    expect(room.players.find((p) => p.id === g)!.score).toBe(score);
    expect(room.feed.some((l) => l.text === turn.word)).toBe(false);
  });

  it("keeps wrong guesses in the feed and hides filtered ones", () => {
    const room = started();
    const g = guessersOf(room)[0]!;
    guessGribouille(room, g, "banana split", T0 + 5);
    guessGribouille(room, g, "rude words", T0 + 6, true);
    expect(room.feed.map((l) => l.text)).toEqual(["banana split", undefined]);
  });

  it("shows a close guess's text only to the person who typed it", () => {
    const room = started(["a", "b", "c"]);
    const turn = room.turn!;
    const [g1, g2] = guessersOf(room) as [string, string];
    const near = `${turn.word}x`;
    expect(guessGribouille(room, g1, near, T0 + 5).result).toBe("close");
    expect(viewGribouille(room, g1, T0 + 6).feed[0]).toMatchObject({ kind: "close", text: near });
    for (const other of [g2, turn.drawerId]) {
      const line = viewGribouille(room, other, T0 + 6).feed[0]!;
      expect(line.kind).toBe("close");
      expect(line.text).toBeUndefined();
      expect(JSON.stringify(viewGribouille(room, other, T0 + 6))).not.toContain(near);
    }
  });

  it("ends the turn at the buzzer with nobody paid, then plays everyone and finishes", () => {
    const room = started(["a", "b", "c"], 1);
    let now = T0;
    for (let i = 0; i < 3; i++) {
      now += room.turn!.timeLimitMs;
      ping(room, now);
      advanceGribouille(room, now, rng());
      expect(room.phase).toBe("reveal");
      expect(room.turn!.endReason).toBe("timeUp");
      now += GRIBOUILLE_REVEAL_MS;
      ping(room, now);
      advanceGribouille(room, now, rng());
    }
    expect(room.phase).toBe("end");
    expect(room.endReason).toBe("completed");
    expect(room.players.every((p) => p.score === 0)).toBe(true);
    expect(viewGribouille(room, "a", now).ranking).toHaveLength(3);
  });

  it("gives every player the pen once per round", () => {
    const room = started(["a", "b", "c"], 2);
    const drawers: string[] = [];
    let now = T0;
    while (room.phase === "drawing") {
      drawers.push(room.turn!.drawerId);
      now += room.turn!.timeLimitMs;
      ping(room, now);
      advanceGribouille(room, now, rng());
      now += GRIBOUILLE_REVEAL_MS;
      ping(room, now);
      advanceGribouille(room, now, rng());
    }
    expect(drawers).toHaveLength(6);
    for (const id of ["a", "b", "c"]) expect(drawers.filter((d) => d === id)).toHaveLength(2);
  });

  it("moves on when the drawer disappears, and the game goes on when a guesser leaves", () => {
    const room = started(["a", "b", "c", "d"]);
    const drawer = room.turn!.drawerId;
    const now = T0 + GRIBOUILLE_PRESENCE_MS + 1;
    for (const p of room.players) if (p.id !== drawer) touchGribouille(room, p.id, now);
    advanceGribouille(room, now, rng());
    expect(room.turn!.endReason).toBe("drawerGone");
    const other = room.players.find((p) => p.id !== drawer)!.id;
    leaveGribouille(room, other, now, rng());
    expect(room.phase).toBe("reveal");
    expect(room.players.find((p) => p.id === other)!.left).toBe(true);
    expect(() => touchGribouille(room, other, now)).toThrowError("not_in_room");
  });

  it("ends when fewer than two players remain", () => {
    const room = started();
    leaveGribouille(room, "b", T0 + 1, rng());
    leaveGribouille(room, "c", T0 + 2, rng());
    expect(room.phase).toBe("end");
    expect(room.endReason).toBe("notEnoughPlayers");
  });

  it("gives the host role to someone else when the host leaves", () => {
    const room = lobby(["a", "b", "c"]);
    leaveGribouille(room, "a", T0, rng());
    expect(room.hostId).toBe("b");
  });

  it("lets a dropped phone come back and see the whole picture again", () => {
    const room = started();
    const turn = room.turn!;
    addGribouilleStrokes(room, turn.drawerId, [{ type: "stroke.start", id: "s1", colour: "#000", width: 0.02, point: { x: 0.1, y: 0.1 } }, { type: "stroke.extend", id: "s1", points: [{ x: 0.2, y: 0.2 }] }], T0 + 1);
    const g = guessersOf(room)[0]!;
    joinGribouille(room, g, "again", T0 + 9_000);
    expect(viewGribouille(room, g, T0 + 9_000, 0).turn!.events).toHaveLength(2);
    expect(viewGribouille(room, g, T0 + 9_000, 2).turn!.events).toHaveLength(0);
    expect(viewGribouille(room, g, T0 + 9_000, 1).turn!.events).toHaveLength(1);
  });

  it("accepts strokes from the drawer only", () => {
    const room = started();
    const g = guessersOf(room)[0]!;
    expect(() => addGribouilleStrokes(room, g, [{ type: "clear" }], T0 + 1)).toThrowError("not_drawer");
  });

  it("swaps the word once, only before the first stroke", () => {
    const room = started();
    const turn = room.turn!;
    const before = turn.word;
    swapGribouilleWord(room, turn.drawerId, T0 + 1, rng());
    expect(room.turn!.word).not.toBe(before);
    expect(() => swapGribouilleWord(room, turn.drawerId, T0 + 2, rng())).toThrowError("no_swap");
  });
});

describe("hints and batches", () => {
  it("gives letters away at half and three quarters of the time", () => {
    const order = [0, 3, 1, 2];
    expect(wordMask("rose", order, 0, 100).join("")).toBe("____");
    expect(wordMask("rose", order, 50, 100).join("")).toBe("r___");
    expect(wordMask("rose", order, 80, 100).join("")).toBe("r__e");
    expect(wordMask("ice cream", [0, 1], 0, 100).join("")).toBe("___ _____");
    expect(wordMask("key", order, 90, 100).join("")).toBe("___");
  });

  it("merges runs of extensions of the same stroke", () => {
    const p = (x: number) => ({ x, y: x });
    const merged = coalesceDrawingEvents([
      { type: "stroke.start", id: "a", colour: "#000", width: 0.02, point: p(0) },
      { type: "stroke.extend", id: "a", points: [p(0.1)] },
      { type: "stroke.extend", id: "a", points: [p(0.2), p(0.3)] },
      { type: "stroke.extend", id: "b", points: [p(0.5)] },
      { type: "undo" },
    ]);
    expect(merged).toHaveLength(4);
    expect(merged[1]).toEqual({ type: "stroke.extend", id: "a", points: [p(0.1), p(0.2), p(0.3)] });
  });
});
