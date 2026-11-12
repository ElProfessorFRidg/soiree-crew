import type { DrawingEvent, GameLevel, GribouilleLanguage, GribouilleView } from "@crew/games";
import { api } from "./api";

export type { GribouilleView };

export interface OpenRoom {
  id: string;
  code: string;
  crewId: string | null;
  language: GribouilleLanguage;
  level: GameLevel;
  host: string;
  players: number;
}

export interface GuessAnswer {
  result: "correct" | "close" | "wrong" | "ignored";
  points: number;
}

/**
 * O-63: the online drawing game. The server owns the word, the clock and the scores; the phone sends
 * strokes and guesses and asks for the room (with the strokes after `since`) on a live hint, on a
 * timer, and again after any gap in the connection.
 */
export const gribouille = {
  create: (body: { crewId: string | null; language: GribouilleLanguage; level: GameLevel; rounds: number }) => api<GribouilleView>("/v1/gribouille", { method: "POST", body }),
  open: () => api<{ rooms: OpenRoom[] }>("/v1/gribouille/open").then((r) => r.rooms),
  join: (code: string) => api<GribouilleView>("/v1/gribouille/join", { method: "POST", body: { code } }),
  get: (id: string, since: number) => api<GribouilleView>(`/v1/gribouille/${id}?since=${since}`),
  start: (id: string) => api<GribouilleView>(`/v1/gribouille/${id}/start`, { method: "POST" }),
  strokes: (id: string, events: DrawingEvent[]) => api<{ count: number }>(`/v1/gribouille/${id}/strokes`, { method: "POST", body: { events } }),
  guess: (id: string, text: string) => api<GuessAnswer>(`/v1/gribouille/${id}/guess`, { method: "POST", body: { text } }),
  swap: (id: string) => api<GribouilleView>(`/v1/gribouille/${id}/swap`, { method: "POST" }),
  leave: (id: string) => api<void>(`/v1/gribouille/${id}/leave`, { method: "POST" }),
};
