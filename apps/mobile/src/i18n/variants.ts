import { useAppStore } from "@/state/store";
import type { MessageKey } from "./types";

/** Recurring lines with written variants (SLOP-11): `${base}.v1` to `${base}.v3` in every catalogue. */
export const VARIANTS = 3;

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
  | "reminders.waterNone";

/**
 * SLOP-11: the same line never shows twice in a row for this person. One pick per occasion (a day
 * part, a reminder): the screen re-rendering keeps the line; the next occasion gets another one.
 */
export function variantKey(base: Base, occasion: string): MessageKey {
  const memory = useAppStore.getState().copyVariants[base];
  if (memory?.occasion === occasion) return `${base}.v${memory.index}` as MessageKey;
  const others = Array.from({ length: VARIANTS }, (_, i) => i + 1).filter((i) => i !== memory?.index);
  const index = others[Math.floor(Math.random() * others.length)]!;
  // Written after render, in a microtask: a store update during render would warn.
  queueMicrotask(() => useAppStore.setState((s) => ({ copyVariants: { ...s.copyVariants, [base]: { index, occasion } } })));
  return `${base}.v${index}` as MessageKey;
}
