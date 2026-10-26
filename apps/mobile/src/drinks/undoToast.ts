import type { Translator } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { haptic } from "@/motion/haptics";
import type { DrinkEntry } from "@/sync/types";
import { showToast } from "@/ui/Toast";
import { removeDrink } from "./actions";
import { drinkLabel } from "./display";
import { findPreset } from "./presets";

/** Every logged drink gets 5 s to be undone with a big button (ADP-04). */
export function offerUndo(drink: DrinkEntry, i18n: Translator, hourCycle: "h12" | "h23"): void {
  const name = drinkLabel(drink.kind, i18n);
  const time = formatClock(drink.consumedAt, i18n.language, hourCycle);
  const key = findPreset(drink.presetId)?.feminine ? "party.addedFeminine" : "party.added";
  showToast({
    message: i18n.t(key, { drink: name, time }),
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
