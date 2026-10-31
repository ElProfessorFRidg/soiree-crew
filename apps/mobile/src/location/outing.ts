import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { estimateBac } from "@crew/bac";
import { afterQuietHours } from "@crew/units";
import { createTranslator } from "@/i18n";
import { variantKey } from "@/i18n/variants";
import { useAppStore } from "@/state/store";

// "Rappel quand t'es de sortie": with the "Always" location permission, the phone notices it has
// stayed in one place at night while no night is logged, and nudges to launch it: once per
// place, 45 min apart at least, 3 per night at most. The
// position stays on this phone: it is compared with the previous one here, never sent anywhere.

export const OUTING_TASK = "outing-location";
export const OUTING_ID = "outing-nudge";
const STATE_KEY = "crew-outing-v1";

const MINUTE_MS = 60_000;
/** Within this distance of where it stopped, the phone counts as still there. */
const STAY_RADIUS_M = 150;
/** Stopped this long somewhere at night: probably out. */
const STAY_MS = 20 * MINUTE_MS;
/** A nudge again tonight only from a place at least this far from the previous nudged ones. */
const NEW_PLACE_M = 400;
/** Never two nudges closer than this. */
const NUDGE_GAP_MS = 45 * MINUTE_MS;
/** At most this many nudges in one night. */
const MAX_PER_NIGHT = 3;
/** The night window for the nudge, local hours: from 8 pm to 4 am. */
const NIGHT_FROM_HOUR = 20;
const NIGHT_TO_HOUR = 4;

const supported = Platform.OS === "ios" || Platform.OS === "android";

interface OutingState {
  /** Where the phone stopped, and since when. */
  anchor: { lat: number; lng: number; since: number } | null;
  /** Nudges scheduled or sent, with the place each one was for: one per place, a few per night. */
  nudges: { at: number; lat: number; lng: number }[];
}

/** One night: noon to noon, as for the other reminders. */
const nightOf = (at: number) => new Date(at - 12 * 60 * MINUTE_MS).toDateString();

const atNight = (at: number) => {
  const hour = new Date(at).getHours();
  return hour >= NIGHT_FROM_HOUR || hour < NIGHT_TO_HOUR;
};

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

async function readState(): Promise<OutingState> {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<OutingState>;
      return { anchor: saved.anchor ?? null, nudges: Array.isArray(saved.nudges) ? saved.nudges : [] };
    }
  } catch {
    // Unreadable: start over.
  }
  return { anchor: null, nudges: [] };
}

const writeState = (state: OutingState) => AsyncStorage.setItem(STATE_KEY, JSON.stringify(state)).catch(() => undefined);

/** A headless launch starts with an empty store: wait for the saved one before reading it. */
async function hydrated(): Promise<void> {
  const persist = useAppStore.persist;
  if (persist.hasHydrated()) return;
  await new Promise<void>((resolve) => {
    const stop = persist.onFinishHydration(() => {
      stop();
      resolve();
    });
    if (persist.hasHydrated()) {
      stop();
      resolve();
    }
  });
}

/** A night is already going on: something drunk not yet back to zero, or tonight's Live Activity. */
function nightGoingOn(now: number): boolean {
  const { profile, drinks, liveActivityId } = useAppStore.getState();
  if (liveActivityId) return true;
  const intakes = drinks
    .filter((d) => d.abv > 0)
    .map((d) => ({ id: d.id, volumeMl: d.volumeMl, abv: d.abv, consumedAt: d.consumedAt, withFood: d.withFood, ...(d.food ? { food: d.food } : {}) }));
  if (!profile) return intakes.some((d) => d.consumedAt > now - 6 * 60 * MINUTE_MS);
  return estimateBac(intakes, profile, now).bac > 0;
}

/** Every condition for the nudge at `at`, checked when it is scheduled. */
async function mayNudge(at: number, now: number, state: OutingState): Promise<boolean> {
  const { outingNudgeOn, nudgesOn, preferences, remindersMutedUntil } = useAppStore.getState();
  if (!outingNudgeOn || !nudgesOn) return false;
  if (!atNight(at)) return false;
  if (afterQuietHours(at, preferences.quietFromHour, preferences.quietToHour) !== at) return false;
  if (remindersMutedUntil !== null && remindersMutedUntil > at) return false;
  const tonight = state.nudges.filter((n) => nightOf(n.at) === nightOf(at));
  if (tonight.length >= MAX_PER_NIGHT) return false;
  if (state.anchor && tonight.some((n) => metersBetween(n, state.anchor!) < NEW_PLACE_M)) return false;
  if (nightGoingOn(now)) return false;
  return (await Notifications.getPermissionsAsync()).granted;
}

