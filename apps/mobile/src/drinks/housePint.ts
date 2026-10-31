import { useEffect } from "react";
import { create } from "zustand";
import type { Translator } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { showFailure } from "@/server/errors";
import { fetchVenuePage, saveHousePint, useVenueData, type VenueKind } from "@/server/venueData";
import { showToast } from "@/ui/Toast";

interface HousePintEntry {
  abv: number | null;
  byName: string | null;
  venueName: string;
  kind: VenueKind;
}

/** House pints of the bars I was checked in at, as the server last said. A cache, never the truth. */
const useHousePints = create<{ byVenue: Record<string, HousePintEntry> }>(() => ({ byVenue: {} }));

const put = (venueId: string, entry: HousePintEntry) =>
  useHousePints.setState((state) => ({ byVenue: { ...state.byVenue, [venueId]: entry } }));

export async function loadHousePint(venueId: string): Promise<void> {
  const page = await fetchVenuePage(venueId);
  put(venueId, {
    abv: page.housePint?.abv ?? null,
    byName: page.housePint?.updatedByName ?? null,
    venueName: page.venue.name,
    kind: page.venue.kind,
  });
}

export interface HousePintHere {
  venueId: string;
  venueName: string;
  /** Null until someone of the crew sets it. */
  abv: number | null;
  byName: string | null;
}

/**
 * The bar I am checked in at and its house pint, or null away from a bar (home is not a bar).
 * Fetched fresh each time a screen using it mounts, so a strength set by the crew shows up.
 */
export function useHousePintHere(): HousePintHere | null {
  const open = useVenueData((state) => state.openCheckIn);
  const venueId = open?.venueId ?? null;
  const entry = useHousePints((state) => (venueId ? state.byVenue[venueId] : undefined));
  const summary = useVenueData((state) => {
    if (!venueId) return undefined;
    for (const crew of Object.values(state.byCrew)) {
      const found = crew.venues.find((v) => v.id === venueId);
      if (found) return found;
    }
    return undefined;
  });
  useEffect(() => {
    if (venueId) void loadHousePint(venueId).catch(() => undefined);
  }, [venueId]);
  if (!venueId) return null;
  const kind = entry?.kind ?? summary?.kind;
  if (!kind || kind === "home") return null;
  return {
    venueId,
    venueName: entry?.venueName ?? summary?.name ?? "",
    abv: entry ? entry.abv : (summary?.housePintAbv ?? null),
    byName: entry?.byName ?? null,
  };
}

/** Shown at once, sent to the server, rolled back with the reason if it refuses (SYNC-03). */
export async function setHousePint(here: HousePintHere, abv: number | null, i18n: Translator): Promise<void> {
  const before = useHousePints.getState().byVenue[here.venueId];
  const base: HousePintEntry = before ?? { abv: here.abv, byName: here.byName, venueName: here.venueName, kind: "bar" };
  put(here.venueId, { ...base, abv, byName: null });
  try {
    const saved = await saveHousePint(here.venueId, abv);
    put(here.venueId, { ...base, abv: saved.housePint?.abv ?? null, byName: null });
    haptic.confirmed();
    // News for the user: the whole crew now logs this strength here.
    if (abv !== null) showToast({ message: i18n.t("drinkCatalogue.housePintSaved") });
  } catch (error) {
    if (before) put(here.venueId, before);
    else useHousePints.setState((state) => ({ byVenue: Object.fromEntries(Object.entries(state.byVenue).filter(([id]) => id !== here.venueId)) }));
    haptic.error();
    showFailure(i18n)(error);
  }
}
