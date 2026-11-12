import type { Translator } from "@/i18n";
import type { DrinkEntry } from "@/sync/types";
import { drinkLabel } from "./display";
import type { DrinkKind } from "./presets";

/**
 * The label of a favourite kind on a profile. "custom" is the generic kind of a drink the person named
 * themselves: the server only knows the kind. On my own profile the phone knows the name (the one I logged
 * most); for anyone else it says what it is rather than the bare "Drink".
 */
export function favouriteLabel(kind: string, mine: boolean, drinks: readonly DrinkEntry[], i18n: Translator): string {
  if (kind !== "custom") return drinkLabel({ kind: kind as DrinkKind }, i18n);
  if (mine) {
    const counts = new Map<string, number>();
    for (const d of drinks) if (d.kind === "custom" && d.name) counts.set(d.name, (counts.get(d.name) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (top) return drinkLabel({ kind: "custom", name: top }, i18n);
  }
  return i18n.t("people.favouriteOther");
}
