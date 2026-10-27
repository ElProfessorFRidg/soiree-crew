import { useEffect, useMemo, useState } from "react";
import { AppState as RNAppState } from "react-native";
import {
  BacSimulation,
  distributionVolume,
  estimateBac,
  estimateDriving,
  nextUiLevel,
  type BacEstimate,
  type BodyProfile,
  type DrivingEstimate,
  type DrinkIntake,
  type UiLevel,
} from "@crew/bac";
import { breathRatio, countryRules, drivingLimit, type CountryRules } from "@crew/units";
import { useAppStore } from "./store";
import { useEcoInterval } from "@/power/eco";

const TICK_MS = 15_000;
const HOUR_MS = 3_600_000;

/** Wall clock that refreshes every 15 s and whenever the app comes back to the foreground. */
export function useNow(base = TICK_MS): number {
  const [now, setNow] = useState(() => Date.now());
  // ADP-08: the clock ticks less often on a low battery; coming back to the app still refreshes it.
  const intervalMs = useEcoInterval(base);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    const subscription = RNAppState.addEventListener("change", (status) => {
      if (status === "active") setNow(Date.now());
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [intervalMs]);
  return now;
}

export function useBodyProfile(): BodyProfile | null {
  const profile = useAppStore((state) => state.profile);
  return useMemo(() => {
    if (!profile) return null;
    const body: BodyProfile = { weightKg: profile.weightKg, bodyModel: profile.bodyModel };
    if (profile.heightCm !== undefined) body.heightCm = profile.heightCm;
    if (profile.ageYears !== undefined) body.ageYears = profile.ageYears;
    return body;
  }, [profile]);
}

export function useIntakes(): DrinkIntake[] {
  const drinks = useAppStore((state) => state.drinks);
  return useMemo(
    () =>
      drinks
        .filter((drink) => drink.abv > 0)
        .map((drink) => ({
          id: drink.id,
          volumeMl: drink.volumeMl,
          abv: drink.abv,
          consumedAt: drink.consumedAt,
          withFood: drink.withFood,
        })),
    [drinks],
  );
}

export interface LiveBac {
  estimate: BacEstimate;
  driving: DrivingEstimate;
  rules: CountryRules;
  ratio: number;
  /** Highest value expected in the next hour, for the next-morning vault (ADP-06). */
  peakNextHour: number;
}

/** Everything the Party screen shows about the BAC, recomputed from the drink list. */
export function useLiveBac(now: number): LiveBac | null {
  const profile = useBodyProfile();
  const intakes = useIntakes();
  const legalCountry = useAppStore((state) => state.preferences.legalCountry);
  const driverCategory = useAppStore((state) => state.preferences.driverCategory);

  return useMemo(() => {
    if (!profile) return null;
    // The clock only ticks every few seconds: a drink logged since then must not look like a future drink.
    const at = Math.max(now, Date.now());
    const rules = countryRules(legalCountry);
    const estimate = estimateBac(intakes, profile, at);
    const driving = estimateDriving(intakes, profile, at, drivingLimit(rules, driverCategory));
    const sim = new BacSimulation(intakes, distributionVolume(profile), at);
    let peakNextHour = estimate.bac;
    for (const point of sim.sample(at, at + HOUR_MS, 60_000)) peakNextHour = Math.max(peakNextHour, point.bac);
    return { estimate, driving, rules, ratio: breathRatio(rules), peakNextHour };
  }, [profile, intakes, legalCountry, driverCategory, now]);
}

/** Estimated level with hysteresis, then the manual choice on top (ADP-01). */
export function useUiLevel(bac: number, now: number): { level: UiLevel; estimated: UiLevel; manual: UiLevel | null } {
  const levelState = useAppStore((state) => state.levelState);
  const manual = useAppStore((state) => state.manualLevel);
  const next = nextUiLevel(levelState, bac, now);

  useEffect(() => {
    if (!levelState || next.level !== levelState.level || next.since !== levelState.since) {
      useAppStore.setState({ levelState: next });
    }
  }, [levelState, next]);

  return { level: manual ?? next.level, estimated: next.level, manual };
}
