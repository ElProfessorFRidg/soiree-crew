import { api } from "./api";

export const PROFILE_SECTIONS = ["identity", "crews", "titles", "venues", "drinks", "records", "nights"] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];
export type Audience = "me" | "crews" | "friends" | "everyone";
export type Friendship = "none" | "friends" | "requested" | "incoming";

export interface ProfileView {
  userId: string;
  relation: { me: boolean; friend: boolean; crewMate: boolean };
  friendship: Friendship;
  audiences?: Record<ProfileSection, Audience>;
  sections: {
    identity?: { displayName: string; username: string; bio: string; country: string };
    crews?: { name: string; members: number }[];
    titles?: { kind: "mayor" | "conqueror" | "explorer" | "nomad"; venueName?: string }[];
    venues?: { venueId: string; name: string; visits: number; ruled: boolean; lastAt?: number; hidden?: boolean }[];
    drinks?: { total: number; favourites: { kind: string; count: number }[] };
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
}): Promise<{ audiences: Record<ProfileSection, Audience> }> {
  return api("/v1/me/profile", { method: "PUT", body: input });
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
  friends: { userId: string; name: string }[];
  incoming: { userId: string; name: string }[];
  outgoing: { userId: string; name: string }[];
  blocked: { userId: string; name: string }[];
}

export function fetchFriends(): Promise<FriendsList> {
  return api("/v1/friends");
}
