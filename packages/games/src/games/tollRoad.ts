// O-51 Toll Road: each driver crosses 5 checkpoints by guessing the next card; checkpoint 2 is customs
// (red or black). A miss costs sips and sends the driver back to the first checkpoint.

import { drawFromShoe, isRed, shuffledDeck, type PlayingCard, type Shoe } from "../cards";
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
import type { Random } from "../random";

export const CHECKPOINTS = 5;
/** Checkpoint 2 (index 1) is customs. */
export const CUSTOMS_INDEX = 1;

export type RoadGuess = "higher" | "lower";
export type CustomsGuess = "red" | "black";
export type TollGuess = RoadGuess | CustomsGuess;

/** After this many misses on one road the barrier lifts, so nobody is stuck all night. Extreme never lifts it. */
export const TOLL_MISS_CAP: Readonly<Record<GameLevel, number | null>> = { normal: 6, hard: 10, extreme: null };

export interface TollResult {
  playerId: string;
  checkpoint: number;
  guess: TollGuess;
  /** The card the guess was made against, and the one drawn. Both stay visible (the prototype showed the same card twice). */
  from: PlayingCard;
  drawn: PlayingCard;
  hit: boolean;
  sips: number;
  /** The driver reached the end, by passing checkpoint 5 or because the barrier lifted. */
  arrived: "road" | "barrier" | null;
}

export interface TollRoadState {
  level: GameLevel;
  order: TurnOrder;
  roster: Player[];
  shoe: Shoe;
  /** The face-up card the driver guesses against. */
  current: PlayingCard;
  checkpoint: number;
  missesThisRoad: number;
  /** Players who already drove their road. */
  arrived: string[];
  phase: "guess" | "result" | "end";
  lastResult: TollResult | null;
  ledger: PenaltyLedger;
  lastPenalties: PenaltyLine[];
  /** Misses per player across the game, for the end screen. */
  misses: Readonly<Record<string, number>>;
  endReason: EndReason | null;
}

export type TollRoadAction =
  | { type: "guess"; guess: TollGuess }
  | { type: "next" }
  | { type: "removePlayer"; playerId: string }
  | { type: "addPlayer"; player: Player }
  | { type: "stop" };

export function tollSips(level: GameLevel, checkpoint: number): number {
  if (level === "normal") return 1;
  const base = checkpoint + 1;
  return level === "extreme" && checkpoint === CUSTOMS_INDEX ? base * 2 : base;
}

export function isCustoms(checkpoint: number): boolean {
  return checkpoint === CUSTOMS_INDEX;
}

export function guessHits(guess: TollGuess, from: PlayingCard, drawn: PlayingCard): boolean {
  switch (guess) {
    case "higher":
      return drawn.rank > from.rank;
    case "lower":
      return drawn.rank < from.rank;
    case "red":
      return isRed(drawn);
    case "black":
      return !isRed(drawn);
  }
}

export function createTollRoad(options: { players: Player[]; level: GameLevel; rng: Random }): TollRoadState {
  const deck = shuffledDeck(options.rng);
  const [first, ...rest] = deck;
  const enough = options.players.length >= 2;
  return {
    level: options.level,
    order: { players: [...options.players], turn: 0 },
    roster: [...options.players],
    shoe: { deck: rest, discard: [] },
    current: first as PlayingCard,
    checkpoint: 0,
    missesThisRoad: 0,
    arrived: [],
    phase: enough ? "guess" : "end",
    lastResult: null,
    ledger: {},
    lastPenalties: [],
    misses: {},
    endReason: enough ? null : "notEnoughPlayers",
  };
}

function nextDriver(state: TollRoadState): TollRoadState {
  const { players } = state.order;
  for (let step = 1; step <= players.length; step++) {
    const turn = (state.order.turn + step) % players.length;
    const candidate = players[turn];
    if (candidate && !state.arrived.includes(candidate.id)) {
      return { ...state, order: { players, turn }, checkpoint: 0, missesThisRoad: 0, phase: "guess" };
    }
  }
  return { ...state, phase: "end", endReason: "completed" };
}

export function tollRoadReducer(state: TollRoadState, action: TollRoadAction, rng: Random): TollRoadState {
  if (state.phase === "end" && action.type !== "addPlayer") return state;
  switch (action.type) {
    case "guess": {
      if (state.phase !== "guess") return state;
      const driver = currentPlayer(state.order);
      if (!driver) return state;
      const customs = isCustoms(state.checkpoint);
      const valid = customs ? action.guess === "red" || action.guess === "black" : action.guess === "higher" || action.guess === "lower";
      if (!valid) return state;

      const { card: drawn, shoe } = drawFromShoe(state.shoe, rng);
      const hit = guessHits(action.guess, state.current, drawn);
      const sips = hit ? 0 : tollSips(state.level, state.checkpoint);
      const missesThisRoad = hit ? state.missesThisRoad : state.missesThisRoad + 1;
      const cap = TOLL_MISS_CAP[state.level];
      const arrived: TollResult["arrived"] =
        hit && state.checkpoint === CHECKPOINTS - 1 ? "road" : !hit && cap !== null && missesThisRoad >= cap ? "barrier" : null;
      const lines = sips > 0 ? [{ playerId: driver.id, sips }] : [];
      return {
        ...state,
        shoe: { ...shoe, discard: [...shoe.discard, state.current] },
        current: drawn,
        checkpoint: hit ? state.checkpoint + 1 : 0,
        missesThisRoad,
        arrived: arrived ? [...state.arrived, driver.id] : state.arrived,
        phase: "result",
        lastResult: { playerId: driver.id, checkpoint: state.checkpoint, guess: action.guess, from: state.current, drawn, hit, sips, arrived },
        ledger: addPenalties(state.ledger, lines),
        lastPenalties: lines,
        misses: hit ? state.misses : { ...state.misses, [driver.id]: (state.misses[driver.id] ?? 0) + 1 },
      };
    }
    case "next": {
      if (state.phase !== "result") return state;
      const base = { ...state, lastPenalties: [] };
      if (state.lastResult?.arrived) return nextDriver(base);
      return { ...base, phase: "guess" };
    }
    case "removePlayer": {
      const wasDriver = currentPlayer(state.order)?.id === action.playerId;
      const order = removeFromOrder(state.order, action.playerId);
      if (order.players.length < 2) return { ...state, order, phase: "end", endReason: "notEnoughPlayers" };
      const arrived = state.arrived.filter((id) => id !== action.playerId);
      if (!wasDriver) return { ...state, order, arrived };
      // The new driver at this index starts their own road, unless they already drove it.
      const next = order.players[order.turn];
      const base = { ...state, order, arrived, checkpoint: 0, missesThisRoad: 0, phase: "guess" as const, lastResult: null };
      if (next && !arrived.includes(next.id)) return base;
      return nextDriver(base);
    }
    case "addPlayer": {
      if (state.order.players.some((p) => p.id === action.player.id)) return state;
      const order = addToOrder(state.order, action.player);
      const roster = withPlayer(state.roster, action.player);
      if (state.phase === "end") {
        if (state.endReason === "stopped") return state;
        // A newcomer reopens a game that ended because the others had all driven, or too few were left.
        return nextDriver({ ...state, order, roster, phase: "guess", endReason: null });
      }
      return { ...state, order, roster };
    }
    case "stop":
      return { ...state, phase: "end", endReason: "stopped" };
  }
}
