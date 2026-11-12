// O-63 Gribouille, online: one draws, the others guess, 3 to 8 phones. This is the server's rulebook: the
// server owns the word, the clock, who found it and the scores; phones only send strokes and guesses.
// Every function takes the time and the randomness, so tests replay a whole game.

import type { GameLevel } from "../core";
import { leveledDeck } from "../deck";
import type { DrawingEvent } from "../drawing";
import { QUICK_DRAW_TIME_MS } from "../games/quickDraw";
import { shuffle, type Random } from "../random";
import { gribouilleWordsFor, type GribouilleLanguage } from "./words";

export const GRIBOUILLE_MIN_PLAYERS = 3;
export const GRIBOUILLE_MAX_PLAYERS = 8;
export const GRIBOUILLE_MAX_ROUNDS = 3;
/** The picture and the word stay on screen this long between two turns. */
export const GRIBOUILLE_REVEAL_MS = 7_000;
/** A phone silent for longer than this is shown as gone, and a gone drawer loses the turn. */
export const GRIBOUILLE_PRESENCE_MS = 20_000;
export const GRIBOUILLE_MAX_EVENTS = 4_000;
export const GRIBOUILLE_FEED = 40;
const GUESS_POINTS = 100;
const SPEED_POINTS = 200;
const DRAWER_POINTS = 50;

export type GribouillePhase = "lobby" | "drawing" | "reveal" | "end";
export type GribouilleEndReason = "completed" | "notEnoughPlayers";
export type GribouilleTurnEnd = "allFound" | "timeUp" | "drawerGone";

export type GribouilleErrorCode = "full" | "started" | "not_host" | "not_enough_players" | "not_drawer" | "bad_phase" | "no_swap" | "too_many_events" | "not_in_room";

export class GribouilleError extends Error {
  constructor(readonly code: GribouilleErrorCode) {
    super(code);
  }
}

export interface GribouillePlayer {
  id: string;
  name: string;
  score: number;
  lastSeen: number;
  left: boolean;
}

export interface GribouilleFeedLine {
  id: number;
  userId: string;
  kind: "guess" | "found";
  /** Absent on "found" (the word is never in the feed) and when a guess was hidden by the text filter. */
  text?: string;
}

export interface GribouilleTurn {
  index: number;
  drawerId: string;
  word: string;
  startedAt: number;
  timeLimitMs: number;
  swapsLeft: number;
  /** Letter positions in the order they are given away. */
  hintOrder: number[];
  guessed: string[];
  gained: Record<string, number>;
  events: DrawingEvent[];
  endedAt: number | null;
  endReason: GribouilleTurnEnd | null;
}

export interface GribouilleRoom {
  id: string;
  code: string;
  hostId: string;
  crewId: string | null;
  language: GribouilleLanguage;
  level: GameLevel;
  rounds: number;
  players: GribouillePlayer[];
  phase: GribouillePhase;
  endReason: GribouilleEndReason | null;
  order: string[];
  deck: string[];
  turn: GribouilleTurn | null;
  feed: GribouilleFeedLine[];
  feedSeq: number;
  createdAt: number;
}