async function cancelNudge(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(OUTING_ID).catch(() => undefined);
}

/** Reads one batch of positions from the system and keeps or schedules the nudge. */
async function onLocations(locations: readonly Location.LocationObject[]): Promise<void> {
  const last = locations[locations.length - 1];
  if (!last) return;
  await hydrated();
  if (!useAppStore.getState().outingNudgeOn) return;
  const now = Date.now();
  const here = { lat: last.coords.latitude, lng: last.coords.longitude };
  const state = await readState();

  if (!state.anchor || metersBetween(state.anchor, here) > STAY_RADIUS_M) {
    // Moved: a new place, a new wait. A nudge still pending for the old place is dropped.
    state.anchor = { ...here, since: last.timestamp || now };
    if (state.nudges.some((n) => n.at > now)) {
      await cancelNudge();
      state.nudges = state.nudges.filter((n) => n.at <= now);
    }
  }

  // Only the last day matters: older nudges are dropped.
  state.nudges = state.nudges.filter((n) => n.at > now - 24 * 60 * MINUTE_MS);
  const pending = state.nudges.some((n) => n.at > now);
  if (!pending) {
    const lastNudge = state.nudges.reduce((latest, n) => Math.max(latest, n.at), 0);
    const at = Math.max(state.anchor.since + STAY_MS, now + MINUTE_MS, lastNudge + NUDGE_GAP_MS);
    if (await mayNudge(at, now, state)) {
      const i18n = createTranslator(useAppStore.getState().preferences.language);
      await Notifications.scheduleNotificationAsync({
        identifier: OUTING_ID,
        content: { title: i18n.t("reminders.outingTitle"), body: i18n.t(variantKey("reminders.outingBody", String(at))), data: { url: "/(tabs)" } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
      }).catch(() => undefined);
      state.nudges.push({ at, lat: state.anchor.lat, lng: state.anchor.lng });
    }
  }
  await writeState(state);
}

if (supported) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(OUTING_TASK, async ({ data, error }) => {
    if (error || !data?.locations) return;
    try {
      await onLocations(data.locations);
    } catch {
      // A failed batch is skipped; the next one tries again.
    }
  });
}

/** Turns the low-power background updates on, once both permissions are there. */
export async function startOuting(): Promise<boolean> {
  if (!supported) return false;
  const background = await Location.getBackgroundPermissionsAsync().catch(() => null);
  if (!background?.granted) return false;
  if (await Location.hasStartedLocationUpdatesAsync(OUTING_TASK).catch(() => false)) return true;
  try {
    await Location.startLocationUpdatesAsync(OUTING_TASK, {
      // Cell and Wi-Fi level: enough to tell "still at the same bar" from "moved on".
      accuracy: Location.Accuracy.Low,
      distanceInterval: 100,
      deferredUpdatesDistance: 200,
      deferredUpdatesInterval: 5 * MINUTE_MS,
      timeInterval: 5 * MINUTE_MS,
      activityType: Location.ActivityType.Other,
      pausesUpdatesAutomatically: true,
      showsBackgroundLocationIndicator: false,
    });
    return true;
  } catch {
    return false;
  }
}

/** Off: no more updates, no pending nudge, the last place forgotten. */
export async function stopOuting(): Promise<void> {
  if (!supported) return;
  if (await Location.hasStartedLocationUpdatesAsync(OUTING_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(OUTING_TASK).catch(() => undefined);
  }
  await cancelNudge();
  await AsyncStorage.removeItem(STATE_KEY).catch(() => undefined);
}

/** At launch: keeps the updates in line with the setting and the permission given in the phone's settings. */
export async function syncOuting(): Promise<void> {
  if (!supported) return;
  if (useAppStore.getState().outingNudgeOn) {
    if (!(await startOuting())) useAppStore.setState({ outingNudgeOn: false });
  } else {
    await stopOuting();
  }
}

/** A night got logged: the nudge waiting to say "launch it" would be noise. */
export async function cancelOutingNudge(): Promise<void> {
  if (!supported) return;
  const state = await readState();
  if (state.nudges.some((n) => n.at > Date.now())) {
    await cancelNudge();
    // Kept in the list: this place counts as nudged, the gap and the nightly cap still apply.
    await writeState(state);
  }
}
