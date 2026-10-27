import { BacSimulation, distributionVolume, ethanolGrams, type BodyProfile, type DrinkIntake } from "@crew/bac";
import { nightKey } from "@crew/units";

export type CurvePeriod = "day" | "week" | "month" | "total" | "average";

export interface CurvePoint {
  at: number;
  value: number;
}

export interface CurveSeries {
  points: CurvePoint[];
  /** Points are BAC in g/L for every period; for week and longer each point is a night's peak. */
  kind: "timeline" | "nights";
  peak: CurvePoint | null;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
/** Before the first drink, the day view still starts at a sensible evening hour. */
const DAY_VIEW_MIN_SPAN_MS = 3 * HOUR_MS;

function peakOf(points: CurvePoint[]): CurvePoint | null {
  let best: CurvePoint | null = null;
  for (const point of points) if (!best || point.value > best.value) best = point;
  return best && best.value > 0 ? best : null;
}

/** Tonight's curve, from the start of the night (or the first drink) to back to zero, projected after now. */
function daySeries(sim: BacSimulation, nightStart: number, now: number): CurveSeries {
  const first = sim.firstDrinkAt;
  const start = first !== undefined && first >= nightStart ? Math.min(first, now) : Math.max(nightStart, now - DAY_VIEW_MIN_SPAN_MS);
  let end = now + HOUR_MS;
  // Extend to where the estimate is back to zero, so the falling side is visible.
  for (const point of sim.sample(now, now + 24 * HOUR_MS, 10 * MINUTE_MS)) {
    end = point.at;
    if (point.bac <= 0 && point.at > now) break;
  }
  end = Math.max(end, start + DAY_VIEW_MIN_SPAN_MS);
  const step = Math.max(MINUTE_MS, Math.round((end - start) / 160));
  const points = sim.sample(start, end, step).map((p) => ({ at: p.at, value: p.bac }));
  return { points, kind: "timeline", peak: peakOf(points.filter((p) => p.at <= now)) };
}

/** Peak BAC of every night in [from, now], one point per night including nights without drinks. */
function nightlyPeaks(
  sim: BacSimulation,
  from: number,
  now: number,
  offsetMinutes: number,
  boundaryHour: number,
): CurvePoint[] {
  const peaks = new Map<string, CurvePoint>();
  for (let at = from; at <= now; at += DAY_MS) {
    const key = nightKey(at, offsetMinutes, boundaryHour);
    if (!peaks.has(key)) peaks.set(key, { at, value: 0 });
  }
  for (const point of sim.sample(from, now, 5 * MINUTE_MS)) {
    const key = nightKey(point.at, offsetMinutes, boundaryHour);
    const current = peaks.get(key);
    if (!current || point.bac > current.value) peaks.set(key, { at: current?.at ?? point.at, value: point.bac });
  }
  return [...peaks.values()].sort((a, b) => a.at - b.at);
}

export interface SeriesInput {
  intakes: DrinkIntake[];
  profile: BodyProfile;
  now: number;
  nightStart: number;
  offsetMinutes: number;
  boundaryHour: number;
}

export function buildSeries(period: CurvePeriod, input: SeriesInput): CurveSeries {
  const { intakes, profile, now, nightStart, offsetMinutes, boundaryHour } = input;
  const sim = new BacSimulation(intakes, distributionVolume(profile), now);
  if (period === "day") return daySeries(sim, nightStart, now);

  const firstAt = sim.firstDrinkAt ?? now;
  const spans: Record<Exclude<CurvePeriod, "day">, number> = {
    week: 7 * DAY_MS,
    month: 30 * DAY_MS,
    total: Math.max(30 * DAY_MS, now - firstAt + DAY_MS),
    average: 30 * DAY_MS,
  };
  const from = now - spans[period];
  let points = nightlyPeaks(sim, from, now, offsetMinutes, boundaryHour);

  if (period === "average") {
    // 7-night moving average (O-24).
    points = points.map((point, index) => {
      const window = points.slice(Math.max(0, index - 6), index + 1);
      return { at: point.at, value: window.reduce((sum, p) => sum + p.value, 0) / window.length };
    });
  }
  return { points, kind: "nights", peak: peakOf(points) };
}

export interface GramStats {
  thisMonth: number;
  total: number;
  /** Average grams per night out, over nights with at least one drink. */
  perNight: number;
}

/** Stats in grams of pure alcohol (O-28). */
export function gramStats(intakes: DrinkIntake[], now: number, offsetMinutes: number, boundaryHour: number): GramStats {
  const month = new Date(now);
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
  let thisMonth = 0;
  let total = 0;
  const nights = new Set<string>();
  for (const intake of intakes) {
    if (intake.consumedAt > now) continue;
    const grams = ethanolGrams(intake.volumeMl, intake.abv);
    total += grams;
    if (intake.consumedAt >= monthStart) thisMonth += grams;
    nights.add(nightKey(intake.consumedAt, offsetMinutes, boundaryHour));
  }
  return { thisMonth, total, perNight: nights.size ? total / nights.size : 0 };
}
