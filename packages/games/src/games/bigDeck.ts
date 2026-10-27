// O-50 The Big Deck: a mixed deck of dares, rules, votes and mini-games. The game ends on the last card.

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
import type { BigDeckContent } from "../content/types";
import { leveledDeck, usesOther } from "../deck";
import { pickOne, shuffle, type Random } from "../random";

export type BigDeckKind = "dare" | "rule" | "vote" | "minigame";
export const BIG_DECK_KINDS: readonly BigDeckKind[] = ["dare", "rule", "vote", "minigame"];

export interface BigDeckCard {
  id: string;
  kind: BigDeckKind;
  level: GameLevel;
  text: string;
}

export interface DrawnCard {
  card: BigDeckCard;
  playerId: string;
  /** The other player named by the card, when it names one. */
  otherId: string | null;
}

export interface BigDeckState {
  level: GameLevel;
  order: TurnOrder;
  /** Everyone who played, including players who left: the end screen still counts them. */
  roster: Player[];
  deck: BigDeckCard[];
  deckSize: number;
  current: DrawnCard | null;
  /** A Rule card stays on until the next Rule card. */
  activeRule: DrawnCard | null;
  phase: "draw" | "card" | "end";
  ledger: PenaltyLedger;
  lastPenalties: PenaltyLine[];
  endReason: EndReason | null;
}

export type BigDeckAction =
  | { type: "draw" }
  /** Dare done, rule read: no penalty. */
  | { type: "done" }
  /** Dare refused: the player takes the refusal penalty. */
  | { type: "refuse" }
  /** Vote or mini-game: the designated player(s) or loser(s). */
  | { type: "designate"; playerIds: readonly string[] }
  /** Someone broke the active rule. */
  | { type: "ruleBroken"; playerId: string }
  | { type: "removePlayer"; playerId: string }
  | { type: "addPlayer"; player: Player }
  | { type: "stop" };

/** Sips by card kind and level. Starting values for playtests (research/games.md A-GAMES-1). */
export const BIG_DECK_SIPS: Readonly<Record<BigDeckKind | "ruleBroken", Readonly<Record<GameLevel, number>>>> = {
  dare: { normal: 2, hard: 3, extreme: 4 },
  vote: { normal: 2, hard: 3, extreme: 3 },
  minigame: { normal: 2, hard: 2, extreme: 3 },
  rule: { normal: 0, hard: 0, extreme: 0 },
  ruleBroken: { normal: 1, hard: 1, extreme: 2 },
};

export const BIG_DECK_DEFAULT_SIZE = 40;
export const BIG_DECK_MIN_PLAYERS = 2;

export function buildBigDeck(content: BigDeckContent, level: GameLevel, size: number, rng: Random): BigDeckCard[] {
  // Each kind keeps its share of the deck, so a 40-card game is not 30 dares.
  const all = BIG_DECK_KINDS.flatMap((kind) =>
    leveledDeck(content[kind], level, null, rng, `${kind}:`).map((item) => ({ id: item.id, kind, level: item.level, text: item.value })),
  );
  return shuffle(rng, all).slice(0, size);
}

export function createBigDeck(options: {
  players: Player[];
  level: GameLevel;
  content: BigDeckContent;
  size?: number;
  rng: Random;
}): BigDeckState {
  const deck = buildBigDeck(options.content, options.level, options.size ?? BIG_DECK_DEFAULT_SIZE, options.rng);
  return {
    level: options.level,
    order: { players: [...options.players], turn: 0 },
    roster: [...options.players],
    deck,
    deckSize: deck.length,
    current: null,
    activeRule: null,
    phase: options.players.length < BIG_DECK_MIN_PLAYERS ? "end" : "draw",
    ledger: {},
    lastPenalties: [],
    endReason: options.players.length < BIG_DECK_MIN_PLAYERS ? "notEnoughPlayers" : null,
  };
}

function pickOther(state: BigDeckState, playerId: string, rng: Random): string | null {
  const others = state.order.players.filter((p) => p.id !== playerId);
  return others.length > 0 ? pickOne(rng, others).id : null;
}

function finishCard(state: BigDeckState, penalties: PenaltyLine[]): BigDeckState {
  const lines = mergePenalties(penalties);
  const activeRule = state.current?.card.kind === "rule" ? state.current : state.activeRule;
  const base = { ...state, ledger: addPenalties(state.ledger, lines), lastPenalties: lines, current: null, activeRule };
  if (state.deck.length === 0) return { ...base, phase: "end", endReason: "completed" };
  return { ...base, phase: "draw", order: nextTurn(state.order) };
}

export function bigDeckReducer(state: BigDeckState, action: BigDeckAction, rng: Random): BigDeckState {
  if (state.phase === "end" && action.type !== "addPlayer") return state;
  switch (action.type) {
    case "draw": {
      if (state.phase !== "draw") return state;
      const [card, ...rest] = state.deck;
      const player = currentPlayer(state.order);
      if (!card || !player) return { ...state, phase: "end", endReason: "completed" };
      const otherId = usesOther(card.text) ? pickOther(state, player.id, rng) : null;
      return { ...state, deck: rest, phase: "card", current: { card, playerId: player.id, otherId }, lastPenalties: [] };
    }
    case "done":
      if (state.phase !== "card" || !state.current) return state;
      return finishCard(state, []);
    case "refuse": {
      if (state.phase !== "card" || !state.current || state.current.card.kind !== "dare") return state;
      return finishCard(state, [{ playerId: state.current.playerId, sips: BIG_DECK_SIPS.dare[state.level] }]);
    }
    case "designate": {
      if (state.phase !== "card" || !state.current) return state;
      const kind = state.current.card.kind;
      if (kind !== "vote" && kind !== "minigame") return state;
      const known = action.playerIds.filter((id) => state.order.players.some((p) => p.id === id));
      return finishCard(state, known.map((playerId) => ({ playerId, sips: BIG_DECK_SIPS[kind][state.level] })));
    }
    case "ruleBroken": {
      if (!state.activeRule || !state.order.players.some((p) => p.id === action.playerId)) return state;
      const line = { playerId: action.playerId, sips: BIG_DECK_SIPS.ruleBroken[state.level] };
      return { ...state, ledger: addPenalties(state.ledger, [line]), lastPenalties: [line] };
    }
    case "removePlayer": {
      const order = removeFromOrder(state.order, action.playerId);
      if (order.players.length < BIG_DECK_MIN_PLAYERS) return { ...state, order, current: null, phase: "end", endReason: "notEnoughPlayers" };
      let { current, phase } = state;
      if (current?.playerId === action.playerId) {
        // The drawer left: their card is set aside and the next player draws.
        current = null;
        phase = "draw";
      } else if (current?.otherId === action.playerId) {
        current = { ...current, otherId: pickOther({ ...state, order }, current.playerId, rng) };
      }
      // The active rule binds the table, not the person who drew it: it stays.
      return { ...state, order, current, phase };
    }
    case "addPlayer": {
      if (state.order.players.some((p) => p.id === action.player.id)) return state;
      const order = addToOrder(state.order, action.player);
      const reopened = state.phase === "end" && state.endReason === "notEnoughPlayers" && state.deck.length > 0;
      return {
        ...state,
        order,
        roster: withPlayer(state.roster, action.player),
        phase: reopened ? "draw" : state.phase,
        endReason: reopened ? null : state.endReason,
      };
    }
    case "stop":
      return { ...state, phase: "end", current: null, endReason: "stopped" };
  }
}

export function cardsLeft(state: BigDeckState): number {
  return state.deck.length;
}
