// O-59 Minefield (research/games.md §2.3): a shared 5x5 grid, push your luck. Every extra safe tile
// in one turn is a sip to give; a mine costs more the further you pushed. Mines never share a tile.

import {
  addPenalties,
  addToOrder,
  currentPlayer,
  mergePenalties,
  nextTurn,
  removeFromOrder,
  withPlayer,
  type EndReason,
  type GameLevel,
  type PenaltyLedger,
  type PenaltyLine,
  type Player,
  type TurnOrder,
} from "../core";
import { distinctIndices, randomInt, type Random } from "../random";

export const GRID_SIDE = 5;
export const GRID_TILES = GRID_SIDE * GRID_SIDE;
export const MINE_COUNT: Readonly<Record<GameLevel, number>> = { normal: 4, hard: 6, extreme: 7 };
export const MINE_CAP: Readonly<Record<GameLevel, number>> = { normal: 3, hard: 5, extreme: 7 };
export const MINE_BASE_SIPS = 2;
/** Extreme: at least two tiles before you may stop. */
export const MIN_TILES_PER_TURN: Readonly<Record<GameLevel, number>> = { normal: 1, hard: 1, extreme: 2 };

export interface MineGrid {
  mines: number[];
  /** Extreme: one mine counts double. */
  bigMine: number | null;
  revealed: boolean[];
  exploded: number[];
}

export type MinefieldPhase = "reveal" | "decide" | "give" | "boom" | "gridEnd" | "end";

export interface MinefieldState {
  level: GameLevel;
  order: TurnOrder;
  roster: Player[];
  grid: MineGrid;
  gridNumber: number;
  grids: number | null;
  phase: MinefieldPhase;
  tilesThisTurn: number;
  sipsToGive: number;
  given: PenaltyLine[];
  lastTile: number | null;
  ledger: PenaltyLedger;
  lastPenalties: PenaltyLine[];
  minesHit: Readonly<Record<string, number>>;
  bestTurn: Readonly<Record<string, number>>;
  endReason: EndReason | null;
}

export type MinefieldAction =
  | { type: "reveal"; index: number }
  | { type: "stop" }
  | { type: "give"; playerId: string; all?: boolean }
  | { type: "continue" }
  | { type: "nextGrid" }
  | { type: "removePlayer"; playerId: string }
  | { type: "addPlayer"; player: Player }
  | { type: "endGame" };

/** Mines drawn without replacement: the prototype could put two on one tile and show fewer than it said. */
export function createGrid(level: GameLevel, rng: Random): MineGrid {
  const mines = distinctIndices(rng, GRID_TILES, MINE_COUNT[level]);
  const bigMine = level === "extreme" ? (mines[randomInt(rng, 0, mines.length - 1)] as number) : null;
  return { mines, bigMine, revealed: Array.from({ length: GRID_TILES }, () => false), exploded: [] };
}

export function defaultGrids(playerCount: number): number {
  return Math.max(3, Math.ceil(playerCount / 3));
}

export function neighbours(index: number): number[] {
  const row = Math.floor(index / GRID_SIDE);
  const col = index % GRID_SIDE;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < GRID_SIDE && c >= 0 && c < GRID_SIDE) out.push(r * GRID_SIDE + c);
    }
  }
  return out;
}

/** Minesweeper help, shown at Normal only. */
export function touchingMines(grid: MineGrid, index: number): number {
  return neighbours(index).filter((n) => grid.mines.includes(n)).length;
}

export function minesLeft(grid: MineGrid): number {
  return grid.mines.length - grid.exploded.length;
}

export function hiddenTiles(grid: MineGrid): number {
  return grid.revealed.filter((r) => !r).length;
}

export function safeTilesLeft(grid: MineGrid): number {
  return grid.revealed.filter((r, i) => !r && !grid.mines.includes(i)).length;
}

export function gridIsOver(grid: MineGrid): boolean {
  return minesLeft(grid) === 0 || safeTilesLeft(grid) === 0;
}

/** Penalty for a mine after `tilesBefore` safe tiles this turn. */
export function mineSips(level: GameLevel, tilesBefore: number, big: boolean): number {
  const sips = (MINE_BASE_SIPS + tilesBefore) * (big ? 2 : 1);
  return Math.min(MINE_CAP[level], sips);
}

export function createMinefield(options: { players: Player[]; level: GameLevel; grids?: number | null; rng: Random }): MinefieldState {
  const enough = options.players.length >= 2;
  return {
    level: options.level,
    order: { players: [...options.players], turn: 0 },
    roster: [...options.players],
    grid: createGrid(options.level, options.rng),
    gridNumber: 1,
    grids: options.grids === undefined ? defaultGrids(options.players.length) : options.grids,
    phase: enough ? "reveal" : "end",
    tilesThisTurn: 0,
    sipsToGive: 0,
    given: [],
    lastTile: null,
    ledger: {},
    lastPenalties: [],
    minesHit: {},
    bestTurn: {},
    endReason: enough ? null : "notEnoughPlayers",
  };
}

function endTurn(state: MinefieldState, lines: PenaltyLine[]): MinefieldState {
  const merged = mergePenalties(lines);
  const base = {
    ...state,
    ledger: addPenalties(state.ledger, merged),
    lastPenalties: merged,
    tilesThisTurn: 0,
    sipsToGive: 0,
    given: [],
    order: nextTurn(state.order),
  };
  return gridIsOver(state.grid) ? { ...base, phase: "gridEnd" } : { ...base, phase: "reveal" };
}

