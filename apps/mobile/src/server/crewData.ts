import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { newId } from "@/state/store";
import { notifyRecapReady } from "@/reminders/reminders";
import { api } from "./api";

export interface CrewMember {
  id: string;
  username: string;
  displayName: string;
  nickname: string | null;
  role: "admin" | "member";
}

export interface Crew {
  id: string;
  name: string;
  role: "admin" | "member";
  leaderboardEnabled: boolean;
  /** <ai_features>: opt-in per crew, off by default. */
  aiEnabled?: boolean;
  me: { leaderboardOptOut: boolean; territoryOptOut: boolean };
  members: CrewMember[];
}

export type PartyMood = "party" | "birthday" | "champagne" | "sunset" | "costume" | "wine" | "fire" | "night" | "home" | "tropical";
export type PartyResponse = "invited" | "going" | "declined";

export interface Party {
  id: string;
  crewId: string;
  name: string;
  mood: PartyMood;
  kind: "party" | "trip";
  startsAt: number;
  endsAt: number;
  closedAt: number | null;
  live: boolean;
  myResponse: PartyResponse;
}

export interface LiveMember {
  userId: string;
  displayName: string;
  response: PartyResponse;
  designatedDriver: boolean;
  homeSafeAt: number | null;
  batteryLow: boolean;
  lastActivityAt: number | null;
  bac: number | null;
  trend: "rising" | "falling" | "steady" | null;
  drinks: number;
  water: number;
  quiet: boolean;
  /** N-27: leader of the group this member goes home with (themself when leading). */
  homeWith: string | null;
  homeMode: HomeMode | null;
  homeOfferFrom: string | null;
}

export type HomeMode = "walk" | "car" | "ride" | "transit";

export async function setGoingHome(
  partyId: string,
  input: { withUserId?: string | null; mode?: HomeMode | null; offerTo?: string; answerOffer?: boolean },
): Promise<void> {
  await api(`/v1/parties/${partyId}/home`, { method: "POST", body: input });
  await refreshLiveParty(partyId);
}

export interface LiveParty {
  party: Omit<Party, "myResponse">;
  members: LiveMember[];
  serverTime: number;
  fetchedAt: number;
}

interface CrewState {
  crews: Crew[];
  parties: Party[];
  live: Record<string, LiveParty>;
}

/** Cached server data, kept on the device so crew screens read offline (SYNC-05: a cache, never the truth). */
export const useCrewData = create<CrewState>()(
  persist((): CrewState => ({ crews: [], parties: [], live: {} }), {
    name: "crew-data-v1",
    storage: createJSONStorage(() => AsyncStorage),
  }),
);

export async function refreshCrews(): Promise<void> {
  const { crews } = await api<{ crews: Crew[] }>("/v1/crews");
  useCrewData.setState({ crews });
}

export async function refreshParties(): Promise<void> {
  const { parties } = await api<{ parties: Party[] }>("/v1/parties");
  useCrewData.setState({ parties });
  // O-41: a party I went to closed in the last day, its recap is ready.
  const dayAgo = Date.now() - 24 * 3_600_000;
  for (const party of parties) {
    if (party.myResponse === "going" && party.closedAt !== null && party.closedAt > dayAgo) void notifyRecapReady(party).catch(() => undefined);
  }
  // Keep the live view of the party in progress current.
  const live = parties.find((p) => p.live && p.myResponse === "going");
  if (live) await refreshLiveParty(live.id);
}

export async function refreshLiveParty(partyId: string): Promise<void> {
  const data = await api<Omit<LiveParty, "fetchedAt">>(`/v1/parties/${partyId}/live`);
  useCrewData.setState((state) => ({ live: { ...state.live, [partyId]: { ...data, fetchedAt: Date.now() } } }));
}

export async function createCrew(name: string): Promise<string> {
  const { crew } = await api<{ crew: { id: string } }>("/v1/crews", { method: "POST", body: { name } });
  await refreshCrews();
  return crew.id;
}

