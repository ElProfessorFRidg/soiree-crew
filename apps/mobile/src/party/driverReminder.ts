import { useEffect } from "react";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { setPartyStatus, useCrewData } from "@/server/crewData";
import { showFailure } from "@/server/errors";
import { useSession } from "@/server/session";
import { useAppStore } from "@/state/store";
import { showToast } from "@/ui/Toast";

/** A drink logged this long after it was drunk is a catch-up, not a drink in hand: still worth the reminder. */
const FRESH_MS = 3 * 60 * 60_000;

/** The live party where I said I drive tonight, if any. */
function drivingParty(): string | null {
  const me = useSession.getState().session?.userId;
  if (!me) return null;
  const { parties, live } = useCrewData.getState();
  const now = Date.now();
  const party = parties.find((p) => p.myResponse === "going" && p.closedAt === null && p.startsAt <= now && p.endsAt >= now);
  if (!party) return null;
  return live[party.id]?.members.find((m) => m.userId === me)?.designatedDriver ? party.id : null;
}

/**
 * N-26: the designated driver logs a drink with alcohol, and the app says so at once, with the way
 * to hand the keys over. Mounted once, from the root layout.
 */
export function useDriverReminder(): void {
  const i18n = useT();
  useEffect(
    () =>
      useAppStore.subscribe((state, previous) => {
        if (state.drinks === previous.drinks || state.drinks.length <= previous.drinks.length) return;
        const known = new Set(previous.drinks.map((d) => d.id));
        const added = state.drinks.filter((d) => !known.has(d.id) && d.abv > 0 && Date.now() - d.consumedAt < FRESH_MS);
        if (!added.length) return;
        const partyId = drivingParty();
        if (!partyId) return;
        haptic.error();
        showToast({
          tone: "danger",
          message: i18n.t("party.driverDrink"),
          durationMs: 8_000,
          action: { label: i18n.t("party.driverHandOver"), onPress: () => void setPartyStatus(partyId, { designatedDriver: false }).catch(showFailure(i18n)) },
        });
      }),
    [i18n],
  );
}