export function minefieldReducer(state: MinefieldState, action: MinefieldAction, rng: Random): MinefieldState {
  if (state.phase === "end" && action.type !== "addPlayer") return state;
  switch (action.type) {
    case "reveal": {
      if (state.phase !== "reveal" && state.phase !== "decide") return state;
      const { grid } = state;
      // A tap on an open tile, or a second tap during the reveal, does nothing (ADP-04).
      if (action.index < 0 || action.index >= GRID_TILES || grid.revealed[action.index]) return state;
      const player = currentPlayer(state.order);
      if (!player) return state;
      const revealed = [...grid.revealed];
      revealed[action.index] = true;
      if (grid.mines.includes(action.index)) {
        const sips = mineSips(state.level, state.tilesThisTurn, grid.bigMine === action.index);
        const nextGrid = { ...grid, revealed, exploded: [...grid.exploded, action.index] };
        const lines = [{ playerId: player.id, sips }];
        // The sips earned this turn are lost with the mine.
        return {
          ...state,
          grid: nextGrid,
          phase: "boom",
          lastTile: action.index,
          sipsToGive: 0,
          given: [],
          ledger: addPenalties(state.ledger, lines),
          lastPenalties: lines,
          minesHit: { ...state.minesHit, [player.id]: (state.minesHit[player.id] ?? 0) + 1 },
        };
      }
      const tilesThisTurn = state.tilesThisTurn + 1;
      const nextGrid = { ...grid, revealed };
      const next: MinefieldState = {
        ...state,
        grid: nextGrid,
        lastTile: action.index,
        tilesThisTurn,
        sipsToGive: state.sipsToGive + (tilesThisTurn > 1 ? 1 : 0),
        bestTurn: { ...state.bestTurn, [player.id]: Math.max(state.bestTurn[player.id] ?? 0, tilesThisTurn) },
        lastPenalties: [],
      };
      if (safeTilesLeft(nextGrid) === 0) return next.sipsToGive > 0 ? { ...next, phase: "give" } : endTurn(next, []);
      return { ...next, phase: tilesThisTurn >= MIN_TILES_PER_TURN[state.level] ? "decide" : "reveal" };
    }
    case "stop": {
      if (state.phase !== "decide") return state;
      return state.sipsToGive > 0 ? { ...state, phase: "give" } : endTurn(state, []);
    }
    case "give": {
      if (state.phase !== "give") return state;
      const giver = currentPlayer(state.order);
      if (!giver || giver.id === action.playerId || !state.order.players.some((p) => p.id === action.playerId)) return state;
      const amount = action.all ? state.sipsToGive : 1;
      const given = [...state.given, { playerId: action.playerId, sips: amount }];
      const sipsToGive = state.sipsToGive - amount;
      if (sipsToGive > 0) return { ...state, given, sipsToGive };
      return endTurn({ ...state, given: [], sipsToGive: 0 }, given);
    }
    case "continue":
      if (state.phase !== "boom") return state;
      return endTurn({ ...state, lastPenalties: [] }, []);
    case "nextGrid": {
      if (state.phase !== "gridEnd") return state;
      if (state.grids !== null && state.gridNumber >= state.grids) return { ...state, phase: "end", endReason: "completed" };
      return { ...state, grid: createGrid(state.level, rng), gridNumber: state.gridNumber + 1, phase: "reveal", lastTile: null, lastPenalties: [] };
    }
    case "removePlayer": {
      const wasCurrent = currentPlayer(state.order)?.id === action.playerId;
      const order = removeFromOrder(state.order, action.playerId);
      const given = state.given.filter((line) => line.playerId !== action.playerId);
      if (order.players.length < 2) return { ...state, order, given, phase: "end", endReason: "notEnoughPlayers" };
      if (wasCurrent && state.phase !== "gridEnd") {
        // Their turn ends with no penalty; the next player starts a fresh turn.
        const phase = gridIsOver(state.grid) ? "gridEnd" : "reveal";
        return { ...state, order, given: [], sipsToGive: 0, tilesThisTurn: 0, phase };
      }
      if (state.phase === "give") {
        // Sips meant for the player who left go back to the giver's pool.
        const lost = state.given.length - given.length;
        const back = state.given.filter((line) => line.playerId === action.playerId).reduce((sum, line) => sum + line.sips, 0);
        return { ...state, order, given, sipsToGive: state.sipsToGive + (lost > 0 ? back : 0) };
      }
      return { ...state, order, given };
    }
    case "addPlayer": {
      if (state.order.players.some((p) => p.id === action.player.id)) return state;
      const order = addToOrder(state.order, action.player);
      const reopened = state.phase === "end" && state.endReason === "notEnoughPlayers";
      return {
        ...state,
        order,
        roster: withPlayer(state.roster, action.player),
        phase: reopened ? (gridIsOver(state.grid) ? "gridEnd" : "reveal") : state.phase,
        endReason: reopened ? null : state.endReason,
      };
    }
    case "endGame":
      return { ...state, phase: "end", endReason: "stopped" };
  }
}
