import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { AppState } from "@/state/store";

/**
 * O-07 the other way round: deleting the app is not deleting one's data. iOS empties the app's
 * folder when it is deleted but keeps its Keychain items, so a compact copy of what matters most
 * lives there and comes back on the first launch of a reinstall: age check, consent and body
 * profile, settings, custom drinks and the recent drinks and water. Only "Supprimer mon compte" /
 * "Tout effacer" in Settings erases it. On Android, Google's automatic backup brings the app data
 * back instead (app.json allowBackup); this copy is kept there too for a reinstall without backup.
 *
 * The item never leaves the device (…THIS_DEVICE_ONLY): no iCloud Keychain, no other phone.
 */
export const KEPT_COPY_KEY = "crew.kept.v1";

type Kept = Pick<AppState, "ageConfirmedAt" | "profile" | "preferences" | "customDrinks" | "drinks" | "water">;
interface KeptCopy extends Kept {
  v: 1;
  savedAt: number;
}

const DAY_MS = 86_400_000;
/** Recent enough to rebuild tonight's estimate and the last weeks' stats. */
const KEEP_DAYS = 45;
const MAX_ENTRIES = 400;
/** A Keychain item is meant to stay small: past this, older entries are dropped first. */
const MAX_BYTES = 120_000;

function copyOf(state: Kept, now: number): KeptCopy {
  const since = now - KEEP_DAYS * DAY_MS;
  let drinks = state.drinks.filter((d) => d.consumedAt >= since).slice(-MAX_ENTRIES);
  let water = state.water.filter((w) => w.at >= since).slice(-MAX_ENTRIES);
  let copy: KeptCopy = { v: 1, savedAt: now, ageConfirmedAt: state.ageConfirmedAt, profile: state.profile, preferences: state.preferences, customDrinks: state.customDrinks, drinks, water };
  while (JSON.stringify(copy).length > MAX_BYTES && (drinks.length > 0 || water.length > 0)) {
    drinks = drinks.slice(Math.ceil(drinks.length / 2));
    water = water.slice(Math.ceil(water.length / 2));
    copy = { ...copy, drinks, water };
  }
  return copy;
}

async function write(copy: KeptCopy | null): Promise<void> {
  if (Platform.OS === "web") return;
  if (copy === null) {
    await SecureStore.deleteItemAsync(KEPT_COPY_KEY).catch(() => undefined);
    return;
  }
  await SecureStore.setItemAsync(KEPT_COPY_KEY, JSON.stringify(copy), { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }).catch(() => undefined);
}

/**
 * After the store is read back from disk: an empty store with a kept copy is a reinstall, and the
 * copy fills it before anything is shown, so the person lands where they were, not on the age gate.
 * Returns what to merge into the store, or null.
 */
export async function keptCopyFor(state: Kept | undefined): Promise<Partial<Kept> | null> {
  if (Platform.OS === "web" || !state) return null;
  const empty = state.ageConfirmedAt === null && state.profile === null && state.drinks.length === 0 && state.customDrinks.length === 0;
  if (!empty) return null;
  try {
    const raw = await SecureStore.getItemAsync(KEPT_COPY_KEY);
    if (!raw) return null;
    const copy = JSON.parse(raw) as KeptCopy;
    if (copy.v !== 1) return null;
    return {
      ageConfirmedAt: copy.ageConfirmedAt,
      profile: copy.profile,
      preferences: { ...state.preferences, ...copy.preferences },
      customDrinks: copy.customDrinks ?? [],
      drinks: copy.drinks ?? [],
      water: copy.water ?? [],
    };
  } catch {
    return null;
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
let stopped = false;

/** The reset in Settings: no copy may be written back between the erase and the restart. */
export function stopKeptCopy(): void {
  stopped = true;
  clearTimeout(timer);
}

/** Keeps the copy current a few seconds after what it holds changes. */
export function watchKeptCopy(store: { getState: () => AppState; subscribe: (listener: (state: AppState, previous: AppState) => void) => () => void }): void {
  if (Platform.OS === "web") return;
  store.subscribe((state, previous) => {
    if (!state.hydrated || stopped) return;
    if (
      state.ageConfirmedAt === previous.ageConfirmedAt &&
      state.profile === previous.profile &&
      state.preferences === previous.preferences &&
      state.customDrinks === previous.customDrinks &&
      state.drinks === previous.drinks &&
      state.water === previous.water
    )
      return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (stopped) return;
      const now = store.getState();
      // Nothing worth keeping yet (or it was all erased): no item at all.
      void write(now.ageConfirmedAt === null && now.profile === null ? null : copyOf(now, Date.now()));
    }, 4000);
  });
}
