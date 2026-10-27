// O-63 Quick Draw, pass-the-phone mode: the drawer sees a word, draws it against the clock, the others
// shout guesses; the drawer taps who found it. Online play reuses this engine with a remote DrawingTransport.

import {
  addPenalties,
  addToOrder,
  currentPlayer,
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
import type { DrawWordContent } from "../content/types";
import { leveledDeck, type LeveledItem } from "../deck";
import type { Random } from "../random";

export const QUICK_DRAW_TIME_MS: Readonly<Record<GameLevel, number>> = { normal: 75_000, hard: 60_000, extreme: 45_000 };
/** Nobody found it in time: the drawer pays. */
export const QUICK_DRAW_SIPS: Readonly<Record<GameLevel, number>> = { normal: 2, hard: 2, extreme: 3 };
export const QUICK_DRAW_MIN_PLAYERS = 3;
/** The drawer may swap a word they cannot draw, once per turn. */
export const QUICK_DRAW_SWAPS = 1;

export type QuickDrawPhase = "ready" | "drawing" | "found" | "timeUp" | "end";

export interface QuickDrawState {
  level: GameLevel;
  order: TurnOrder;
  roster: Player[];
  words: LeveledItem<string>[];
  content: DrawWordContent;
  word: string;
  swapsLeft: number;
  phase: QuickDrawPhase;
  elapsedMs: number;
  timeLimitMs: number;
  guesserId: string | null;
  /** Each player draws this many times. */
  turnsEach: number;
  turnsPlayed: number;
  scores: Readonly<Record<string, number>>;
  ledger: PenaltyLedger;
  lastPenalties: PenaltyLine[];
  endReason: EndReason | null;
}

export type QuickDrawAction =
  | { type: "swapWord" }
  | { type: "start" }
  | { type: "tick"; deltaMs: number }
  | { type: "found"; guesserId: string }
  | { type: "next" }
  | { type: "removePlayer"; playerId: string }
  | { type: "addPlayer"; player: Player }
  | { type: "stop" };

function drawWord(state: Pick<QuickDrawState, "words" | "content" | "level">, rng: Random): { word: string; words: LeveledItem<string>[] } {
  let words = state.words;
  if (words.length === 0) words = leveledDeck(state.content, state.level, null, rng);
  const [first, ...rest] = words;
  return { word: first?.value ?? "", words: rest };
}

export function createQuickDraw(options: { players: Player[]; level: GameLevel; content: DrawWordContent; turnsEach?: number; rng: Random }): QuickDrawState {
  const base = { words: leveledDeck(options.content, options.level, null, options.rng), content: options.content, level: options.level };
  const drawn = drawWord(base, options.rng);
  const enough = options.players.length >= QUICK_DRAW_MIN_PLAYERS;
  return {
    level: options.level,
    order: { players: [...options.players], turn: 0 },
    roster: [...options.players],
    words: drawn.words,
    content: options.content,
    word: drawn.word,
    swapsLeft: QUICK_DRAW_SWAPS,
    phase: enough ? "ready" : "end",
    elapsedMs: 0,
    timeLimitMs: QUICK_DRAW_TIME_MS[options.level],
    guesserId: null,
    turnsEach: options.turnsEach ?? 1,
    turnsPlayed: 0,
    scores: {},
    ledger: {},
    lastPenalties: [],
    endReason: enough ? null : "notEnoughPlayers",
  };
}

export function timeLeftMs(state: QuickDrawState): number {
  return Math.max(0, state.timeLimitMs - state.elapsedMs);
}

function freshTurn(state: QuickDrawState, rng: Random): QuickDrawState {
  const drawn = drawWord(state, rng);
  return { ...state, word: drawn.word, words: drawn.words, swapsLeft: QUICK_DRAW_SWAPS, phase: "ready", elapsedMs: 0, guesserId: null, lastPenalties: [] };
}

export function quickDrawReducer(state: QuickDrawState, action: QuickDrawAction, rng: Random): QuickDrawState {
  if (state.phase === "end" && action.type !== "addPlayer") return state;
  switch (action.type) {
    case "swapWord": {
      if (state.phase !== "ready" || state.swapsLeft <= 0) return state;
      const drawn = drawWord(state, rng);
      return { ...state, word: drawn.word, words: drawn.words, swapsLeft: state.swapsLeft - 1 };
    }
    case "start":
      return state.phase === "ready" ? { ...state, phase: "drawing", elapsedMs: 0 } : state;
    case "tick": {
      if (state.phase !== "drawing" || action.deltaMs <= 0) return state;
      const elapsedMs = Math.min(state.timeLimitMs, state.elapsedMs + action.deltaMs);
      if (elapsedMs < state.timeLimitMs) return { ...state, elapsedMs };
      const drawer = currentPlayer(state.order);
      const lines = drawer ? [{ playerId: drawer.id, sips: QUICK_DRAW_SIPS[state.level] }] : [];
      return { ...state, elapsedMs, phase: "timeUp", ledger: addPenalties(state.ledger, lines), lastPenalties: lines };
    }
    case "found": {
      if (state.phase !== "drawing") return state;
      const drawer = currentPlayer(state.order);
      if (!drawer || drawer.id === action.guesserId || !state.order.players.some((p) => p.id === action.guesserId)) return state;
      // A point each: the one who found it and the one who drew it well enough.
      const scores = { ...state.scores, [action.guesserId]: (state.scores[action.guesserId] ?? 0) + 1, [drawer.id]: (state.scores[drawer.id] ?? 0) + 1 };
      return { ...state, phase: "found", guesserId: action.guesserId, scores, lastPenalties: [] };
    }
    case "next": {
      if (state.phase !== "found" && state.phase !== "timeUp") return state;
      const turnsPlayed = state.turnsPlayed + 1;
      if (turnsPlayed >= state.turnsEach * state.order.players.length) return { ...state, turnsPlayed, phase: "end", endReason: "completed", lastPenalties: [] };
      return freshTurn({ ...state, turnsPlayed, order: nextTurn(state.order) }, rng);
    }
    case "removePlayer": {
      const wasDrawer = currentPlayer(state.order)?.id === action.playerId;
      const order = removeFromOrder(state.order, action.playerId);
      if (order.players.length < QUICK_DRAW_MIN_PLAYERS) return { ...state, order, phase: "end", endReason: "notEnoughPlayers" };
      // The drawer left: the next player gets a new word, the unfinished drawing does not count.
      if (wasDrawer && state.phase !== "found" && state.phase !== "timeUp") return freshTurn({ ...state, order }, rng);
      return { ...state, order };
    }
    case "addPlayer": {
      if (state.order.players.some((p) => p.id === action.player.id)) return state;
      const order = addToOrder(state.order, action.player);
      const roster = withPlayer(state.roster, action.player);
      if (state.phase === "end" && state.endReason === "notEnoughPlayers" && order.players.length >= QUICK_DRAW_MIN_PLAYERS) {
        return freshTurn({ ...state, order, roster, endReason: null }, rng);
      }
      return { ...state, order, roster };
    }
    case "stop":
      return { ...state, phase: "end", endReason: "stopped" };
  }
}
