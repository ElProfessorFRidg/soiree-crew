// O-64 Bail Out (research/games.md §2.4): the curve climbs, the number is what the crash costs in sips,
// get out before it falls. The crash point is heavy-tailed (most rounds end early, a few go very high).

import { addPenalties, mergePenalties, withPlayer, type EndReason, type GameLevel, type PenaltyLedger, type PenaltyLine, type Player } from "../core";
import type { Random } from "../random";

/** Time for the curve to double. Starting values for playtests (A-GAMES-10). */
export const CRASH_DOUBLING_MS: Readonly<Record<GameLevel, number>> = { normal: 4_000, hard: 3_500, extreme: 3_000 };
/** Normal never crashes before this, so nobody busts at the start. */
export const CRASH_FLOOR: Readonly<Record<GameLevel, number>> = { normal: 1.2, hard: 1, extreme: 1 };
export const CRASH_STAKE_CAP: Readonly<Record<GameLevel, number>> = { normal: 3, hard: 5, extreme: 8 };
/** Extreme: about one round in 25 busts at once; everyone still in takes 1. */
export const CRASH_INSTANT_BUST_CHANCE = 1 / 25;
export const CRASH_FIRST_OUT_SIPS = 1;
/** Extreme: the best exit hands out its stake, capped. */
export const CRASH_EXTREME_AWARD_CAP = 3;
export const CRASH_DEFAULT_ROUNDS = 10;
/** One phone, one tile per finger: past this, tiles get too small (6 at adaptive level 2). */
export const CRASH_MAX_TILES = 8;

export type CrashPhase = "idle" | "running" | "award" | "crashed" | "end";

export interface CrashExit {
  multiplier: number;
  atMs: number;
}

export interface CrashState {
  level: GameLevel;
  players: Player[];
  roster: Player[];
  round: number;
  rounds: number | null;
  phase: CrashPhase;
  /** Drawn when the round starts, never shown before the crash. */
  crashPoint: number;
  elapsedMs: number;
  multiplier: number;
  exits: Readonly<Record<string, CrashExit>>;
  /** Joined during this round: neither in nor out until the next one. */
  sittingOut: string[];
  /** Hard and Extreme: the best exit of the round and the sips it hands out. */
  award: { playerId: string; sips: number } | null;
  ledger: PenaltyLedger;
  lastPenalties: PenaltyLine[];
  /** Best exit stake per player over the game, and how often each was caught by the crash. */
  bestExit: Readonly<Record<string, number>>;
  caught: Readonly<Record<string, number>>;
  endReason: EndReason | null;
}

export type CrashAction =
  | { type: "start" }
  | { type: "tick"; deltaMs: number }
  | { type: "exit"; playerId: string }
  | { type: "award"; targetId: string }
  | { type: "next" }
  /** The app went to the background mid-round: the round is called off, nobody pays (no pausing a live curve). */
  | { type: "cancel" }
  | { type: "removePlayer"; playerId: string }
  | { type: "addPlayer"; player: Player }
  | { type: "stop" };

/**
 * Heavy tail: the chance the curve passes x is about 1/x, so half the rounds crash before 2
 * and one in ten passes 10 (the prototype's uniform draw made x1.5 a free exit).
 */
export function drawCrashPoint(level: GameLevel, rng: Random): number {
  if (level === "extreme" && rng.next() < CRASH_INSTANT_BUST_CHANCE) return 1;
  const u = 1 - rng.next();
  return Math.max(CRASH_FLOOR[level], 1 / u);
}

export function multiplierAt(level: GameLevel, elapsedMs: number): number {
  return 2 ** (elapsedMs / CRASH_DOUBLING_MS[level]);
}

/** Time at which the curve reaches `multiplier`. */
export function msToReach(level: GameLevel, multiplier: number): number {
  return Math.log2(multiplier) * CRASH_DOUBLING_MS[level];
}

/** The number on screen: whole sips at stake, never a decimal multiplier (no casino look). */
export function stakeAt(level: GameLevel, multiplier: number): number {
  return Math.min(CRASH_STAKE_CAP[level], Math.max(1, Math.floor(multiplier)));
}

export function createCrash(options: { players: Player[]; level: GameLevel; rounds?: number | null }): CrashState {
  const enough = options.players.length >= 2;
  return {
    level: options.level,
    players: [...options.players],
    roster: [...options.players],
    round: 1,
    rounds: options.rounds === undefined ? CRASH_DEFAULT_ROUNDS : options.rounds,
    phase: enough ? "idle" : "end",
    crashPoint: 0,
    elapsedMs: 0,
    multiplier: 1,
    exits: {},
    sittingOut: [],
    award: null,
    ledger: {},
    lastPenalties: [],
    bestExit: {},
    caught: {},
    endReason: enough ? null : "notEnoughPlayers",
  };
}

export function stillIn(state: CrashState): Player[] {
  return state.players.filter((p) => !state.exits[p.id] && !state.sittingOut.includes(p.id));
}

