import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { estimateBac, type BacEstimate, type DrinkIntake } from "@crew/bac";
import { afterQuietHours, breathRatio, countryRules, formatBacValue, type UserPreferences } from "@crew/units";
import { createTranslator, type Translator } from "@/i18n";
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
  handleNotification: async (notification) => ({
    // The night notification updates quietly in the list, never as a banner.
    shouldShowBanner: notification.request.identifier !== "night-in-progress",
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

/** QOL-03: actions straight from the notification. */
export const WATER_CATEGORY = "water";
export const LOG_WATER_ACTION = "log-water";
/** QOL-30: every party reminder can be muted until the morning. */
export const MUTE_ACTION = "mute-until-morning";

let categoriesSet = false;
async function setCategories(): Promise<void> {
  if (categoriesSet || !supported) return;
  categoriesSet = true;
  const i18n = createTranslator(useAppStore.getState().preferences.language);
  await Notifications.setNotificationCategoryAsync(WATER_CATEGORY, [
    { identifier: LOG_WATER_ACTION, buttonTitle: i18n.t("reminders.waterDone"), options: { opensAppToForeground: true } },
    { identifier: MUTE_ACTION, buttonTitle: i18n.t("reminders.mute"), options: { opensAppToForeground: false } },
  ]).catch(() => undefined);
}

async function schedule(identifier: string, at: number, title: string, body: string, categoryIdentifier?: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined);
  if (at <= Date.now()) return;
  if (categoryIdentifier) await setCategories();
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title, body, ...(categoryIdentifier ? { categoryIdentifier } : {}) },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
  });
}

/**
 * Called after every drink and every glass of water. Keeps at most one pending
 * water reminder and one limit warning, and never fires once the estimate is
 * back to zero.
 */
const NIGHT_ID = "night-in-progress";
const NIGHT_CHANNEL = "night";

/**
 * HUB-02 on Android: one quiet, persistent notification for the night with the
 * estimate when it was computed and the back-to-zero time, which stays true as time passes.
 * Gone once the estimate is back to zero. iOS needs a Live Activity (native extension).
 */
async function updateNightNotification(estimate: BacEstimate, i18n: Translator, preferences: UserPreferences): Promise<void> {
  if (Platform.OS !== "android") return;
  if (estimate.bac <= 0 || estimate.backToZeroAt === null) {
    await Notifications.dismissNotificationAsync(NIGHT_ID).catch(() => undefined);
    return;
  }
  await Notifications.setNotificationChannelAsync(NIGHT_CHANNEL, {
    name: i18n.t("reminders.nightChannel"),
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
    vibrationPattern: null,
    enableVibrate: false,
    showBadge: false,
  });
  const ratio = breathRatio(countryRules(preferences.legalCountry));
  const value = `${formatBacValue(estimate.bac, preferences.bacUnit, ratio, i18n.locale)} ${i18n.t(`units.${preferences.bacUnit}`)}`;
  await Notifications.scheduleNotificationAsync({
    identifier: NIGHT_ID,
    content: {
      title: i18n.t("reminders.nightTitle", { time: formatClock(estimate.at, preferences.language, preferences.hourCycle), value }),
      body: i18n.t("reminders.nightBody", { time: formatClock(estimate.backToZeroAt, preferences.language, preferences.hourCycle) }),
      sticky: true,
      autoDismiss: false,
      priority: Notifications.AndroidNotificationPriority.LOW,
    },
    trigger: { channelId: NIGHT_CHANNEL },
  });
}

/** QOL-30: no reminder until the end of the night, the day boundary of tomorrow morning. */
export async function muteUntilMorning(): Promise<void> {
  const { dayBoundaryHour } = useAppStore.getState().preferences;
  const morning = new Date();
  if (morning.getHours() >= dayBoundaryHour) morning.setDate(morning.getDate() + 1);
  morning.setHours(dayBoundaryHour, 0, 0, 0);
  useAppStore.setState({ remindersMutedUntil: morning.getTime() });
  await Notifications.cancelScheduledNotificationAsync(WATER_ID).catch(() => undefined);
  await Notifications.cancelScheduledNotificationAsync(LIMIT_ID).catch(() => undefined);
}

export async function refreshReminders(): Promise<void> {
  if (!supported) return;
  const { profile, preferences, drinks, water, remindersMutedUntil } = useAppStore.getState();
  if (!profile) return;
  if (remindersMutedUntil !== null && remindersMutedUntil > Date.now()) return;
  const i18n = createTranslator(preferences.language);
  const now = Date.now();
  const estimate = estimateBac(intakes(), profile, now);

  if (!(await allowed())) return;

  await updateNightNotification(estimate, i18n, preferences).catch(() => undefined);

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
      await schedule(WATER_ID, at, i18n.t("reminders.waterTitle"), body, WATER_CATEGORY);
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
    WATER_CATEGORY,
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

/** O-41: "the recap is ready" as soon as a party closes, at a decent hour. Once per party. */
export async function notifyRecapReady(party: { id: string; name: string }): Promise<void> {
  const { recapNotified, preferences } = useAppStore.getState();
  if (recapNotified.includes(party.id)) return;
  useAppStore.setState({ recapNotified: [...recapNotified, party.id].slice(-40) });
  if (!preferences.notifyRecap || !(await allowed())) return;
  const i18n = createTranslator(preferences.language);
  const at = afterQuietHours(Date.now(), preferences.quietFromHour, preferences.quietToHour);
  await Notifications.scheduleNotificationAsync({
    identifier: `recap-${party.id}`,
    content: { title: i18n.t("recap.notifTitle"), body: i18n.t("recap.notifBody", { party: party.name }), data: { url: `/recap?id=${party.id}` } },
    trigger: at <= Date.now() + MINUTE_MS ? null : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
  });
}
