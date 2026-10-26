import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { getCalendars, getLocales } from "expo-localization";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { UiLevel, UiLevelState } from "@crew/bac";
import { defaultPreferences, type UserPreferences } from "@crew/units";
import type { DrinkPreset } from "@/drinks/presets";
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
  manualLevel: UiLevel | null;
  levelState: UiLevelState | null;
  outbox: PendingMutation[];
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
      manualLevel: null,
      levelState: null,
      outbox: [],
    }),
    {
      name: "crew-app-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hydrated: _hydrated, ...rest }) => rest,
      onRehydrateStorage: () => () => {
        useAppStore.setState({ hydrated: true });
      },
    },
  ),
);

export const newId = (): string => randomUUID();

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
    sync: "pending",
  };
}

export function buildWater(at: number): WaterEntry {
  return { id: newId(), at, sync: "pending" };
}
