import type { UserPreferences } from "@crew/units";
import { haptic } from "@/motion/haptics";
import { submit } from "@/sync/engine";
import { askPermission } from "@/system/askPermission";
import { isOnboarded, useAppStore } from "./store";

/** A reminder switched on by hand: the moment to ask the phone to let it ring. */
function turnsReminderOn(patch: Partial<UserPreferences>, current: UserPreferences): boolean {
  return (
    (patch.waterReminderMinutes != null && current.waterReminderMinutes === null) ||
    (patch.warnNearLimit === true && !current.warnNearLimit) ||
    (patch.notifyRecap === true && !current.notifyRecap)
  );
}

/** Every settings change: instant in the UI, queued for the server, reverted if refused (PREF-01). */
export function setPreferences(patch: Partial<UserPreferences>): void {
  const current = useAppStore.getState().preferences;
  const previous: Partial<UserPreferences> = {};
  for (const key of Object.keys(patch) as (keyof UserPreferences)[]) {
    (previous as Record<string, unknown>)[key] = current[key];
  }
  haptic.select();
  submit({ kind: "preferences.set", patch, previous });
  // The arrival flow asks on its own notifications step, after saying what will ring.
  if (turnsReminderOn(patch, current) && isOnboarded(useAppStore.getState())) {
    void askPermission("notifications", "reminders").then(async (answer) => {
      if (!answer.granted) return;
      const { registerForPush } = await import("@/notify/push");
      await registerForPush();
    });
  }
}
