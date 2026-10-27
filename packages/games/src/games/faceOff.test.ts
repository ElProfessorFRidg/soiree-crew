import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { players } from "../testing";
import { FACE_OFF_CAP, FACE_OFF_HAND, createFaceOff, faceOffReducer, scoreFaceOff } from "./faceOff";

const rng = seededRandom(4);
const c = (rank: number) => ({ rank, suit: "clubs" as const });

describe("Face-off", () => {
  it("deals a hidden hand to each of the two players", () => {
    const state = createFaceOff({ players: players(2), level: "hard", rng });
    expect(state.phase).toBe("hidden");
    expect(state.hands[0]).toHaveLength(FACE_OFF_HAND.hard);
    expect(state.hands[1]).toHaveLength(FACE_OFF_HAND.hard);
  });

  it("makes the weaker hand pay the gap, capped by level", () => {
    const [a, b] = players(2);
    const result = scoreFaceOff("normal", [a!, b!], [[c(14)], [c(2)]]);
    expect(result.loserId).toBe("p2");
    expect(result.penalties).toEqual([{ playerId: "p2", sips: FACE_OFF_CAP.normal }]);
    expect(scoreFaceOff("normal", [a!, b!], [[c(8)], [c(9)]]).penalties).toEqual([{ playerId: "p1", sips: 1 }]);
  });

  it("charges both players on a tie", () => {
    const [a, b] = players(2);
    const result = scoreFaceOff("normal", [a!, b!], [[c(9)], [c(9)]]);
    expect(result.loserId).toBeNull();
    expect(result.penalties.map((p) => p.playerId)).toEqual(["p1", "p2"]);
  });

  it("deals new hands only after the reveal is over", () => {
    let state = createFaceOff({ players: players(2), level: "normal", rng });
    const firstHands = state.hands;
    state = faceOffReducer(state, { type: "reveal" }, rng);
    expect(state.hands).toBe(firstHands);
    expect(state.result).not.toBeNull();
    state = faceOffReducer(state, { type: "next" }, rng);
    expect(state.round).toBe(2);
    expect(state.phase).toBe("hidden");
    expect(state.result).toBeNull();
  });

  it("ends after the set number of rounds", () => {
    let state = createFaceOff({ players: players(2), level: "normal", rounds: 2, rng });
    for (let i = 0; i < 2; i++) state = faceOffReducer(faceOffReducer(state, { type: "reveal" }, rng), { type: "next" }, rng);
    expect(state.phase).toBe("end");
    expect(state.endReason).toBe("completed");
  });

  it("ends cleanly when one of the two leaves, scores kept", () => {
    let state = faceOffReducer(createFaceOff({ players: players(2), level: "normal", rng }), { type: "reveal" }, rng);
    const ledger = state.ledger;
    state = faceOffReducer(state, { type: "removePlayer", playerId: "p1" }, rng);
    expect(state.phase).toBe("end");
    expect(state.endReason).toBe("notEnoughPlayers");
    expect(state.ledger).toBe(ledger);
  });

  it("refuses a second reveal of the same round", () => {
    const state = faceOffReducer(createFaceOff({ players: players(2), level: "normal", rng }), { type: "reveal" }, rng);
    expect(faceOffReducer(state, { type: "reveal" }, rng)).toBe(state);
  });
});
