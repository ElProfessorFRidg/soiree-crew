import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { getCalendars, getLocales } from "expo-localization";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { UiLevel, UiLevelState } from "@crew/bac";
import { defaultPreferences, type UserPreferences } from "@crew/units";
import type { VaultItem } from "@/vault/vault";
import type { CustomDrink, DrinkPreset } from "@/drinks/presets";
import type { DrinkEntry, Mutation, PendingMutation, StoredProfile, SyncState, WaterEntry } from "@/sync/types";

function deviceDefaults(): UserPreferences {
  const locales = getLocales();
  const calendar = getCalendars()[0];
  return defaultPreferences({
    languageTags: locales.map((locale) => locale.languageTag),
    region: locales[0]?.regionCode ?? null,
    uses24HourClock: calendar?.uses24hourClock ?? null,
  });
}

export interface AppState {
  hydrated: boolean;
  ageConfirmedAt: number | null;
  profile: StoredProfile | null;
  preferences: UserPreferences;
  drinks: DrinkEntry[];
  water: WaterEntry[];
  customDrinks: CustomDrink[];
  manualLevel: UiLevel | null;
  levelState: UiLevelState | null;
  outbox: PendingMutation[];
  /** Server time of the last delta sync. */
  syncCursor: number | null;
  /** Set once the history logged before the account was sent to the server. */
  uploadedToServerAt: number | null;
  /** Account the local history belongs to; null while it only lives on this phone. */
  accountUserId: string | null;
  /** Parties whose morning-after screen was already shown or dismissed (QOL-20). */
  morningShown: string[];
  /** Parties whose "recap ready" notification is already scheduled or sent (O-41). */
  recapNotified: string[];
  /** Sensitive actions waiting for the next morning (ADP-06). */
  vault: VaultItem[];
  /** PREF-05: a country the user chose not to switch to; asked again only for another one. */
  travelDismissed: string | null;
  /** O-10: the 12 h / 24 h format follows the phone until the user picks one by hand. */
  hourCycleFollowsPhone: boolean;
  /** O-12: ask GitHub once a day whether a newer build exists. */
  checkUpdates: boolean;
  updateCheckedAt: number | null;
  latestRelease: { build: number; url: string } | null;
  /** QOL-23: the last few searches, newest first, on this phone only. */
  recentSearches: string[];
  /** PROF-10: the privacy summary opened once, the first time something went public. */
  privacySummarySeen: boolean;
  /** O-69: what the mixer thinks is in the fridge. */
  barHave: string[];
  /** JOY-05: the sound pack, off until switched on. */
  soundsOn: boolean;
  /** QOL-32: when the logging nudge was last answered. */
  nudgeDismissedAt: number | null;
}

export const useAppStore = create<AppState>()(
  persist(
    (): AppState => ({
      hydrated: false,
      ageConfirmedAt: null,
      profile: null,
      preferences: deviceDefaults(),
      drinks: [],
      water: [],
      customDrinks: [],
      manualLevel: null,
      levelState: null,
      outbox: [],
      syncCursor: null,
      uploadedToServerAt: null,
      accountUserId: null,
      morningShown: [],
      recapNotified: [],
      vault: [],
      travelDismissed: null,
      hourCycleFollowsPhone: true,
      checkUpdates: true,
      updateCheckedAt: null,
      latestRelease: null,
      recentSearches: [],
      privacySummarySeen: false,
      barHave: [],
      soundsOn: false,
      nudgeDismissedAt: null,
    }),
    {
      name: "crew-app-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hydrated: _hydrated, ...rest }) => rest,
      // Settings added in a later version get their default instead of undefined.
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<AppState>;
        return { ...current, ...stored, preferences: { ...current.preferences, ...stored.preferences } };
      },
      onRehydrateStorage: () => () => {
        useAppStore.setState({ hydrated: true });
        followPhoneHourCycle();
      },
    },
  ),
);

export const newId = (): string => randomUUID();

