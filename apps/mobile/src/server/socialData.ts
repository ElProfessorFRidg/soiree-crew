import { create } from "zustand";
import { api } from "./api";
import { refreshCrews, refreshParties, useCrewData, type PartyMood } from "./crewData";

export interface JoinRequest {
  partyId: string;
  partyName: string;
  mood: PartyMood;
  userId: string;
  name: string;
  at: number;
}

export interface Invitations {
  partyInvites: number;
  friendRequests: number;
  joinRequests: JoinRequest[];
  /** N-31: unseen feed mentions per crew id. */
  mentions: Record<string, number>;
  total: number;
}

const EMPTY: Invitations = { partyInvites: 0, friendRequests: 0, joinRequests: [], mentions: {}, total: 0 };

/** O-36: what waits for my answer. Not persisted: a stale badge is worse than none. */
export const useInvitations = create<Invitations>()(() => EMPTY);

export async function refreshInvitations(): Promise<void> {
  const data = await api<Invitations>("/v1/invitations");
  useInvitations.setState(data);
}

export function clearInvitations(): void {
  useInvitations.setState(EMPTY);
}

/** QOL-11: give a crew mate (or myself) a nickname in this crew; null clears it. */
export async function setNickname(crewId: string, userId: string, nickname: string | null): Promise<void> {
  const patch = (value: string | null) =>
    useCrewData.setState((state) => ({
      crews: state.crews.map((c) => (c.id === crewId ? { ...c, members: c.members.map((m) => (m.id === userId ? { ...m, nickname: value } : m)) } : c)),
    }));
  const before = useCrewData.getState().crews.find((c) => c.id === crewId)?.members.find((m) => m.id === userId)?.nickname ?? null;
  patch(nickname);
  try {
    const result = await api<{ nickname: string | null }>(`/v1/crews/${crewId}/members/${userId}/nickname`, { method: "PUT", body: { nickname } });
    patch(result.nickname);
    await refreshCrews();
  } catch (error) {
    patch(before);
    throw error;
  }
}

/** COM-05: invite someone (and, if they want, their crew) to one of my crew's parties. */
export async function inviteGuest(partyId: string, userId: string, withCrew: boolean): Promise<void> {
  await api(`/v1/parties/${partyId}/guests`, { method: "POST", body: { userId, withCrew } });
}

/** COM-05: a guest brings one of their crews; returns how many people were invited. */
export async function bringCrew(partyId: string, crewId: string): Promise<number> {
  const { invited } = await api<{ invited: number }>(`/v1/parties/${partyId}/bring-crew`, { method: "POST", body: { crewId } });
  await refreshParties();
  return invited;
}

/** COM-05: the hosts open the party at one of the crew's venues, or close it (null). */
export async function setPartyOpen(partyId: string, venueId: string | null): Promise<void> {
  await api(`/v1/parties/${partyId}/open`, { method: "PUT", body: { venueId } });
  await refreshParties();
}

export interface OpenParty {
  id: string;
  name: string;
  mood: PartyMood;
  kind: "party" | "trip";
  startsAt: number;
  endsAt: number;
  host: string;
  going: number;
  mine: "member" | "pending" | "approved" | "refused" | null;
}

export const fetchOpenParties = (venueId: string) => api<{ parties: OpenParty[] }>(`/v1/places/${venueId}/open-parties`);

export async function requestToJoin(partyId: string): Promise<void> {
  await api(`/v1/parties/${partyId}/join-requests`, { method: "POST" });
}

export async function cancelJoinRequest(partyId: string): Promise<void> {
  await api(`/v1/parties/${partyId}/join-requests/me`, { method: "DELETE" });
}

/** Optimistic: the request leaves the list at once and comes back if the server refuses. */
export async function decideJoinRequest(partyId: string, userId: string, approve: boolean): Promise<void> {
  const before = useInvitations.getState();
  const joinRequests = before.joinRequests.filter((r) => !(r.partyId === partyId && r.userId === userId));
  useInvitations.setState({ joinRequests, total: before.total - (before.joinRequests.length - joinRequests.length) });
  try {
    await api(`/v1/parties/${partyId}/join-requests/${userId}`, { method: "POST", body: { approve } });
  } catch (error) {
    useInvitations.setState(before);
    throw error;
  }
}

// N-31: the crew feed.
export const FEED_REACTIONS = ["laugh", "fire", "love", "cheers", "wow"] as const;
export type FeedReaction = (typeof FEED_REACTIONS)[number];
/** Emoji are pictures, not words: they need no translation, only an accessibility label. */
export const REACTION_EMOJI: Record<FeedReaction, string> = { laugh: "😂", fire: "🔥", love: "❤️", cheers: "🍻", wow: "😮" };

export interface FeedComment {
  id: string;
  userId: string;
  text: string;
  at: number;
  mentions: string[];
}

export interface FeedSocial {
  key: string;
  reactions: { reaction: FeedReaction; count: number; mine: boolean }[];
  comments: FeedComment[];
  mentionsMe: boolean;
}

export type FeedLine =
  | { kind: "checkins"; at: number; venueName: string; userIds: string[] }
  | { kind: "photos"; at: number; partyName: string; partyId: string; userIds: string[]; count: number }
  | { kind: "party"; at: number; partyId: string; name: string; by: string }
  | { kind: "poll"; at: number; title: string; by: string }
  | { kind: "takeover"; at: number; venueName: string; userId: string }
  /** AC-09: a refused check-in nobody overturned. */
  | { kind: "cheat"; at: number; venueName: string; userId: string }
  | { kind: "joined"; at: number; userIds: string[] }
  | { kind: "quote"; at: number; partyName: string; text: string; saidBy: string | null }
  | { kind: "reactions"; at: number; partyName: string; partyId: string; count: number };

export type FeedEntry = (FeedLine & FeedSocial) | ({ kind: "digest"; at: number; of: FeedLine["kind"]; count: number; userIds: string[]; items: (FeedLine & FeedSocial)[] } & FeedSocial);

/** A counter per crew, bumped by the live socket when its feed changes, so an open feed refetches. */
export const useFeedPulse = create<Record<string, number>>()(() => ({}));

export function pulseFeed(crewId: string): void {
  useFeedPulse.setState((state) => ({ [crewId]: (state[crewId] ?? 0) + 1 }));
}

export const fetchFeed =(crewId: string) => api<{ items: FeedEntry[]; unseenMentions: number }>(`/v1/crews/${crewId}/feed`);

export async function reactToFeed(crewId: string, key: string, reaction: FeedReaction, on: boolean): Promise<void> {
  await api(`/v1/crews/${crewId}/feed/reactions`, { method: "PUT", body: { key, reaction, on } });
}

export async function commentOnFeed(crewId: string, key: string, text: string, mentions: string[]): Promise<void> {
  await api(`/v1/crews/${crewId}/feed/comments`, { method: "POST", body: { key, text, mentions } });
}

export async function deleteFeedComment(crewId: string, commentId: string): Promise<void> {
  await api(`/v1/crews/${crewId}/feed/comments/${commentId}`, { method: "DELETE" });
}

/** Opening the feed clears my mention markers for that crew. */
export async function markFeedSeen(crewId: string): Promise<void> {
  await api(`/v1/crews/${crewId}/feed/seen`, { method: "POST" });
  useInvitations.setState((state) => {
    const { [crewId]: _seen, ...mentions } = state.mentions;
    return { mentions };
  });
}
