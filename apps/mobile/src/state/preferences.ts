import type { UserPreferences } from "@crew/units";
import { haptic } from "@/motion/haptics";
import { submit } from "@/sync/engine";
import { useAppStore } from "./store";

/** Every settings change: instant in the UI, queued for the server, reverted if refused (PREF-01). */
export function setPreferences(patch: Partial<UserPreferences>): void {
  const current = useAppStore.getState().preferences;
  const previous: Partial<UserPreferences> = {};
  for (const key of Object.keys(patch) as (keyof UserPreferences)[]) {
    (previous as Record<string, unknown>)[key] = current[key];
  }
  haptic.select();
  submit({ kind: "preferences.set", patch, previous });
}