/** O-10: the phone's current 12 h / 24 h setting, read again whenever the app comes back. */
export function followPhoneHourCycle(): void {
  const state = useAppStore.getState();
  if (!state.hourCycleFollowsPhone) return;
  const phone = deviceDefaults().hourCycle;
  // This phone's clock is a local matter: other devices keep following their own.
  if (phone !== state.preferences.hourCycle) useAppStore.setState({ preferences: { ...state.preferences, hourCycle: phone } });
}

// Optimistic reducers: each mutation is applied at once and can be reverted if the server refuses it.

export function applyMutation(mutation: Mutation): void {
  useAppStore.setState((state) => {
    switch (mutation.kind) {
      case "drink.add":
        return { drinks: [...state.drinks.filter((d) => d.id !== mutation.drink.id), mutation.drink] };
      case "drink.remove":
        return { drinks: state.drinks.filter((d) => d.id !== mutation.drink.id) };
      case "water.add":
        return { water: [...state.water.filter((w) => w.id !== mutation.water.id), mutation.water] };
      case "water.remove":
        return { water: state.water.filter((w) => w.id !== mutation.water.id) };
      case "profile.set":
        return { profile: mutation.profile };
      case "preferences.set":
        return { preferences: { ...state.preferences, ...mutation.patch } };
      case "uiLevel.set":
        return { manualLevel: mutation.manual };
      case "customDrink.set":
        return { customDrinks: [...state.customDrinks.filter((d) => d.id !== mutation.drink.id), mutation.drink] };
      case "customDrink.remove":
        return { customDrinks: state.customDrinks.filter((d) => d.id !== mutation.drink.id) };
    }
  });
}

export function revertMutation(mutation: Mutation): void {
  switch (mutation.kind) {
    case "drink.add":
      return applyMutation({ kind: "drink.remove", drink: mutation.drink });
    case "drink.remove":
      return applyMutation({ kind: "drink.add", drink: { ...mutation.drink, sync: "saved" } });
    case "water.add":
      return applyMutation({ kind: "water.remove", water: mutation.water });
    case "water.remove":
      return applyMutation({ kind: "water.add", water: { ...mutation.water, sync: "saved" } });
    case "profile.set":
      useAppStore.setState({ profile: mutation.previous });
      return;
    case "preferences.set":
      return applyMutation({ kind: "preferences.set", patch: mutation.previous, previous: {} });
    case "uiLevel.set":
      return applyMutation({ kind: "uiLevel.set", manual: mutation.previous, previous: null });
    case "customDrink.set":
      if (mutation.previous) return applyMutation({ kind: "customDrink.set", drink: mutation.previous, previous: null });
      return applyMutation({ kind: "customDrink.remove", drink: mutation.drink });
    case "customDrink.remove":
      return applyMutation({ kind: "customDrink.set", drink: mutation.drink, previous: null });
  }
}

export function setSyncState(mutation: Mutation, sync: SyncState): void {
  useAppStore.setState((state) => {
    if (mutation.kind === "drink.add") {
      return { drinks: state.drinks.map((d) => (d.id === mutation.drink.id ? { ...d, sync } : d)) };
    }
    if (mutation.kind === "water.add") {
      return { water: state.water.map((w) => (w.id === mutation.water.id ? { ...w, sync } : w)) };
    }
    return {};
  });
}

export function buildDrink(preset: DrinkPreset, consumedAt: number, withFood: boolean): DrinkEntry {
  return {
    id: newId(),
    presetId: preset.id,
    kind: preset.kind,
    volumeMl: preset.volumeMl,
    abv: preset.abv,
    consumedAt,
    loggedAt: Date.now(),
    withFood,
    ...(preset.name ? { name: preset.name } : {}),
    sync: "pending",
  };
}

export function buildWater(at: number): WaterEntry {
  return { id: newId(), at, sync: "pending" };
}

/** O-13: one account's history never shows under another account on the same phone. */
export function clearAccountHistory(): void {
  useAppStore.setState({
    drinks: [],
    water: [],
    customDrinks: [],
    outbox: [],
    syncCursor: null,
    uploadedToServerAt: null,
    accountUserId: null,
  });
}
