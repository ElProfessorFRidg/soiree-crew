// O-53 Point Blank (research/games.md §2.1): the reader reads a question, everyone points at someone on zero,
// the reader records the fingers, and fingers cost sips.

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
import type { PointBlankContent } from "../content/types";
import { leveledDeck } from "../deck";
import { shuffle, type Random } from "../random";

export interface PointBlankCard {
  id: string;
  text: string;
  /** Extreme only: just the reader sees it, and names someone out loud. */
  secret: boolean;
}

export type PointBlankPhase = "idle" | "read" | "record" | "secretName" | "secretChoice" | "result" | "end";

export interface PointBlankState {
  level: GameLevel;
  order: TurnOrder;
  roster: Player[];
  deck: PointBlankCard[];
  deckSize: number | null;
  card: PointBlankCard | null;
  readerId: string | null;
  phase: PointBlankPhase;
  fingers: Readonly<Record<string, number>>;
  /** Secret card: the player the reader named. */
  namedId: string | null;
  ledger: PenaltyLedger;
  lastPenalties: PenaltyLine[];
  /** Fingers received over the whole game, for the end screen. */
  designations: Readonly<Record<string, number>>;
  endReason: EndReason | null;
}

export type PointBlankAction =
  | { type: "next" }
  | { type: "startRecording" }
  | { type: "point"; playerId: string; delta: 1 | -1 }
  | { type: "done" }
  /** Adaptive level 2 and above: one tap on the most pointed player (two for a tie), fixed penalty. */
  | { type: "quickResult"; playerIds: readonly string[] }
  | { type: "name"; playerId: string }
  | { type: "secretChoice"; hear: boolean }
  | { type: "removePlayer"; playerId: string }
  | { type: "addPlayer"; player: Player }
  | { type: "stop" };

export const POINT_BLANK_CAP: Readonly<Record<GameLevel, number>> = { normal: 3, hard: 5, extreme: 5 };
export const POINT_BLANK_QUICK_SIPS = 2;
export const POINT_BLANK_SECRET_SIPS = 2;
export const POINT_BLANK_DEFAULT_SIZE = 20;
/** About one card in five is a secret card at Extreme. */
export const POINT_BLANK_SECRET_SHARE = 0.2;
export const POINT_BLANK_MIN_PLAYERS = 3;

export function buildPointBlankDeck(content: PointBlankContent, level: GameLevel, size: number | null, rng: Random): PointBlankCard[] {
  const open = leveledDeck(content.open, level, size, rng).map((item) => ({ id: item.id, text: item.value, secret: false }));
  if (level !== "extreme" || content.secret.length === 0) return open;
  const secretCount = Math.min(content.secret.length, Math.round(open.length * POINT_BLANK_SECRET_SHARE));
  const secrets = shuffle(rng, content.secret.map((text, i) => ({ id: `secret:${i}`, text, secret: true })));
  // Secret cards replace open ones, so the deck keeps the length the table chose.
  const mixed = [...open.slice(0, open.length - secretCount), ...secrets.slice(0, secretCount)];
  return shuffle(rng, mixed);
}

export function createPointBlank(options: {
  players: Player[];
  level: GameLevel;
  content: PointBlankContent;
  size?: number | null;
  rng: Random;
}): PointBlankState {
  const size = options.size === undefined ? POINT_BLANK_DEFAULT_SIZE : options.size;
  const deck = buildPointBlankDeck(options.content, options.level, size, options.rng);
  const enough = options.players.length >= POINT_BLANK_MIN_PLAYERS;
  return {
    level: options.level,
    order: { players: [...options.players], turn: 0 },
    roster: [...options.players],
    deck,
    deckSize: deck.length,
    card: null,
    readerId: null,
    phase: enough ? "idle" : "end",
    fingers: {},
    namedId: null,
    ledger: {},
    lastPenalties: [],
    designations: {},
    endReason: enough ? null : "notEnoughPlayers",
  };
}

function fingerTotal(fingers: Readonly<Record<string, number>>): number {
  return Object.values(fingers).reduce((a, b) => a + b, 0);
}

/** Penalties from the recorded fingers. Nobody pointed at: nobody pays. */
export function pointBlankPenalties(level: GameLevel, fingers: Readonly<Record<string, number>>): PenaltyLine[] {
  const entries = Object.entries(fingers).filter(([, n]) => n > 0);
  if (entries.length === 0) return [];
  const cap = POINT_BLANK_CAP[level];
  if (level === "normal") {
    const most = Math.max(...entries.map(([, n]) => n));
    return entries.filter(([, n]) => n === most).map(([playerId, n]) => ({ playerId, sips: Math.min(n, cap) }));
  }
  return entries.map(([playerId, n]) => ({ playerId, sips: Math.min(n, cap) }));
}

