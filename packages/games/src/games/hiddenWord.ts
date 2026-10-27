// O-61 Odd One Out and O-62 Moles share one engine: a secret word passed around one phone, then a vote.
// Odd One Out: one intruder has no word. Moles: two players get a different, close word and do not know it.

import { addPenalties, withPlayer, type EndReason, type GameLevel, type PenaltyLedger, type PenaltyLine, type Player } from "../core";
import type { WordPair, WordPairContent } from "../content/types";
import { leveledDeck, type LeveledItem } from "../deck";
import { distinctIndices, shuffle, type Random } from "../random";

export type HiddenWordMode = "impostor" | "doubleAgent";
export type HiddenRole = "crew" | "impostor" | "agent";

export const HIDDEN_WORD_MIN_PLAYERS: Readonly<Record<HiddenWordMode, number>> = { impostor: 4, doubleAgent: 5 };
export const AGENT_COUNT = 2;

/** What the losing side pays. Starting values for playtests. */
export const HIDDEN_WORD_SIPS = {
  /** Odd One Out: the intruder is caught. */
  impostorCaught: { normal: 2, hard: 3, extreme: 4 },
  /** Odd One Out: the intruder wins; every crew member pays. */
  impostorWins: { normal: 1, hard: 2, extreme: 2 },
  /** Moles: a mole is voted out. */
  agentCaught: { normal: 2, hard: 3, extreme: 3 },
  /** Moles: an innocent is voted out by mistake. */
  innocentOut: { normal: 1, hard: 1, extreme: 2 },
  /** Moles: the moles win; every crew member still in pays. */
  agentsWin: { normal: 2, hard: 2, extreme: 3 },
} as const satisfies Record<string, Record<GameLevel, number>>;

export type HiddenWordPhase = "reveal" | "discuss" | "vote" | "lastGuess" | "roundEnd" | "end";

export interface HiddenWordOutcome {
  winner: "crew" | "impostor" | "agents";
}

export interface HiddenWordState {
  mode: HiddenWordMode;
  level: GameLevel;
  players: Player[];
  roster: Player[];
  pairs: LeveledItem<WordPair>[];
  pair: WordPair;
  roles: Readonly<Record<string, HiddenRole>>;
  phase: HiddenWordPhase;
  /** Pass-the-phone reveal: whose turn it is to look, and whether their card is face up. */
  revealIndex: number;
  peeking: boolean;
  seen: boolean;
  /** Moles: players voted out this round, in order. */
  eliminated: string[];
  /** The last vote: who was accused and what they were. */
  lastAccused: { playerId: string; role: HiddenRole } | null;
  outcome: HiddenWordOutcome | null;
  round: number;
  ledger: PenaltyLedger;
  lastPenalties: PenaltyLine[];
  endReason: EndReason | null;
}

export type HiddenWordAction =
  | { type: "peek" }
  | { type: "hide" }
  | { type: "pass" }
  | { type: "startVote" }
  | { type: "accuse"; playerId: string }
  /** Odd One Out, after the intruder is caught: did they find the crew's word? */
  | { type: "guess"; correct: boolean }
  | { type: "nextRound" }
  | { type: "removePlayer"; playerId: string }
  | { type: "addPlayer"; player: Player }
  | { type: "stop" };

/** What one player's card says. The card looks the same for every role: colour never tells (fixes the Moles demo). */
export interface HiddenCard {
  word: string | null;
  /** Odd One Out at Normal: the intruder gets the category. */
  hint: string | null;
}

export function cardFor(state: HiddenWordState, playerId: string): HiddenCard {
  const role = state.roles[playerId] ?? "crew";
  const [crewWord, otherWord, category] = state.pair;
  if (role === "crew") return { word: crewWord, hint: null };
  if (role === "agent") return { word: otherWord, hint: null };
  return { word: null, hint: state.level === "normal" ? category : null };
}

/** Odd One Out gives the caught intruder one guess, except at Extreme. */
export function hasLastGuess(level: GameLevel): boolean {
  return level !== "extreme";
}

function dealRoles(mode: HiddenWordMode, players: readonly Player[], rng: Random): Record<string, HiddenRole> {
  const count = mode === "impostor" ? 1 : AGENT_COUNT;
  const hidden = new Set(distinctIndices(rng, players.length, Math.min(count, players.length)));
  const role: HiddenRole = mode === "impostor" ? "impostor" : "agent";
  return Object.fromEntries(players.map((p, i) => [p.id, hidden.has(i) ? role : "crew"]));
}

