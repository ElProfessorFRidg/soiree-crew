// O-56 Not Once (Never have I ever): read the card, whoever has done it owns up. Extreme is the unfiltered deck.

import {
  addPenalties,
  addToOrder,
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
import type { NeverEverContent } from "../content/types";
import { leveledDeck, type LeveledItem } from "../deck";
import type { Random } from "../random";

export const NEVER_EVER_SIPS: Readonly<Record<GameLevel, number>> = { normal: 1, hard: 1, extreme: 2 };
export const NEVER_EVER_MIN_PLAYERS = 3;

export interface NeverEverState {
  level: GameLevel;
  /** The player whose turn it is reads the card aloud. */
  order: TurnOrder;
  roster: Player[];
  deck: LeveledItem<string>[];
  deckSize: number;
  card: LeveledItem<string> | null;
  /** Players who owned up to the current card. */
  guilty: string[];
  phase: "card" | "end";
  ledger: PenaltyLedger;
  lastPenalties: PenaltyLine[];
  confessions: Readonly<Record<string, number>>;
  endReason: EndReason | null;
}

export type NeverEverAction =
  | { type: "toggle"; playerId: string }
  | { type: "next" }
  | { type: "removePlayer"; playerId: string }
  | { type: "addPlayer"; player: Player }
  | { type: "stop" };

export function createNeverEver(options: {
  players: Player[];
  level: GameLevel;
  content: NeverEverContent;
  size?: number | null;
  rng: Random;
}): NeverEverState {
  const [card, ...deck] = leveledDeck(options.content, options.level, options.size ?? null, options.rng);
  const enough = options.players.length >= NEVER_EVER_MIN_PLAYERS && card !== undefined;
  return {
    level: options.level,
    order: { players: [...options.players], turn: 0 },
    roster: [...options.players],
    deck,
    deckSize: deck.length + (card ? 1 : 0),
    card: card ?? null,
    guilty: [],
    phase: enough ? "card" : "end",
    ledger: {},
    lastPenalties: [],
    confessions: {},
    endReason: enough ? null : "notEnoughPlayers",
  };
}

function scoreCard(state: NeverEverState): Pick<NeverEverState, "ledger" | "lastPenalties" | "confessions"> {
  const lines = state.guilty.map((playerId) => ({ playerId, sips: NEVER_EVER_SIPS[state.level] }));
  const confessions = { ...state.confessions };
  for (const id of state.guilty) confessions[id] = (confessions[id] ?? 0) + 1;
  return { ledger: addPenalties(state.ledger, lines), lastPenalties: lines, confessions };
}

export function neverEverReducer(state: NeverEverState, action: NeverEverAction): NeverEverState {
  if (state.phase === "end" && action.type !== "addPlayer") return state;
  switch (action.type) {
    case "toggle": {
      if (!state.order.players.some((p) => p.id === action.playerId)) return state;
      const guilty = state.guilty.includes(action.playerId) ? state.guilty.filter((id) => id !== action.playerId) : [...state.guilty, action.playerId];
      return { ...state, guilty };
    }
    case "next": {
      const scored = { ...state, ...scoreCard(state), guilty: [] };
      const [card, ...deck] = state.deck;
      if (!card) return { ...scored, card: null, phase: "end", endReason: "completed" };
      return { ...scored, card, deck, order: nextTurn(state.order) };
    }
    case "removePlayer": {
      const order = removeFromOrder(state.order, action.playerId);
      const guilty = state.guilty.filter((id) => id !== action.playerId);
      if (order.players.length < NEVER_EVER_MIN_PLAYERS) return { ...state, order, guilty, phase: "end", endReason: "notEnoughPlayers" };
      return { ...state, order, guilty };
    }
    case "addPlayer": {
      if (state.order.players.some((p) => p.id === action.player.id)) return state;
      const order = addToOrder(state.order, action.player);
      const reopened = state.phase === "end" && state.endReason === "notEnoughPlayers" && state.card !== null && order.players.length >= NEVER_EVER_MIN_PLAYERS;
      return { ...state, order, roster: withPlayer(state.roster, action.player), phase: reopened ? "card" : state.phase, endReason: reopened ? null : state.endReason };
    }
    case "stop":
      return { ...state, ...scoreCard(state), guilty: [], phase: "end", endReason: "stopped" };
  }
}
