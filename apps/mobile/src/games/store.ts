import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { GameId, GameLevel, Player } from "@crew/games";
import { newId } from "@/state/store";

/** A player at the table. Guests have no account; crew members keep their crew id for the live BAC check. */
export interface TablePlayer {
  id: string;
  name: string;
  noAlcohol: boolean;
  guest: boolean;
  crewMemberId: string | null;
}

export type TimerSeconds = 0 | 30 | 60;

export interface GameSettings {
  level: GameLevel;
  timerSeconds: TimerSeconds;
}

export interface GameSession {
  id: string;
  gameId: GameId;
  level: GameLevel;
  timerSeconds: TimerSeconds;
  players: TablePlayer[];
  startedAt: number;
}

interface GamesState {
  table: TablePlayer[];
  settings: Partial<Record<GameId, GameSettings>>;
  /** Length of finished games, newest last, for the computed "usually N min" line (O-44). */
  durations: Partial<Record<GameId, number[]>>;
  session: GameSession | null;
  /** N-24: hall of fame on this phone: wins by player name and the best record, per game. */
  hall: Partial<Record<GameId, HallEntry>>;
  /** O-48: games opened by the friends unlock stay open, even if someone leaves a crew later. */
  unlocked?: GameId[];
}

export interface HallEntry {
  played: number;
  wins: Record<string, number>;
  record: { key: string; name: string; count: number; at: number } | null;
}

const KEPT_DURATIONS = 12;
export const DEFAULT_SETTINGS: GameSettings = { level: "normal", timerSeconds: 0 };

/** Players, their order and per-game settings survive between nights; nothing here leaves the phone. */
export const useGamesStore = create<GamesState>()(
  persist((): GamesState => ({ table: [], settings: {}, durations: {}, session: null, hall: {}, unlocked: [] }), {
    name: "games-v1",
    storage: createJSONStorage(() => AsyncStorage),
  }),
);

/** Two players with the same name get told apart (QOL-11): « Lucas », « Lucas 2 ». */
export function distinctName(name: string, taken: readonly string[]): string {
  const base = name.trim();
  const lower = new Set(taken.map((n) => n.toLocaleLowerCase()));
  if (!lower.has(base.toLocaleLowerCase())) return base;
  let n = 2;
  while (lower.has(`${base} ${n}`.toLocaleLowerCase())) n += 1;
  return `${base} ${n}`;
}

export function addTablePlayer(name: string, crewMemberId: string | null = null): TablePlayer | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const table = useGamesStore.getState().table;
  if (crewMemberId && table.some((p) => p.crewMemberId === crewMemberId)) return null;
  const player: TablePlayer = {
    id: newId(),
    name: distinctName(trimmed, table.map((p) => p.name)),
    noAlcohol: false,
    guest: crewMemberId === null,
    crewMemberId,
  };
  useGamesStore.setState({ table: [...table, player] });
  return player;
}

export function removeTablePlayer(id: string): void {
  useGamesStore.setState((s) => ({ table: s.table.filter((p) => p.id !== id) }));
}

export function moveTablePlayer(id: string, delta: -1 | 1): void {
  useGamesStore.setState((s) => {
    const index = s.table.findIndex((p) => p.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= s.table.length) return {};
    const table = [...s.table];
    [table[index], table[target]] = [table[target] as TablePlayer, table[index] as TablePlayer];
    return { table };
  });
}

export function setNoAlcohol(id: string, noAlcohol: boolean): void {
  useGamesStore.setState((s) => ({ table: s.table.map((p) => (p.id === id ? { ...p, noAlcohol } : p)) }));
}

export function setGameSettings(gameId: GameId, patch: Partial<GameSettings>): void {
  useGamesStore.setState((s) => ({ settings: { ...s.settings, [gameId]: { ...DEFAULT_SETTINGS, ...s.settings[gameId], ...patch } } }));
}

export function startSession(gameId: GameId): GameSession {
  const { table, settings } = useGamesStore.getState();
  const chosen = { ...DEFAULT_SETTINGS, ...settings[gameId] };
  const session: GameSession = { id: newId(), gameId, level: chosen.level, timerSeconds: chosen.timerSeconds, players: [...table], startedAt: Date.now() };
  useGamesStore.setState({ session });
  return session;
}

export function recordDuration(gameId: GameId, ms: number): void {
  if (ms < 30_000) return;
  useGamesStore.setState((s) => ({ durations: { ...s.durations, [gameId]: [...(s.durations[gameId] ?? []), ms].slice(-KEPT_DURATIONS) } }));
}

export function toEnginePlayer(player: TablePlayer): Player {
  return { id: player.id, name: player.name, noAlcohol: player.noAlcohol };
}

/**
 * N-24: a finished game counts once: the player with strictly the fewest
 * penalties wins (a tie names nobody), and a higher record replaces the old one.
 */
export function recordResult(
  gameId: GameId,
  ranking: readonly { player: { name: string }; penalties: number }[],
  record: { key: string; name: string; count: number } | null,
): void {
  useGamesStore.setState((s) => {
    const entry: HallEntry = s.hall?.[gameId] ?? { played: 0, wins: {}, record: null };
    const [first, second] = ranking;
    const wins = { ...entry.wins };
    if (first && second && first.penalties < second.penalties) wins[first.player.name] = (wins[first.player.name] ?? 0) + 1;
    const best = record && (!entry.record || record.count > entry.record.count) ? { ...record, at: Date.now() } : entry.record;
    return { hall: { ...s.hall, [gameId]: { played: entry.played + 1, wins, record: best } } };
  });
}
