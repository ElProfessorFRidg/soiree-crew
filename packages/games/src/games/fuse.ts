// O-54 Short Fuse (research/games.md §2.2): say a word that fits, pass the bomb, and whoever holds it
// when the hidden fuse ends takes the penalty.

import {
  addPenalties,
  addToOrder,
  currentPlayer,
  removeFromOrder,
  withPlayer,
  type EndReason,
  type GameLevel,
  type PenaltyLedger,
  type PenaltyLine,
  type Player,
  type TurnOrder,
} from "../core";
import type { FusePromptContent } from "../content/types";
import { leveledDeck } from "../deck";
import { randomInt, shuffle, type Random } from "../random";

/** Fuse length range in ms per level. Starting values for playtests (A-GAMES-6). */
export const FUSE_RANGE_MS: Readonly<Record<GameLevel, readonly [number, number]>> = {
  normal: [15_000, 40_000],
  hard: [10_000, 30_000],
  extreme: [6_000, 25_000],
};
/** The first holder always gets to say a word. */
export const FUSE_MIN_MS = 5_000;
/** A second tap this soon after a pass is the same tap (ADP-04): it never skips a player. */
export const PASS_LOCK_MS = 700;
export const FUSE_DEFAULT_ROUNDS = 10;
export const FUSE_SIPS: Readonly<Record<GameLevel, number>> = { normal: 2, hard: 3, extreme: 3 };
/** Extreme: the player who passed the bomb to the loser takes this much too. */
export const FUSE_PASSER_SIPS = 1;

export type FusePhase = "idle" | "burning" | "paused" | "exploded" | "end";

export interface FuseState {
  level: GameLevel;
  order: TurnOrder;
  roster: Player[];
  prompts: string[];
  promptPool: string[];
  prompt: string | null;
  round: number;
  rounds: number | null;
  phase: FusePhase;
  /** Hidden from the screen. Never used to drive colour, shake or tick speed. */
  fuseMs: number;
  elapsedMs: number;
  lastPassAtMs: number | null;
  passerId: string | null;
  ledger: PenaltyLedger;
  lastPenalties: PenaltyLine[];
  explosions: Readonly<Record<string, number>>;
  streaks: Readonly<Record<string, number>>;
  bestStreaks: Readonly<Record<string, number>>;
  endReason: EndReason | null;
}

export type FuseAction =
  | { type: "light" }
  | { type: "tick"; deltaMs: number }
  /** `targetId` is honoured at Extreme only ("free pass"); otherwise the bomb goes to the next player. */
  | { type: "pass"; targetId?: string }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "nextRound" }
  | { type: "removePlayer"; playerId: string }
  | { type: "addPlayer"; player: Player }
  | { type: "stop" };

export function drawFuse(level: GameLevel, rng: Random): number {
  const [min, max] = FUSE_RANGE_MS[level];
  return Math.max(FUSE_MIN_MS, randomInt(rng, min, max));
}

/**
 * Danger felt on screen, 0 to 1: elapsed time over the LONGEST fuse of the level, never over the real one,
 * so colour, shake and ticks grow without telling anyone when it will blow (fixes the prototype leak).
 */
export function fuseEscalation(state: Pick<FuseState, "level" | "elapsedMs">): number {
  return Math.min(1, state.elapsedMs / FUSE_RANGE_MS[state.level][1]);
}

/** Time to the next tick haptic. Normal ticks steadily, Hard speeds up, Extreme is irregular. */
export function fuseTickInterval(level: GameLevel, escalation: number, rng: Random): number {
  if (level === "normal") return 650;
  if (level === "hard") return Math.round(650 - 300 * escalation);
  return Math.round(600 - 330 * escalation + (rng.next() - 0.5) * 220);
}

export function createFuse(options: {
  players: Player[];
  level: GameLevel;
  content: FusePromptContent;
  rounds?: number | null;
  rng: Random;
}): FuseState {
  const prompts = leveledDeck(options.content, options.level, null, options.rng).map((p) => p.value);
  const [prompt, ...rest] = prompts;
  const enough = options.players.length >= 2;
  return {
    level: options.level,
    order: { players: [...options.players], turn: 0 },
    roster: [...options.players],
    prompts: rest,
    promptPool: prompts,
    prompt: prompt ?? null,
    round: 1,
    rounds: options.rounds === undefined ? FUSE_DEFAULT_ROUNDS : options.rounds,
    phase: enough ? "idle" : "end",
    fuseMs: 0,
    elapsedMs: 0,
    lastPassAtMs: null,
    passerId: null,
    ledger: {},
    lastPenalties: [],
    explosions: {},
    streaks: {},
    bestStreaks: {},
    endReason: enough ? null : "notEnoughPlayers",
  };
}

