import * as Device from "expo-device";
import { Platform } from "react-native";
import * as Location from "expo-location";
import { create } from "zustand";
import { newId } from "@/state/store";
import type { VenueFacts, WeekSchedule } from "@/venues/hours";
import { api } from "./api";
import { useCrewData } from "./crewData";
import { checkLocationIntegrity } from "../../modules/location-integrity";

export type VenueKind = "bar" | "club" | "spot" | "home";

export interface VenueSummary {
  id: string;
  name: string;
  kind: VenueKind;
  lat: number;
  lng: number;
  address: string;
  isHq: boolean;
  bossId: string | null;
  bossName: string | null;
  myPoints: number;
  bossPoints: number;
  explored: boolean;
  /** TER-11: counts for territories (two members on two nights, or the HQ). */
  validated?: boolean;
  hereNow: number;
  /** TER-01 filters, from the owner's or the crew's hours. Null when nobody entered hours. */
  openNow?: boolean | null;
  happyNow?: boolean;
}

export interface VenuePage {
  validated?: boolean;
  /** TER-12: this month's rule twist. */
  variant?: "none" | "discovery" | "games" | "organiser" | "regulars";
  venue: { id: string; crewId: string; name: string; kind: VenueKind; lat: number; lng: number; address: string; isHq?: boolean };
  /** N-08, COM-01: hours and happy hour, the owner's once claimed, else the crew's (editable). */
  facts?: VenueFacts;
  /** N-08: whether I may make this the crew's HQ, or stop it being one. */
  canSetHq?: boolean;
  season: string;
  bossId: string | null;
  top: { userId: string; name: string; points: number; nights: number }[];
  myPoints: number;
  challengers: { userId: string; name: string; points: number }[];
  pastMayors: { season: string; userId: string; name: string }[];
  latestNights: { partyId: string; name: string; startsAt: number; members: number }[];
  cheatAttempts: { id: string; userId: string; name: string; at: number; overturned: boolean }[];
  /** AC-04: unverified check-ins around mine that I can vouch for. */
  toConfirm?: { id: string; userId: string; name: string; at: number }[];
  /** TER-07: other crews playing this bar, anonymous. */
  rivalry?: { crews: number; myRank: number; myPoints: number; leaderPoints: number } | null;
  /** TER-10: my lifetime nights at this venue. */
  myNights?: number;
}

export type CheckInVerdict = "accepted" | "unverified" | "rejected" | "not_here";

export interface CheckInResult {
  id: string;
  verdict: CheckInVerdict;
  reason: "not_here" | "imprecise" | null;
  takeover: { bossId: string | null; takenFrom: string | null } | null;
}

interface VenueState {
  byCrew: Record<string, { season: string; venues: VenueSummary[] }>;
  /** My open check-in, so "still here" and "leaving" know what to update. */
  openCheckIn: { id: string; venueId: string; at: number } | null;
}

export const useVenueData = create<VenueState>(() => ({ byCrew: {}, openCheckIn: null }));

export async function refreshVenues(crewId: string): Promise<void> {
  const data = await api<{ season: string; venues: VenueSummary[] }>(`/v1/crews/${crewId}/venues`);
  useVenueData.setState((state) => ({ byCrew: { ...state.byCrew, [crewId]: data } }));
}

export function fetchVenuePage(venueId: string): Promise<VenuePage> {
  return api<VenuePage>(`/v1/venues/${venueId}`);
}

export async function addVenue(crewId: string, input: { name: string; kind: VenueKind; lat: number; lng: number; address?: string; isHq?: boolean }): Promise<string> {
  const id = newId();
  await api(`/v1/crews/${crewId}/venues`, { method: "POST", body: { id, ...input } });
  await refreshVenues(crewId);
  return id;
}

/** N-08: the address or the HQ of a venue, after it was added. */
export function updateVenue(venueId: string, input: { address?: string; isHq?: boolean }): Promise<unknown> {
  return api(`/v1/venues/${venueId}`, { method: "PATCH", body: input });
}

/** N-08: the crew's hours for a venue nobody has claimed. */
export function saveVenueHours(venueId: string, schedule: WeekSchedule): Promise<unknown> {
  return api(`/v1/venues/${venueId}/hours`, { method: "PUT", body: schedule });
}

