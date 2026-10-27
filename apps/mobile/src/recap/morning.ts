import { router } from "expo-router";
import { useEffect } from "react";
import { useCrewData } from "@/server/crewData";
import { useAppStore } from "@/state/store";

const HOUR_MS = 3_600_000;
/** The morning after: from 6 am to 4 pm, within 20 hours of the party closing (QOL-20). */
const MORNING_FROM_HOUR = 6;
const MORNING_UNTIL_HOUR = 16;
const MORNING_WITHIN_MS = 20 * HOUR_MS;

export function morningParty(now = Date.now()): { id: string; name: string } | null {
  const hour = new Date(now).getHours();
  if (hour < MORNING_FROM_HOUR || hour >= MORNING_UNTIL_HOUR) return null;
  const shown = useAppStore.getState().morningShown;
  const party = useCrewData
    .getState()
    .parties.filter((p) => p.myResponse === "going" && p.closedAt !== null && now - p.closedAt < MORNING_WITHIN_MS && !shown.includes(p.id))
    .sort((a, b) => b.closedAt! - a.closedAt!)[0];
  return party ? { id: party.id, name: party.name } : null;
}

export function markMorningShown(partyId: string): void {
  const shown = useAppStore.getState().morningShown;
  if (!shown.includes(partyId)) useAppStore.setState({ morningShown: [...shown, partyId].slice(-40) });
}

/** Opens the calm morning screen once per party, the first time the app comes up the morning after. */
export function useMorningAfter(): void {
  const parties = useCrewData((state) => state.parties);
  useEffect(() => {
    const party = morningParty();
    if (!party) return;
    markMorningShown(party.id);
    router.push({ pathname: "/morning", params: { id: party.id } });
  }, [parties]);
}