function settle(state: PointBlankState, lines: PenaltyLine[]): PointBlankState {
  const merged = mergePenalties(lines);
  const designations = { ...state.designations };
  for (const [id, n] of Object.entries(state.fingers)) designations[id] = (designations[id] ?? 0) + n;
  return { ...state, phase: "result", ledger: addPenalties(state.ledger, merged), lastPenalties: merged, designations };
}

function inGame(state: PointBlankState, playerId: string): boolean {
  return state.order.players.some((p) => p.id === playerId);
}

export function pointBlankReducer(state: PointBlankState, action: PointBlankAction): PointBlankState {
  if (state.phase === "end" && action.type !== "addPlayer") return state;
  switch (action.type) {
    case "next": {
      if (state.phase !== "idle" && state.phase !== "result") return state;
      // The reader role passes to the next player after each card.
      const order = state.phase === "result" ? nextTurn(state.order) : state.order;
      const [card, ...deck] = state.deck;
      if (!card) return { ...state, order, phase: "end", endReason: "completed", lastPenalties: [] };
      const reader = currentPlayer(order);
      return {
        ...state,
        order,
        deck,
        card,
        readerId: reader?.id ?? null,
        phase: card.secret ? "secretName" : "read",
        fingers: {},
        namedId: null,
        lastPenalties: [],
      };
    }
    case "startRecording":
      return state.phase === "read" ? { ...state, phase: "record" } : state;
    case "point": {
      if (state.phase !== "record" || !inGame(state, action.playerId)) return state;
      const current = state.fingers[action.playerId] ?? 0;
      const next = current + action.delta;
      // Each player points once, so the table cannot record more fingers than players.
      if (next < 0 || (action.delta > 0 && fingerTotal(state.fingers) >= state.order.players.length)) return state;
      return { ...state, fingers: { ...state.fingers, [action.playerId]: next } };
    }
    case "done":
      if (state.phase !== "record") return state;
      return settle(state, pointBlankPenalties(state.level, state.fingers));
    case "quickResult": {
      if (state.phase !== "record" && state.phase !== "read") return state;
      const ids = action.playerIds.filter((id) => inGame(state, id)).slice(0, 2);
      const fingers = Object.fromEntries(ids.map((id) => [id, 1]));
      return settle({ ...state, fingers }, ids.map((playerId) => ({ playerId, sips: POINT_BLANK_QUICK_SIPS })));
    }
    case "name":
      if (state.phase !== "secretName" || !inGame(state, action.playerId)) return state;
      return { ...state, phase: "secretChoice", namedId: action.playerId };
    case "secretChoice": {
      if (state.phase !== "secretChoice" || !state.namedId) return state;
      const lines = action.hear ? [{ playerId: state.namedId, sips: POINT_BLANK_SECRET_SIPS }] : [];
      return settle({ ...state, fingers: { [state.namedId]: 1 } }, lines);
    }
    case "removePlayer": {
      const order = removeFromOrder(state.order, action.playerId);
      const { [action.playerId]: _gone, ...fingers } = state.fingers;
      if (order.players.length < POINT_BLANK_MIN_PLAYERS) return { ...state, order, fingers, phase: "end", endReason: "notEnoughPlayers" };
      if (state.readerId === action.playerId && state.phase !== "result" && state.phase !== "idle") {
        // The reader left mid-card: the card is dropped and the next player reads a new one.
        return { ...state, order, fingers: {}, card: null, readerId: null, namedId: null, phase: "idle" };
      }
      if (state.namedId === action.playerId && state.phase === "secretChoice") {
        return { ...state, order, fingers, namedId: null, phase: "secretName" };
      }
      return { ...state, order, fingers };
    }
    case "addPlayer": {
      if (inGame(state, action.player.id)) return state;
      const order = addToOrder(state.order, action.player);
      const reopened = state.phase === "end" && state.endReason === "notEnoughPlayers" && order.players.length >= POINT_BLANK_MIN_PLAYERS;
      return { ...state, order, roster: withPlayer(state.roster, action.player), phase: reopened ? "idle" : state.phase, endReason: reopened ? null : state.endReason };
    }
    case "stop":
      return { ...state, phase: "end", endReason: "stopped" };
  }
}
