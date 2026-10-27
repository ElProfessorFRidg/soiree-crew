import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { players } from "../testing";
import { QUICK_DRAW_SIPS, QUICK_DRAW_TIME_MS, createQuickDraw, quickDrawReducer, timeLeftMs, type QuickDrawAction, type QuickDrawState } from "./quickDraw";

const content = { normal: ["a cat", "a hat", "a bat"], hard: ["a map"], extreme: ["an idea"] };
const rng = seededRandom(61);
const act = (state: QuickDrawState, ...actions: QuickDrawAction[]) => actions.reduce((s, a) => quickDrawReducer(s, a, rng), state);
const start = (count = 3) => createQuickDraw({ players: players(count), level: "normal", content, rng: seededRandom(4) });

describe("Quick Draw", () => {
  it("needs three players", () => {
    expect(start(2).phase).toBe("end");
  });

  it("lets the drawer swap the word once, before the clock starts", () => {
    let state = start();
    const first = state.word;
    state = act(state, { type: "swapWord" });
    expect(state.word).not.toBe(first);
    expect(act(state, { type: "swapWord" })).toBe(state);
  });

  it("gives a point to the guesser and the drawer", () => {
    const state = act(start(), { type: "start" }, { type: "tick", deltaMs: 10_000 }, { type: "found", guesserId: "p2" });
    expect(state.phase).toBe("found");
    expect(state.scores).toEqual({ p1: 1, p2: 1 });
    expect(act(start(), { type: "start" }, { type: "found", guesserId: "p1" }).phase).toBe("drawing");
  });

  it("charges the drawer when time runs out", () => {
    const state = act(start(), { type: "start" }, { type: "tick", deltaMs: QUICK_DRAW_TIME_MS.normal });
    expect(state.phase).toBe("timeUp");
    expect(timeLeftMs(state)).toBe(0);
    expect(state.lastPenalties).toEqual([{ playerId: "p1", sips: QUICK_DRAW_SIPS.normal }]);
  });

  it("passes the pen and ends once everyone has drawn", () => {
    let state = start();
    for (let i = 0; i < 3; i++) state = act(state, { type: "start" }, { type: "tick", deltaMs: QUICK_DRAW_TIME_MS.normal }, { type: "next" });
    expect(state.phase).toBe("end");
    expect(state.ledger).toEqual({ p1: 2, p2: 2, p3: 2 });
  });

  it("gives the next player a fresh word when the drawer leaves mid-drawing", () => {
    let state = act(start(4), { type: "start" });
    state = act(state, { type: "removePlayer", playerId: "p1" });
    expect(state.phase).toBe("ready");
    expect(state.order.players[state.order.turn]?.id).toBe("p2");
    expect(state.elapsedMs).toBe(0);
  });
});