export interface VenuePhoto {
  id: string;
  partyId: string;
  userId: string;
  width: number;
  height: number;
  at: number;
  url: string;
}

/** TER-05: album photos of the nights here that I was part of. */
export function fetchVenuePhotos(venueId: string): Promise<{ photos: VenuePhoto[] }> {
  return api(`/v1/venues/${venueId}/photos`);
}

export type WhereToReason = "happyNow" | "friendsHere" | "wanted" | "close" | "cheap" | "favourite" | "toConquer" | "openNow";

export interface WhereToOption {
  venueId: string;
  name: string;
  kind: VenueKind;
  lat: number;
  lng: number;
  address: string;
  /** False for a place from the want-to-go list that the crew has not added. */
  crewVenue: boolean;
  openNow: boolean | null;
  happyNow: boolean;
  pint: number | null;
  average: number | null;
  currency: string | null;
  distanceM: number | null;
  wanted: boolean;
  hereNow: number;
  explored: boolean;
  visits: number;
  /** Strongest first: what makes this option good tonight. */
  reasons: WhereToReason[];
}

export interface WhereToResult {
  total: number;
  suggestion: string | null;
  /** TER-08: a never-visited venue to conquer. */
  conquest: string | null;
  options: WhereToOption[];
}

/** N-11: ranked options for the crew, with or without a party. */
export function fetchWhereTo(
  crewId: string,
  filters: { here?: { lat: number; lng: number } | null; openNow?: boolean; happyNow?: boolean; maxPrice?: number; currency?: string },
): Promise<WhereToResult> {
  const params = new URLSearchParams();
  if (filters.here) {
    params.set("lat", String(filters.here.lat));
    params.set("lng", String(filters.here.lng));
  }
  if (filters.openNow) params.set("open", "1");
  if (filters.happyNow) params.set("happy", "1");
  if (filters.maxPrice) params.set("maxPrice", String(filters.maxPrice));
  if (filters.currency) params.set("currency", filters.currency);
  return api(`/v1/crews/${crewId}/where-to?${params.toString()}`);
}

export type LocationFailure = "denied" | "unavailable";

/** One fresh fix, never a cached one (anticheat.md §2.2 stale fix). */
export async function currentFix(): Promise<
  { ok: true; fix: { lat: number; lng: number; accuracy: number; mocked: boolean } } | { ok: false; failure: LocationFailure; canAskAgain?: boolean }
> {
  // Never throws: the SOS waits on this, and a browser without the permissions API throws on the request.
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return { ok: false, failure: "denied", canAskAgain: permission.canAskAgain };
    // AC-02 on iOS: the native module reads how the system produced the fix, in parallel.
    const [position, source] = await Promise.all([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      (checkLocationIntegrity() ?? Promise.resolve(null)).catch(() => null),
    ]);
    return {
      ok: true,
      fix: {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy ?? 999,
        // AC-02: read, sent, never trusted alone. Android reports a mock provider, iOS a fix
        // simulated by software (Xcode, spoofing apps).
        mocked: position.mocked === true || source?.simulatedBySoftware === true,
      },
    };
  } catch {
    return { ok: false, failure: "unavailable" };
  }
}

/** AC-05: what the phone says about itself, read once. Only ever a weight on the server, never a gate. */
let integrity: Promise<{ rooted: boolean; emulator: boolean }> | null = null;
function deviceIntegrity(): Promise<{ rooted: boolean; emulator: boolean }> {
  if (Platform.OS === "web") return Promise.resolve({ rooted: false, emulator: false });
  integrity ??= Device.isRootedExperimentalAsync()
    .catch(() => false)
    .then((rooted) => ({ rooted, emulator: !Device.isDevice }));
  return integrity;
}

export async function checkIn(venueId: string, fix: { lat: number; lng: number; accuracy: number; mocked: boolean }, isPrivate: boolean): Promise<CheckInResult> {
  const id = newId();
  const result = await api<CheckInResult>("/v1/checkins", {
    method: "POST",
    // AC-05: the server weighs a browser check-in differently, since devtools can fake its position.
    body: { id, venueId, ...fix, deviceNow: Date.now(), private: isPrivate, integrity: await deviceIntegrity(), platform: Platform.OS },
  });
  if (result.verdict === "accepted" || result.verdict === "unverified") {
    useVenueData.setState({ openCheckIn: { id, venueId, at: Date.now() } });
  }
  return result;
}

