import { create } from "zustand";
import type { CompatibilityNotice } from "@/ui/pure/apiCompatibility";

interface CompatibilityEvent extends CompatibilityNotice {
  origin: string | null;
  feature: string;
  method: string;
  code: string;
  status: number;
}
interface CompatibilityState { pending: CompatibilityEvent[] }
export const useCompatibilityEvents = create<CompatibilityState>(() => ({ pending: [] }));
const recent = new Map<string, number>();
const REMIND_AFTER_MS = 5 * 60_000;

/** Startup polls and background sync must not produce a queue of identical update messages. */
export function reportCompatibility(notice: CompatibilityEvent): void {
  const now = Date.now();
  for (const [key, until] of recent) if (until <= now) recent.delete(key);
  const key = JSON.stringify([notice.origin, notice.reason, notice.minimumBuild, notice.minimumApiVersion, notice.webUrl]);
  if ((recent.get(key) ?? 0) > now) return;
  if (recent.size >= 100) recent.delete(recent.keys().next().value!);
  recent.set(key, now + REMIND_AFTER_MS);
  useCompatibilityEvents.setState((state) => ({ pending: [...state.pending, notice].slice(-5) }));
}

export function takeCompatibilityNotices(): CompatibilityEvent[] {
  const pending = useCompatibilityEvents.getState().pending;
  if (pending.length) useCompatibilityEvents.setState({ pending: [] });
  return pending;
}
