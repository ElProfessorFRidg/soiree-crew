import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { players } from "../testing";
import { NEVER_EVER_SIPS, createNeverEver, neverEverReducer } from "./neverEver";

const content = { normal: ["n1", "n2", "n3"], hard: ["h1", "h2"], extreme: ["e1", "e2", "e3", "e4"] };
const start = (level: "normal" | "hard" | "extreme" = "normal", count = 4) =>
  createNeverEver({ players: players(count), level, content, rng: seededRandom(8) });

describe("Not Once", () => {
  it("plays the unfiltered deck at Extreme, mostly from its own cards", () => {
    const state = start("extreme");
    const all = [state.card!, ...state.deck];
    expect(all.filter((c) => c.level === "extreme").length).toBeGreaterThanOrEqual(all.length / 2);
    expect(all.every((c) => c.level === "extreme" || c.level === "hard")).toBe(true);
  });

  it("charges whoever owned up when the next card is drawn", () => {
    let state = neverEverReducer(start(), { type: "toggle", playerId: "p2" });
    state = neverEverReducer(state, { type: "toggle", playerId: "p4" });
    state = neverEverReducer(state, { type: "toggle", playerId: "p4" });
    state = neverEverReducer(state, { type: "next" });
    expect(state.lastPenalties).toEqual([{ playerId: "p2", sips: NEVER_EVER_SIPS.normal }]);
    expect(state.guilty).toEqual([]);
    expect(state.order.turn).toBe(1);
  });

  it("ends after the last card", () => {
    let state = start();
    for (let i = 0; i < 3; i++) state = neverEverReducer(state, { type: "next" });
    expect(state.phase).toBe("end");
    expect(state.endReason).toBe("completed");
  });

  it("forgets the toggle of a player who leaves, and ends below three players", () => {
    let state = neverEverReducer(start(), { type: "toggle", playerId: "p3" });
    state = neverEverReducer(state, { type: "removePlayer", playerId: "p3" });
    expect(state.guilty).toEqual([]);
    state = neverEverReducer(state, { type: "removePlayer", playerId: "p2" });
    expect(state.phase).toBe("end");
    expect(state.endReason).toBe("notEnoughPlayers");
  });

  it("scores the current card when the game is stopped", () => {
    let state = neverEverReducer(start(), { type: "toggle", playerId: "p1" });
    state = neverEverReducer(state, { type: "stop" });
    expect(state.ledger.p1).toBe(NEVER_EVER_SIPS.normal);
  });
});