export async function stillHere(fix: { lat: number; lng: number; accuracy: number; mocked: boolean }): Promise<boolean> {
  const open = useVenueData.getState().openCheckIn;
  if (!open) return false;
  const { ok } = await api<{ ok: boolean }>(`/v1/checkins/${open.id}/proof`, { method: "POST", body: { ...fix, deviceNow: Date.now() } });
  return ok;
}

export async function leaveVenue(): Promise<void> {
  const open = useVenueData.getState().openCheckIn;
  if (!open) return;
  await api(`/v1/checkins/${open.id}/end`, { method: "POST" });
  useVenueData.setState({ openCheckIn: null });
}

export function confirmCheckIn(checkInId: string): Promise<unknown> {
  return api(`/v1/checkins/${checkInId}/confirm`, { method: "POST" });
}

export function overturnCheckIn(checkInId: string): Promise<unknown> {
  return api(`/v1/checkins/${checkInId}/overturn`, { method: "POST" });
}

/** RANK-08, TER-07: instant in the UI, rolled back if the server refuses. */
export async function setCrewParticipation(crewId: string, input: { territoryOptOut?: boolean; leaderboardOptOut?: boolean }): Promise<void> {
  const patchCrew = (patch: typeof input) =>
    useCrewData.setState((state) => ({ crews: state.crews.map((c) => (c.id === crewId ? { ...c, me: { ...c.me, ...patch } } : c)) }));
  const before = useCrewData.getState().crews.find((c) => c.id === crewId)?.me;
  patchCrew(input);
  try {
    await api(`/v1/crews/${crewId}/me`, { method: "PATCH", body: input });
  } catch (error) {
    if (before) patchCrew(before);
    throw error;
  }
}

export type LeaderboardPeriod = "party" | "week" | "month" | "all";
export type LeaderboardMetric = "drinks" | "grams" | "nights" | "games";

export interface LeaderboardRow {
  userId: string;
  name: string;
  value: number;
  rank: number;
  unverified?: number;
}

export function fetchLeaderboard(
  crewId: string,
  period: LeaderboardPeriod,
  metric: LeaderboardMetric,
  partyId?: string,
): Promise<{ disabled: boolean; rows: LeaderboardRow[] }> {
  const params = new URLSearchParams({ period, metric, ...(partyId ? { partyId } : {}) });
  return api(`/v1/crews/${crewId}/leaderboard?${params.toString()}`);
}

export interface Champion {
  userId: string;
  name: string;
  value: number;
}

export interface LeaderboardHistory {
  disabled: boolean;
  weeks: { from: number; champions: Champion[] }[];
  months: { season: string; champions: Champion[] }[];
  streaks: { userId: string; name: string; current: number; best: number }[];
}

/** RANK-04: champions of past weeks and months, and their streaks. */
export function fetchLeaderboardHistory(crewId: string, metric: LeaderboardMetric): Promise<LeaderboardHistory> {
  return api(`/v1/crews/${crewId}/leaderboard/history?metric=${metric}`);
}

export interface ConfirmableDrink {
  id: string;
  userId: string;
  name: string;
  kind: string;
  consumedAt: number;
  confirmedByMe: boolean;
}

export function fetchConfirmable(partyId: string): Promise<{ drinks: ConfirmableDrink[] }> {
  return api(`/v1/parties/${partyId}/confirmable`);
}

export function confirmDrink(drinkId: string): Promise<unknown> {
  return api(`/v1/drinks/${drinkId}/confirm`, { method: "POST" });
}

export interface TitlesRow {
  userId: string;
  name: string;
  ruled: number;
  visited: number;
  titles: { kind: "mayor" | "conqueror" | "explorer" | "nomad"; venueName?: string }[];
}

/** TER-06 */
export function fetchTitles(crewId: string): Promise<{ season: string; rows: TitlesRow[] }> {
  return api(`/v1/crews/${crewId}/titles`);
}
