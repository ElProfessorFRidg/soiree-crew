import { api } from "./api";

export type PollAnswer = "yes" | "maybe" | "no";

export interface PollSlot {
  id: string;
  startsAt: number;
  endsAt: number;
  answers: { userId: string; answer: PollAnswer }[];
}

export interface Poll {
  id: string;
  createdBy: string;
  title: string;
  place: string;
  plan: string;
  createdAt: number;
  closedAt: number | null;
  partyId: string | null;
  slots: PollSlot[];
}

export interface UsualNights {
  members: { userId: string; name: string; weekdays: number[] }[];
  nights: { night: string; weekday: number; usually: string[] }[];
}

export function fetchPolls(crewId: string): Promise<{ polls: Poll[] }> {
  return api(`/v1/crews/${crewId}/polls`);
}

export function createPoll(
  crewId: string,
  input: { id: string; title: string; place: string; plan: string; slots: { id: string; startsAt: number; endsAt: number }[] },
): Promise<{ id: string }> {
  return api(`/v1/crews/${crewId}/polls`, { method: "POST", body: input });
}

export function votePoll(pollId: string, votes: Record<string, PollAnswer>): Promise<unknown> {
  return api(`/v1/polls/${pollId}/votes`, { method: "PUT", body: { votes } });
}

export function closePoll(pollId: string, slotId: string, partyId: string): Promise<{ partyId: string }> {
  return api(`/v1/polls/${pollId}/close`, { method: "POST", body: { slotId, partyId } });
}

export function deletePoll(pollId: string): Promise<unknown> {
  return api(`/v1/polls/${pollId}`, { method: "DELETE" });
}

export function fetchUsualNights(crewId: string): Promise<UsualNights> {
  return api(`/v1/crews/${crewId}/usual-nights`);
}

export function saveUsualNights(crewId: string, weekdays: number[]): Promise<{ weekdays: number[] }> {
  return api(`/v1/crews/${crewId}/usual-nights`, { method: "PUT", body: { weekdays } });
}
