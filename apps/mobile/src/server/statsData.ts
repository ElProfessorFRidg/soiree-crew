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
  bestNights: { night: string; people: number }[];
}

export function fetchCrewStats(crewId: string): Promise<CrewStats> {
  return api(`/v1/crews/${crewId}/stats`);
}

export function fetchVenueStats(venueId: string): Promise<VenueStats> {
  return api(`/v1/venues/${venueId}/stats`);
}
