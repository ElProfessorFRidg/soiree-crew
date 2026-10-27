import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { estimateBac, type DrinkIntake } from "@crew/bac";
import { createTranslator } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { useAppStore } from "@/state/store";

const MINUTE_MS = 60_000;
const WATER_ID = "water-reminder";
const LIMIT_ID = "limit-reminder";
/** bac.md §2.5: a drink with no water since the previous one gets a reminder 20 min later. */
const WATER_AFTER_DRY_DRINK_MS = 20 * MINUTE_MS;
/** Never two water reminders closer than this. */
const WATER_MIN_GAP_MS = 20 * MINUTE_MS;
/** Warn this far below the personal limit (O-26). */
const LIMIT_MARGIN = 0.05;

const supported = Platform.OS === "ios" || Platform.OS === "android";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let permission: boolean | null = null;

async function allowed(): Promise<boolean> {
  if (!supported) return false;
  if (permission !== null) return permission;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return (permission = true);
  if (!current.canAskAgain) return (permission = false);
  const asked = await Notifications.requestPermissionsAsync();
  return (permission = asked.granted);
}

function intakes(): DrinkIntake[] {
  return useAppStore
    .getState()
    .drinks.filter((d) => d.abv > 0)
    .map((d) => ({ id: d.id, volumeMl: d.volumeMl, abv: d.abv, consumedAt: d.consumedAt, withFood: d.withFood }));
}

async function schedule(identifier: string, at: number, title: string, body: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined);
  if (at <= Date.now()) return;
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
  });
}

/**
 * Called after every drink and every glass of water. Keeps at most one pending
 * water reminder and one limit warning, and never fires once the estimate is
 * back to zero.
 */
export async function refreshReminders(): Promise<void> {
  if (!supported) return;
  const { profile, preferences, drinks, water } = useAppStore.getState();
  if (!profile) return;
  const i18n = createTranslator(preferences.language);
  const now = Date.now();
  const estimate = estimateBac(intakes(), profile, now);

  if (!(await allowed())) return;

  // Water (O-27).
  const interval = preferences.waterReminderMinutes;
  const backToZero = estimate.backToZeroAt;
  if (interval === null || backToZero === null) {
    await Notifications.cancelScheduledNotificationAsync(WATER_ID).catch(() => undefined);
  } else {
    const lastWater = water.reduce((latest, w) => Math.max(latest, w.at), 0);
    const sortedDrinks = drinks.filter((d) => d.abv > 0).map((d) => d.consumedAt).sort((a, b) => b - a);
    const lastDrink = sortedDrinks[0] ?? 0;
    const previousDrink = sortedDrinks[1] ?? 0;
    const dryDrink = lastDrink > lastWater && lastWater < previousDrink;
    let at = Math.max(lastWater, lastDrink) + interval * MINUTE_MS;
    if (dryDrink) at = Math.min(at, lastDrink + WATER_AFTER_DRY_DRINK_MS);
    at = Math.max(at, now + WATER_MIN_GAP_MS);
    if (at < backToZero) {
      const body =
        lastWater > 0
          ? i18n.t("reminders.waterSince", { minutes: Math.round((at - lastWater) / MINUTE_MS) })
          : i18n.t("reminders.waterNone");
      await schedule(WATER_ID, at, i18n.t("reminders.waterTitle"), body);
    } else {
      await Notifications.cancelScheduledNotificationAsync(WATER_ID).catch(() => undefined);
    }
  }

  // Personal limit (O-26): one warning before the estimate reaches it, not every drink.
  const limit = preferences.personalLimit;
  if (limit === null || !preferences.warnNearLimit || !estimate.peak || estimate.peak.bac < limit - LIMIT_MARGIN) {
    await Notifications.cancelScheduledNotificationAsync(LIMIT_ID).catch(() => undefined);
    return;
  }
  const time = formatClock(estimate.peak.at, preferences.language, preferences.hourCycle);
  await schedule(
    LIMIT_ID,
    Math.max(now + MINUTE_MS, estimate.peak.at - 15 * MINUTE_MS),
    i18n.t("reminders.limitTitle"),
    i18n.t("reminders.limitBody", { time }),
  );
}

/** At the moment a drink is logged: does it take the night over the personal limit? */
export function crossesPersonalLimit(): { crosses: boolean; at: number | null } {
  const { profile, preferences } = useAppStore.getState();
  const limit = preferences.personalLimit;
  if (!profile || limit === null || !preferences.warnNearLimit) return { crosses: false, at: null };
  const estimate = estimateBac(intakes(), profile, Date.now());
  if (!estimate.peak || estimate.peak.bac < limit) return { crosses: false, at: null };
  return { crosses: true, at: estimate.peak.at };
}
