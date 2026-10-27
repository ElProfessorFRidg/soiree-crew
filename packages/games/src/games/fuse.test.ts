import { describe, expect, it } from "vitest";
import type { FusePromptContent } from "../content/types";
import { seededRandom } from "../random";
import { players } from "../testing";
import { FUSE_MIN_MS, FUSE_RANGE_MS, PASS_LOCK_MS, createFuse, drawFuse, fuseEscalation, fuseHolder, fuseReducer, type FuseAction, type FuseState } from "./fuse";

const content: FusePromptContent = { normal: ["a", "b", "c"], hard: ["d", "e"], extreme: ["f", "g"] };
const rng = seededRandom(11);
const act = (state: FuseState, ...actions: FuseAction[]) => actions.reduce((s, a) => fuseReducer(s, a, rng), state);
const start = (level: FuseState["level"] = "normal", count = 4) => createFuse({ players: players(count), level, content, rng: seededRandom(5) });

describe("Short Fuse", () => {
  it("draws a hidden fuse inside the level range, never under the minimum", () => {
    for (let i = 0; i < 200; i++) {
      const fuse = drawFuse("extreme", rng);
      expect(fuse).toBeGreaterThanOrEqual(Math.max(FUSE_MIN_MS, FUSE_RANGE_MS.extreme[0]));
      expect(fuse).toBeLessThanOrEqual(FUSE_RANGE_MS.extreme[1]);
    }
  });

  it("escalates on elapsed time over the longest fuse, so the screen never tells the real one", () => {
    const short = { ...act(start(), { type: "light" }), fuseMs: 16_000 };
    const long = { ...short, fuseMs: 39_000 };
    const a = act(short, { type: "tick", deltaMs: 8_000 });
    const b = act(long, { type: "tick", deltaMs: 8_000 });
    expect(fuseEscalation(a)).toBe(fuseEscalation(b));
    expect(fuseEscalation(a)).toBeCloseTo(8_000 / FUSE_RANGE_MS.normal[1]);
  });

  it("passes the bomb in order and ignores a double tap", () => {
    let state = act(start(), { type: "light" }, { type: "tick", deltaMs: 1_000 }, { type: "pass" });
    expect(fuseHolder(state)?.id).toBe("p2");
    state = act(state, { type: "tick", deltaMs: PASS_LOCK_MS - 100 }, { type: "pass" });
    expect(fuseHolder(state)?.id).toBe("p2");
    state = act(state, { type: "tick", deltaMs: 200 }, { type: "pass" });
    expect(fuseHolder(state)?.id).toBe("p3");
  });

  it("allows a free pass at Extreme only", () => {
    const normal = act(start("normal"), { type: "light" }, { type: "pass", targetId: "p4" });
    expect(fuseHolder(normal)?.id).toBe("p2");
    const extreme = act(start("extreme"), { type: "light" }, { type: "pass", targetId: "p4" });
    expect(fuseHolder(extreme)?.id).toBe("p4");
  });

  it("explodes on the holder; at Extreme the passer pays one too", () => {
    let state = act(start("extreme"), { type: "light" }, { type: "pass" });
    state = act(state, { type: "tick", deltaMs: state.fuseMs });
    expect(state.phase).toBe("exploded");
    expect(state.lastPenalties).toEqual([
      { playerId: "p2", sips: 3 },
      { playerId: "p1", sips: 1 },
    ]);
  });

  it("lets the exploded player start the next round", () => {
    let state = act(start(), { type: "light" }, { type: "pass" });
    state = act(state, { type: "tick", deltaMs: state.fuseMs }, { type: "nextRound" });
    expect(state.phase).toBe("idle");
    expect(state.round).toBe(2);
    expect(fuseHolder(state)?.id).toBe("p2");
  });

  it("freezes while paused and keeps the holder", () => {
    let state = act(start(), { type: "light" }, { type: "tick", deltaMs: 1_000 }, { type: "pause" });
    const paused = act(state, { type: "tick", deltaMs: 60_000 });
    expect(paused.phase).toBe("paused");
    expect(paused.elapsedMs).toBe(1_000);
    state = act(paused, { type: "resume" });
    expect(state.phase).toBe("burning");
  });

  it("moves the bomb on without penalty when the holder leaves", () => {
    let state = act(start(), { type: "light" }, { type: "pass" });
    state = act(state, { type: "removePlayer", playerId: "p2" });
    expect(fuseHolder(state)?.id).toBe("p3");
    expect(state.ledger).toEqual({});
    expect(state.phase).toBe("burning");
  });

  it("counts explosions and survival streaks", () => {
    let state = act(start("normal", 3), { type: "light" });
    state = act(state, { type: "tick", deltaMs: state.fuseMs }, { type: "nextRound" }, { type: "light" });
    state = act(state, { type: "pass" });
    state = act(state, { type: "tick", deltaMs: state.fuseMs });
    expect(state.explosions).toEqual({ p1: 1, p2: 1 });
    expect(state.bestStreaks.p3).toBe(2);
  });

  it("ends after the set rounds", () => {
    let state = createFuse({ players: players(2), level: "normal", content, rounds: 1, rng });
    state = act(state, { type: "light" });
    state = act(state, { type: "tick", deltaMs: state.fuseMs }, { type: "nextRound" });
    expect(state.phase).toBe("end");
  });
});
