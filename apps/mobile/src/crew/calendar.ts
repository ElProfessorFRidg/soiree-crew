import * as Calendar from "expo-calendar/legacy";
import type { Translator } from "@/i18n";
import type { Party } from "@/server/crewData";
import { showToast } from "@/ui/Toast";

/**
 * N-06, QOL-21: the system's own "new event" form, filled in. The app never reads
 * the calendar; the user confirms or cancels in the form.
 */
export async function addPartyToCalendar(party: Party, crewName: string, i18n: Translator): Promise<void> {
  try {
    const result = await Calendar.createEventInCalendarAsync({
      title: party.name || i18n.t(`newParty.moods.${party.mood}` as "newParty.moods.party"),
      startDate: new Date(party.startsAt),
      endDate: new Date(party.endsAt),
      notes: crewName,
    });
    if (result.action === "saved") showToast({ message: i18n.t("crew.calendarAdded") });
  } catch {
    // A local failure (no calendar app, refused): nothing to do with the network.
    showToast({ tone: "danger", message: i18n.t("crew.calendarFailed") });
  }
}
