import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { players } from "../testing";
import {
  GRID_TILES,
  MINE_CAP,
  MINE_COUNT,
  createGrid,
  createMinefield,
  gridIsOver,
  mineSips,
  minefieldReducer,
  minesLeft,
  touchingMines,
  type MinefieldAction,
  type MinefieldState,
} from "./minefield";

const rng = seededRandom(31);
const act = (state: MinefieldState, ...actions: MinefieldAction[]) => actions.reduce((s, a) => minefieldReducer(s, a, rng), state);

/** A game with mines on the given tiles. */
function rigged(mines: number[], level: MinefieldState["level"] = "normal", count = 3): MinefieldState {
  const state = createMinefield({ players: players(count), level, rng: seededRandom(1) });
  return { ...state, grid: { mines, bigMine: level === "extreme" ? (mines[0] ?? null) : null, revealed: Array(GRID_TILES).fill(false), exploded: [] } };
}
const safeTiles = (mines: number[]) => Array.from({ length: GRID_TILES }, (_, i) => i).filter((i) => !mines.includes(i));

describe("Minefield", () => {
  it("never puts two mines on one tile", () => {
    for (let i = 0; i < 500; i++) {
      for (const level of ["normal", "hard", "extreme"] as const) {
        const grid = createGrid(level, rng);
        expect(new Set(grid.mines).size).toBe(MINE_COUNT[level]);
        expect(grid.mines.every((m) => m >= 0 && m < GRID_TILES)).toBe(true);
      }
    }
  });

  it("counts touching mines for the Normal help", () => {
    const grid = rigged([0, 1, 5]).grid;
    expect(touchingMines(grid, 6)).toBe(3);
    expect(touchingMines(grid, 24)).toBe(0);
  });

  it("lets the player stop or push after a safe tile; each extra tile is a sip to give", () => {
    const mines = [0, 1, 2, 3];
    const [a, b, c] = safeTiles(mines);
    let state = act(rigged(mines), { type: "reveal", index: a! });
    expect(state.phase).toBe("decide");
    state = act(state, { type: "reveal", index: b! }, { type: "reveal", index: c! });
    expect(state.sipsToGive).toBe(2);
    state = act(state, { type: "stop" });
    expect(state.phase).toBe("give");
    expect(act(state, { type: "give", playerId: "p1" })).toBe(state);
    state = act(state, { type: "give", playerId: "p2" }, { type: "give", playerId: "p3" });
    expect(state.lastPenalties).toEqual([
      { playerId: "p2", sips: 1 },
      { playerId: "p3", sips: 1 },
    ]);
    expect(state.order.turn).toBe(1);
  });

  it("gives all the sips in one tap at high adaptive levels", () => {
    const mines = [0, 1, 2, 3];
    const [a, b, c] = safeTiles(mines);
    let state = act(rigged(mines), { type: "reveal", index: a! }, { type: "reveal", index: b! }, { type: "reveal", index: c! }, { type: "stop" });
    state = act(state, { type: "give", playerId: "p3", all: true });
    expect(state.lastPenalties).toEqual([{ playerId: "p3", sips: 2 }]);
  });

  it("charges a mine more the further the player pushed, capped; earned sips are lost", () => {
    expect(mineSips("normal", 0, false)).toBe(2);
    expect(mineSips("normal", 4, false)).toBe(MINE_CAP.normal);
    expect(mineSips("extreme", 1, true)).toBe(6);
    const mines = [0, 1, 2, 3];
    const [a, b] = safeTiles(mines);
    let state = act(rigged(mines), { type: "reveal", index: a! }, { type: "reveal", index: b! }, { type: "reveal", index: 0 });
    expect(state.phase).toBe("boom");
    expect(state.lastPenalties).toEqual([{ playerId: "p1", sips: 3 }]);
    expect(state.sipsToGive).toBe(0);
  });

  it("ignores a tap on an open tile", () => {
    const state = act(rigged([0, 1, 2, 3]), { type: "reveal", index: 10 });
    expect(act(state, { type: "reveal", index: 10 })).toBe(state);
  });

  it("asks for two tiles before stopping at Extreme", () => {
    const mines = [0, 1, 2, 3, 4, 5, 6];
    const [a] = safeTiles(mines);
    const state = act(rigged(mines, "extreme"), { type: "reveal", index: a! });
    expect(state.phase).toBe("reveal");
    expect(act(state, { type: "stop" })).toBe(state);
  });

  it("ends the grid when the last mine blows or no safe tile is left", () => {
    let state = rigged([0]);
    state = act(state, { type: "reveal", index: 0 }, { type: "continue" });
    expect(minesLeft(state.grid)).toBe(0);
    expect(gridIsOver(state.grid)).toBe(true);
    expect(state.phase).toBe("gridEnd");
  });

  it("ends the game after the set grids", () => {
    let state = { ...rigged([0]), grids: 1 };
    state = act(state, { type: "reveal", index: 0 }, { type: "continue" }, { type: "nextGrid" });
    expect(state.phase).toBe("end");
    expect(state.endReason).toBe("completed");
  });

  it("ends the turn with no penalty when the player whose turn it is leaves", () => {
    const mines = [0, 1, 2, 3];
    let state = act(rigged(mines), { type: "reveal", index: safeTiles(mines)[0]! });
    state = act(state, { type: "removePlayer", playerId: "p1" });
    expect(state.phase).toBe("reveal");
    expect(state.order.players[state.order.turn]?.id).toBe("p2");
    expect(state.ledger).toEqual({});
  });

  it("gives back sips meant for a player who leaves during the hand-out", () => {
    const mines = [0, 1, 2, 3];
    const [a, b, c] = safeTiles(mines);
    let state = act(rigged(mines), { type: "reveal", index: a! }, { type: "reveal", index: b! }, { type: "reveal", index: c! }, { type: "stop" });
    state = act(state, { type: "give", playerId: "p2" });
    state = act(state, { type: "removePlayer", playerId: "p2" });
    expect(state.sipsToGive).toBe(2);
  });
});
