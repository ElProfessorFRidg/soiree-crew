import { create } from "zustand";
import { scheduleBirthdayReminders, schedulePartyReminders } from "@/reminders/reminders";
import { useAppStore } from "@/state/store";
import { phoneTimeZone } from "@/system/timeZone";
import { api } from "./api";
import { useCrewData } from "./crewData";
import { useSession } from "./session";

/** QOL-02: the server counts nights on the person's clock; it learns the time zone from the phone. */
export async function sendClock(): Promise<void> {
  const session = useSession.getState().session;
  const zone = phoneTimeZone();
  if (!session || !zone) return;
  const key = `${session.userId}:${zone}`;
  if (useAppStore.getState().clockSent === key) return;
  await api("/v1/me/clock", { method: "PUT", body: { timeZone: zone } });
  useAppStore.setState({ clockSent: key });
}

/** N-06: my private feed of a crew's parties, as an https link; null until made. */
export async function fetchCalendarFeed(crewId: string): Promise<string | null> {
  return (await api<{ url: string | null }>(`/v1/crews/${crewId}/calendar`)).url;
}

/** Makes the link, or a new one in place of the old (which stops working at once). */
export async function resetCalendarFeed(crewId: string): Promise<string> {
  return (await api<{ url: string }>(`/v1/crews/${crewId}/calendar`, { method: "POST" })).url;
}

export function revokeCalendarFeed(crewId: string): Promise<unknown> {
  return api(`/v1/crews/${crewId}/calendar`, { method: "DELETE" });
}

/** Calendar apps subscribe to webcal:// links; the feed itself is served over https. */
export function webcalUrl(url: string): string {
  return url.replace(/^https?:\/\//, "webcal://");
}

export interface Birthday {
  userId: string;
  name: string;
  month: number;
  day: number;
  /** Next occurrence, YYYY-MM-DD, today included. */
  date: string;
  inDays: number;
}

export const useBirthdays = create<{ byCrew: Record<string, Birthday[]> }>(() => ({ byCrew: {} }));

/** QOL-21: crew mates' birthdays of the next two weeks, as far as each one allows. */
export async function refreshBirthdays(crewId: string): Promise<Birthday[]> {
  const { birthdays } = await api<{ birthdays: Birthday[] }>(`/v1/crews/${crewId}/birthdays`);
  useBirthdays.setState((state) => ({ byCrew: { ...state.byCrew, [crewId]: birthdays } }));
  return birthdays;
}

/**
 * N-06, QOL-21: local reminders for parties I said yes to and for crew mates' birthdays,
 * scheduled on the phone. Runs at launch, on return to the app and whenever parties change.
 */
export async function refreshCalendarReminders(): Promise<void> {
  if (!useSession.getState().session) return;
  const { crews, parties } = useCrewData.getState();
  const crewName = new Map(crews.map((c) => [c.id, c.name]));
  await schedulePartyReminders(parties.map((p) => ({ ...p, crewName: crewName.get(p.crewId) ?? "" }))).catch(() => undefined);
  const lists = await Promise.all(crews.map((c) => refreshBirthdays(c.id).then((list) => list.map((b) => ({ ...b, crewId: c.id }))).catch(() => [])));
  await scheduleBirthdayReminders(lists.flat()).catch(() => undefined);
}

let watching = false;
/** Parties change through the socket and pull-to-refresh: reminders follow without a screen asking. */
export function watchCalendarReminders(): void {
  if (watching) return;
  watching = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  useCrewData.subscribe((state, previous) => {
    if (state.parties === previous.parties && state.crews === previous.crews) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void refreshCalendarReminders(), 1_500);
  });
}
