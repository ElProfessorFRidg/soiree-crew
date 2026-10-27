import { describe, expect, it } from "vitest";
import type { PointBlankContent } from "../content/types";
import { seededRandom } from "../random";
import { players } from "../testing";
import { POINT_BLANK_SECRET_SIPS, createPointBlank, pointBlankPenalties, pointBlankReducer, type PointBlankAction, type PointBlankState } from "./pointBlank";

const content: PointBlankContent = {
  open: {
    normal: Array.from({ length: 10 }, (_, i) => `normal ${i}`),
    hard: Array.from({ length: 10 }, (_, i) => `hard ${i}`),
    extreme: Array.from({ length: 10 }, (_, i) => `extreme ${i}`),
  },
  secret: Array.from({ length: 10 }, (_, i) => `secret ${i}`),
};
const act = (state: PointBlankState, ...actions: PointBlankAction[]) => actions.reduce(pointBlankReducer, state);
const start = (level: PointBlankState["level"] = "normal", count = 4, size: number | null = 5) =>
  createPointBlank({ players: players(count), level, content, size, rng: seededRandom(3) });

describe("Point Blank", () => {
  it("needs three players", () => {
    expect(start("normal", 2).phase).toBe("end");
  });

  it("gives the card to the reader, then rotates the reader", () => {
    let state = act(start(), { type: "next" });
    expect(state.readerId).toBe("p1");
    state = act(state, { type: "startRecording" }, { type: "done" }, { type: "next" });
    expect(state.readerId).toBe("p2");
  });

  it("charges only the most pointed at Normal, one sip per finger, capped", () => {
    expect(pointBlankPenalties("normal", { p1: 2, p2: 1 })).toEqual([{ playerId: "p1", sips: 2 }]);
    expect(pointBlankPenalties("normal", { p1: 2, p2: 2 })).toHaveLength(2);
    expect(pointBlankPenalties("normal", { p1: 7 })).toEqual([{ playerId: "p1", sips: 3 }]);
  });

  it("charges everyone pointed at, from Hard", () => {
    expect(pointBlankPenalties("hard", { p1: 2, p2: 1, p3: 0 })).toEqual([
      { playerId: "p1", sips: 2 },
      { playerId: "p2", sips: 1 },
    ]);
  });

  it("charges nobody when nobody was pointed at", () => {
    const state = act(start(), { type: "next" }, { type: "startRecording" }, { type: "done" });
    expect(state.phase).toBe("result");
    expect(state.lastPenalties).toEqual([]);
  });

  it("never records more fingers than players", () => {
    let state = act(start("normal", 3), { type: "next" }, { type: "startRecording" });
    for (let i = 0; i < 5; i++) state = act(state, { type: "point", playerId: "p2", delta: 1 });
    expect(state.fingers.p2).toBe(3);
    state = act(state, { type: "point", playerId: "p2", delta: -1 });
    expect(state.fingers.p2).toBe(2);
  });

  it("offers a one-tap result at high adaptive levels", () => {
    const state = act(start(), { type: "next" }, { type: "quickResult", playerIds: ["p3"] });
    expect(state.lastPenalties).toEqual([{ playerId: "p3", sips: 2 }]);
  });

  it("mixes secret cards in at Extreme only; the named player pays only to hear the question", () => {
    expect(start("hard", 4, 10).deck.some((c) => c.secret)).toBe(false);
    const extreme = start("extreme", 4, 10);
    expect(extreme.deck.filter((c) => c.secret)).toHaveLength(2);
    let state: PointBlankState = { ...extreme, deck: [extreme.deck.find((c) => c.secret)!] };
    state = act(state, { type: "next" });
    expect(state.phase).toBe("secretName");
    state = act(state, { type: "name", playerId: "p3" });
    expect(act(state, { type: "secretChoice", hear: false }).lastPenalties).toEqual([]);
    expect(act(state, { type: "secretChoice", hear: true }).lastPenalties).toEqual([{ playerId: "p3", sips: POINT_BLANK_SECRET_SIPS }]);
  });

  it("drops the card when the reader leaves, and the next player reads", () => {
    let state = act(start(), { type: "next" }, { type: "startRecording" });
    state = act(state, { type: "removePlayer", playerId: "p1" });
    expect(state.phase).toBe("idle");
    expect(act(state, { type: "next" }).readerId).toBe("p2");
  });

  it("ends at the last card", () => {
    let state = start("normal", 4, 2);
    for (let i = 0; i < 2; i++) state = act(state, { type: "next" }, { type: "startRecording" }, { type: "done" });
    state = act(state, { type: "next" });
    expect(state.phase).toBe("end");
    expect(state.endReason).toBe("completed");
  });
});
