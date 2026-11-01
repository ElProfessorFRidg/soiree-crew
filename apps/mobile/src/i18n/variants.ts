import { useAppStore } from "@/state/store";
import type { MessageKey } from "./types";

/** Recurring lines with written variants (SLOP-11): `${base}.v1` to `${base}.v8` in every catalogue. */
export const VARIANTS = 8;
/** The water reminders come back often in a night: they get a longer list, from v1 to v12. */
const COUNTS: Partial<Record<Base, number>> = {
  "reminders.waterSince": 20,
  "reminders.waterNone": 20,
  "reminders.waterStreak": 10,
  "reminders.foodBody": 10,
  "reminders.paceBody": 10,
  "reminders.rideBody": 10,
  "reminders.morningBody": 10,
  "drive.notifBody": 6,
  "drive.notifBodyOver": 6,
  "drive.drank": 4,
  "drive.dontDrink": 4,
  "drive.phone": 4,
  "drive.options": 4,
};

type Base =
  | "greeting.lateNight"
  | "greeting.morning"
  | "greeting.afternoon"
  | "greeting.apero"
  | "greeting.evening"
  | "greeting.home"
  | "greeting.driver"
  | "greeting.firstRound"
  | "greeting.climbing"
  | "reminders.waterSince"
  | "reminders.waterNone"
  | "reminders.waterStreak"
  | "reminders.foodBody"
  | "reminders.paceBody"
  | "reminders.rideBody"
  | "reminders.morningBody"
  | "reminders.limitBody"
  | "reminders.partySoonBody"
  | "reminders.peakBody"
  | "reminders.launchBody"
  | "reminders.comebackBody"
  | "reminders.outingBody"
  | "reminders.birthdayBody"
  | "homeCheck.notifBody"
  | "recap.notifBody"
  | "drive.notifBody"
  | "drive.notifBodyOver"
  | "drive.drank"
  | "drive.dontDrink"
  | "drive.phone"
  | "drive.options";

/**
 * SLOP-11: the same line never shows twice in a row for this person. One pick per occasion (a day
 * part, a reminder): the screen re-rendering keeps the line; the next occasion gets another one.
 */
export function variantKey(base: Base, occasion: string): MessageKey {
  const memory = useAppStore.getState().copyVariants[base];
  if (memory?.occasion === occasion) return `${base}.v${memory.index}` as MessageKey;
  const others = Array.from({ length: COUNTS[base] ?? VARIANTS }, (_, i) => i + 1).filter((i) => i !== memory?.index);
  const index = others[Math.floor(Math.random() * others.length)]!;
  // Written after render, in a microtask: a store update during render would warn.
  queueMicrotask(() => useAppStore.setState((s) => ({ copyVariants: { ...s.copyVariants, [base]: { index, occasion } } })));
  return `${base}.v${index}` as MessageKey;
}
