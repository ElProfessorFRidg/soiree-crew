import { api } from "./api";

export const PROFILE_SECTIONS = ["identity", "crews", "titles", "venues", "reviews", "drinks", "records", "nights", "games", "birthday"] as const;
/** PROF-03: single figures that can be hidden one by one (server: STATS in profileRules.ts). */
export const PROFILE_STATS = ["drinksTotal", "favourites", "usualFirstDrink", "usualPace", "usualLeaving", "highestBac", "biggestNight", "nightsTotal", "nightsRecent", "nightHistory", "gameWins"] as const;
export type ProfileStat = (typeof PROFILE_STATS)[number];
export type ReviewAudience = "public" | "anonymous" | "friends" | "me";

/** PROF-02: a review on its author's profile, already filtered by its own audience. */
export interface ProfileReview {
  id: string;
  venueId: string;
  place: string;
  ratings: Record<string, number>;
  text: string;
  photos: { id: string; url: string }[];
  visitedAt?: number;
  /** Owner only. */
  audience?: ReviewAudience;
  hidden?: boolean;
}
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
  /** AC-09: a rejected check-in this week, shown to crew mates only. */
  cheat?: { at: number; venue: string; count: number } | null;
  storyOptOut?: boolean;
  /** PROF-03: owner only. */
  hiddenStats?: ProfileStat[];
  sections: {
    identity?: { displayName: string; username: string; bio: string; country: string };
    crews?: { name: string; members: number }[];
    titles?: { kind: "mayor" | "conqueror" | "explorer" | "nomad"; venueName?: string }[];
    venues?: { venueId: string; name: string; visits: number; nights?: number; ruled: boolean; lastAt?: number; hidden?: boolean }[];
    // PROF-03: any single figure may be missing when its owner hid it.
    drinks?: { total?: number; favourites?: { kind: string; count: number }[]; usualFirstDrink?: number | null; usualPacePerHour?: number | null; usualLeaving?: number | null };
    records?: { highestBac?: number | null; biggestNight?: number };
    /** O-43: history comes to friends, crew mates and me only; a party name only inside its crew. */
    nights?: { total?: number; last30Days?: number; history?: { at: number; name: string | null; venues: string[] }[] };
    reviews?: ProfileReview[];
    games?: { wins?: number; byGame?: { gameId: string; wins: number }[] };
    /** QOL-21: the year only comes back to its owner. */
    birthday?: { month: number; day: number; year?: number };
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
  hiddenReviews?: string[];
  hiddenStats?: ProfileStat[];
  findable?: Findable;
  regularOptIn?: boolean;
  openToMeet?: boolean;
  requestsFrom?: "nobody" | "friendsOfFriends" | "everyone";
  storyOptOut?: boolean;
  /** QOL-21: null removes it. */
  birthday?: { month: number; day: number; year?: number } | null;
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

export type ReportReason = "harassment" | "fake" | "inappropriate" | "personalData" | "other";
/** COM-08, O-77: everything people post can be reported. */
export type ReportKind = "profile" | "party" | "venue" | "review" | "photo" | "quote" | "card";

/** `to` says who reads it: the crew's admins, or the server's moderators for public content. */
export function report(input: { targetKind: ReportKind; targetId: string; reason: ReportReason; note?: string }): Promise<{ ok: true; to?: "crew" | "operator" }> {
  return api("/v1/reports", { method: "POST", body: input });
}

export interface CrewReport {
  id: string;
  targetKind: ReportKind | "message";
  targetId: string;
  reason: ReportReason;
  note: string;
  at: number;
  handledAt: number | null;
  decision?: "upheld" | "dismissed" | null;
  ground?: ReportReason | null;
  /** What was reported, as it is now; null once it is gone or decided. */
  content?: { text: string; photos: string[]; authorName: string | null } | null;
}

export function fetchReports(crewId: string): Promise<{ reports: CrewReport[] }> {
  return api(`/v1/crews/${crewId}/reports`);
}

export function markReportHandled(crewId: string, reportId: string): Promise<unknown> {
  return api(`/v1/crews/${crewId}/reports/${reportId}/handled`, { method: "POST" });
}

/** COM-08: take the content down (the author gets the reason) or leave it. */
export function decideReport(crewId: string, reportId: string, decision: "upheld" | "dismissed", ground?: ReportReason): Promise<unknown> {
  return api(`/v1/crews/${crewId}/reports/${reportId}/decision`, { method: "POST", body: { decision, ...(ground ? { ground } : {}) } });
}

export interface Appeal {
  id: string;
  userId: string;
  name: string;
  targetKind: string;
  ground: ReportReason;
  excerpt: string;
  appeal: string;
  at: number;
}

export function fetchOperatorReports(): Promise<{ reports: CrewReport[]; appeals: Appeal[] }> {
  return api("/v1/operator/reports");
}

export function decideOperatorReport(reportId: string, decision: "upheld" | "dismissed", ground?: ReportReason): Promise<unknown> {
  return api(`/v1/operator/reports/${reportId}`, { method: "POST", body: { decision, ...(ground ? { ground } : {}) } });
}

export function decideAppeal(noticeId: string, outcome: "reversed" | "confirmed"): Promise<unknown> {
  return api(`/v1/operator/appeals/${noticeId}`, { method: "POST", body: { outcome } });
}

/** COM-08 statement of reasons, as the server keeps it. */
export interface ModerationNotice {
  id: string;
  kind: "removed" | "kept" | "reportUpheld" | "reportDismissed";
  targetKind: ReportKind | "message";
  ground: ReportReason;
  excerpt: string;
  decidedBy: "crew" | "operator";
  strikes: number;
  bannedUntil: number | null;
  at: number;
  read: boolean;
  appeal: { text: string; at: number; outcome: "reversed" | "confirmed" | null } | null;
  canAppeal: boolean;
}

export interface NoticesView {
  strikes: number;
  strikesForBan: number;
  bannedUntil: number | null;
  unread: number;
  notices: ModerationNotice[];
}

export function fetchNotices(): Promise<NoticesView> {
  return api("/v1/me/notices");
}

export function markNoticesRead(): Promise<unknown> {
  return api("/v1/me/notices/read", { method: "POST" });
}

export function appealNotice(noticeId: string, text: string): Promise<unknown> {
  return api(`/v1/me/notices/${noticeId}/appeal`, { method: "POST", body: { text } });
}

/** O-43: my personal link, and what opening someone else's does. */
export function fetchReferral(): Promise<{ code: string; url: string }> {
  return api("/v1/me/referral");
}

export function openReferral(code: string): Promise<{ userId: string; name: string; friendship: Friendship }> {
  return api(`/v1/referrals/${encodeURIComponent(code)}`, { method: "POST" });
}

/** TER-11: "I work here", waiting for a crew admin or the venue's owner. */
export interface WorkplaceRequest {
  venueId: string;
  venue: string;
  userId: string;
  name: string;
  suggestedBy: string | null;
  at: number | null;
}

export interface WorkplaceView {
  mine: "pending" | "approved" | "rejected" | null;
  staff: { userId: string; name: string }[];
  pending: WorkplaceRequest[];
  canDecide: boolean;
}

export function fetchWorkplace(venueId: string): Promise<WorkplaceView> {
  return api(`/v1/venues/${venueId}/workplace`);
}

export function claimWorkplace(venueId: string, userId?: string): Promise<{ status: "pending" | "approved" }> {
  return api(`/v1/venues/${venueId}/workplace`, { method: "POST", body: userId ? { userId } : {} });
}

export function withdrawWorkplace(venueId: string): Promise<unknown> {
  return api(`/v1/venues/${venueId}/workplace`, { method: "DELETE" });
}

export function decideWorkplace(venueId: string, userId: string, decision: "approved" | "rejected"): Promise<unknown> {
  return api(`/v1/venues/${venueId}/workplace/${userId}`, { method: "POST", body: { decision } });
}

export function fetchCrewWorkplaceRequests(crewId: string): Promise<{ requests: WorkplaceRequest[] }> {
  return api(`/v1/crews/${crewId}/workplace-requests`);
}

export function fetchPlaceWorkplaceRequests(venueId: string): Promise<{ requests: WorkplaceRequest[] }> {
  return api(`/v1/places/${venueId}/workplace-requests`);
}

/** PROF-02 games: the winner of a finished game, when the winner has an account at the table. */
export function postGameWin(input: { id: string; gameId: string; winnerId: string; accountIds: string[]; players: number }): Promise<unknown> {
  return api("/v1/games/wins", { method: "POST", body: input });
}