function drawPair(state: Pick<HiddenWordState, "pairs" | "level">, content: WordPairContent | null, rng: Random): { pair: WordPair; pairs: LeveledItem<WordPair>[] } {
  let pairs = state.pairs;
  if (pairs.length === 0 && content) pairs = leveledDeck(content, state.level, null, rng);
  const [first, ...rest] = pairs;
  if (!first) throw new Error("hidden word game needs word pairs");
  return { pair: first.value, pairs: rest };
}

export function createHiddenWord(options: {
  mode: HiddenWordMode;
  players: Player[];
  level: GameLevel;
  content: WordPairContent;
  rng: Random;
}): HiddenWordState {
  const pairs = leveledDeck(options.content, options.level, null, options.rng);
  const drawn = drawPair({ pairs, level: options.level }, options.content, options.rng);
  // A different seat looks first each round, so the first to look is no clue.
  const players = shuffle(options.rng, options.players);
  const enough = options.players.length >= HIDDEN_WORD_MIN_PLAYERS[options.mode];
  return {
    mode: options.mode,
    level: options.level,
    players,
    roster: [...options.players],
    pairs: drawn.pairs,
    pair: drawn.pair,
    roles: dealRoles(options.mode, players, options.rng),
    phase: enough ? "reveal" : "end",
    revealIndex: 0,
    peeking: false,
    seen: false,
    eliminated: [],
    lastAccused: null,
    outcome: null,
    round: 1,
    ledger: {},
    lastPenalties: [],
    endReason: enough ? null : "notEnoughPlayers",
  };
}

function alive(state: HiddenWordState): Player[] {
  return state.players.filter((p) => !state.eliminated.includes(p.id));
}

function countRole(state: HiddenWordState, role: HiddenRole): number {
  return alive(state).filter((p) => state.roles[p.id] === role).length;
}

function finishRound(state: HiddenWordState, winner: HiddenWordOutcome["winner"], extra: PenaltyLine[] = []): HiddenWordState {
  const lines: PenaltyLine[] = [...extra];
  const level = state.level;
  if (state.mode === "impostor") {
    // alive() leaves out anyone who joined mid-round and had no card.
    for (const p of alive(state)) {
      const role = state.roles[p.id];
      if (winner === "crew" && role === "impostor") lines.push({ playerId: p.id, sips: HIDDEN_WORD_SIPS.impostorCaught[level] });
      if (winner === "impostor" && role === "crew") lines.push({ playerId: p.id, sips: HIDDEN_WORD_SIPS.impostorWins[level] });
    }
  } else if (winner === "agents") {
    for (const p of alive(state)) {
      if (state.roles[p.id] === "crew") lines.push({ playerId: p.id, sips: HIDDEN_WORD_SIPS.agentsWin[level] });
    }
  }
  return { ...state, phase: "roundEnd", outcome: { winner }, ledger: addPenalties(state.ledger, lines), lastPenalties: lines };
}

/** New word, new roles, the phone goes round again. */
function redeal(state: HiddenWordState, content: WordPairContent | null, rng: Random, nextRoundNumber: boolean): HiddenWordState {
  const drawn = drawPair(state, content, rng);
  const players = shuffle(rng, state.players);
  return {
    ...state,
    players,
    pairs: drawn.pairs,
    pair: drawn.pair,
    roles: dealRoles(state.mode, players, rng),
    phase: "reveal",
    revealIndex: 0,
    peeking: false,
    seen: false,
    eliminated: [],
    lastAccused: null,
    outcome: null,
    round: nextRoundNumber ? state.round + 1 : state.round,
    lastPenalties: [],
  };
}

