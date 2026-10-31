import type { Translator } from "@/i18n";
import { useAppStore } from "@/state/store";
import { nameToSave, savedMatch } from "./catalogue";
import { saveCustomDrink } from "./customDrinks";
import type { CustomDrink, DrinkPreset } from "./presets";

/** Name length the server accepts for a saved drink. */
const MAX_NAME = 40;

/** Saves a drink to "Mes boissons" once: the same name, size and strength is never saved twice. */
export function keepInMyDrinks(preset: DrinkPreset, i18n: Translator): CustomDrink {
  const existing = savedMatch(preset, useAppStore.getState().customDrinks, i18n);
  if (existing) return existing;
  return saveCustomDrink({ name: nameToSave(preset, i18n).slice(0, MAX_NAME), volumeMl: preset.volumeMl, abv: preset.abv, icon: preset.icon });
}
