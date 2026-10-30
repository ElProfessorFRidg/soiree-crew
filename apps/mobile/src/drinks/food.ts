import { foodOf, type FoodLevel } from "@crew/bac";
import { nightKey } from "@crew/units";
import { useAppStore } from "@/state/store";
import { submit } from "@/sync/engine";

/** Evenings kept: enough to edit last week's drinks with the food they had. */
const KEEP_NIGHTS = 14;

export function nightOf(at: number): string {
  const { dayBoundaryHour } = useAppStore.getState().preferences;
  return nightKey(at, -new Date(at).getTimezoneOffset(), dayBoundaryHour);
}

/** O-85: what was eaten on the night of `at`; nothing known reads as an empty stomach. */
export function eveningFood(at = Date.now()): FoodLevel {
  return useAppStore.getState().foodByNight[nightOf(at)] ?? "none";
}

export function useEveningFood(now: number): FoodLevel {
  const boundary = useAppStore((state) => state.preferences.dayBoundaryHour);
  const night = nightKey(now, -new Date(now).getTimezoneOffset(), boundary);
  return useAppStore((state) => state.foodByNight[night] ?? "none");
}

/**
 * Sets tonight's food level, then moves every drink of tonight to it through the sync engine, so
 * the server's live estimate (O-37) and every phone compute with the same stomach.
 */
export function setEveningFood(level: FoodLevel, at = Date.now()): void {
  const night = nightOf(at);
  const state = useAppStore.getState();
  const kept = Object.entries({ ...state.foodByNight, [night]: level })
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, KEEP_NIGHTS);
  useAppStore.setState({ foodByNight: Object.fromEntries(kept) });
  for (const drink of state.drinks) {
    if (nightOf(drink.consumedAt) !== night || foodOf(drink) === level) continue;
    submit({ kind: "drink.edit", drink: { ...drink, food: level, withFood: level !== "none", sync: "pending" }, previous: drink });
  }
}
