import { catalogueDrink, DRINK_CATALOGUE, shownNames, type ShownName } from "@crew/fuzzy";
import { CATALOGUE_PREFIX } from "./presets";

/**
 * Full and short names of logged and saved drinks. A drink logged from the catalogue keeps only its
 * name and its preset id (`cat:<id>`, synced as it is): the short form comes from the catalogue,
 * so nothing new is stored, on the phone or on the server.
 */

/** Catalogue names changed since drinks were logged with them: the old drinks show the new name. */
const RENAMED: Readonly<Record<string, string>> = { "Flash Poliakov + Red Bull": "Flash vodka Red Bull" };

export interface NamedDrink {
  kind: string;
  name?: string;
  /** A preset's id or a logged drink's preset id: `cat:poliakov-red-bull`, `custom:…`, `m-pint`. */
  id?: string;
  presetId?: string;
}

const fold = (name: string) => name.trim().toLowerCase();

let fullNames: Map<string, ShownName> | null = null;
/** Every full catalogue name to its short form, built on first use. */
function byFullName(): Map<string, ShownName> {
  if (!fullNames) {
    fullNames = new Map();
    for (const drink of DRINK_CATALOGUE) for (const shown of shownNames(drink)) if (!fullNames.has(fold(shown.name))) fullNames.set(fold(shown.name), shown);
  }
  return fullNames;
}

/**
 * The catalogue name a custom-kind drink carries, full and short, or null for a name the catalogue
 * does not know. A drink logged from the catalogue is matched on its own names, its short one
 * included (an earlier version logged "Flash vodka"); a saved drink named after a brand, on full names only.
 */
export function catalogueName(drink: NamedDrink): ShownName | null {
  if (drink.kind !== "custom" || !drink.name) return null;
  const name = fold(RENAMED[drink.name] ?? drink.name);
  const presetId = drink.presetId ?? drink.id ?? "";
  const own = presetId.startsWith(CATALOGUE_PREFIX) ? catalogueDrink(presetId.slice(CATALOGUE_PREFIX.length)) : undefined;
  const mine = own ? shownNames(own).find((shown) => fold(shown.name) === name || fold(shown.short) === name) : undefined;
  return mine ?? byFullName().get(name) ?? null;
}

/** A custom drink's name as shown in full, old catalogue names brought up to date. */
export function currentName(drink: NamedDrink): string | undefined {
  return catalogueName(drink)?.name ?? (drink.name ? (RENAMED[drink.name] ?? drink.name) : undefined);
}
