import type { FoodLevel } from "@crew/bac";
import { haptic } from "@/motion/haptics";
import { refreshReminders } from "@/reminders/reminders";
import { buildDrink, buildWater, useAppStore } from "@/state/store";
import { submit } from "@/sync/engine";
import type { DrinkEntry, WaterEntry } from "@/sync/types";
import { eveningFood } from "./food";
import type { DrinkPreset } from "./presets";

/** Two taps on the same button within this window are one drink (ADP-04, double-tap guard). */
const DOUBLE_TAP_MS = 900;
let lastAddAt = 0;

/**
 * A second tap within the double-tap window is ignored. An order of several drinks at once
 * (« 2 pintes et un shot ») passes `batch` for the drinks after the first. Without a food level the
 * drink takes the evening's (O-85).
 */
export function logDrink(preset: DrinkPreset, consumedAt: number, food: FoodLevel | null = null, batch = false): DrinkEntry | null {
  const now = Date.now();
  if (!batch && now - lastAddAt < DOUBLE_TAP_MS) return null;
  lastAddAt = now;
  const at = Math.min(consumedAt, now);
  const drink = buildDrink(preset, at, food ?? eveningFood(at));
  haptic.drinkAdded();
  submit({ kind: "drink.add", drink });
  void refreshReminders();
  return drink;
}

/** O-23: a logged drink changed. A time in the future never counts (O-22): it is brought back to now. */
export function editDrink(before: DrinkEntry, change: Partial<Pick<DrinkEntry, "consumedAt" | "volumeMl" | "abv" | "food">>): void {
  const next: DrinkEntry = { ...before, ...change, sync: "pending" };
  next.consumedAt = Math.min(next.consumedAt, Date.now());
  if (next.food) next.withFood = next.food !== "none";
  submit({ kind: "drink.edit", drink: next, previous: before });
  void refreshReminders();
}

export function removeDrink(drink: DrinkEntry): void {
  submit({ kind: "drink.remove", drink });
  void refreshReminders();
}

export function restoreDrink(drink: DrinkEntry): void {
  submit({ kind: "drink.add", drink: { ...drink, sync: "pending" } });
}

let lastWaterAt = 0;

/** Null when it follows another water within the double-tap window (ADP-09). */
export function logWater(): WaterEntry | null {
  const now = Date.now();
  if (now - lastWaterAt < DOUBLE_TAP_MS) return null;
  lastWaterAt = now;
  const water = buildWater(now);
  haptic.water();
  submit({ kind: "water.add", water });
  void refreshReminders();
  return water;
}

export function removeWater(water: WaterEntry): void {
  submit({ kind: "water.remove", water });
}

/** "Same again" (QOL-01): the most recent drink by the time it was drunk. */
export function lastDrink(): DrinkEntry | undefined {
  const drinks = useAppStore.getState().drinks;
  let latest: DrinkEntry | undefined;
  for (const drink of drinks) if (!latest || drink.consumedAt > latest.consumedAt) latest = drink;
  return latest;
}
