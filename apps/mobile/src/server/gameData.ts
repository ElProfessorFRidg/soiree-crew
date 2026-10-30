import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { GameId } from "@crew/games";
import { api, ApiError } from "./api";
import { useSession } from "./session";

/** What the phone reports at the end of a game (TER-02, N-24). The server picks the winner and the venue. */
export interface GameResultPayload {
  id: string;
  crewId: string;
  partyId: string | null;
  gameId: GameId;
  playedAt: number;
  members: { userId: string; penalties: number }[];
  guests: number[];
  record: { key: string; userId: string; count: number } | null;
}

export interface GameResultAnswer {
  id: string;
  winnerId: string | null;
  venueId: string | null;
  takeover: { bossId: string | null; takenFrom: string | null } | null;
}

interface PendingState {
  /** Results not accepted yet: a game ending in a basement bar is sent when the network is back. */
  queue: (GameResultPayload & { attempts: number })[];
}

const MAX_ATTEMPTS = 8;

export const usePendingGames = create<PendingState>()(
  persist((): PendingState => ({ queue: [] }), { name: "game-results-v1", storage: createJSONStorage(() => AsyncStorage) }),
);

/** Queues a finished game and tries to send it right away. Never throws: the end screen never waits. */
export function reportGameResult(result: GameResultPayload, onAnswer?: (answer: GameResultAnswer) => void): void {
  if (!useSession.getState().session) return;
  usePendingGames.setState((s) => ({ queue: [...s.queue.filter((r) => r.id !== result.id), { ...result, attempts: 0 }] }));
  void flushGameResults(onAnswer);
}

let running = false;

/** Sends what is waiting, oldest first; a refusal (4xx) drops the result, a network failure keeps it. */
export async function flushGameResults(onAnswer?: (answer: GameResultAnswer) => void): Promise<void> {
  if (running || !useSession.getState().session) return;
  running = true;
  try {
    for (;;) {
      const next = usePendingGames.getState().queue[0];
      if (!next) return;
      const { attempts, ...body } = next;
      try {
        const answer = await api<GameResultAnswer>("/v1/games/results", { method: "POST", body });
        usePendingGames.setState((s) => ({ queue: s.queue.filter((r) => r.id !== next.id) }));
        onAnswer?.(answer);
      } catch (error) {
        const refused = error instanceof ApiError && error.failure.kind === "http" && error.failure.status < 500 && error.failure.status !== 429;
        if (refused || attempts + 1 >= MAX_ATTEMPTS) {
          usePendingGames.setState((s) => ({ queue: s.queue.filter((r) => r.id !== next.id) }));
          continue;
        }
        usePendingGames.setState((s) => ({ queue: s.queue.map((r) => (r.id === next.id ? { ...r, attempts: attempts + 1 } : r)) }));
        return;
      }
    }
  } finally {
    running = false;
  }
}

export interface CrewHall {
  games: {
    gameId: string;
    played: number;
    wins: { userId: string; name: string; wins: number }[];
    record: { key: string; userId: string; name: string; count: number; at: number } | null;
  }[];
  top: { userId: string; name: string; wins: number }[];
}

/** N-24: the crew's hall of fame, shared by everyone in it. */
export function fetchCrewHall(crewId: string): Promise<CrewHall> {
  return api(`/v1/crews/${crewId}/games/hall`);
}