/** Same letters, whatever the accents, case, spaces or punctuation. German ß is ss. */
export function normaliseGuess(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const ARTICLES = new Set(["the", "a", "an", "le", "la", "les", "l", "un", "une", "el", "los", "las", "il", "lo", "gli", "der", "die", "das", "ein", "eine", "o", "os", "as", "um", "uma"]);

/** The comparison form of a word or a guess: normalised, a leading article dropped, spaces gone. */
export function guessKey(text: string): string {
  const words = normaliseGuess(text).split(" ");
  const kept = words.length > 1 && ARTICLES.has(words[0] as string) ? words.slice(1) : words;
  return kept.join("");
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min((previous[j] as number) + 1, (row[j - 1] as number) + 1, (previous[j - 1] as number) + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = row;
  }
  return previous[b.length] as number;
}

export type GuessJudgement = "correct" | "close" | "wrong";

export function judgeGuess(word: string, guess: string): GuessJudgement {
  const target = guessKey(word);
  const attempt = guessKey(guess);
  if (!attempt) return "wrong";
  if (attempt === target) return "correct";
  const allowed = target.length >= 9 ? 2 : target.length >= 5 ? 1 : 0;
  return allowed > 0 && editDistance(attempt, target) <= allowed ? "close" : "wrong";
}

const isLetter = (ch: string) => /[\p{L}\p{N}]/u.test(ch);

/** What guessers see of the word: letters as "_", separators as they are, and the letters given away so far. */
export function wordMask(word: string, hintOrder: readonly number[], elapsedMs: number, timeLimitMs: number): string[] {
  const chars = [...word];
  const letters = chars.filter(isLetter).length;
  const share = elapsedMs / timeLimitMs;
  const revealed = letters < 4 ? 0 : share >= 0.75 ? 2 : share >= 0.5 ? 1 : 0;
  const shown = new Set(hintOrder.slice(0, revealed));
  return chars.map((ch, i) => (!isLetter(ch) ? ch : shown.has(i) ? ch : "_"));
}

export function isConnected(player: GribouillePlayer, now: number): boolean {
  return !player.left && now - player.lastSeen <= GRIBOUILLE_PRESENCE_MS;
}

const active = (room: GribouilleRoom) => room.players.filter((p) => !p.left);

function playerOf(room: GribouilleRoom, userId: string): GribouillePlayer {
  const player = room.players.find((p) => p.id === userId && !p.left);
  if (!player) throw new GribouilleError("not_in_room");
  return player;
}

export function createGribouille(options: {
  id: string;
  code: string;
  hostId: string;
  hostName: string;
  crewId: string | null;
  language: GribouilleLanguage;
  level: GameLevel;
  rounds: number;
  now: number;
}): GribouilleRoom {
  return {
    id: options.id,
    code: options.code,
    hostId: options.hostId,
    crewId: options.crewId,
    language: options.language,
    level: options.level,
    rounds: Math.min(GRIBOUILLE_MAX_ROUNDS, Math.max(1, Math.floor(options.rounds))),
    players: [{ id: options.hostId, name: options.hostName, score: 0, lastSeen: options.now, left: false }],
    phase: "lobby",
    endReason: null,
    order: [],
    deck: [],
    turn: null,
    feed: [],
    feedSeq: 0,
    createdAt: options.now,
  };
}

/** A player coming back (a dropped connection, a restarted app) is always let in; a new one only while the room is a lobby. */
export function joinGribouille(room: GribouilleRoom, userId: string, name: string, now: number): void {
  const existing = room.players.find((p) => p.id === userId);
  if (existing) {
    if (existing.left) {
      if (room.phase !== "lobby") throw new GribouilleError("started");
      existing.left = false;
    }
    existing.lastSeen = now;
    return;
  }
  if (room.phase !== "lobby") throw new GribouilleError("started");
  if (active(room).length >= GRIBOUILLE_MAX_PLAYERS) throw new GribouilleError("full");
  room.players.push({ id: userId, name, score: 0, lastSeen: now, left: false });
}

export function touchGribouille(room: GribouilleRoom, userId: string, now: number): void {
  playerOf(room, userId).lastSeen = now;
}

export function leaveGribouille(room: GribouilleRoom, userId: string, now: number, rng: Random): void {
  const player = room.players.find((p) => p.id === userId);
  if (!player || player.left) return;
  if (room.phase === "lobby") room.players = room.players.filter((p) => p.id !== userId);
  else player.left = true;
  const remaining = active(room);
  if (room.hostId === userId && remaining[0]) room.hostId = remaining[0].id;
  if (remaining.length === 0) {
    room.phase = "end";
    room.endReason = "notEnoughPlayers";
  } else advanceGribouille(room, now, rng);
}

function takeWord(room: GribouilleRoom, rng: Random): string {
  if (room.deck.length === 0) room.deck = leveledDeck(gribouilleWordsFor(room.language), room.level, null, rng).map((c) => c.value);
  return room.deck.shift() as string;
}

const letterPositions = (word: string) => [...word].map((ch, i) => (isLetter(ch) ? i : -1)).filter((i) => i >= 0);

function startTurn(room: GribouilleRoom, index: number, drawerId: string, now: number, rng: Random): void {
  const word = takeWord(room, rng);
  room.turn = {
    index,
    drawerId,
    word,
    startedAt: now,
    timeLimitMs: QUICK_DRAW_TIME_MS[room.level],
    swapsLeft: 1,
    hintOrder: shuffle(rng, letterPositions(word)),
    guessed: [],
    gained: {},
    events: [],
    endedAt: null,
    endReason: null,
  };
  room.phase = "drawing";
}

export function startGribouille(room: GribouilleRoom, userId: string, now: number, rng: Random): void {
  if (room.hostId !== userId) throw new GribouilleError("not_host");
  if (room.phase !== "lobby") throw new GribouilleError("bad_phase");
  const present = active(room).filter((p) => isConnected(p, now));
  if (present.length < GRIBOUILLE_MIN_PLAYERS) throw new GribouilleError("not_enough_players");
  const lap = shuffle(rng, present.map((p) => p.id));
  room.players = room.players.filter((p) => present.some((q) => q.id === p.id));
  room.order = Array.from({ length: room.rounds }, () => lap).flat();
  room.deck = [];
  startTurn(room, 0, room.order[0] as string, now, rng);
}

function endTurn(room: GribouilleRoom, reason: GribouilleTurnEnd, now: number): void {
  const turn = room.turn;
  if (!turn || room.phase !== "drawing") return;
  turn.endedAt = now;
  turn.endReason = reason;
  room.phase = "reveal";
}

/**
 * Moves the clock: ends a turn when time is up, everyone found it or the drawer is gone, and starts the next
 * one after the reveal. Called on every request, so a game never depends on a timer surviving. Returns true
 * when anything changed (phones are told).
 */
export function advanceGribouille(room: GribouilleRoom, now: number, rng: Random): boolean {
  let changed = false;
  for (let guard = 0; guard < 40; guard++) {
    if (room.phase === "lobby" || room.phase === "end") return changed;
    const turn = room.turn as GribouilleTurn;
    if (active(room).length < 2) {
      room.phase = "end";
      room.endReason = "notEnoughPlayers";
      if (turn.endedAt === null) {
        turn.endedAt = now;
        turn.endReason = "drawerGone";
      }
      return true;
    }
    if (room.phase === "drawing") {
      const drawer = room.players.find((p) => p.id === turn.drawerId);
      const guessers = active(room).filter((p) => p.id !== turn.drawerId && isConnected(p, now));
      if (now - turn.startedAt >= turn.timeLimitMs) endTurn(room, "timeUp", now);
      else if (!drawer || !isConnected(drawer, now)) endTurn(room, "drawerGone", now);
      else if (guessers.length > 0 && guessers.every((p) => turn.guessed.includes(p.id))) endTurn(room, "allFound", now);
      else return changed;
      changed = true;
      continue;
    }
    // Reveal: the picture and the word stay up, then the next player draws.
    if (now - (turn.endedAt as number) < GRIBOUILLE_REVEAL_MS) return changed;
    let next = turn.index + 1;
    while (next < room.order.length && !active(room).some((p) => p.id === room.order[next])) next++;
    if (next >= room.order.length) {
      room.phase = "end";
      room.endReason = "completed";
    } else startTurn(room, next, room.order[next] as string, now, rng);
    changed = true;
  }
  return changed;
}

function pushFeed(room: GribouilleRoom, line: Omit<GribouilleFeedLine, "id">): void {
  room.feedSeq += 1;
  room.feed.push({ ...line, id: room.feedSeq });
  if (room.feed.length > GRIBOUILLE_FEED) room.feed.splice(0, room.feed.length - GRIBOUILLE_FEED);
}

export type GuessOutcome = { result: "correct"; points: number } | { result: "close" | "wrong" | "ignored" };

/** `hide` is the text filter's verdict: a hidden guess still counts, it just does not show its words. */
export function guessGribouille(room: GribouilleRoom, userId: string, text: string, now: number, hide = false): GuessOutcome {
  const player = playerOf(room, userId);
  player.lastSeen = now;
  const turn = room.turn;
  if (room.phase !== "drawing" || !turn || turn.drawerId === userId || turn.guessed.includes(userId)) return { result: "ignored" };
  const judgement = judgeGuess(turn.word, text);
  if (judgement === "correct") {
    const remaining = Math.max(0, turn.timeLimitMs - (now - turn.startedAt));
    const points = GUESS_POINTS + Math.round((SPEED_POINTS * remaining) / turn.timeLimitMs);
    turn.guessed.push(userId);
    player.score += points;
    turn.gained[userId] = points;
    const drawer = room.players.find((p) => p.id === turn.drawerId);
    if (drawer) {
      drawer.score += DRAWER_POINTS;
      turn.gained[drawer.id] = (turn.gained[drawer.id] ?? 0) + DRAWER_POINTS;
    }
    pushFeed(room, { userId, kind: "found" });
    return { result: "correct", points };
  }
  const shown = text.trim().slice(0, 40);
  pushFeed(room, hide || !shown ? { userId, kind: "guess" } : { userId, kind: "guess", text: shown });
  return { result: judgement };
}

export function addGribouilleStrokes(room: GribouilleRoom, userId: string, events: readonly DrawingEvent[], now: number): number {
  playerOf(room, userId).lastSeen = now;
  const turn = room.turn;
  if (room.phase !== "drawing" || !turn || turn.drawerId !== userId) throw new GribouilleError("not_drawer");
  if (turn.events.length + events.length > GRIBOUILLE_MAX_EVENTS) throw new GribouilleError("too_many_events");
  turn.events.push(...events);
  return turn.events.length;
}

/** One new word, before the first stroke and before anyone found it. */
export function swapGribouilleWord(room: GribouilleRoom, userId: string, now: number, rng: Random): void {
  playerOf(room, userId).lastSeen = now;
  const turn = room.turn;
  if (room.phase !== "drawing" || !turn || turn.drawerId !== userId) throw new GribouilleError("not_drawer");
  if (turn.swapsLeft <= 0 || turn.events.length > 0 || turn.guessed.length > 0) throw new GribouilleError("no_swap");
  turn.word = takeWord(room, rng);
  turn.swapsLeft -= 1;
  turn.hintOrder = shuffle(rng, letterPositions(turn.word));
}

/** Merges runs of extensions of one stroke into one event: fewer, bigger messages from the phone. */
export function coalesceDrawingEvents(events: readonly DrawingEvent[]): DrawingEvent[] {
  const out: DrawingEvent[] = [];
  for (const event of events) {
    const last = out[out.length - 1];
    if (event.type === "stroke.extend" && last && last.type === "stroke.extend" && last.id === event.id) {
      out[out.length - 1] = { type: "stroke.extend", id: last.id, points: [...last.points, ...event.points] };
    } else out.push(event);
  }
  return out;
}

export interface GribouilleView {
  id: string;
  code: string;
  phase: GribouillePhase;
  endReason: GribouilleEndReason | null;
  hostId: string;
  crewId: string | null;
  language: GribouilleLanguage;
  level: GameLevel;
  rounds: number;
  serverNow: number;
  players: { id: string; name: string; score: number; connected: boolean; left: boolean; guessed: boolean; drawing: boolean }[];
  turn: null | {
    index: number;
    total: number;
    drawerId: string;
    startedAt: number;
    timeLimitMs: number;
    /** Letters of the word as guessers see them. */
    mask: string[];
    /** The word: for the drawer and whoever found it, and for everyone once the turn is over. */
    word: string | null;
    swapsLeft: number;
    endReason: GribouilleTurnEnd | null;
    gained: Record<string, number>;
    eventCount: number;
    eventsFrom: number;
    events: DrawingEvent[];
  };
  feed: GribouilleFeedLine[];
  ranking: { id: string; name: string; score: number; place: number }[];
}

export function rankGribouille(room: GribouilleRoom): GribouilleView["ranking"] {
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  return sorted.map((p) => ({ id: p.id, name: p.name, score: p.score, place: sorted.findIndex((q) => q.score === p.score) + 1 }));
}

/** What one phone may know. The word never leaves the server for a guesser who has not found it. */
export function viewGribouille(room: GribouilleRoom, userId: string, now: number, since = 0): GribouilleView {
  const turn = room.turn;
  const over = room.phase === "reveal" || room.phase === "end";
  let turnView: GribouilleView["turn"] = null;
  if (turn) {
    const knows = over || turn.drawerId === userId || turn.guessed.includes(userId);
    const from = Math.min(Math.max(0, since), turn.events.length);
    turnView = {
      index: turn.index,
      total: room.order.length,
      drawerId: turn.drawerId,
      startedAt: turn.startedAt,
      timeLimitMs: turn.timeLimitMs,
      mask: wordMask(turn.word, turn.hintOrder, over ? turn.timeLimitMs : now - turn.startedAt, turn.timeLimitMs),
      word: knows ? turn.word : null,
      swapsLeft: turn.drawerId === userId ? turn.swapsLeft : 0,
      endReason: turn.endReason,
      gained: over ? turn.gained : {},
      eventCount: turn.events.length,
      eventsFrom: from,
      events: turn.events.slice(from),
    };
  }
  return {
    id: room.id,
    code: room.code,
    phase: room.phase,
    endReason: room.endReason,
    hostId: room.hostId,
    crewId: room.crewId,
    language: room.language,
    level: room.level,
    rounds: room.rounds,
    serverNow: now,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      connected: isConnected(p, now),
      left: p.left,
      guessed: Boolean(turn?.guessed.includes(p.id)),
      drawing: turn?.drawerId === p.id && room.phase === "drawing",
    })),
    turn: turnView,
    feed: room.feed,
    ranking: room.phase === "end" ? rankGribouille(room) : [],
  };
}
