// O-55 The Wheel: one segment per player, a real deceleration, and the loser is read from the final angle
// once the wheel has stopped (the prototype showed it at the tap).

import { addPenalties, withPlayer, type EndReason, type GameLevel, type PenaltyLedger, type PenaltyLine, type Player } from "../core";
import type { Random } from "../random";

export const WHEEL_TURNS = 5;
export const WHEEL_SPIN_MS = 4_000;
export const WHEEL_SIPS: Readonly<Record<GameLevel, number>> = { normal: 2, hard: 3, extreme: 4 };
/** The pointer never stops this close to a line between two names (share of a segment). */
export const WHEEL_EDGE_MARGIN = 0.1;

export interface WheelState {
  level: GameLevel;
  players: Player[];
  roster: Player[];
  /** Cumulative clockwise rotation of the wheel in degrees. */
  rotationDeg: number;
  /** Where the current spin will stop. Only read once the spin is over. */
  targetDeg: number;
  phase: "idle" | "spinning" | "result" | "end";
  resultId: string | null;
  round: number;
  ledger: PenaltyLedger;
  lastPenalties: PenaltyLine[];
  losses: Readonly<Record<string, number>>;
  endReason: EndReason | null;
}

export type WheelAction =
  | { type: "spin" }
  /** The wheel has stopped on screen. */
  | { type: "settle" }
  | { type: "removePlayer"; playerId: string }
  | { type: "addPlayer"; player: Player }
  | { type: "stop" };

/** Index of the segment under the pointer (at the top) for a wheel turned clockwise by `rotationDeg`. */
export function segmentIndexAt(rotationDeg: number, count: number): number {
  if (count <= 0) return -1;
  const size = 360 / count;
  const underPointer = (((360 - (rotationDeg % 360)) % 360) + 360) % 360;
  return Math.min(count - 1, Math.floor(underPointer / size));
}

export function createWheel(options: { players: Player[]; level: GameLevel }): WheelState {
  const enough = options.players.length >= 2;
  return {
    level: options.level,
    players: [...options.players],
    roster: [...options.players],
    rotationDeg: 0,
    targetDeg: 0,
    phase: enough ? "idle" : "end",
    resultId: null,
    round: 1,
    ledger: {},
    lastPenalties: [],
    losses: {},
    endReason: enough ? null : "notEnoughPlayers",
  };
}

function spinTarget(rotationDeg: number, count: number, rng: Random): number {
  const size = 360 / count;
  let extra = rng.next() * 360;
  // Keep the pointer clear of the lines: nobody argues over a name split in two.
  const into = (((360 - ((rotationDeg + extra) % 360)) % 360) + 360) % 360 % size;
  const margin = size * WHEEL_EDGE_MARGIN;
  if (into < margin) extra -= margin - into;
  else if (into > size - margin) extra += into - (size - margin);
  return rotationDeg + WHEEL_TURNS * 360 + extra;
}

export function wheelReducer(state: WheelState, action: WheelAction, rng: Random): WheelState {
  if (state.phase === "end" && action.type !== "addPlayer") return state;
  switch (action.type) {
    case "spin": {
      if (state.phase !== "idle" && state.phase !== "result") return state;
      const round = state.phase === "result" ? state.round + 1 : state.round;
      return { ...state, phase: "spinning", targetDeg: spinTarget(state.rotationDeg, state.players.length, rng), resultId: null, lastPenalties: [], round };
    }
    case "settle": {
      if (state.phase !== "spinning") return state;
      const loser = state.players[segmentIndexAt(state.targetDeg, state.players.length)];
      if (!loser) return state;
      const lines = [{ playerId: loser.id, sips: WHEEL_SIPS[state.level] }];
      return {
        ...state,
        phase: "result",
        rotationDeg: state.targetDeg,
        resultId: loser.id,
        ledger: addPenalties(state.ledger, lines),
        lastPenalties: lines,
        losses: { ...state.losses, [loser.id]: (state.losses[loser.id] ?? 0) + 1 },
      };
    }
    case "removePlayer": {
      if (!state.players.some((p) => p.id === action.playerId)) return state;
      const players = state.players.filter((p) => p.id !== action.playerId);
      // Segments change size: a spin in progress is called off, nobody pays for it.
      const cancelled = state.phase === "spinning";
      if (players.length < 2) return { ...state, players, phase: "end", endReason: "notEnoughPlayers" };
      return { ...state, players, phase: cancelled ? "idle" : state.phase, rotationDeg: cancelled ? state.targetDeg : state.rotationDeg };
    }
    case "addPlayer": {
      if (state.players.some((p) => p.id === action.player.id)) return state;
      const players = [...state.players, action.player];
      const cancelled = state.phase === "spinning";
      const reopened = state.phase === "end" && state.endReason === "notEnoughPlayers" && players.length >= 2;
      return {
        ...state,
        players,
        roster: withPlayer(state.roster, action.player),
        phase: cancelled || reopened ? "idle" : state.phase,
        rotationDeg: cancelled ? state.targetDeg : state.rotationDeg,
        endReason: reopened ? null : state.endReason,
      };
    }
    case "stop":
      return { ...state, phase: "end", endReason: "stopped" };
  }
}
