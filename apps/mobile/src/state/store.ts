import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { Platform } from "react-native";
import { getCalendars, getLocales } from "expo-localization";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { FoodLevel, UiLevel, UiLevelState } from "@crew/bac";
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
  /** MOT-15: vibrations, on by default, switched separately from sounds. */
  hapticsOn: boolean;
  /** AC-12: this install's event chain and the nonces fetched in advance for offline writes. */
  installId: string | null;
  eventSeq: number;
  chainHead: string;
  nonceBook: { nonce: string; expiresAt: number }[];
  /** QOL-27: BAC figures on the lock screen and in notifications; off means time to zero only. */
  lockScreenNumbers: boolean;
  /** HUB-02: the iOS Live Activity of tonight, so a relaunch updates it instead of starting another. */
  liveActivityId: string | null;
  /** SLOP-11: the last variant shown of each recurring line, and for which occasion. */
  copyVariants: Record<string, { index: number; occasion: string }>;
  /** QOL-32: when the logging nudge was last answered. */
  nudgeDismissedAt: number | null;
  /** QOL-30: party reminders muted until this morning time. */
  remindersMutedUntil: number | null;
  /** O-85: what was eaten each evening, by night key; new drinks of that night start from it. */
  foodByNight: Record<string, FoodLevel>;
  /** N-28: someone to call or text from the SOS screen. Kept on this phone only. */
  emergencyContact: { name: string; phone: string } | null;
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
      hapticsOn: true,
      copyVariants: {},
      lockScreenNumbers: false,
      liveActivityId: null,
      installId: null,
      eventSeq: 0,
      chainHead: "",
      nonceBook: [],
      nudgeDismissedAt: null,
      remindersMutedUntil: null,
      foodByNight: {},
      emergencyContact: null,
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

/**
 * A v4 UUID. A browser on plain http (a LAN preview) has no crypto.randomUUID, only getRandomValues,
 * so the web falls back to building one from random bytes.
 */
export const newId = (): string => {
  const web = (globalThis as { crypto?: { randomUUID?: () => string; getRandomValues?: (bytes: Uint8Array) => Uint8Array } }).crypto;
  if (Platform.OS !== "web" || web?.randomUUID) return randomUUID();
  const bytes = web!.getRandomValues!(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

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
      case "drink.edit":
        return { drinks: state.drinks.map((d) => (d.id === mutation.drink.id ? mutation.drink : d)) };
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
    case "drink.edit":
      return applyMutation({ kind: "drink.edit", drink: { ...mutation.previous, sync: "saved" }, previous: mutation.previous });
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
    if (mutation.kind === "drink.add" || mutation.kind === "drink.edit") {
      return { drinks: state.drinks.map((d) => (d.id === mutation.drink.id ? { ...d, sync } : d)) };
    }
    if (mutation.kind === "water.add") {
      return { water: state.water.map((w) => (w.id === mutation.water.id ? { ...w, sync } : w)) };
    }
    return {};
  });
}

export function buildDrink(preset: DrinkPreset, consumedAt: number, food: FoodLevel): DrinkEntry {
  return {
    id: newId(),
    presetId: preset.id,
    kind: preset.kind,
    volumeMl: preset.volumeMl,
    abv: preset.abv,
    consumedAt,
    loggedAt: Date.now(),
    withFood: food !== "none",
    food,
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
    // Body, safety and night state are the previous person's too.
    profile: null,
    vault: [],
    levelState: null,
    manualLevel: null,
    foodByNight: {},
    emergencyContact: null,
    morningShown: [],
    recapNotified: [],
    nudgeDismissedAt: null,
    remindersMutedUntil: null,
    // AC-12: the server ties an install's chain to one account; another account starts a new one.
    installId: null,
    eventSeq: 0,
    chainHead: "",
    nonceBook: [],
    drinks: [],
    water: [],
    customDrinks: [],
    outbox: [],
    syncCursor: null,
    uploadedToServerAt: null,
    accountUserId: null,
  });
}
