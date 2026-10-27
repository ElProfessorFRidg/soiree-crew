import { haptic } from "@/motion/haptics";
import { refreshReminders } from "@/reminders/reminders";
import { buildDrink, buildWater, useAppStore } from "@/state/store";
import { submit } from "@/sync/engine";
import type { DrinkEntry, WaterEntry } from "@/sync/types";
import type { DrinkPreset } from "./presets";

/** Two taps on the same button within this window are one drink (ADP-04, double-tap guard). */
const DOUBLE_TAP_MS = 900;
let lastAddAt = 0;

/**
 * A second tap within the double-tap window is ignored. An order of several drinks at once
 * (« 2 pintes et un shot ») passes `batch` for the drinks after the first.
 */
export function logDrink(preset: DrinkPreset, consumedAt: number, withFood: boolean, batch = false): DrinkEntry | null {
  const now = Date.now();
  if (!batch && now - lastAddAt < DOUBLE_TAP_MS) return null;
  lastAddAt = now;
  const drink = buildDrink(preset, Math.min(consumedAt, now), withFood);
  haptic.drinkAdded();
  submit({ kind: "drink.add", drink });
  void refreshReminders();
  return drink;
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