function resolveCrash(state: CrashState): CrashState {
  const instantBust = state.crashPoint <= 1;
  const stake = instantBust ? 1 : stakeAt(state.level, state.crashPoint);
  const caughtPlayers = stillIn(state);
  const lines: PenaltyLine[] = caughtPlayers.map((p) => ({ playerId: p.id, sips: stake }));

  const exited = Object.entries(state.exits)
    .filter(([id]) => state.players.some((p) => p.id === id))
    .sort((a, b) => a[1].atMs - b[1].atMs);
  // Leaving at once is not free: the first one out pays 1, unless nobody else got out.
  const firstOut = exited[0];
  if (firstOut && exited.length > 1) lines.push({ playerId: firstOut[0], sips: CRASH_FIRST_OUT_SIPS });

  const caught = { ...state.caught };
  for (const p of caughtPlayers) caught[p.id] = (caught[p.id] ?? 0) + 1;

  let award: CrashState["award"] = null;
  const best = [...exited].sort((a, b) => b[1].multiplier - a[1].multiplier || a[1].atMs - b[1].atMs)[0];
  if (best && state.level !== "normal") {
    const sips = state.level === "hard" ? 1 : Math.min(CRASH_EXTREME_AWARD_CAP, stakeAt(state.level, best[1].multiplier));
    award = { playerId: best[0], sips };
  }
  const merged = mergePenalties(lines);
  return {
    ...state,
    phase: award && state.players.length > 1 ? "award" : "crashed",
    elapsedMs: msToReach(state.level, Math.max(1, state.crashPoint)),
    multiplier: Math.max(1, state.crashPoint),
    award,
    ledger: addPenalties(state.ledger, merged),
    lastPenalties: merged,
    caught,
  };
}

export function crashReducer(state: CrashState, action: CrashAction, rng: Random): CrashState {
  if (state.phase === "end" && action.type !== "addPlayer") return state;
  switch (action.type) {
    case "start": {
      if (state.phase !== "idle") return state;
      const crashPoint = drawCrashPoint(state.level, rng);
      const started = { ...state, phase: "running" as const, crashPoint, elapsedMs: 0, multiplier: 1, exits: {}, award: null, lastPenalties: [] };
      return crashPoint <= 1 ? resolveCrash(started) : started;
    }
    case "tick": {
      if (state.phase !== "running" || action.deltaMs <= 0) return state;
      const elapsedMs = state.elapsedMs + action.deltaMs;
      const multiplier = multiplierAt(state.level, elapsedMs);
      if (multiplier >= state.crashPoint) return resolveCrash({ ...state, elapsedMs, multiplier });
      return { ...state, elapsedMs, multiplier };
    }
    case "exit": {
      // Exits after the crash are refused; an exit cannot be undone.
      if (state.phase !== "running" || state.exits[action.playerId] || !stillIn(state).some((p) => p.id === action.playerId)) return state;
      const exits = { ...state.exits, [action.playerId]: { multiplier: state.multiplier, atMs: state.elapsedMs } };
      const stake = stakeAt(state.level, state.multiplier);
      const bestExit = { ...state.bestExit, [action.playerId]: Math.max(state.bestExit[action.playerId] ?? 0, stake) };
      return { ...state, exits, bestExit };
    }
    case "award": {
      if (state.phase !== "award" || !state.award || action.targetId === state.award.playerId) return state;
      if (!state.players.some((p) => p.id === action.targetId)) return state;
      const line = { playerId: action.targetId, sips: state.award.sips };
      return { ...state, phase: "crashed", ledger: addPenalties(state.ledger, [line]), lastPenalties: mergePenalties([...state.lastPenalties, line]) };
    }
    case "next": {
      if (state.phase !== "crashed" && state.phase !== "award") return state;
      if (state.rounds !== null && state.round >= state.rounds) return { ...state, phase: "end", endReason: "completed", lastPenalties: [] };
      return { ...state, phase: "idle", round: state.round + 1, elapsedMs: 0, multiplier: 1, exits: {}, sittingOut: [], award: null, lastPenalties: [] };
    }
    case "cancel":
      if (state.phase !== "running") return state;
      return { ...state, phase: "idle", elapsedMs: 0, multiplier: 1, exits: {}, sittingOut: [], award: null };
    case "removePlayer": {
      if (!state.players.some((p) => p.id === action.playerId)) return state;
      const players = state.players.filter((p) => p.id !== action.playerId);
      const { [action.playerId]: _gone, ...exits } = state.exits;
      if (players.length < 2) return { ...state, players, exits, phase: "end", endReason: "notEnoughPlayers" };
      const award = state.award?.playerId === action.playerId ? null : state.award;
      const phase = state.phase === "award" && !award ? "crashed" : state.phase;
      return { ...state, players, exits, award, phase };
    }
    case "addPlayer": {
      if (state.players.some((p) => p.id === action.player.id) || state.players.length >= CRASH_MAX_TILES) return state;
      const players = [...state.players, action.player];
      const roster = withPlayer(state.roster, action.player);
      const reopened = state.phase === "end" && state.endReason === "notEnoughPlayers";
      // Mid-round a newcomer would be "in" without having chosen to be: they start next round.
      const sittingOut = state.phase === "running" ? [...state.sittingOut, action.player.id] : state.sittingOut;
      return { ...state, players, roster, sittingOut, phase: reopened ? "idle" : state.phase, endReason: reopened ? null : state.endReason };
    }
    case "stop":
      return { ...state, phase: "end", endReason: "stopped" };
  }
}
