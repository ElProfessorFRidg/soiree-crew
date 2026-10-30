import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { estimateBac, type BacEstimate, type DrinkIntake } from "@crew/bac";
import { afterQuietHours, breathRatio, countryRules, formatBacValue, type UserPreferences } from "@crew/units";
import { createTranslator, type Translator } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { variantKey } from "@/i18n/variants";
import { useAppStore } from "@/state/store";
import { REMOTE_PUSH } from "@/notify/remote";

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
    // The night notification updates quietly in the list, never as a banner. Crew notifications
    // (O-38) show as a toast inside the app instead, so the banner would say it twice.
    shouldShowBanner: notification.request.identifier !== "night-in-progress" && typeof notification.request.content.data?.k !== "string",
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Asked at most once a session; the answer itself is read again each time, so a change in the settings counts at once. */
let asked = false;

async function allowed(): Promise<boolean> {
  if (!supported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain || asked) return false;
  asked = true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

function intakes(): DrinkIntake[] {
  return useAppStore
    .getState()
    .drinks.filter((d) => d.abv > 0)
    .map((d) => ({ id: d.id, volumeMl: d.volumeMl, abv: d.abv, consumedAt: d.consumedAt, withFood: d.withFood, ...(d.food ? { food: d.food } : {}) }));
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
    // QOL-27: on a locked phone the system shows the app name only.
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
  const ratio = breathRatio(countryRules(preferences.legalCountry));
  const value = `${formatBacValue(estimate.bac, preferences.bacUnit, ratio, i18n.locale)} ${i18n.t(`units.${preferences.bacUnit}`)}`;
  // QOL-27: discreet by default, no figure anyone glancing at the phone could read.
  const numbers = useAppStore.getState().lockScreenNumbers;
  await Notifications.scheduleNotificationAsync({
    identifier: NIGHT_ID,
    content: {
      title: numbers ? i18n.t("reminders.nightTitle", { time: formatClock(estimate.at, preferences.language, preferences.hourCycle), value }) : i18n.t("reminders.nightChannel"),
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
          ? i18n.t(variantKey("reminders.waterSince", String(at)), { minutes: Math.round((at - lastWater) / MINUTE_MS) })
          : i18n.t(variantKey("reminders.waterNone", String(at)));
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

/** N-06: a party I said yes to is announced this long before it starts. */
const PARTY_LEAD_MS = 60 * MINUTE_MS;
const PARTY_PREFIX = "party-soon-";
/** QOL-21: a crew mate's birthday is announced this many days before, early evening. */
const BIRTHDAY_LEAD_DAYS = 3;
const BIRTHDAY_HOUR = 18;
const BIRTHDAY_PREFIX = "birthday-";

async function cancelStale(prefix: string, keep: ReadonlySet<string>): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  for (const n of scheduled) {
    if (n.identifier.startsWith(prefix) && !keep.has(n.identifier)) await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined);
  }
}

/**
 * N-06: one local notification an hour before each party I said yes to. Saying no, or the
 * party being cancelled or closed, takes its reminder away. Local only: no push involved.
 */
export async function schedulePartyReminders(
  parties: readonly { id: string; name: string; mood: string; crewName: string; startsAt: number; closedAt: number | null; myResponse: string }[],
): Promise<void> {
  if (!supported) return;
  const now = Date.now();
  const upcoming = parties.filter((p) => p.myResponse === "going" && p.closedAt === null && p.startsAt - PARTY_LEAD_MS > now);
  const keep = new Set(upcoming.map((p) => `${PARTY_PREFIX}${p.id}`));
  await cancelStale(PARTY_PREFIX, keep);
  if (!upcoming.length || !(await allowed())) return;
  const { preferences } = useAppStore.getState();
  const i18n = createTranslator(preferences.language);
  for (const p of upcoming) {
    const name = p.name || i18n.t(`newParty.moods.${p.mood}` as "newParty.moods.party");
    const time = formatClock(p.startsAt, preferences.language, preferences.hourCycle);
    await Notifications.scheduleNotificationAsync({
      identifier: `${PARTY_PREFIX}${p.id}`,
      content: { title: i18n.t("reminders.partySoonTitle", { party: name, time }), body: i18n.t("reminders.partySoonBody", { crew: p.crewName }), data: { url: `/live?id=${p.id}` } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(p.startsAt - PARTY_LEAD_MS) },
    }).catch(() => undefined);
  }
}

/**
 * QOL-21: crew mates' birthdays, a few days before at 6 pm (or as soon as the quiet hours end
 * when that moment has passed). Once per birthday; the tap opens a party already filled in.
 */
export async function scheduleBirthdayReminders(birthdays: readonly { userId: string; name: string; date: string; crewId: string }[]): Promise<void> {
  if (!supported) return;
  const { preferences, birthdayNotified } = useAppStore.getState();
  const seen = new Set<string>();
  const fresh = birthdays.filter((b) => {
    const key = `${b.userId}:${b.date}`;
    if (seen.has(key) || birthdayNotified.includes(key)) return false;
    seen.add(key);
    return true;
  });
  if (!fresh.length || !(await allowed())) return;
  const i18n = createTranslator(preferences.language);
  const now = Date.now();
  for (const b of fresh) {
    const [y, m, d] = b.date.split("-").map(Number) as [number, number, number];
    const day = new Date(y, m - 1, d);
    const lead = new Date(y, m - 1, d - BIRTHDAY_LEAD_DAYS, BIRTHDAY_HOUR).getTime();
    // Already inside the window: the next decent moment, unless the day itself is over.
    const at = lead > now ? lead : afterQuietHours(now + MINUTE_MS, preferences.quietFromHour, preferences.quietToHour);
    if (at >= new Date(y, m - 1, d + 1).getTime()) continue;
    const when = new Intl.DateTimeFormat(i18n.locale, { weekday: "long", day: "numeric", month: "long" }).format(day);
    const partyName = i18n.t("radar.birthdayPartyName", { name: b.name });
    const url = `/new-party?crewId=${encodeURIComponent(b.crewId)}&mood=birthday&date=${b.date}&name=${encodeURIComponent(partyName)}`;
    await Notifications.scheduleNotificationAsync({
      identifier: `${BIRTHDAY_PREFIX}${b.userId}-${b.date}`,
      content: { title: i18n.t("radar.birthdayOn", { name: b.name, date: when }), body: i18n.t("radar.birthdayPlanQuestion"), data: { url } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
    }).catch(() => undefined);
  }
  useAppStore.setState({ birthdayNotified: [...birthdayNotified, ...seen].slice(-60) });
const homeCheckId = (partyId: string) => `home-check-${partyId}`;

/**
 * N-25: when the night I go to ends, the phone asks whether I am home, even with the app closed.
 * Scheduled again whenever the party is read, so a new end time moves it.
 */
export async function scheduleHomeCheck(party: { id: string; name: string; endsAt: number }): Promise<void> {
  if (!supported || !(await allowed())) return;
  const i18n = createTranslator(useAppStore.getState().preferences.language);
  await Notifications.cancelScheduledNotificationAsync(homeCheckId(party.id)).catch(() => undefined);
  await Notifications.scheduleNotificationAsync({
    identifier: homeCheckId(party.id),
    content: { title: i18n.t("homeCheck.notifTitle"), body: i18n.t("homeCheck.notifBody", { party: party.name }), data: { url: "/(tabs)" } },
    trigger: party.endsAt <= Date.now() + MINUTE_MS ? null : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(party.endsAt) },
  });
}

/** Home already: the question would be noise. */
export async function cancelHomeCheck(partyId: string): Promise<void> {
  if (!supported) return;
  await Notifications.cancelScheduledNotificationAsync(homeCheckId(partyId)).catch(() => undefined);
  await Notifications.dismissNotificationAsync(homeCheckId(partyId)).catch(() => undefined);
}

/** O-41: "the recap is ready" as soon as a party closes, at a decent hour. Once per party. */
export async function notifyRecapReady(party: { id: string; name: string }): Promise<void> {
  const { recapNotified, preferences } = useAppStore.getState();
  if (recapNotified.includes(party.id)) return;
  useAppStore.setState({ recapNotified: [...recapNotified, party.id].slice(-40) });
  // With push, the server sends it (O-38); without, this local one still waits out the quiet hours.
  if (REMOTE_PUSH || !preferences.notifyRecap || !(await allowed())) return;
  const i18n = createTranslator(preferences.language);
  const at = afterQuietHours(Date.now(), preferences.quietFromHour, preferences.quietToHour);
  await Notifications.scheduleNotificationAsync({
    identifier: `recap-${party.id}`,
    content: { title: i18n.t("recap.notifTitle"), body: i18n.t("recap.notifBody", { party: party.name }), data: { url: `/recap?id=${party.id}` } },
    trigger: at <= Date.now() + MINUTE_MS ? null : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
  });
}
