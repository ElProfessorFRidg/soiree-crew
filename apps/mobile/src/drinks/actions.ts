import { haptic } from "@/motion/haptics";
import { refreshReminders } from "@/reminders/reminders";
import { buildDrink, buildWater, useAppStore } from "@/state/store";
import { submit } from "@/sync/engine";
import type { DrinkEntry, WaterEntry } from "@/sync/types";
import type { DrinkPreset } from "./presets";

/** Two taps on the same button within this window are one drink (ADP-04, double-tap guard). */
const DOUBLE_TAP_MS = 900;
let lastAddAt = 0;

export function logDrink(preset: DrinkPreset, consumedAt: number, withFood: boolean): DrinkEntry | null {
  const now = Date.now();
  if (now - lastAddAt < DOUBLE_TAP_MS) return null;
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

export function logWater(): WaterEntry {
  const water = buildWater(Date.now());
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