export async function createInvite(crewId: string): Promise<{ code: string; url: string; expiresAt: number }> {
  return api(`/v1/crews/${crewId}/invites`, { method: "POST" });
}

export async function acceptInvite(code: string): Promise<string> {
  const { crewId } = await api<{ crewId: string }>(`/v1/invites/${encodeURIComponent(code.trim().toUpperCase())}/accept`, { method: "POST" });
  await Promise.all([refreshCrews(), refreshParties()]);
  return crewId;
}

export async function leaveCrew(crewId: string): Promise<void> {
  await api(`/v1/crews/${crewId}/members/me`, { method: "DELETE" });
  await refreshCrews();
}

export interface NewParty {
  crewId: string;
  name: string;
  mood: PartyMood;
  kind: "party" | "trip";
  startsAt: number;
  endsAt: number;
}

export async function createParty(input: NewParty): Promise<Party> {
  const { party } = await api<{ party: Omit<Party, "myResponse"> }>("/v1/parties", { method: "POST", body: { id: newId(), ...input } });
  await refreshParties();
  return { ...party, myResponse: "going" };
}

/** Optimistic reply to an invitation (O-36): the card moves at once and comes back if the server refuses. */
export async function respondToParty(partyId: string, response: "going" | "declined"): Promise<void> {
  const before = useCrewData.getState().parties;
  useCrewData.setState({ parties: before.map((p) => (p.id === partyId ? { ...p, myResponse: response } : p)) });
  try {
    await api(`/v1/parties/${partyId}/response`, { method: "POST", body: { response } });
    await refreshParties();
  } catch (error) {
    useCrewData.setState({ parties: before });
    throw error;
  }
}

export async function setPartyStatus(
  partyId: string,
  status: { homeSafe?: boolean; designatedDriver?: boolean; batteryLow?: boolean },
): Promise<void> {
  await api(`/v1/parties/${partyId}/status`, { method: "POST", body: status });
  await refreshLiveParty(partyId);
}

export async function closeParty(partyId: string): Promise<void> {
  await api(`/v1/parties/${partyId}/close`, { method: "POST" });
  await refreshParties();
}

/** The party the user is in right now, if any (HUB-01 opens on it). */
export function useLiveParty(): { party: Party; live: LiveParty | undefined } | null {
  const parties = useCrewData((state) => state.parties);
  const liveMap = useCrewData((state) => state.live);
  const now = Date.now();
  const party = parties.find((p) => p.myResponse === "going" && p.closedAt === null && p.startsAt <= now && p.endsAt >= now);
  if (!party) return null;
  return { party, live: liveMap[party.id] };
}

/** <ai_features>: the crew admin turns AI drafts on or off for the whole crew. */
export async function setCrewAi(crewId: string, aiEnabled: boolean): Promise<void> {
  const patch = (on: boolean) => useCrewData.setState((state) => ({ crews: state.crews.map((c) => (c.id === crewId ? { ...c, aiEnabled: on } : c)) }));
  patch(aiEnabled);
  try {
    await api(`/v1/crews/${crewId}/settings`, { method: "PATCH", body: { aiEnabled } });
  } catch (error) {
    patch(!aiEnabled);
    throw error;
  }
}

/** RANK-08: the crew admin switches the drinking leaderboard on or off for everyone. */
export async function setCrewLeaderboard(crewId: string, leaderboardEnabled: boolean): Promise<void> {
  const patch = (enabled: boolean) =>
    useCrewData.setState((state) => ({ crews: state.crews.map((c) => (c.id === crewId ? { ...c, leaderboardEnabled: enabled } : c)) }));
  patch(leaderboardEnabled);
  try {
    await api(`/v1/crews/${crewId}/settings`, { method: "PATCH", body: { leaderboardEnabled } });
  } catch (error) {
    patch(!leaderboardEnabled);
    throw error;
  }
}
