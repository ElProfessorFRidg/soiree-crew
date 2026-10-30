import { AppState, Platform } from "react-native";
import { lastDrink, logDrink } from "@/drinks/actions";
import { defaultPreset, presetFromEntry } from "@/drinks/presets";
import { buildWater, useAppStore } from "@/state/store";
import { submit } from "@/sync/engine";
import { refreshWidget } from "./handler";
import { takeQueue } from "./queue";

let timer: ReturnType<typeof setTimeout> | undefined;

/** QOL-25: what was tapped on the widget becomes real drinks and water, at the time of each tap. */
export async function drainWidgetQueue(): Promise<void> {
  if (Platform.OS !== "android") return;
  // Never before the app's own state is loaded: hydration would overwrite what is added here.
  if (!useAppStore.persist.hasHydrated()) await new Promise<void>((resolve) => useAppStore.persist.onFinishHydration(() => resolve()));
  const taps = await takeQueue();
  for (const tap of taps) {
    if (tap.kind === "water") submit({ kind: "water.add", water: buildWater(tap.at) });
    else {
      const last = lastDrink();
      logDrink(last ? presetFromEntry(last) : defaultPreset(useAppStore.getState().preferences.unitSystem), tap.at, null, true);
    }
  }
}

/** Keeps the Android widget in step with what is logged in the app (after storage has caught up). */
export function watchWidget(): void {
  if (Platform.OS !== "android") return;
  void drainWidgetQueue();
  AppState.addEventListener("change", (status) => {
    if (status === "active") void drainWidgetQueue();
  });
  useAppStore.subscribe((state, previous) => {
    if (state.drinks === previous.drinks && state.water === previous.water && state.lockScreenNumbers === previous.lockScreenNumbers && state.preferences === previous.preferences) return;
    clearTimeout(timer);
    timer = setTimeout(() => void refreshWidget().catch(() => undefined), 1500);
  });
}