function explode(state: FuseState): FuseState {
  const holder = currentPlayer(state.order);
  if (!holder) return state;
  const lines: PenaltyLine[] = [{ playerId: holder.id, sips: FUSE_SIPS[state.level] }];
  const passerStillHere = state.passerId && state.passerId !== holder.id && state.order.players.some((p) => p.id === state.passerId);
  if (state.level === "extreme" && passerStillHere && state.passerId) lines.push({ playerId: state.passerId, sips: FUSE_PASSER_SIPS });
  const streaks: Record<string, number> = {};
  const bestStreaks: Record<string, number> = { ...state.bestStreaks };
  for (const p of state.order.players) {
    const value = p.id === holder.id ? 0 : (state.streaks[p.id] ?? 0) + 1;
    streaks[p.id] = value;
    bestStreaks[p.id] = Math.max(bestStreaks[p.id] ?? 0, value);
  }
  return {
    ...state,
    phase: "exploded",
    elapsedMs: state.fuseMs,
    ledger: addPenalties(state.ledger, lines),
    lastPenalties: lines,
    explosions: { ...state.explosions, [holder.id]: (state.explosions[holder.id] ?? 0) + 1 },
    streaks,
    bestStreaks,
  };
}

export function fuseReducer(state: FuseState, action: FuseAction, rng: Random): FuseState {
  if (state.phase === "end" && action.type !== "addPlayer") return state;
  switch (action.type) {
    case "light":
      if (state.phase !== "idle") return state;
      return { ...state, phase: "burning", fuseMs: drawFuse(state.level, rng), elapsedMs: 0, lastPassAtMs: null, passerId: null, lastPenalties: [] };
    case "tick": {
      if (state.phase !== "burning" || action.deltaMs <= 0) return state;
      const elapsedMs = state.elapsedMs + action.deltaMs;
      const next = { ...state, elapsedMs };
      return elapsedMs >= state.fuseMs ? explode(next) : next;
    }
    case "pass": {
      if (state.phase !== "burning") return state;
      if (state.lastPassAtMs !== null && state.elapsedMs - state.lastPassAtMs < PASS_LOCK_MS) return state;
      const holder = currentPlayer(state.order);
      if (!holder) return state;
      let turn = (state.order.turn + 1) % state.order.players.length;
      if (state.level === "extreme" && action.targetId && action.targetId !== holder.id) {
        const target = state.order.players.findIndex((p) => p.id === action.targetId);
        if (target >= 0) turn = target;
      }
      return { ...state, order: { ...state.order, turn }, lastPassAtMs: state.elapsedMs, passerId: holder.id };
    }
    case "pause":
      return state.phase === "burning" ? { ...state, phase: "paused" } : state;
    case "resume":
      // The holder stays the holder while paused, so stalling gains nothing.
      return state.phase === "paused" ? { ...state, phase: "burning" } : state;
    case "nextRound": {
      if (state.phase !== "exploded") return state;
      if (state.rounds !== null && state.round >= state.rounds) return { ...state, phase: "end", endReason: "completed", lastPenalties: [] };
      let [prompt, ...prompts] = state.prompts;
      if (!prompt) {
        // Deck used up: reshuffle rather than end a game the table wants to keep playing.
        [prompt, ...prompts] = shuffle(rng, state.promptPool.filter((p) => p !== state.prompt));
      }
      // The player who exploded starts the next round: they are still the current holder.
      return { ...state, phase: "idle", prompt: prompt ?? null, prompts, round: state.round + 1, elapsedMs: 0, lastPassAtMs: null, passerId: null, lastPenalties: [] };
    }
    case "removePlayer": {
      const order = removeFromOrder(state.order, action.playerId);
      if (order.players.length < 2) return { ...state, order, phase: "end", endReason: "notEnoughPlayers" };
      // A departing holder hands the bomb to the next player, with no penalty.
      const passerId = state.passerId === action.playerId ? null : state.passerId;
      return { ...state, order, passerId };
    }
    case "addPlayer": {
      if (state.order.players.some((p) => p.id === action.player.id)) return state;
      const order = addToOrder(state.order, action.player);
      const reopened = state.phase === "end" && state.endReason === "notEnoughPlayers";
      return { ...state, order, roster: withPlayer(state.roster, action.player), phase: reopened ? "idle" : state.phase, endReason: reopened ? null : state.endReason };
    }
    case "stop":
      return { ...state, phase: "end", endReason: "stopped" };
  }
}

export function fuseHolder(state: FuseState): Player | undefined {
  return currentPlayer(state.order);
}
