import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { estimateBac } from "@crew/bac";
import { afterQuietHours } from "@crew/units";
import { createTranslator } from "@/i18n";
import { variantKey } from "@/i18n/variants";
import { api } from "@/server/api";
import { useAppStore } from "@/state/store";
import { driveAlertEnabled, forgetDriving, onDriveLocations } from "./driving";

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
/** Stopped this long somewhere at night: probably out (10 min for people who tend to forget). */
const STAY_MS = 20 * MINUTE_MS;
/** "Me détecter avec mon crew": one coarse position every 10 min at most, while lingering. */
const REPORT_EVERY_MS = 10 * MINUTE_MS;
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
  /** Tonight's nudges the server knows of (the crew ones too): one budget for both. */
  serverNudges: number[];
  lastReportAt: number;
  /** Where the phone spent the night, and which nights: a place slept in twice is home. */
  sleeps: { lat: number; lng: number; nights: string[] }[];
}

/** Within this of a place slept in twice, the phone is at home: an evening in is not a night out. */
const HOME_RADIUS_M = 300;
const isHome = (state: OutingState, here: { lat: number; lng: number }) =>
  state.sleeps.some((s) => s.nights.length >= 2 && metersBetween(s, here) < HOME_RADIUS_M);

/** The first position after 4 am, still where it stopped before: the night was spent there. */
function learnSleep(state: OutingState, now: number): void {
  const anchor = state.anchor;
  const morning = new Date(now);
  if (!anchor || morning.getHours() < NIGHT_TO_HOUR || morning.getHours() >= 12) return;
  morning.setHours(NIGHT_TO_HOUR, 0, 0, 0);
  if (anchor.since > morning.getTime()) return;
  const night = nightOf(now - 12 * 60 * MINUTE_MS);
  const spot = state.sleeps.find((s) => metersBetween(s, anchor) < HOME_RADIUS_M);
  if (spot) {
    if (!spot.nights.includes(night)) spot.nights = [...spot.nights, night].slice(-10);
  } else state.sleeps = [...state.sleeps, { lat: anchor.lat, lng: anchor.lng, nights: [night] }].slice(-5);
}

interface ServerOuting {
  habit: { stayMinutes: number; maxPerNight: number; pausedUntil: number | null };
  nudges: number[];
}

/** About 100 m: three decimals of a degree. Nothing finer ever leaves the phone. */
const coarse = (value: number) => Math.round(value * 1000) / 1000;

