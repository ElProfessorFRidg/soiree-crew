import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { GameContent, GameLevel, Leveled } from "@crew/games";
import { api } from "@/server/api";

export type CrewCardKind = "neverEver" | "pointBlank" | "verdict" | "truth" | "dare" | "bigDare";
export const CREW_CARD_KINDS: readonly CrewCardKind[] = ["neverEver", "pointBlank", "verdict", "truth", "dare", "bigDare"];

export interface CrewCard {
  id: string;
  authorId: string;
  kind: CrewCardKind;
  level: GameLevel;
  text: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
}

/** N-33: the crew's own cards, kept on the phone so they play offline too. */
export const useCrewCards = create<{ byCrew: Record<string, CrewCard[]> }>()(
  persist(() => ({ byCrew: {} }), { name: "crew-cards-v1", storage: createJSONStorage(() => AsyncStorage) }),
);

export async function refreshCrewCards(crewId: string): Promise<CrewCard[]> {
  const { cards } = await api<{ cards: CrewCard[] }>(`/v1/crews/${crewId}/cards`);
  useCrewCards.setState((s) => ({ byCrew: { ...s.byCrew, [crewId]: cards } }));
  return cards;
}

export function writeCrewCard(crewId: string, card: { id: string; kind: CrewCardKind; level: GameLevel; text: string }): Promise<{ status: string }> {
  return api(`/v1/crews/${crewId}/cards`, { method: "POST", body: card });
}

export function reviewCrewCard(cardId: string, approve: boolean): Promise<unknown> {
  return api(`/v1/cards/${cardId}/review`, { method: "POST", body: { approve } });
}

export function deleteCrewCard(cardId: string): Promise<unknown> {
  return api(`/v1/cards/${cardId}`, { method: "DELETE" });
}

function add(deck: Leveled<string>, cards: CrewCard[], kind: CrewCardKind): Leveled<string> {
  const mine = cards.filter((c) => c.kind === kind);
  if (!mine.length) return deck;
  return {
    normal: [...deck.normal, ...mine.filter((c) => c.level === "normal").map((c) => c.text)],
    hard: [...deck.hard, ...mine.filter((c) => c.level === "hard").map((c) => c.text)],
    extreme: [...deck.extreme, ...mine.filter((c) => c.level === "extreme").map((c) => c.text)],
  };
}

/** The decks with the crew's approved cards shuffled in, by game and level. */
export function withCrewCards(content: GameContent, cards: readonly CrewCard[]): GameContent {
  const approved = cards.filter((c) => c.status === "approved");
  if (!approved.length) return content;
  return {
    ...content,
    neverEver: add(content.neverEver, approved, "neverEver"),
    verdict: add(content.verdict, approved, "verdict"),
    pointBlank: { ...content.pointBlank, open: add(content.pointBlank.open, approved, "pointBlank") },
    truthDare: { truth: add(content.truthDare.truth, approved, "truth"), dare: add(content.truthDare.dare, approved, "dare") },
    bigDeck: { ...content.bigDeck, dare: add(content.bigDeck.dare, approved, "bigDare") },
  };
}
