// O-57 The Verdict: two players face the group, "which of these two...", the table votes, the verdict pays.

import { addPenalties, withPlayer, type EndReason, type GameLevel, type PenaltyLedger, type PenaltyLine, type Player } from "../core";
import type { VerdictContent } from "../content/types";
import { leveledDeck, type LeveledItem } from "../deck";
import { shuffle, type Random } from "../random";

export const VERDICT_SIPS: Readonly<Record<GameLevel, number>> = { normal: 2, hard: 3, extreme: 2 };
/** Extreme: the base plus the vote gap, so a landslide costs more. */
export const VERDICT_EXTREME_CAP = 5;
export const VERDICT_MIN_PLAYERS = 3;

export interface VerdictState {
  level: GameLevel;
  players: Player[];
  roster: Player[];
  deck: LeveledItem<string>[];
  card: LeveledItem<string> | null;
  pair: readonly [string, string] | null;
  votes: readonly [number, number];
  phase: "vote" | "result" | "end";
  appearances: Readonly<Record<string, number>>;
  ledger: PenaltyLedger;
  lastPenalties: PenaltyLine[];
  verdicts: Readonly<Record<string, number>>;
  endReason: EndReason | null;
}

export type VerdictAction =
  | { type: "vote"; side: 0 | 1; delta: 1 | -1 }
  | { type: "close" }
  | { type: "next" }
  | { type: "removePlayer"; playerId: string }
  | { type: "addPlayer"; player: Player }
  | { type: "stop" };

/** Everyone outside the pair votes once. */
export function voterCount(state: Pick<VerdictState, "players" | "pair">): number {
  return state.players.filter((p) => !state.pair?.includes(p.id)).length;
}

/** Fair rotation: the two players who have faced the group least, never the same pair twice in a row. */
export function pickPair(players: readonly Player[], appearances: Readonly<Record<string, number>>, previous: readonly [string, string] | null, rng: Random): [string, string] | null {
  if (players.length < 2) return null;
  const ranked = shuffle(rng, players).sort((a, b) => (appearances[a.id] ?? 0) - (appearances[b.id] ?? 0));
  const samePair = (x: string, y: string) => previous !== null && previous.includes(x) && previous.includes(y);
  for (let i = 0; i < ranked.length; i++) {
    for (let j = i + 1; j < ranked.length; j++) {
      const a = ranked[i] as Player;
      const b = ranked[j] as Player;
      if (!samePair(a.id, b.id) || players.length === 2) return [a.id, b.id];
    }
  }
  return null;
}

export function createVerdict(options: { players: Player[]; level: GameLevel; content: VerdictContent; size?: number | null; rng: Random }): VerdictState {
  const [card, ...deck] = leveledDeck(options.content, options.level, options.size ?? null, options.rng);
  const pair = pickPair(options.players, {}, null, options.rng);
  const enough = options.players.length >= VERDICT_MIN_PLAYERS && card !== undefined && pair !== null;
  return {
    level: options.level,
    players: [...options.players],
    roster: [...options.players],
    deck,
    card: card ?? null,
    pair,
    votes: [0, 0],
    phase: enough ? "vote" : "end",
    appearances: pair ? { [pair[0]]: 1, [pair[1]]: 1 } : {},
    ledger: {},
    lastPenalties: [],
    verdicts: {},
    endReason: enough ? null : "notEnoughPlayers",
  };
}

export function verdictPenalties(level: GameLevel, pair: readonly [string, string], votes: readonly [number, number]): PenaltyLine[] {
  const [a, b] = votes;
  if (a + b === 0) return [];
  const base = VERDICT_SIPS[level];
  const sips = level === "extreme" ? Math.min(VERDICT_EXTREME_CAP, base + Math.abs(a - b)) : base;
  if (a === b) return [{ playerId: pair[0], sips: base }, { playerId: pair[1], sips: base }];
  return [{ playerId: a > b ? pair[0] : pair[1], sips }];
}

function withNewPair(state: VerdictState, rng: Random): VerdictState {
  const pair = pickPair(state.players, state.appearances, state.pair, rng);
  if (!pair) return { ...state, pair: null, phase: "end", endReason: "notEnoughPlayers" };
  const appearances = { ...state.appearances, [pair[0]]: (state.appearances[pair[0]] ?? 0) + 1, [pair[1]]: (state.appearances[pair[1]] ?? 0) + 1 };
  return { ...state, pair, appearances, votes: [0, 0] };
}

export function verdictReducer(state: VerdictState, action: VerdictAction, rng: Random): VerdictState {
  if (state.phase === "end" && action.type !== "addPlayer") return state;
  switch (action.type) {
    case "vote": {
      if (state.phase !== "vote") return state;
      const votes: [number, number] = [state.votes[0], state.votes[1]];
      const next = votes[action.side] + action.delta;
      // One vote per voter: the demo let one person tap forever.
      if (next < 0 || (action.delta > 0 && votes[0] + votes[1] >= voterCount(state))) return state;
      votes[action.side] = next;
      return { ...state, votes };
    }
    case "close": {
      if (state.phase !== "vote" || !state.pair) return state;
      const lines = verdictPenalties(state.level, state.pair, state.votes);
      const verdicts = { ...state.verdicts };
      for (const line of lines) verdicts[line.playerId] = (verdicts[line.playerId] ?? 0) + 1;
      return { ...state, phase: "result", ledger: addPenalties(state.ledger, lines), lastPenalties: lines, verdicts };
    }
    case "next": {
      if (state.phase !== "result") return state;
      const [card, ...deck] = state.deck;
      if (!card) return { ...state, card: null, phase: "end", endReason: "completed", lastPenalties: [] };
      return { ...withNewPair({ ...state, card, deck }, rng), phase: "vote", lastPenalties: [] };
    }
    case "removePlayer": {
      if (!state.players.some((p) => p.id === action.playerId)) return state;
      const players = state.players.filter((p) => p.id !== action.playerId);
      if (players.length < VERDICT_MIN_PLAYERS) return { ...state, players, phase: "end", endReason: "notEnoughPlayers" };
      const base = { ...state, players };
      // One of the two left mid-vote: same card, a new pair, votes start over.
      if (state.phase === "vote" && state.pair?.includes(action.playerId)) return withNewPair(base, rng);
      // A voter left: votes above the new voter count are trimmed.
      const voters = voterCount(base);
      const total = state.votes[0] + state.votes[1];
      if (state.phase === "vote" && total > voters) {
        const trimmed: [number, number] = [state.votes[0], state.votes[1]];
        let excess = total - voters;
        for (const side of [0, 1] as const) {
          const cut = Math.min(excess, trimmed[side]);
          trimmed[side] -= cut;
          excess -= cut;
        }
        return { ...base, votes: trimmed };
      }
      return base;
    }
    case "addPlayer": {
      if (state.players.some((p) => p.id === action.player.id)) return state;
      const players = [...state.players, action.player];
      const roster = withPlayer(state.roster, action.player);
      if (state.phase === "end" && state.endReason === "notEnoughPlayers" && state.card && players.length >= VERDICT_MIN_PLAYERS) {
        return { ...withNewPair({ ...state, players, roster }, rng), phase: "vote", endReason: null };
      }
      return { ...state, players, roster };
    }
    case "stop":
      return { ...state, phase: "end", endReason: "stopped" };
  }
}