function keepServer(answer: ServerOuting, state: OutingState): void {
  const { stayMinutes, maxPerNight, pausedUntil } = answer.habit;
  useAppStore.setState({ outingHabit: { stayMinutes, maxPerNight, pausedUntil } });
  state.serverNudges = answer.nudges;
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
      return {
        anchor: saved.anchor ?? null,
        nudges: Array.isArray(saved.nudges) ? saved.nudges : [],
        serverNudges: Array.isArray(saved.serverNudges) ? saved.serverNudges : [],
        lastReportAt: typeof saved.lastReportAt === "number" ? saved.lastReportAt : 0,
        sleeps: Array.isArray(saved.sleeps) ? saved.sleeps : [],
      };
    }
  } catch {
    // Unreadable: start over.
  }
  return { anchor: null, nudges: [], serverNudges: [], lastReportAt: 0, sleeps: [] };
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
  const { outingNudgeOn, nudgesOn, preferences, remindersMutedUntil, outingHabit } = useAppStore.getState();
  if (!outingNudgeOn || !nudgesOn) return false;
  if (outingHabit?.pausedUntil && outingHabit.pausedUntil > at) return false;
  if (!atNight(at)) return false;
  if (afterQuietHours(at, preferences.quietFromHour, preferences.quietToHour) !== at) return false;
  if (remindersMutedUntil !== null && remindersMutedUntil > at) return false;
  const tonight = state.nudges.filter((n) => nightOf(n.at) === nightOf(at));
  // The crew nudges the server sent count too; a local one it already knows is counted once.
  const crewOnly = state.serverNudges.filter((t) => nightOf(t) === nightOf(at) && !tonight.some((n) => n.at === t));
  if (tonight.length + crewOnly.length >= (outingHabit?.maxPerNight ?? MAX_PER_NIGHT)) return false;
  if (state.anchor && isHome(state, state.anchor)) return false;
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
  // The driving warning rides on the same updates (driving.ts).
  await onDriveLocations(locations).catch(() => undefined);
  if (!useAppStore.getState().outingNudgeOn) return;
  const now = Date.now();
  const here = { lat: last.coords.latitude, lng: last.coords.longitude };
  const state = await readState();
  learnSleep(state, now);

  if (!state.anchor || metersBetween(state.anchor, here) > STAY_RADIUS_M) {
    // Moved: a new place, a new wait. A nudge still pending for the old place is dropped.
    state.anchor = { ...here, since: last.timestamp || now };
    if (state.nudges.some((n) => n.at > now)) {
      await cancelNudge();
      state.nudges = state.nudges.filter((n) => n.at <= now);
    }
  }

  const { crewDetectOn, remindersMutedUntil, outingHabit } = useAppStore.getState();
  // "Me détecter avec mon crew": still here at night, a coarse position every 10 min at most.
  if (crewDetectOn && atNight(now) && now - state.anchor.since >= 5 * MINUTE_MS && now - state.lastReportAt >= REPORT_EVERY_MS) {
    state.lastReportAt = now;
    const answer = await api<ServerOuting>("/v1/me/whereabouts", {
      method: "POST",
      body: { lat: coarse(here.lat), lng: coarse(here.lng), mutedUntil: remindersMutedUntil },
    }).catch(() => null);
    if (answer) keepServer(answer, state);
  }

  // Only the last day matters: older nudges are dropped.
  state.nudges = state.nudges.filter((n) => n.at > now - 24 * 60 * MINUTE_MS);
  state.serverNudges = state.serverNudges.filter((t) => t > now - 24 * 60 * MINUTE_MS);
  const pending = state.nudges.some((n) => n.at > now);
  if (!pending) {
    const lastNudge = Math.max(0, ...state.nudges.map((n) => n.at), ...state.serverNudges);
    const stayMs = outingHabit ? outingHabit.stayMinutes * MINUTE_MS : STAY_MS;
    const at = Math.max(state.anchor.since + stayMs, now + MINUTE_MS, lastNudge + NUDGE_GAP_MS);
    if (await mayNudge(at, now, state)) {
      const i18n = createTranslator(useAppStore.getState().preferences.language);
      await Notifications.scheduleNotificationAsync({
        identifier: OUTING_ID,
        content: { title: i18n.t("reminders.outingTitle"), body: i18n.t(variantKey("reminders.outingBody", String(at))), data: { url: "/(tabs)" } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
      }).catch(() => undefined);
      state.nudges.push({ at, lat: state.anchor.lat, lng: state.anchor.lng });
      // The time only, never the place: the server learns from what follows and shares the budget.
      const answer = await api<ServerOuting>("/v1/me/outing-nudges", { method: "POST", body: { at } }).catch(() => null);
      if (answer) keepServer(answer, state);
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

/** The options the updates were started with in this run: a change, or a new launch, restarts them. */
let startedFor: boolean | null = null;

/**
 * Turns the background updates on, once both permissions are there. Low power for the outing
 * nudge alone; with the driving warning, a fix about every minute at about 100 m, enough to read
 * a car's speed between two of them.
 */
export async function startOuting(): Promise<boolean> {
  if (!supported) return false;
  const background = await Location.getBackgroundPermissionsAsync().catch(() => null);
  if (!background?.granted) return false;
  const drive = await driveAlertEnabled();
  if (await Location.hasStartedLocationUpdatesAsync(OUTING_TASK).catch(() => false)) {
    if (startedFor === drive) return true;
    await Location.stopLocationUpdatesAsync(OUTING_TASK).catch(() => undefined);
  }
  try {
    await Location.startLocationUpdatesAsync(OUTING_TASK, {
      // Cell and Wi-Fi level: enough to tell "still at the same bar" from "moved on".
      accuracy: drive ? Location.Accuracy.Balanced : Location.Accuracy.Low,
      distanceInterval: 100,
      deferredUpdatesDistance: drive ? 0 : 200,
      deferredUpdatesInterval: (drive ? 1 : 5) * MINUTE_MS,
      timeInterval: (drive ? 1 : 5) * MINUTE_MS,
      activityType: Location.ActivityType.Other,
      pausesUpdatesAutomatically: true,
      showsBackgroundLocationIndicator: false,
    });
    startedFor = drive;
    return true;
  } catch {
    return false;
  }
}

/** Off: no more updates (unless the driving warning still needs them), no pending nudge, the last place forgotten. */
export async function stopOuting(): Promise<void> {
  if (useAppStore.getState().crewDetectOn) await stopCrewDetect();
  if (!supported) return;
  await syncLocationUpdates();
  await cancelNudge();
  await AsyncStorage.removeItem(STATE_KEY).catch(() => undefined);
}

/** The updates run while the outing nudge or the driving warning wants them, and stop otherwise. */
export async function syncLocationUpdates(): Promise<boolean> {
  if (!supported) return false;
  const drive = await driveAlertEnabled();
  if (!drive) await forgetDriving();
  if (useAppStore.getState().outingNudgeOn || drive) return startOuting();
  if (await Location.hasStartedLocationUpdatesAsync(OUTING_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(OUTING_TASK).catch(() => undefined);
  }
  startedFor = null;
  return false;
}

/** At launch: keeps the updates in line with the setting and the permission given in the phone's settings. */
export async function syncOuting(): Promise<void> {
  if (!supported) return;
  if (useAppStore.getState().outingNudgeOn) {
    if (!(await startOuting())) useAppStore.setState({ outingNudgeOn: false });
    else void refreshOutingHabit();
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

/** "Me détecter avec mon crew" off: the server forgets the last position at once. */
export async function stopCrewDetect(): Promise<void> {
  useAppStore.setState({ crewDetectOn: false });
  await api("/v1/me/whereabouts", { method: "DELETE" }).catch(() => undefined);
}

/** At launch: the habit the server learnt, for the phone's own nudge. */
export async function refreshOutingHabit(): Promise<void> {
  if (!useAppStore.getState().outingNudgeOn) return;
  const answer = await api<ServerOuting>("/v1/me/outing-habit").catch(() => null);
  if (!answer) return;
  const state = await readState();
  keepServer(answer, state);
  await writeState(state);
}
