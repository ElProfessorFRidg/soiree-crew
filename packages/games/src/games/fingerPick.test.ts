import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { FINGER_MAX, FINGER_SETTLE_MS, FINGER_SIPS, createFingerPick, fingerPickReducer, settleProgress, type FingerPickAction, type FingerPickState } from "./fingerPick";

const rng = seededRandom(41);
const act = (state: FingerPickState, ...actions: FingerPickAction[]) => actions.reduce((s, a) => fingerPickReducer(s, a, rng), state);
const down = (id: string, at = 0): FingerPickAction => ({ type: "down", id, x: 10, y: 10, at });

describe("Short Straw", () => {
  it("waits for two fingers, then picks after they hold still", () => {
    let state = act(createFingerPick("normal"), down("a"));
    expect(state.phase).toBe("waiting");
    state = act(state, down("b", 100));
    expect(state.phase).toBe("settling");
    state = act(state, { type: "tick", at: 100 + FINGER_SETTLE_MS - 1 });
    expect(state.phase).toBe("settling");
    state = act(state, { type: "tick", at: 100 + FINGER_SETTLE_MS });
    expect(state.phase).toBe("chosen");
    expect(["a", "b"]).toContain(state.chosenId);
  });

  it("identifies the chosen one by its touch, whatever order the fingers came in", () => {
    const ids = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      let state = act(createFingerPick("normal"), down("t7"), down("t2"), down("t9"));
      state = fingerPickReducer(state, { type: "tick", at: FINGER_SETTLE_MS }, seededRandom(seed));
      ids.add(state.chosenId!);
    }
    expect(ids).toEqual(new Set(["t7", "t2", "t9"]));
  });

  it("restarts the countdown when a finger is added or lifted, not when one moves", () => {
    let state = act(createFingerPick("normal"), down("a"), down("b"));
    state = act(state, { type: "move", id: "a", x: 50, y: 50 }, { type: "tick", at: FINGER_SETTLE_MS });
    expect(state.phase).toBe("chosen");
    state = act(createFingerPick("normal"), down("a"), down("b"), down("c", 1_000), { type: "tick", at: FINGER_SETTLE_MS });
    expect(state.phase).toBe("settling");
    state = act(state, { type: "up", id: "c", at: 1_500 });
    expect(settleProgress(state, 1_500)).toBe(0);
  });

  it("takes up to ten fingers", () => {
    let state = createFingerPick("normal");
    for (let i = 0; i < FINGER_MAX + 3; i++) state = act(state, down(`f${i}`));
    expect(state.fingers).toHaveLength(FINGER_MAX);
  });

  it("keeps the fingers drawn after the pick, and records the penalty once for the named player", () => {
    let state = act(createFingerPick("hard"), down("a"), down("b"), { type: "tick", at: FINGER_SETTLE_MS });
    state = act(state, { type: "up", id: "a", at: 5_000 });
    expect(state.fingers).toHaveLength(2);
    state = act(state, { type: "assign", playerId: "p1" }, { type: "assign", playerId: "p2" });
    expect(state.ledger).toEqual({ p1: FINGER_SIPS.hard });
  });

  it("starts a new round after a reset", () => {
    let state = act(createFingerPick("normal"), down("a"), down("b"), { type: "tick", at: FINGER_SETTLE_MS }, { type: "reset" });
    expect(state.phase).toBe("waiting");
    expect(state.fingers).toEqual([]);
    expect(state.round).toBe(2);
  });
});
