import { MAX_HORIZON_MS, TREND_DEAD_BAND, ZERO_BAC, ZERO_GUT_GRAMS } from "./constants";
import { distributionVolume, type BodyProfile } from "./profile";
import { BacSimulation, type DrinkIntake } from "./simulation";

const HOUR_MS = 3_600_000;
const PEAK_LOOKAHEAD_MS = 4 * HOUR_MS;
const SCAN_MS = 60_000;
/** The trend looks one minute ahead, so a drink just logged reads as rising at once. */
const TREND_WINDOW_MS = 60_000;

export type BacTrend = "rising" | "falling" | "steady";

export interface BacEstimate {
  at: number;
  /** g/L of blood. */
  bac: number;
  trend: BacTrend;
  /** g/L/h. */
  ratePerHour: number;
  /** Upcoming peak while rising, otherwise the highest point of the current episode. */
  peak: { bac: number; at: number } | null;
  /** First moment the estimate is back to zero, null when it already is. */
  backToZeroAt: number | null;
}

export interface DrivingEstimate {
  /** The legal limit used, g/L of blood. 0 means any alcohol is over the limit. */
  limitBac: number;
  overLimitNow: boolean;
  /**
   * First moment the slow-elimination model is under the limit after its
   * projected peak. Null when nothing ever goes over. Never earlier than the
   * peak, so a rising BAC is never called "under the limit".
   */
  underLimitAt: number | null;
  /** Within 0.10 g/L or one hour of the limit: the UI says "too close to call". */
  tooCloseToCall: boolean;
}

function isZero(bac: number, gutGrams: number): boolean {
  return bac < ZERO_BAC && gutGrams < ZERO_GUT_GRAMS;
}

function firstZeroAfter(sim: BacSimulation, from: number): number | null {
  const start = sim.pointAt(from);
  if (isZero(start.bac, start.gutGrams)) return null;
  const end = from + MAX_HORIZON_MS;
  const points = sim.trace(end);
  for (const point of points) {
    if (point.at > from && isZero(point.bac, point.gutGrams)) return point.at;
  }
  // The trace stops early once everything is back to zero.
  const last = points[points.length - 1];
  return last && last.at < end ? last.at : end;
}

export function estimateBac(drinks: readonly DrinkIntake[], profile: BodyProfile, now: number): BacEstimate {
  const sim = new BacSimulation(drinks, distributionVolume(profile), now);
  const current = sim.pointAt(now);
  const ratePerHour = ((sim.bacAt(now + TREND_WINDOW_MS) - current.bac) / TREND_WINDOW_MS) * HOUR_MS;

  let trend: BacTrend = "steady";
  if (ratePerHour > TREND_DEAD_BAND) trend = "rising";
  else if (ratePerHour < -TREND_DEAD_BAND) trend = "falling";

  let peak: BacEstimate["peak"] = null;
  if (trend === "rising") {
    peak = { bac: current.bac, at: now };
    for (const point of sim.sample(now, now + PEAK_LOOKAHEAD_MS, SCAN_MS)) {
      if (point.bac > peak.bac) peak = { bac: point.bac, at: point.at };
    }
  } else if (current.bac >= ZERO_BAC) {
    // Past maximum of the current episode: walk back to the last time it was at zero.
    peak = { bac: current.bac, at: now };
    const points = sim.trace(now);
    for (let i = points.length - 1; i >= 0; i--) {
      const point = points[i]!;
      if (point.at > now) continue;
      if (isZero(point.bac, point.gutGrams) && point.at < now) break;
      if (point.bac > peak.bac) peak = { bac: point.bac, at: point.at };
    }
  }

  return {
    at: now,
    bac: current.bac < ZERO_BAC ? 0 : current.bac,
    trend,
    ratePerHour,
    peak,
    backToZeroAt: firstZeroAfter(sim, now),
  };
}

export function estimateDriving(
  drinks: readonly DrinkIntake[],
  profile: BodyProfile,
  now: number,
  limitBac: number,
): DrivingEstimate {
  const sim = new BacSimulation(drinks, distributionVolume(profile), now, "safe");
  // Zero-tolerance countries: the limit is the display zero, so only back-to-zero matters.
  const limit = Math.max(limitBac, ZERO_BAC);
  const current = sim.pointAt(now);
  const overLimitNow = current.bac >= limit;

  let peakAt = now;
  let peakBac = current.bac;
  const horizon = now + MAX_HORIZON_MS;
  for (const point of sim.trace(horizon)) {
    if (point.at >= now && point.bac > peakBac) {
      peakBac = point.bac;
      peakAt = point.at;
    }
  }

  let underLimitAt: number | null = null;
  if (peakBac >= limit) {
    underLimitAt = horizon;
    for (const point of sim.trace(horizon)) {
      if (point.at >= peakAt && point.bac < limit && (limit > ZERO_BAC || point.gutGrams < ZERO_GUT_GRAMS)) {
        underLimitAt = point.at;
        break;
      }
    }
    const last = sim.trace(horizon).at(-1);
    if (last && underLimitAt === horizon && last.at < horizon) underLimitAt = last.at;
  }

  const closeInValue = Math.abs(current.bac - limit) <= 0.1;
  const closeInTime = underLimitAt !== null && underLimitAt - now <= HOUR_MS && underLimitAt > now;
  return {
    limitBac,
    overLimitNow,
    underLimitAt,
    tooCloseToCall: limit > ZERO_BAC && (closeInValue || closeInTime),
  };
}
