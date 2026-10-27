import { create } from "zustand";
import { api } from "./api";

export type NightStatus = "going_out" | "maybe" | "home" | "unavailable";

export interface Radar {
  tonight: string;
  nights: string[];
  members: { userId: string; name: string }[];
  statuses: { userId: string; night: string; status: NightStatus; fromMinute: number | null; toMinute: number | null; place: string }[];
  calls: { id: string; userId: string; note: string; partyId: string | null; at: number; replies: { userId: string; reply: "in" | "maybe" | "no" }[] }[];
}

export interface SosAlert {
  id: string;
  userId: string;
  name: string;
  at: number;
  location: { lat: number; lng: number; accuracy: number } | null;
}

interface RadarState {
  byCrew: Record<string, Radar>;
  sos: SosAlert[];
}

export const useRadar = create<RadarState>(() => ({ byCrew: {}, sos: [] }));

export async function refreshRadar(crewId: string): Promise<void> {
  const radar = await api<Radar>(`/v1/crews/${crewId}/radar`);
  useRadar.setState((state) => ({ byCrew: { ...state.byCrew, [crewId]: radar } }));
}

/** Optimistic status change: the tile flips at once and comes back if the server refuses. */
export async function setNightStatus(crewId: string, night: string, status: NightStatus, me: string): Promise<void> {
  const before = useRadar.getState().byCrew[crewId];
  if (before) {
    const statuses = [...before.statuses.filter((s) => !(s.userId === me && s.night === night)), { userId: me, night, status, fromMinute: null, toMinute: null, place: "" }];
    useRadar.setState((state) => ({ byCrew: { ...state.byCrew, [crewId]: { ...before, statuses } } }));
  }
  try {
    await api("/v1/status", { method: "PUT", body: { night, status } });
  } catch (error) {
    if (before) useRadar.setState((state) => ({ byCrew: { ...state.byCrew, [crewId]: before } }));
    throw error;
  }
}

export async function callCrew(crewId: string, note: string): Promise<string> {
  const { id } = await api<{ id: string }>(`/v1/crews/${crewId}/out-calls`, { method: "POST", body: { note } });
  await refreshRadar(crewId);
  return id;
}

export async function replyToCall(crewId: string, callId: string, reply: "in" | "maybe" | "no"): Promise<void> {
  await api(`/v1/out-calls/${callId}/reply`, { method: "POST", body: { reply } });
  await refreshRadar(crewId);
}

export function linkCallToParty(callId: string, partyId: string): Promise<unknown> {
  return api(`/v1/out-calls/${callId}/party`, { method: "POST", body: { partyId } });
}

export async function refreshSos(): Promise<void> {
  const { alerts } = await api<{ alerts: SosAlert[] }>("/v1/sos");
  useRadar.setState({ sos: alerts });
}

export function sendSos(input: { partyId?: string; location?: { lat: number; lng: number; accuracy: number } }): Promise<unknown> {
  return api("/v1/sos", { method: "POST", body: input });
}

export async function resolveSos(id: string): Promise<void> {
  await api(`/v1/sos/${id}/resolve`, { method: "POST" });
  await refreshSos();
}
