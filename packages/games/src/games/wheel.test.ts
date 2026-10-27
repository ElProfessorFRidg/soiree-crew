import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { players } from "../testing";
import { WHEEL_EDGE_MARGIN, WHEEL_SIPS, WHEEL_TURNS, createWheel, segmentIndexAt, wheelReducer } from "./wheel";

const rng = seededRandom(21);

describe("The Wheel", () => {
  it("reads the segment under the top pointer from the angle", () => {
    // Six segments of 60 degrees. Not turned: the pointer is at the start of segment 0.
    expect(segmentIndexAt(0, 6)).toBe(0);
    // Turned 30 degrees clockwise: the pointer now sees the end of the last segment.
    expect(segmentIndexAt(30, 6)).toBe(5);
    expect(segmentIndexAt(330, 6)).toBe(0);
    expect(segmentIndexAt(360 * 5 + 190, 6)).toBe(2);
  });

  it("spins at least five full turns and never stops on a line", () => {
    let state = createWheel({ players: players(5), level: "normal" });
    for (let i = 0; i < 100; i++) {
      state = wheelReducer(state, { type: "spin" }, rng);
      expect(state.targetDeg - state.rotationDeg).toBeGreaterThanOrEqual(WHEEL_TURNS * 360 - 72 * WHEEL_EDGE_MARGIN);
      const size = 72;
      const into = ((((360 - (state.targetDeg % 360)) % 360) + 360) % 360) % size;
      expect(into).toBeGreaterThanOrEqual(size * WHEEL_EDGE_MARGIN - 1e-9);
      expect(into).toBeLessThanOrEqual(size * (1 - WHEEL_EDGE_MARGIN) + 1e-9);
      state = wheelReducer(state, { type: "settle" }, rng);
    }
  });

  it("names the loser only once the wheel has stopped, from the final angle", () => {
    let state = wheelReducer(createWheel({ players: players(4), level: "hard" }), { type: "spin" }, rng);
    expect(state.phase).toBe("spinning");
    expect(state.resultId).toBeNull();
    expect(state.lastPenalties).toEqual([]);
    state = wheelReducer(state, { type: "settle" }, rng);
    const expected = state.players[segmentIndexAt(state.targetDeg, 4)]!.id;
    expect(state.resultId).toBe(expected);
    expect(state.ledger[expected]).toBe(WHEEL_SIPS.hard);
  });

  it("calls a spin off when a player leaves mid-spin, nobody pays", () => {
    let state = wheelReducer(createWheel({ players: players(4), level: "normal" }), { type: "spin" }, rng);
    state = wheelReducer(state, { type: "removePlayer", playerId: "p2" }, rng);
    expect(state.phase).toBe("idle");
    expect(state.players).toHaveLength(3);
    expect(state.ledger).toEqual({});
  });

  it("ends below two players", () => {
    const state = wheelReducer(createWheel({ players: players(2), level: "normal" }), { type: "removePlayer", playerId: "p1" }, rng);
    expect(state.phase).toBe("end");
  });

  it("counts rounds from the second spin", () => {
    let state = createWheel({ players: players(3), level: "normal" });
    state = wheelReducer(wheelReducer(state, { type: "spin" }, rng), { type: "settle" }, rng);
    expect(state.round).toBe(1);
    state = wheelReducer(state, { type: "spin" }, rng);
    expect(state.round).toBe(2);
  });
});
