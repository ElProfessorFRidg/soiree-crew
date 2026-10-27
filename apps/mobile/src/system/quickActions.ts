import { useEffect } from "react";
import { Platform } from "react-native";
import * as QuickActions from "expo-quick-actions";
import { useQuickActionRouting } from "expo-quick-actions/router";
import { lastDrink, logDrink, logWater } from "@/drinks/actions";
import { defaultPreset, presetFromEntry } from "@/drinks/presets";
import { offerUndo, offerWaterUndo } from "@/drinks/undoToast";
import type { Translator } from "@/i18n";
import { useAppStore } from "@/state/store";

export type QuickAction = "again" | "water";

/**
 * QOL-04: the same thing as the big buttons on the party screen, from outside the app. A long
 * press on the icon, a deep link (soireecrew://quick/again) for the Action Button or a Shortcut.
 */
export function runQuickAction(action: QuickAction, i18n: Translator): void {
  if (action === "water") {
    const water = logWater();
    if (water) offerWaterUndo(water, i18n);
    return;
  }
  const { preferences } = useAppStore.getState();
  const last = lastDrink();
  const drink = logDrink(last ? presetFromEntry(last) : defaultPreset(preferences.unitSystem), Date.now(), false);
  if (drink) offerUndo(drink, i18n, preferences.hourCycle);
}

/** Sets the icon's long-press menu in the app language and answers it. Mounted in the tabs layout. */
export function useHomeScreenActions(i18n: Translator): void {
  useEffect(() => {
    if (Platform.OS === "web") return;
    void QuickActions.setItems([
      { id: "again", title: i18n.t("quick.again"), icon: Platform.OS === "ios" ? "symbol:plus.circle.fill" : undefined, params: { href: "/quick/again" } },
      { id: "water", title: i18n.t("quick.water"), icon: Platform.OS === "ios" ? "symbol:drop.fill" : undefined, params: { href: "/quick/water" } },
      { id: "add", title: i18n.t("quick.add"), icon: Platform.OS === "ios" ? "symbol:list.bullet" : undefined, params: { href: "/add-drink" } },
      { id: "sos", title: i18n.t("quick.sos"), icon: Platform.OS === "ios" ? "symbol:sos" : undefined, params: { href: "/sos" } },
    ]).catch(() => undefined);
  }, [i18n]);
  useQuickActionRouting();
}
