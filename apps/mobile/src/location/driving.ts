import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";
import { estimateBac, estimateDriving } from "@crew/bac";
import { countryRules, drivingLimit } from "@crew/units";
import { createTranslator } from "@/i18n";
import { variantKey } from "@/i18n/variants";
import { useAppStore } from "@/state/store";
import { isDriving, type Fix } from "./speed";

// "Alerte si je conduis après avoir bu": the background location updates of outing.ts also carry a
// speed. Sustained car speed while the estimate is above zero raises a strong warning: the full
// screen when the app is open, a time-sensitive notification otherwise. Speeds and positions are
// read here and kept on this phone, a few minutes at most; nothing is sent anywhere.

export const DRIVE_ID = "drive-warning";
export const DRIVE_CATEGORY = "drive";
export const PASSENGER_ACTION = "drive-passenger";
export const DRIVE_URL = "/drive-warning";

const STATE_KEY = "crew-drive-v1";
const MINUTE_MS = 60_000;
/** Fixes older than this are forgotten. */
const KEEP_MS = 6 * MINUTE_MS;
/** At most one warning in this time. */
export const ALERT_GAP_MS = 20 * MINUTE_MS;
/** "Je suis passager" silences the warning this long. */
export const PASSENGER_MS = 2 * 60 * MINUTE_MS;

const toFix = (l: Location.LocationObject): Fix => ({
  at: l.timestamp || Date.now(),
  lat: l.coords.latitude,
  lng: l.coords.longitude,
  accuracy: l.coords.accuracy ?? null,
  speed: typeof l.coords.speed === "number" && l.coords.speed >= 0 ? l.coords.speed : null,
});

async function readFixes(): Promise<Fix[]> {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    const saved = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(saved) ? (saved as Fix[]) : [];
  } catch {
    return [];
  }
}

/** On unless switched off; until the person chooses, it follows the "Always" location permission. */
export async function driveAlertEnabled(): Promise<boolean> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return false;
  const chosen = useAppStore.getState().driveAlertOn;
  if (chosen !== null) return chosen;
  const background = await Location.getBackgroundPermissionsAsync().catch(() => null);
  return background?.granted ?? false;
}

/** The night's estimate now, with the driving limit of the country. */
export function driveReading(now: number) {
  const { profile, drinks, preferences } = useAppStore.getState();
  if (!profile) return null;
  const intakes = drinks
    .filter((d) => d.abv > 0)
    .map((d) => ({ id: d.id, volumeMl: d.volumeMl, abv: d.abv, consumedAt: d.consumedAt, withFood: d.withFood, ...(d.food ? { food: d.food } : {}) }));
  const rules = countryRules(preferences.legalCountry);
  const limit = drivingLimit(rules, preferences.driverCategory);
  return { rules, limit, estimate: estimateBac(intakes, profile, now), driving: estimateDriving(intakes, profile, now, limit) };
}

let categorySet: string | null = null;
async function setCategory(): Promise<void> {
  const language = useAppStore.getState().preferences.language;
  if (categorySet === language) return;
  categorySet = language;
  const i18n = createTranslator(language);
  await Notifications.setNotificationCategoryAsync(DRIVE_CATEGORY, [
    { identifier: PASSENGER_ACTION, buttonTitle: i18n.t("drive.passenger"), options: { opensAppToForeground: true } },
  ]).catch(() => undefined);
}

async function warn(now: number, over: boolean): Promise<void> {
  useAppStore.setState({ driveAlertedAt: now });
  if (AppState.currentState === "active") {
    // The root layout opens the full-screen warning.
    useAppStore.setState({ driveWarningAt: now });
    return;
  }
  if (!(await Notifications.getPermissionsAsync().catch(() => null))?.granted) return;
  await setCategory();
  const i18n = createTranslator(useAppStore.getState().preferences.language);
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("safety", {
      name: i18n.t("notify.channels.safety"),
      importance: Notifications.AndroidImportance.MAX,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      bypassDnd: true,
    }).catch(() => undefined);
  }
  await Notifications.scheduleNotificationAsync({
    identifier: DRIVE_ID,
    content: {
      title: i18n.t("drive.notifTitle"),
      body: i18n.t(variantKey(over ? "drive.notifBodyOver" : "drive.notifBody", String(now))),
      categoryIdentifier: DRIVE_CATEGORY,
      data: { url: DRIVE_URL },
      interruptionLevel: "timeSensitive",
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: Platform.OS === "android" ? { channelId: "safety" } : null,
  }).catch(() => undefined);
}

/** One batch of background positions, from the outing task; the store is already hydrated. */
export async function onDriveLocations(locations: readonly Location.LocationObject[]): Promise<void> {
  if (!locations.length || !(await driveAlertEnabled())) return;
  const now = Date.now();
  const fixes = [...(await readFixes()), ...locations.map(toFix)].filter((f) => f.at > now - KEEP_MS).slice(-30);
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(fixes)).catch(() => undefined);
  if (!isDriving(fixes)) return;
  const { drivePassengerUntil, driveAlertedAt } = useAppStore.getState();
  if (drivePassengerUntil !== null && drivePassengerUntil > now) return;
  if (driveAlertedAt !== null && now - driveAlertedAt < ALERT_GAP_MS) return;
  const reading = driveReading(now);
  if (!reading || reading.estimate.bac <= 0) return;
  await warn(now, reading.driving.overLimitNow);
}

/** "Je suis passager": quiet for 2 h, and the notification goes. */
export async function silenceAsPassenger(): Promise<void> {
  useAppStore.setState({ drivePassengerUntil: Date.now() + PASSENGER_MS, driveWarningAt: null });
  await Notifications.dismissNotificationAsync(DRIVE_ID).catch(() => undefined);
}

/** Switched off: the few fixes kept are forgotten. */
export async function forgetDriving(): Promise<void> {
  await AsyncStorage.removeItem(STATE_KEY).catch(() => undefined);
}
