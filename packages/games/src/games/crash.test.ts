import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { players } from "../testing";
import {
  CRASH_FLOOR,
  CRASH_STAKE_CAP,
  crashReducer,
  createCrash,
  drawCrashPoint,
  msToReach,
  multiplierAt,
  stakeAt,
  type CrashAction,
  type CrashState,
} from "./crash";

const rng = seededRandom(71);
const act = (state: CrashState, ...actions: CrashAction[]) => actions.reduce((s, a) => crashReducer(s, a, rng), state);

/** A started round with a known crash point. */
function running(crashPoint: number, level: CrashState["level"] = "normal", count = 3): CrashState {
  const state = createCrash({ players: players(count), level });
  return { ...state, phase: "running", crashPoint };
}

describe("Bail Out", () => {
  it("draws a heavy-tailed crash point: about half before 2, about one in ten past 10", () => {
    const draws = Array.from({ length: 20_000 }, () => drawCrashPoint("hard", rng));
    const share = (x: number) => draws.filter((d) => d > x).length / draws.length;
    expect(share(2)).toBeGreaterThan(0.45);
    expect(share(2)).toBeLessThan(0.55);
    expect(share(10)).toBeGreaterThan(0.08);
    expect(share(10)).toBeLessThan(0.12);
  });

  it("never crashes below the Normal floor; Extreme sometimes busts at once", () => {
    for (let i = 0; i < 2_000; i++) expect(drawCrashPoint("normal", rng)).toBeGreaterThanOrEqual(CRASH_FLOOR.normal);
    const busts = Array.from({ length: 10_000 }, () => drawCrashPoint("extreme", rng)).filter((d) => d === 1).length;
    expect(busts).toBeGreaterThan(250);
    expect(busts).toBeLessThan(560);
  });

  it("shows whole sips, never a decimal multiplier, capped by level", () => {
    expect(stakeAt("normal", 1.4)).toBe(1);
    expect(stakeAt("normal", 2.99)).toBe(2);
    expect(stakeAt("normal", 40)).toBe(CRASH_STAKE_CAP.normal);
    expect(multiplierAt("normal", msToReach("normal", 4))).toBeCloseTo(4);
  });

  it("charges the stake at the crash to everyone still in", () => {
    let state = running(3.5);
    state = act(state, { type: "tick", deltaMs: msToReach("normal", 3.6) });
    expect(state.phase).toBe("crashed");
    expect(state.lastPenalties).toEqual([
      { playerId: "p1", sips: 3 },
      { playerId: "p2", sips: 3 },
      { playerId: "p3", sips: 3 },
    ]);
  });

  it("makes the first one out pay 1 when others got out too, not when alone", () => {
    let state = running(5);
    state = act(state, { type: "tick", deltaMs: 200 }, { type: "exit", playerId: "p1" }, { type: "tick", deltaMs: 2_000 }, { type: "exit", playerId: "p2" });
    state = act(state, { type: "tick", deltaMs: 60_000 });
    expect(state.lastPenalties).toEqual([
      { playerId: "p3", sips: 3 },
      { playerId: "p1", sips: 1 },
    ]);
    let alone = running(5);
    alone = act(alone, { type: "exit", playerId: "p1" }, { type: "tick", deltaMs: 60_000 });
    expect(alone.lastPenalties.find((l) => l.playerId === "p1")).toBeUndefined();
  });

  it("refuses an exit after the crash and a second exit", () => {
    let state = act(running(1.5), { type: "tick", deltaMs: 60_000 });
    expect(act(state, { type: "exit", playerId: "p1" })).toBe(state);
    state = act(running(9), { type: "exit", playerId: "p1" });
    expect(act(state, { type: "exit", playerId: "p1" })).toBe(state);
  });

  it("lets the best exit hand out sips at Hard", () => {
    let state = running(6, "hard");
    state = act(state, { type: "tick", deltaMs: msToReach("hard", 2.2) }, { type: "exit", playerId: "p2" });
    state = act(state, { type: "tick", deltaMs: msToReach("hard", 1.5) }, { type: "exit", playerId: "p3" });
    state = act(state, { type: "tick", deltaMs: 60_000 });
    expect(state.phase).toBe("award");
    expect(state.award).toEqual({ playerId: "p3", sips: 1 });
    expect(act(state, { type: "award", targetId: "p3" })).toBe(state);
    state = act(state, { type: "award", targetId: "p1" });
    expect(state.phase).toBe("crashed");
    expect(state.ledger.p1).toBe(CRASH_STAKE_CAP.hard + 1);
  });

  it("calls the round off when the app goes to the background", () => {
    const state = act(running(4), { type: "tick", deltaMs: 1_000 }, { type: "cancel" });
    expect(state.phase).toBe("idle");
    expect(state.ledger).toEqual({});
  });

  it("lets a newcomer sit out the live round, then play the next", () => {
    let state = act(running(2), { type: "addPlayer", player: { id: "p9", name: "New", noAlcohol: false } });
    state = act(state, { type: "tick", deltaMs: 60_000 });
    expect(state.lastPenalties.find((l) => l.playerId === "p9")).toBeUndefined();
    state = act(state, { type: "next" });
    expect(state.sittingOut).toEqual([]);
  });

  it("ends after the set rounds", () => {
    let state = { ...createCrash({ players: players(2), level: "normal", rounds: 1 }) };
    state = act(state, { type: "start" }, { type: "tick", deltaMs: 600_000 }, { type: "next" });
    expect(state.phase).toBe("end");
  });
});
