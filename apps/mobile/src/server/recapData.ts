import { api } from "./api";

export const RECAP_EMOJIS = ["🔥", "😂", "🥴", "👑", "💧", "❤️"] as const;
export type RecapEmoji = (typeof RECAP_EMOJIS)[number];

export type BadgeKind = "camel" | "goldenDriver" | "newBoss" | "firstIn" | "nightOwl";
export type TimelineKind = "start" | "arrival" | "checkIn" | "takeover" | "round" | "homeSafe" | "end";

export interface Recap {
  party: { id: string; crewId: string; name: string; mood: string; startsAt: number; endsAt: number; closedAt: number | null };
  ready: boolean;
  window: { from: number; to: number };
  figures: { participants: number; drinks: number; averagePeak: number | null };
  participants: {
    userId: string;
    name: string;
    drinks: number;
    water: number;
    peak: number | null;
    /** [timestamp, g/L] every 10 minutes. */
    curve: [number, number][];
    designatedDriver: boolean;
    homeSafeAt: number | null;
  }[];
  badges: { kind: BadgeKind; userId: string; value?: number; venueName?: string }[];
  timeline: { at: number; kind: TimelineKind; userId?: string; venueName?: string; count?: number }[];
  reactions: { fromId: string; toId: string; emoji: RecapEmoji }[];
  quotes: { id: string; saidBy: string | null; addedBy: string; text: string; votes: number; mine: boolean }[];
  /** AI-02: the story published by someone who was there. */
  narration?: { text: string; tone: "plain" | "epic" | "roast"; authorId: string; at: number } | null;
  aiAvailable?: boolean;
}

export interface RecapSummary {
  id: string;
  crewId: string;
  name: string;
  mood: string;
  startsAt: number;
  closedAt: number;
  going: number;
  seenAt: number | null;
}

export function fetchRecap(partyId: string): Promise<Recap> {
  return api(`/v1/parties/${partyId}/recap`);
}

export function fetchRecaps(): Promise<{ recaps: RecapSummary[] }> {
  return api("/v1/recaps");
}

export function react(partyId: string, toId: string, emoji: RecapEmoji | null): Promise<unknown> {
  return api(`/v1/parties/${partyId}/recap/reactions`, { method: "PUT", body: { toId, emoji } });
}

export function addQuote(partyId: string, input: { id: string; text: string; saidBy: string | null }): Promise<unknown> {
  return api(`/v1/parties/${partyId}/quotes`, { method: "POST", body: input });
}

export function voteQuote(quoteId: string): Promise<{ voted: boolean }> {
  return api(`/v1/quotes/${quoteId}/vote`, { method: "POST" });
}

export function removeQuote(quoteId: string): Promise<unknown> {
  return api(`/v1/quotes/${quoteId}`, { method: "DELETE" });
}
