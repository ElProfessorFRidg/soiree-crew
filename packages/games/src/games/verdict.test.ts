import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { players } from "../testing";
import { createVerdict, pickPair, verdictPenalties, verdictReducer, voterCount, type VerdictAction, type VerdictState } from "./verdict";

const content = { normal: ["a", "b", "c", "d", "e", "f"], hard: ["g"], extreme: ["h"] };
const rng = seededRandom(13);
const act = (state: VerdictState, ...actions: VerdictAction[]) => actions.reduce((s, a) => verdictReducer(s, a, rng), state);
const start = (count = 5) => createVerdict({ players: players(count), level: "normal", content, rng: seededRandom(2) });

describe("The Verdict", () => {
  it("puts two players in front of the table; everyone else votes once", () => {
    const state = start(5);
    expect(state.pair).not.toBeNull();
    expect(voterCount(state)).toBe(3);
    const full = act(state, ...Array.from({ length: 10 }, () => ({ type: "vote", side: 0, delta: 1 }) as const));
    expect(full.votes[0]).toBe(3);
  });

  it("makes the most voted pay; a tie makes both pay; no vote, no penalty", () => {
    expect(verdictPenalties("normal", ["a", "b"], [2, 1])).toEqual([{ playerId: "a", sips: 2 }]);
    expect(verdictPenalties("normal", ["a", "b"], [1, 1])).toHaveLength(2);
    expect(verdictPenalties("normal", ["a", "b"], [0, 0])).toEqual([]);
    expect(verdictPenalties("extreme", ["a", "b"], [5, 0])).toEqual([{ playerId: "a", sips: 5 }]);
  });

  it("rotates pairs fairly and never repeats the same pair twice in a row", () => {
    const ps = players(4);
    let previous: [string, string] | null = null;
    const appearances: Record<string, number> = {};
    for (let i = 0; i < 20; i++) {
      const pair: [string, string] = pickPair(ps, appearances, previous, rng)!;
      if (previous) expect([...pair].sort()).not.toEqual([...previous].sort());
      for (const id of pair) appearances[id] = (appearances[id] ?? 0) + 1;
      previous = pair;
    }
    const counts = Object.values(appearances);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
  });

  it("closes the vote, then moves to the next card and a new pair", () => {
    let state = act(start(), { type: "vote", side: 1, delta: 1 }, { type: "close" });
    expect(state.phase).toBe("result");
    expect(state.lastPenalties).toEqual([{ playerId: state.pair![1], sips: 2 }]);
    state = act(state, { type: "next" });
    expect(state.phase).toBe("vote");
    expect(state.votes).toEqual([0, 0]);
  });

  it("finds a new pair when one of the two leaves mid-vote", () => {
    let state = act(start(5), { type: "vote", side: 0, delta: 1 });
    const leaving = state.pair![0];
    state = act(state, { type: "removePlayer", playerId: leaving });
    expect(state.pair).not.toContain(leaving);
    expect(state.votes).toEqual([0, 0]);
  });

  it("trims votes when a voter leaves", () => {
    let state = start(4);
    state = act(state, { type: "vote", side: 0, delta: 1 }, { type: "vote", side: 1, delta: 1 });
    const voter = state.players.find((p) => !state.pair!.includes(p.id))!.id;
    state = act(state, { type: "removePlayer", playerId: voter });
    expect(state.votes[0] + state.votes[1]).toBe(1);
  });

  it("ends below three players", () => {
    const state = act(start(3), { type: "removePlayer", playerId: "p1" });
    expect(state.phase).toBe("end");
  });
});
