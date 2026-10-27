import { newId, useAppStore } from "@/state/store";
import { submit } from "@/sync/engine";
import type { CustomDrink } from "./presets";

export interface CustomDrinkDraft {
  name: string;
  volumeMl: number;
  abv: number;
}

export const CUSTOM_BOUNDS = {
  volumeMl: { min: 10, max: 1500 },
  abvPercent: { min: 0, max: 80 },
} as const;

/** Creates a drink, or updates it in place when `existing` is given. Synced like any other change (O-21). */
export function saveCustomDrink(draft: CustomDrinkDraft, existing?: CustomDrink): CustomDrink {
  const all = useAppStore.getState().customDrinks;
  const drink: CustomDrink = {
    id: existing?.id ?? newId(),
    name: draft.name.trim(),
    volumeMl: draft.volumeMl,
    abv: draft.abv,
    icon: existing?.icon ?? (draft.abv >= 0.2 ? "shot" : draft.volumeMl >= 400 ? "pint" : "cocktail"),
    order: existing?.order ?? all.reduce((max, d) => Math.max(max, d.order), -1) + 1,
  };
  submit({ kind: "customDrink.set", drink, previous: existing ?? null });
  return drink;
}

export function removeCustomDrink(drink: CustomDrink): void {
  submit({ kind: "customDrink.remove", drink });
}

export function restoreCustomDrink(drink: CustomDrink): void {
  submit({ kind: "customDrink.set", drink, previous: null });
}

export function sortedCustomDrinks(drinks: readonly CustomDrink[]): CustomDrink[] {
  return [...drinks].sort((a, b) => a.order - b.order);
}
