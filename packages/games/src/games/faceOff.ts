// O-52 Face-off: two players across one phone, each gets a hidden hand, both flip, the weaker hand pays the gap.

import { drawFromShoe, shuffledDeck, type PlayingCard, type Shoe } from "../cards";
import { addPenalties, type EndReason, type GameLevel, type PenaltyLedger, type PenaltyLine, type Player } from "../core";
import type { Random } from "../random";

export const FACE_OFF_HAND: Readonly<Record<GameLevel, number>> = { normal: 1, hard: 2, extreme: 3 };
/** The gap is paid in sips, capped so an ace against a two is not a whole glass. */
export const FACE_OFF_CAP: Readonly<Record<GameLevel, number>> = { normal: 3, hard: 5, extreme: 7 };
export const FACE_OFF_TIE: Readonly<Record<GameLevel, number>> = { normal: 1, hard: 2, extreme: 2 };
export const FACE_OFF_DEFAULT_ROUNDS = 10;

export interface FaceOffResult {
  /** Null on a tie. */
  loserId: string | null;
  totals: readonly [number, number];
  gap: number;
  penalties: PenaltyLine[];
}

export interface FaceOffState {
  level: GameLevel;
  /** players[0] sits at the top of the phone (upside down), players[1] at the bottom. */
  players: Player[];
  roster: Player[];
  shoe: Shoe;
  hands: readonly [PlayingCard[], PlayingCard[]];
  round: number;
  rounds: number;
  phase: "hidden" | "revealed" | "end";
  result: FaceOffResult | null;
  ledger: PenaltyLedger;
  lastPenalties: PenaltyLine[];
  roundsLost: Readonly<Record<string, number>>;
  endReason: EndReason | null;
}

export type FaceOffAction = { type: "reveal" } | { type: "next" } | { type: "removePlayer"; playerId: string } | { type: "stop" };

function deal(shoe: Shoe, size: number, rng: Random): { hands: [PlayingCard[], PlayingCard[]]; shoe: Shoe } {
  const hands: [PlayingCard[], PlayingCard[]] = [[], []];
  let current = shoe;
  for (let i = 0; i < size; i++) {
    for (const hand of hands) {
      const drawn = drawFromShoe(current, rng);
      hand.push(drawn.card);
      current = drawn.shoe;
    }
  }
  return { hands, shoe: current };
}

export function handValue(hand: readonly PlayingCard[]): number {
  return hand.reduce((sum, card) => sum + card.rank, 0);
}

export function createFaceOff(options: { players: Player[]; level: GameLevel; rounds?: number; rng: Random }): FaceOffState {
  const players = options.players.slice(0, 2);
  const dealt = deal({ deck: shuffledDeck(options.rng), discard: [] }, FACE_OFF_HAND[options.level], options.rng);
  const enough = players.length === 2;
  return {
    level: options.level,
    players,
    roster: players,
    shoe: dealt.shoe,
    hands: dealt.hands,
    round: 1,
    rounds: options.rounds ?? FACE_OFF_DEFAULT_ROUNDS,
    phase: enough ? "hidden" : "end",
    result: null,
    ledger: {},
    lastPenalties: [],
    roundsLost: {},
    endReason: enough ? null : "notEnoughPlayers",
  };
}

export function scoreFaceOff(level: GameLevel, players: readonly Player[], hands: FaceOffState["hands"]): FaceOffResult {
  const totals = [handValue(hands[0]), handValue(hands[1])] as const;
  const [top, bottom] = players;
  if (!top || !bottom) return { loserId: null, totals, gap: 0, penalties: [] };
  if (totals[0] === totals[1]) {
    const sips = FACE_OFF_TIE[level];
    return { loserId: null, totals, gap: 0, penalties: [{ playerId: top.id, sips }, { playerId: bottom.id, sips }] };
  }
  const gap = Math.abs(totals[0] - totals[1]);
  const loser = totals[0] < totals[1] ? top : bottom;
  return { loserId: loser.id, totals, gap, penalties: [{ playerId: loser.id, sips: Math.min(gap, FACE_OFF_CAP[level]) }] };
}

export function faceOffReducer(state: FaceOffState, action: FaceOffAction, rng: Random): FaceOffState {
  if (state.phase === "end") return state;
  switch (action.type) {
    case "reveal": {
      if (state.phase !== "hidden") return state;
      const result = scoreFaceOff(state.level, state.players, state.hands);
      const roundsLost = result.loserId ? { ...state.roundsLost, [result.loserId]: (state.roundsLost[result.loserId] ?? 0) + 1 } : state.roundsLost;
      return { ...state, phase: "revealed", result, ledger: addPenalties(state.ledger, result.penalties), lastPenalties: result.penalties, roundsLost };
    }
    case "next": {
      if (state.phase !== "revealed") return state;
      if (state.round >= state.rounds) return { ...state, phase: "end", endReason: "completed", lastPenalties: [] };
      // New hands are dealt only now, after the cards have turned back: nobody sees the next value early.
      const used = [...state.hands[0], ...state.hands[1]];
      const dealt = deal({ deck: state.shoe.deck, discard: [...state.shoe.discard, ...used] }, FACE_OFF_HAND[state.level], rng);
      return { ...state, shoe: dealt.shoe, hands: dealt.hands, round: state.round + 1, phase: "hidden", result: null, lastPenalties: [] };
    }
    case "removePlayer": {
      if (!state.players.some((p) => p.id === action.playerId)) return state;
      // A duel needs two: the game ends, and the scores so far stand.
      return { ...state, players: state.players.filter((p) => p.id !== action.playerId), phase: "end", endReason: "notEnoughPlayers" };
    }
    case "stop":
      return { ...state, phase: "end", endReason: "stopped" };
  }
}
