import type { GlassIconName } from "@crew/design-tokens";
import { newId, useAppStore } from "@/state/store";
import { submit } from "@/sync/engine";
import { guessIcon, moveInOrder } from "./customOrder";
import type { CustomDrink } from "./presets";

export interface CustomDrinkDraft {
  name: string;
  volumeMl: number;
  abv: number;
  /** Picked in the editor; guessed from size and strength when left alone. */
  icon?: GlassIconName;
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
    icon: draft.icon ?? existing?.icon ?? guessIcon(draft.volumeMl, draft.abv),
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

/** O-21: one step up or down in the user's own order, synced to the other devices like an edit. */
export function moveCustomDrink(id: string, delta: -1 | 1): boolean {
  const all = useAppStore.getState().customDrinks;
  const changed = moveInOrder(all, id, delta);
  for (const drink of changed) submit({ kind: "customDrink.set", drink, previous: all.find((d) => d.id === drink.id) ?? null });
  return changed.length > 0;
}

export function sortedCustomDrinks(drinks: readonly CustomDrink[]): CustomDrink[] {
  return [...drinks].sort((a, b) => a.order - b.order);
}
