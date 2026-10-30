import { haptic } from "@/motion/haptics";
import { scheduleHomeCheck } from "@/reminders/reminders";
import { useCrewData } from "@/server/crewData";

type AlertType = "party.unwell" | "party.quiet" | "party.danger" | "party.homeCheck";

/** N-36 comes in two waves (nearest first, then everyone): the second stays silent for those already told. */
const unwellFelt = new Set<string>();

/**
 * Live-socket alerts about the night (N-25, N-29, N-36, O-88). The server sends each once; the
 * banners on the Party screen carry the words and the actions. This makes the phone felt and, for
 * the home check, asks through a local notification in case the app is in the background.
 */
export function onPartyAlert(type: AlertType, partyId: string, userId?: string): void {
  if (type === "party.homeCheck") {
    const party = useCrewData.getState().parties.find((p) => p.id === partyId);
    if (party) void scheduleHomeCheck({ ...party, endsAt: Date.now() }).catch(() => undefined);
    return;
  }
  if (type === "party.unwell") {
    const key = `${partyId}:${userId ?? ""}`;
    if (unwellFelt.has(key)) return;
    unwellFelt.add(key);
  }
  // A danger is worth more than a tap on the shoulder.
  if (type === "party.danger") haptic.heavy();
  else haptic.error();
}