export function hiddenWordReducer(state: HiddenWordState, action: HiddenWordAction, rng: Random, content: WordPairContent | null = null): HiddenWordState {
  if (state.phase === "end" && action.type !== "addPlayer") return state;
  switch (action.type) {
    case "peek":
      return state.phase === "reveal" ? { ...state, peeking: true, seen: true } : state;
    case "hide":
      return state.phase === "reveal" ? { ...state, peeking: false } : state;
    case "pass": {
      // Nobody passes a card they have not looked at.
      if (state.phase !== "reveal" || !state.seen) return state;
      const revealIndex = state.revealIndex + 1;
      if (revealIndex >= state.players.length) return { ...state, phase: "discuss", peeking: false, seen: false, revealIndex };
      return { ...state, revealIndex, peeking: false, seen: false };
    }
    case "startVote":
      return state.phase === "discuss" ? { ...state, phase: "vote" } : state;
    case "accuse": {
      if (state.phase !== "vote" || !alive(state).some((p) => p.id === action.playerId)) return state;
      const role = state.roles[action.playerId] ?? "crew";
      const lastAccused = { playerId: action.playerId, role };
      if (state.mode === "impostor") {
        if (role !== "impostor") return finishRound({ ...state, lastAccused }, "impostor");
        if (hasLastGuess(state.level)) return { ...state, lastAccused, phase: "lastGuess" };
        return finishRound({ ...state, lastAccused }, "crew");
      }
      // Moles: the accused is out and their role is shown; the vote goes on until one side wins.
      const eliminated = [...state.eliminated, action.playerId];
      const line = role === "agent" ? HIDDEN_WORD_SIPS.agentCaught[state.level] : HIDDEN_WORD_SIPS.innocentOut[state.level];
      const lines = [{ playerId: action.playerId, sips: line }];
      const next = { ...state, eliminated, lastAccused, ledger: addPenalties(state.ledger, lines), lastPenalties: lines };
      const agents = countRole(next, "agent");
      const crew = countRole(next, "crew");
      if (agents === 0) return { ...finishRound(next, "crew"), lastPenalties: lines };
      if (agents >= crew) {
        const done = finishRound(next, "agents");
        return { ...done, lastPenalties: [...lines, ...done.lastPenalties] };
      }
      return { ...next, phase: "discuss" };
    }
    case "guess":
      if (state.phase !== "lastGuess") return state;
      return finishRound(state, action.correct ? "impostor" : "crew");
    case "nextRound":
      if (state.phase !== "roundEnd") return state;
      return redeal(state, content, rng, true);
    case "removePlayer": {
      const index = state.players.findIndex((p) => p.id === action.playerId);
      if (index < 0) return state;
      const players = state.players.filter((p) => p.id !== action.playerId);
      const { [action.playerId]: _role, ...roles } = state.roles;
      const base = { ...state, players, roles, eliminated: state.eliminated.filter((id) => id !== action.playerId) };
      if (players.length < HIDDEN_WORD_MIN_PLAYERS[state.mode]) return { ...base, phase: "end", endReason: "notEnoughPlayers" };
      if (state.phase === "roundEnd") return base;
      const hiddenLeft = state.roles[action.playerId] !== "crew";
      const noContest = state.mode === "doubleAgent" && countRole(base, "agent") >= countRole(base, "crew");
      // Someone with a hidden role left, or the vote can no longer be fair: the round is dealt again, nobody pays.
      if (hiddenLeft || noContest) return redeal(base, content, rng, false);
      if (state.phase === "reveal") {
        const revealIndex = index < state.revealIndex ? state.revealIndex - 1 : state.revealIndex;
        const leftMidPeek = index === state.revealIndex;
        if (revealIndex >= players.length) return { ...base, revealIndex, phase: "discuss", peeking: false, seen: false };
        return { ...base, revealIndex, peeking: leftMidPeek ? false : state.peeking, seen: leftMidPeek ? false : state.seen };
      }
      return base;
    }
    case "addPlayer": {
      if (state.players.some((p) => p.id === action.player.id)) return state;
      const players = [...state.players, action.player];
      const roster = withPlayer(state.roster, action.player);
      // A newcomer has no card this round: they join from the next deal.
      if (state.phase === "end" && state.endReason === "notEnoughPlayers" && players.length >= HIDDEN_WORD_MIN_PLAYERS[state.mode]) {
        return { ...redeal({ ...state, players, roster }, content, rng, true), endReason: null };
      }
      if (state.phase === "roundEnd" || state.phase === "end") return { ...state, players, roster };
      return { ...state, players, roster, roles: { ...state.roles, [action.player.id]: "crew" }, eliminated: [...state.eliminated, action.player.id] };
    }
    case "stop":
      return { ...state, phase: "end", endReason: "stopped" };
  }
}

/** The player holding the phone during the reveal. */
export function revealPlayer(state: HiddenWordState): Player | undefined {
  return state.players[state.revealIndex];
}

export function alivePlayers(state: HiddenWordState): Player[] {
  return alive(state);
}
