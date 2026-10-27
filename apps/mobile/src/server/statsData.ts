import { api } from "./api";

export interface CrewBoardRow {
  userId: string;
  name: string;
  nights: number;
  venuesRuled: number;
  /** Minutes after noon, local to the crew. */
  lastHome: number | null;
  soberDriver: number;
  firstDrink?: number | null;
  hydration?: number | null;
}

export interface CrewStats {
  timeZone: string;
  totalNights: number;
  weekdays: number[];
  months: { month: string; count: number }[];
  topVenues: { venueId: string; name: string; visits: number }[];
  streak: { current: number; best: number };
  milestones: { reached: number[]; next: number | null };
  crewSince: number;
  boards: CrewBoardRow[];
  honours: { userId: string; name: string; joinedAt: number; organised: number; homeSafe: number; badges: ("organiser" | "homeSafe" | "soberDriver" | "hydrated" | "boss")[] }[];
}

export interface VenueStats {
  visits: number;
  nights: number;
  people: number;
  averageDrinks: number | null;
  bestNights: { night: string; people: number }[];
}

export function fetchCrewStats(crewId: string): Promise<CrewStats> {
  return api(`/v1/crews/${crewId}/stats`);
}

export function fetchVenueStats(venueId: string): Promise<VenueStats> {
  return api(`/v1/venues/${venueId}/stats`);
}
