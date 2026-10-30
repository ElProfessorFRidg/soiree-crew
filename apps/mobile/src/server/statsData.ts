import type { CrewMoment } from "@/crew/celebrate";
import { api } from "./api";

export interface CrewBoardRow {
  userId: string;
  name: string;
  nights: number;
  venuesRuled: number;
  /** Minutes after noon, local to the crew. */
  lastHome: number | null;
  soberDriver: number;
  /** RANK-05: games won in the crew, from two members at the table. */
  gamesWon?: number;
  firstDrink?: number | null;
  hydration?: number | null;
}

export interface CrewStats {
  timeZone: string;
  totalNights: number;
  weekdays: number[];
  months: { month: string; count: number }[];
  topVenues: { venueId: string; name: string; visits: number }[];
  /** JOY-06: frozenWeeks are quiet weeks of the current run saved by the monthly freeze. */
  streak: { current: number; best: number; frozenWeeks?: string[]; freezeAvailable?: boolean };
  milestones: { reached: number[]; next: number | null };
  /** JOY-08: years together, and the night of the last anniversary. */
  anniversary?: { years: number; night: string | null };
  moments?: CrewMoment[];
  crewSince: number;
  boards: CrewBoardRow[];
  /** N-16: every night together, whatever the filter (totalNights is the filtered count). */
  allNights?: number;
  /** N-14: tonight's night key, and the nights of the last 26 weeks (only those with an outing). */
  tonight?: string;
  calendar?: { night: string; count: number }[];
  /** N-14: from what was logged, nights without anything logged left out. Hours, one decimal. */
  hoursOut?: { total: number; perNight: number | null; nights: number };
  /** N-16: what the figures can be narrowed to. */
  filters?: StatsFilters;
  honours: {
    userId: string;
    name: string;
    joinedAt: number;
    organised: number;
    homeSafe: number;
    badges: ("organiser" | "homeSafe" | "soberDriver" | "hydrated" | "boss" | "gameWinner" | "champion")[];
    /** RANK-04: number one of last week or last month on a board that never counts drinks. */
    titles?: { period: "week" | "month"; board: "nights" | "games" }[];
  }[];
}

export interface VenueStats {
  visits: number;
  nights: number;
  people: number;
  averageDrinks: number | null;
  /** N-12: the drinks of a visit at the crew's prices here, on average. Minor units. */
  averageSpend?: { amount: number; currency: string } | null;
  bestNights: { night: string; people: number }[];
}

/** N-16: venues and people (who share their nights with me) the figures can be narrowed to. */
export interface StatsFilters {
  venues: { id: string; name: string }[];
  people: { userId: string; name: string }[];
}

export interface StatsFilter {
  venueId?: string | null;
  userId?: string | null;
}

const query = (params: Record<string, string | null | undefined>) => {
  const parts = Object.entries(params).flatMap(([key, value]) => (value ? [`${key}=${encodeURIComponent(value)}`] : []));
  return parts.length ? `?${parts.join("&")}` : "";
};

export function fetchCrewStats(crewId: string, filter: StatsFilter = {}): Promise<CrewStats> {
  return api(`/v1/crews/${crewId}/stats${query({ venueId: filter.venueId, userId: filter.userId })}`);
}

export interface MyStats {
  timeZone: string;
  dayBoundaryHour: number;
  filters: StatsFilters;
  /** N-16: night keys the filter keeps, null without a filter. */
  nights: string[] | null;
  /** N-13: times in minutes after noon, local. */
  habits: { nights: number; usualFirstDrink: number | null; usualPacePerHour: number | null; usualLeaving: number | null };
}

/** N-13, N-16: my habits and the nights a venue or a person narrows my figures to. */
export function fetchMyStats(filter: StatsFilter = {}): Promise<MyStats> {
  return api(`/v1/me/stats${query({ venueId: filter.venueId, withUserId: filter.userId })}`);
}

export function fetchVenueStats(venueId: string): Promise<VenueStats> {
  return api(`/v1/venues/${venueId}/stats`);
}
