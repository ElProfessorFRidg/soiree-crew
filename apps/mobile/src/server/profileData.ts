import { api } from "./api";

export const PROFILE_SECTIONS = ["identity", "crews", "titles", "venues", "drinks", "records", "nights"] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];
export type Audience = "me" | "crews" | "friends" | "everyone";
export type Friendship = "none" | "friends" | "requested" | "incoming";
export type Findable = "search" | "username" | "nobody";

export interface ProfileView {
  userId: string;
  relation: { me: boolean; friend: boolean; crewMate: boolean };
  friendship: Friendship;
  muted: boolean;
  audiences?: Record<ProfileSection, Audience>;
  findable?: Findable;
  regularOptIn?: boolean;
  openToMeet?: boolean;
  requestsFrom?: "nobody" | "friendsOfFriends" | "everyone";
  mutualFriends?: number;
  sections: {
    identity?: { displayName: string; username: string; bio: string; country: string };
    crews?: { name: string; members: number }[];
    titles?: { kind: "mayor" | "conqueror" | "explorer" | "nomad"; venueName?: string }[];
    venues?: { venueId: string; name: string; visits: number; nights?: number; ruled: boolean; lastAt?: number; hidden?: boolean }[];
    drinks?: { total: number; favourites: { kind: string; count: number }[]; usualFirstDrink: number | null; usualPacePerHour: number | null };
    records?: { highestBac: number | null; biggestNight: number };
    nights?: { total: number; last30Days: number };
  };
}

export function fetchProfile(userId: string, as?: "stranger" | "friend" | "crew"): Promise<ProfileView> {
  return api(`/v1/users/${userId}/profile${as ? `?as=${as}` : ""}`);
}

export function saveProfile(input: {
  bio?: string;
  country?: string;
  preset?: "private" | "friends" | "public";
  audiences?: Partial<Record<ProfileSection, Audience>>;
  hiddenVenues?: string[];
  findable?: Findable;
  regularOptIn?: boolean;
  openToMeet?: boolean;
  requestsFrom?: "nobody" | "friendsOfFriends" | "everyone";
}): Promise<{ audiences: Record<ProfileSection, Audience> }> {
  return api("/v1/me/profile", { method: "PUT", body: input });
}

export interface PersonFound {
  userId: string;
  username: string;
  name: string;
  friendship: Friendship;
}

/** O-43: crew mates, friends, and strangers who let themselves be found. */
export function searchPeople(q: string): Promise<{ people: PersonFound[] }> {
  return api(`/v1/users/search?q=${encodeURIComponent(q)}`);
}

export function befriend(userId: string): Promise<{ friendship: Friendship }> {
  return api(`/v1/users/${userId}/friend`, { method: "POST" });
}

export function unfriend(userId: string): Promise<unknown> {
  return api(`/v1/users/${userId}/friend`, { method: "DELETE" });
}

export function block(userId: string): Promise<unknown> {
  return api(`/v1/users/${userId}/block`, { method: "POST" });
}

export function unblock(userId: string): Promise<unknown> {
  return api(`/v1/users/${userId}/block`, { method: "DELETE" });
}

export interface FriendsList {
  muted: { userId: string; name: string }[];
  friends: { userId: string; name: string }[];
  incoming: { userId: string; name: string }[];
  outgoing: { userId: string; name: string }[];
  blocked: { userId: string; name: string }[];
}

export function fetchFriends(): Promise<FriendsList> {
  return api("/v1/friends");
}

export function mute(userId: string): Promise<unknown> {
  return api(`/v1/users/${userId}/mute`, { method: "POST" });
}

export function unmute(userId: string): Promise<unknown> {
  return api(`/v1/users/${userId}/mute`, { method: "DELETE" });
}

export type ReportReason = "harassment" | "fake" | "inappropriate" | "other";

export function report(input: { targetKind: "profile" | "party" | "venue"; targetId: string; reason: ReportReason; note?: string }): Promise<unknown> {
  return api("/v1/reports", { method: "POST", body: input });
}

export interface CrewReport {
  id: string;
  targetKind: "profile" | "party" | "venue";
  targetId: string;
  reason: ReportReason;
  note: string;
  at: number;
  handledAt: number | null;
}

export function fetchReports(crewId: string): Promise<{ reports: CrewReport[] }> {
  return api(`/v1/crews/${crewId}/reports`);
}

export function markReportHandled(crewId: string, reportId: string): Promise<unknown> {
  return api(`/v1/crews/${crewId}/reports/${reportId}/handled`, { method: "POST" });
}
