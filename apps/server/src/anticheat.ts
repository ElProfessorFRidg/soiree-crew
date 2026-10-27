import { createHmac } from "node:crypto";
import { ethanolGrams } from "@crew/bac";

// AC-03 and AC-06 (research/anticheat.md §2.2 to §2.5). Every number is a default of
// ac_config_version 1; verdicts store the version so scoring can be replayed (AC-01).

export const AC_CONFIG = {
  version: 1,
  bands: { acceptBelow: 30, rejectAt: 70, rejectMinCategories: 2 },
  weights: { mocked: 50, speedStrong: 45, speedMedium: 20, coordsIdentical: 30, coordsOnPin: 25, clockDrift: 5, venueHopping: 20 },
  credits: { peerPassive: 20 },
  geo: { maxAccuracyM: 150, speedStrongKmh: 250, speedMediumKmh: 130 },
  time: { clockDriftMin: 5, peerWindowMin: 20, peerActiveWindowMin: 30, hoppingWindowMin: 10 },
  peers: { confirmsPerNight: 10 },
  drinks: { burst30Grams: 40, burst60Grams: 60, retroMinutes: 45, partyPreMinutes: 30, confirmWindowMinutes: 30 },
} as const;

type Category = "F" | "I" | "P" | "B";

export interface Signal {
  name: string;
  points: number;
  category: Category | "C";
}

export interface Fix {
  lat: number;
  lng: number;
  /** Metres. */
  accuracy: number;
  mocked: boolean;
}

export interface PreviousCheckIn {
  venueId: string;
  at: number;
  lat: number;
  lng: number;
  fixHash: string;
}

export interface CheckInEvaluationInput {
  fix: Fix;
  venue: { id: string; lat: number; lng: number; radiusM: number };
  serverNow: number;
  deviceNow: number;
  /** This user's earlier check-ins in the last 12 h, newest first. */
  previous: readonly PreviousCheckIn[];
  /** Other crew members' accepted check-ins at this venue, for passive corroboration. */
  peersAtVenue: readonly { at: number }[];
  fixHash: string;
}

export type Verdict = "accepted" | "unverified" | "rejected" | "not_here";

export interface Evaluation {
  verdict: Verdict;
  risk: number;
  signals: Signal[];
  corroborated: boolean;
  reason?: "not_here" | "imprecise";
}

const EARTH_M = 6_371_000;

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(h));
}

/** Keyed hash of a fix rounded to 1e-6 degrees: spots repeated coordinates without storing them. */
export function fixHash(secret: string, fix: { lat: number; lng: number }): string {
  return createHmac("sha256", secret).update(`${fix.lat.toFixed(6)},${fix.lng.toFixed(6)}`).digest("hex").slice(0, 32);
}

