import { useAppStore } from "@/state/store";
import type { FirstRunCard } from "./flow";

/** The first-run checklist ticks itself: these are called where the thing really happens. */
export function markFirstRun(what: "invited" | "played"): void {
  const key = what === "invited" ? "invitedAt" : "playedAt";
  useAppStore.setState((state) => (state.firstRun[key] === null ? { firstRun: { ...state.firstRun, [key]: Date.now() } } : {}));
}

export function dismissFirstRunCard(card: FirstRunCard): void {
  useAppStore.setState((state) => (state.firstRun.dismissed.includes(card) ? {} : { firstRun: { ...state.firstRun, dismissed: [...state.firstRun.dismissed, card] } }));
}
