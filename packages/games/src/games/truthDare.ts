// O-58 Spill or Dare (truth or dare): pick one, do it or pay. Both piles follow the chosen level
// (the prototype kept the same truths at every level).

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
import type { TruthDareContent } from "../content/types";
import { leveledDeck, usesOther, type LeveledItem } from "../deck";
import { pickOne, type Random } from "../random";

export type TruthDareKind = "truth" | "dare";
export const TRUTH_DARE_REFUSAL_SIPS: Readonly<Record<GameLevel, number>> = { normal: 2, hard: 3, extreme: 4 };

export interface TruthDareCard {
  kind: TruthDareKind;
  item: LeveledItem<string>;
  playerId: string;
  otherId: string | null;
}

export interface TruthDareState {
  level: GameLevel;
  order: TurnOrder;
  roster: Player[];
  piles: Readonly<Record<TruthDareKind, LeveledItem<string>[]>>;
  content: TruthDareContent;
  current: TruthDareCard | null;
  phase: "choose" | "card" | "end";
  turns: number;
  ledger: PenaltyLedger;
  lastPenalties: PenaltyLine[];
  refusals: Readonly<Record<string, number>>;
  endReason: EndReason | null;
}

export type TruthDareAction =
  | { type: "choose"; kind: TruthDareKind }
  | { type: "done" }
  | { type: "refuse" }
  | { type: "removePlayer"; playerId: string }
  | { type: "addPlayer"; player: Player }
  | { type: "stop" };

export function createTruthDare(options: { players: Player[]; level: GameLevel; content: TruthDareContent; rng: Random }): TruthDareState {
  const enough = options.players.length >= 2;
  return {
    level: options.level,
    order: { players: [...options.players], turn: 0 },
    roster: [...options.players],
    piles: {
      truth: leveledDeck(options.content.truth, options.level, null, options.rng, "truth:"),
      dare: leveledDeck(options.content.dare, options.level, null, options.rng, "dare:"),
    },
    content: options.content,
    current: null,
    phase: enough ? "choose" : "end",
    turns: 0,
    ledger: {},
    lastPenalties: [],
    refusals: {},
    endReason: enough ? null : "notEnoughPlayers",
  };
}

function others(state: TruthDareState, playerId: string): Player[] {
  return state.order.players.filter((p) => p.id !== playerId);
}

function finish(state: TruthDareState, lines: PenaltyLine[]): TruthDareState {
  return { ...state, current: null, phase: "choose", order: nextTurn(state.order), turns: state.turns + 1, ledger: addPenalties(state.ledger, lines), lastPenalties: lines };
}

export function truthDareReducer(state: TruthDareState, action: TruthDareAction, rng: Random): TruthDareState {
  if (state.phase === "end" && action.type !== "addPlayer") return state;
  switch (action.type) {
    case "choose": {
      if (state.phase !== "choose") return state;
      const player = currentPlayer(state.order);
      if (!player) return state;
      let pile = state.piles[action.kind];
      if (pile.length === 0) {
        // A long night empties a pile: reshuffle it rather than run dry.
        pile = leveledDeck(state.content[action.kind], state.level, null, rng, `${action.kind}:`);
      }
      const [item, ...rest] = pile;
      if (!item) return state;
      const pool = others(state, player.id);
      const otherId = usesOther(item.value) && pool.length > 0 ? pickOne(rng, pool).id : null;
      return {
        ...state,
        piles: { ...state.piles, [action.kind]: rest },
        current: { kind: action.kind, item, playerId: player.id, otherId },
        phase: "card",
        lastPenalties: [],
      };
    }
    case "done":
      return state.phase === "card" ? finish(state, []) : state;
    case "refuse": {
      if (state.phase !== "card" || !state.current) return state;
      const playerId = state.current.playerId;
      return {
        ...finish(state, [{ playerId, sips: TRUTH_DARE_REFUSAL_SIPS[state.level] }]),
        refusals: { ...state.refusals, [playerId]: (state.refusals[playerId] ?? 0) + 1 },
      };
    }
    case "removePlayer": {
      const order = removeFromOrder(state.order, action.playerId);
      if (order.players.length < 2) return { ...state, order, phase: "end", endReason: "notEnoughPlayers" };
      let { current, phase } = state;
      if (current?.playerId === action.playerId) {
        current = null;
        phase = "choose";
      } else if (current?.otherId === action.playerId) {
        const pool = order.players.filter((p) => p.id !== current?.playerId);
        current = { ...current, otherId: pool.length > 0 ? pickOne(rng, pool).id : null };
      }
      return { ...state, order, current, phase };
    }
    case "addPlayer": {
      if (state.order.players.some((p) => p.id === action.player.id)) return state;
      const order = addToOrder(state.order, action.player);
      const reopened = state.phase === "end" && state.endReason === "notEnoughPlayers";
      return { ...state, order, roster: withPlayer(state.roster, action.player), phase: reopened ? "choose" : state.phase, endReason: reopened ? null : state.endReason };
    }
    case "stop":
      return { ...state, phase: "end", current: null, endReason: "stopped" };
  }
}
