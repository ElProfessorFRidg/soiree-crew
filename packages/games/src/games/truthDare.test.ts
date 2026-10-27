import { describe, expect, it } from "vitest";
import type { TruthDareContent } from "../content/types";
import { seededRandom } from "../random";
import { players } from "../testing";
import { TRUTH_DARE_REFUSAL_SIPS, createTruthDare, truthDareReducer, type TruthDareAction, type TruthDareState } from "./truthDare";

const content: TruthDareContent = {
  truth: { normal: ["tn1", "tn2"], hard: ["th1"], extreme: ["te1", "te2"] },
  dare: { normal: ["dn1 {other}"], hard: ["dh1"], extreme: ["de1"] },
};
const rng = seededRandom(17);
const act = (state: TruthDareState, ...actions: TruthDareAction[]) => actions.reduce((s, a) => truthDareReducer(s, a, rng), state);
const start = (level: TruthDareState["level"] = "normal", count = 3) => createTruthDare({ players: players(count), level, content, rng: seededRandom(1) });

describe("Spill or Dare", () => {
  it("draws truths from the chosen level too (the prototype kept one list of truths)", () => {
    const state = act(start("extreme"), { type: "choose", kind: "truth" });
    expect(["extreme", "hard"]).toContain(state.current?.item.level);
    expect(state.current?.item.value.startsWith("t")).toBe(true);
  });

  it("charges a refusal, nothing for a dare done, then passes the turn", () => {
    let state = act(start(), { type: "choose", kind: "dare" }, { type: "refuse" });
    expect(state.ledger.p1).toBe(TRUTH_DARE_REFUSAL_SIPS.normal);
    expect(state.order.turn).toBe(1);
    state = act(state, { type: "choose", kind: "truth" }, { type: "done" });
    expect(state.ledger.p2).toBeUndefined();
    expect(state.turns).toBe(2);
  });

  it("names another player for {other}", () => {
    const state = act(start(), { type: "choose", kind: "dare" });
    expect(state.current?.otherId).not.toBeNull();
    expect(state.current?.otherId).not.toBe("p1");
  });

  it("reshuffles a pile that runs dry instead of stopping", () => {
    let state = start();
    for (let i = 0; i < 5; i++) state = act(state, { type: "choose", kind: "dare" }, { type: "done" });
    expect(state.phase).toBe("choose");
    expect(state.turns).toBe(5);
  });

  it("goes on when the player with the card leaves", () => {
    let state = act(start(), { type: "choose", kind: "dare" });
    state = act(state, { type: "removePlayer", playerId: "p1" });
    expect(state.phase).toBe("choose");
    expect(state.order.players[state.order.turn]?.id).toBe("p2");
  });

  it("ends below two players", () => {
    const state = act(start("normal", 2), { type: "removePlayer", playerId: "p1" });
    expect(state.phase).toBe("end");
  });
});
