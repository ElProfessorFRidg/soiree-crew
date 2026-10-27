import type { Translator } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { haptic } from "@/motion/haptics";
import { crossesPersonalLimit } from "@/reminders/reminders";
import type { DrinkEntry, WaterEntry } from "@/sync/types";
import { showToast } from "@/ui/Toast";
import { removeDrink, removeWater } from "./actions";
import { drinkLabel } from "./display";
import { findPreset } from "./presets";

/** Every logged drink gets 5 s to be undone with a big button (ADP-04). */
export function offerUndo(drink: DrinkEntry, i18n: Translator, hourCycle: "h12" | "h23"): void {
  const name = drinkLabel(drink, i18n);
  const time = formatClock(drink.consumedAt, i18n.language, hourCycle);
  const key =
    drink.kind === "custom" ? "party.addedNamed" : findPreset(drink.presetId)?.feminine ? "party.addedFeminine" : "party.added";
  let message = i18n.t(key, { drink: name, time });
  const limit = crossesPersonalLimit();
  if (limit.crosses && limit.at !== null) {
    // The one moment the warning is useful: right when the drink that causes it is logged.
    haptic.error();
    message = `${message}. ${i18n.t("reminders.limitToast", { time: formatClock(limit.at, i18n.language, hourCycle) })}`;
  }
  showToast({
    message,
    durationMs: 5_000,
    action: {
      label: i18n.t("common.undo"),
      onPress: () => {
        haptic.select();
        removeDrink(drink);
      },
    },
  });
}

/** A glass of water logged by mistake can be taken back the same way (ADP-09). */
export function offerWaterUndo(water: WaterEntry, i18n: Translator): void {
  showToast({
    message: i18n.t("party.waterAdded"),
    durationMs: 5_000,
    action: {
      label: i18n.t("common.undo"),
      onPress: () => {
        haptic.select();
        removeWater(water);
      },
    },
  });
}
