// O-60 Short Straw: everyone holds a finger on the screen, the phone keeps one. The chosen one is a finger,
// identified by its touch, never a name picked by order (the prototype named "finger 1 = Hugo").

import { addPenalties, type GameLevel, type PenaltyLedger, type PenaltyLine } from "../core";
import { pickOne, type Random } from "../random";

export const FINGER_MAX = 10;
export const FINGER_MIN = 2;
/** Fingers must stay still this long before the phone picks (the ripples run meanwhile). */
export const FINGER_SETTLE_MS = 1_600;
export const FINGER_SIPS: Readonly<Record<GameLevel, number>> = { normal: 2, hard: 3, extreme: 4 };

export interface Finger {
  /** The touch identifier given by the OS. */
  id: string;
  x: number;
  y: number;
  /** Arrival order, for a stable colour. */
  slot: number;
}

export interface FingerPickState {
  level: GameLevel;
  fingers: Finger[];
  /** Last time a finger was added or lifted. */
  changedAt: number;
  phase: "waiting" | "settling" | "chosen";
  chosenId: string | null;
  chosenAt: number | null;
  round: number;
  ledger: PenaltyLedger;
  lastPenalties: PenaltyLine[];
  nextSlot: number;
}

export type FingerPickAction =
  | { type: "down"; id: string; x: number; y: number; at: number }
  | { type: "move"; id: string; x: number; y: number }
  | { type: "up"; id: string; at: number }
  | { type: "tick"; at: number }
  /** Optional: the table says whose finger it was, to count the penalty (O-49). */
  | { type: "assign"; playerId: string }
  | { type: "reset" };

export function createFingerPick(level: GameLevel): FingerPickState {
  return { level, fingers: [], changedAt: 0, phase: "waiting", chosenId: null, chosenAt: null, round: 1, ledger: {}, lastPenalties: [], nextSlot: 0 };
}

export function fingerPickReducer(state: FingerPickState, action: FingerPickAction, rng: Random): FingerPickState {
  switch (action.type) {
    case "down": {
      if (state.phase === "chosen" || state.fingers.length >= FINGER_MAX) return state;
      if (state.fingers.some((f) => f.id === action.id)) return state;
      const fingers = [...state.fingers, { id: action.id, x: action.x, y: action.y, slot: state.nextSlot }];
      return { ...state, fingers, changedAt: action.at, nextSlot: state.nextSlot + 1, phase: fingers.length >= FINGER_MIN ? "settling" : "waiting" };
    }
    case "move": {
      // Moving a held finger does not restart the countdown; only adding or lifting one does.
      const fingers = state.fingers.map((f) => (f.id === action.id ? { ...f, x: action.x, y: action.y } : f));
      return { ...state, fingers };
    }
    case "up": {
      // After the pick, the fingers stay drawn where they were so everyone sees whose it is.
      if (state.phase === "chosen" || !state.fingers.some((f) => f.id === action.id)) return state;
      const fingers = state.fingers.filter((f) => f.id !== action.id);
      return { ...state, fingers, changedAt: action.at, phase: fingers.length >= FINGER_MIN ? "settling" : "waiting" };
    }
    case "tick": {
      if (state.phase !== "settling" || action.at - state.changedAt < FINGER_SETTLE_MS) return state;
      const chosen = pickOne(rng, state.fingers);
      return { ...state, phase: "chosen", chosenId: chosen.id, chosenAt: action.at };
    }
    case "assign": {
      if (state.phase !== "chosen" || state.lastPenalties.length > 0) return state;
      const lines = [{ playerId: action.playerId, sips: FINGER_SIPS[state.level] }];
      return { ...state, ledger: addPenalties(state.ledger, lines), lastPenalties: lines };
    }
    case "reset":
      return { ...state, fingers: [], phase: "waiting", chosenId: null, chosenAt: null, round: state.phase === "chosen" ? state.round + 1 : state.round, lastPenalties: [] };
  }
}

/** Progress of the settle countdown, 0 to 1, for the ripple suspense. */
export function settleProgress(state: FingerPickState, now: number): number {
  if (state.phase !== "settling") return state.phase === "chosen" ? 1 : 0;
  return Math.min(1, Math.max(0, (now - state.changedAt) / FINGER_SETTLE_MS));
}
