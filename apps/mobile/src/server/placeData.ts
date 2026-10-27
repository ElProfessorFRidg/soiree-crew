import { api } from "./api";

export const VIBE_TAGS = ["dance", "terrace", "student", "live", "quiet", "sport", "karaoke", "rock", "electro", "hiphop", "cheap"] as const;
export type VibeTag = (typeof VIBE_TAGS)[number];
export const CRITERIA = ["prices", "vibe", "music", "service", "queue", "safe"] as const;
export type Criterion = (typeof CRITERIA)[number];
export type ReviewAudience = "public" | "anonymous" | "friends" | "me";
export type EventKind = "dj" | "student" | "match" | "concert" | "quiz" | "other";

export interface PlacePage {
  place: { venueId: string; name: string; address: string | null; lat: number; lng: number };
  prices: { kind: string; currency: string; amount: number; reports: number }[];
  tags: { tag: VibeTag; votes: number }[];
  myTags: VibeTag[];
  weekdays: number[];
  hours: number[];
  usersThisMonth: number;
  ratings: Record<Criterion, number | null>;
  ratingCount: number;
  reviews: {
    id: string;
    author: { userId: string; name: string } | null;
    audience: ReviewAudience;
    ratings: Partial<Record<Criterion, number>>;
    text: string;
    /** COM-11: the owner's public answer. */
    reply: { text: string; at: number } | null;
    visitedAt: number;
    useful: number;
    markedUseful: boolean;
    mine: boolean;
  }[];
  canReview: boolean;
  /** COM-11: the page is managed by the venue, and whether that is me. */
  claimed?: boolean;
  isOwner?: boolean;
  info?: { hours: string; happyHours: string } | null;
  door: { always: number; sometimes: number; never: number; adultsOnly: number; reports: number };
  events: { id: string; title: string; kind: EventKind; startsAt: number; official?: boolean; going: number; friendsGoing: number; mine: boolean }[];
  regulars: { userId: string; name: string; nights: number; openToMeet: boolean; friend: boolean; legend: boolean }[];
}

export interface NearbyPlace {
  venueId: string;
  name: string;
  distanceM: number;
  rating: number | null;
  checkIns: number;
  pint: number | null;
  strict: boolean;
  tags: VibeTag[];
}

export const fetchPlace = (venueId: string) => api<PlacePage>(`/v1/places/${venueId}`);
export const saveReview = (venueId: string, body: { ratings: Partial<Record<Criterion, number>>; text: string; audience: ReviewAudience }) =>
  api(`/v1/places/${venueId}/review`, { method: "PUT", body });
export const markUseful = (reviewId: string, useful: boolean) => api(`/v1/reviews/${reviewId}/useful`, { method: "POST", body: { useful } });
export const saveTags = (venueId: string, tags: VibeTag[]) => api(`/v1/places/${venueId}/tags`, { method: "PUT", body: { tags } });
export const reportDoor = (venueId: string, idCheck: "always" | "sometimes" | "never", agePolicy: "adults" | "allAgesEarly" | null) =>
  api(`/v1/places/${venueId}/door`, { method: "PUT", body: { idCheck, agePolicy } });
export const addEvent = (venueId: string, body: { id: string; title: string; kind: EventKind; startsAt: number }) => api(`/v1/places/${venueId}/events`, { method: "POST", body });
export const rsvp = (eventId: string, going: boolean) => api(`/v1/events/${eventId}/rsvp`, { method: "POST", body: { going } });
export const fetchNearby = (lat: number, lng: number, filters: { maxPint?: number; strict?: boolean; tag?: VibeTag }) => {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  if (filters.maxPint) params.set("maxPint", String(filters.maxPint));
  if (filters.strict) params.set("strict", "1");
  if (filters.tag) params.set("tag", filters.tag);
  return api<{ places: NearbyPlace[] }>(`/v1/places?${params.toString()}`);
};
export const fetchWantToGo = (crewId: string) => api<{ places: { venueId: string; name: string; addedBy: string }[] }>(`/v1/crews/${crewId}/want-to-go`);
export const setWantToGo = (crewId: string, venueId: string, want: boolean) => api(`/v1/crews/${crewId}/want-to-go`, { method: "PUT", body: { venueId, want } });

// COM-11: claiming a page, the owner's info and replies, and the operator's queue.
export const fetchClaim = (venueId: string) => api<{ status: "pending" | "approved" | "rejected" | null; claimed: boolean }>(`/v1/places/${venueId}/claim`);
export const claimPlace = (venueId: string, body: { role: string; contact: string }) => api(`/v1/places/${venueId}/claim`, { method: "POST", body });
export const savePlaceInfo = (venueId: string, body: { hours: string; happyHours: string }) => api(`/v1/places/${venueId}/info`, { method: "PUT", body });
export const replyToReview = (reviewId: string, text: string) => api(`/v1/reviews/${reviewId}/reply`, { method: "PUT", body: { text } });
export interface PendingClaim {
  id: string;
  venueId: string;
  place: string;
  address: string;
  by: string;
  username: string;
  role: string;
  contact: string;
  requestedAt: number;
}
export const fetchOperatorClaims = () => api<{ claims: PendingClaim[] }>("/v1/operator/claims");
export const decideClaim = (id: string, decision: "approved" | "rejected") => api(`/v1/operator/claims/${id}`, { method: "POST", body: { decision } });