export function evaluateCheckIn(input: CheckInEvaluationInput): Evaluation {
  const { fix, venue, serverNow } = input;
  const cfg = AC_CONFIG;
  const signals: Signal[] = [];

  // Preconditions: being elsewhere or having a poor fix is never cheating.
  const distance = distanceMeters(fix, venue);
  if (distance - fix.accuracy > venue.radiusM) return { verdict: "not_here", risk: 0, signals, corroborated: false, reason: "not_here" };

  if (fix.mocked) signals.push({ name: "mocked", points: cfg.weights.mocked, category: "F" });

  const last = input.previous[0];
  if (last && last.venueId !== venue.id) {
    const hours = Math.max((serverNow - last.at) / 3_600_000, 1 / 3600);
    const km = Math.max(0, distanceMeters(last, fix) - fix.accuracy) / 1000;
    const speed = km / hours;
    if (speed > cfg.geo.speedStrongKmh && km > 20) signals.push({ name: "speed_strong", points: cfg.weights.speedStrong, category: "P" });
    else if (speed > cfg.geo.speedMediumKmh && km > 5) signals.push({ name: "speed_medium", points: cfg.weights.speedMedium, category: "P" });
  }
  if (input.previous.some((p) => p.fixHash === input.fixHash)) {
    signals.push({ name: "coords_identical", points: cfg.weights.coordsIdentical, category: "P" });
  }
  if (Math.abs(fix.lat - venue.lat) < 1e-5 && Math.abs(fix.lng - venue.lng) < 1e-5) {
    signals.push({ name: "coords_on_pin", points: cfg.weights.coordsOnPin, category: "P" });
  }
  if (Math.abs(input.deviceNow - serverNow) > cfg.time.clockDriftMin * 60_000) {
    signals.push({ name: "clock_drift", points: cfg.weights.clockDrift, category: "B" });
  }
  const recentVenues = new Set(
    input.previous.filter((p) => serverNow - p.at < cfg.time.hoppingWindowMin * 60_000).map((p) => p.venueId),
  );
  recentVenues.add(venue.id);
  if (recentVenues.size >= 3) signals.push({ name: "venue_hopping", points: cfg.weights.venueHopping, category: "B" });

  const corroborated = input.peersAtVenue.some((p) => Math.abs(p.at - serverNow) <= cfg.time.peerWindowMin * 60_000);
  if (corroborated) signals.push({ name: "peer_passive", points: -cfg.credits.peerPassive, category: "C" });

  const risk = signals.reduce((sum, s) => sum + s.points, 0);
  const categories = new Set(signals.filter((s) => s.category !== "C" && s.points > 0).map((s) => s.category));
  const credited = signals.some((s) => s.category === "C");

  let verdict: Verdict;
  if (risk >= cfg.bands.rejectAt && categories.size >= cfg.bands.rejectMinCategories && !credited) verdict = "rejected";
  else if (risk >= cfg.bands.acceptBelow || (risk >= cfg.bands.rejectAt && categories.size < cfg.bands.rejectMinCategories)) verdict = "unverified";
  else verdict = "accepted";

  // A poor fix never adds risk; it only removes the right to be accepted alone (kindness rule 3).
  if (fix.accuracy > cfg.geo.maxAccuracyM && verdict === "accepted" && !corroborated) {
    return { verdict: "unverified", risk, signals, corroborated, reason: "imprecise" };
  }
  return { verdict, risk, signals, corroborated };
}

export interface DrinkForVerification {
  id: string;
  volumeMl: number;
  abv: number;
  consumedAt: number;
  loggedAt: number;
  confirmed: boolean;
}

export type DrinkStatus = "verified" | "unverified";

/**
 * AC-07: which of a member's drinks count on leaderboards. Every drink still counts for BAC
 * and personal stats. A drink is verified only by a friend's confirmation, and loses it when
 * it is part of an implausible burst, logged late, or outside the party.
 */
export function verifyDrinks(
  drinks: readonly DrinkForVerification[],
  party: { startsAt: number; endsAt: number } | null,
): Map<string, { status: DrinkStatus; reason?: string }> {
  const cfg = AC_CONFIG.drinks;
  const result = new Map<string, { status: DrinkStatus; reason?: string }>();
  const sorted = [...drinks].sort((a, b) => a.consumedAt - b.consumedAt);
  const burstOver = new Set<string>();

  for (const [windowMin, limit] of [
    [30, cfg.burst30Grams],
    [60, cfg.burst60Grams],
  ] as const) {
    for (let i = 0; i < sorted.length; i++) {
      let grams = 0;
      for (let j = i; j < sorted.length && sorted[j]!.consumedAt - sorted[i]!.consumedAt <= windowMin * 60_000; j++) {
        grams += ethanolGrams(sorted[j]!.volumeMl, sorted[j]!.abv);
        if (grams > limit) burstOver.add(sorted[j]!.id);
      }
    }
  }

  for (const drink of sorted) {
    let reason: string | undefined;
    if (!party || drink.consumedAt < party.startsAt - cfg.partyPreMinutes * 60_000 || drink.consumedAt > party.endsAt) reason = "outside_party";
    else if (drink.loggedAt - drink.consumedAt > cfg.retroMinutes * 60_000) reason = "late_entry";
    else if (burstOver.has(drink.id)) reason = "burst";
    else if (!drink.confirmed) reason = "not_confirmed";
    result.set(drink.id, reason ? { status: "unverified", reason } : { status: "verified" });
  }
  return result;
}
