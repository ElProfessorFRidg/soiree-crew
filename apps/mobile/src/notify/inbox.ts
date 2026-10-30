import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { create } from "zustand";
import { api } from "@/server/api";

/** QOL-30: the server's fixed taxonomy (apps/server/src/notifications/kinds.ts). */
export const NOTIFICATION_KINDS = [
  "outCall",
  "round",
  "recapReady",
  "takeover",
  "overtaken",
  "cheatAttempt",
  "sos",
  "quietMember",
  "unwell",
  "homeCheck",
  "notHome",
  "newDevice",
  "chatMessage",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
export const CHANNELS = ["safety", "plans", "party", "game", "messages", "account"] as const;
export type Channel = (typeof CHANNELS)[number];

export function isKind(value: unknown): value is NotificationKind {
  return typeof value === "string" && (NOTIFICATION_KINDS as readonly string[]).includes(value);
}

export interface InboxItem {
  id: string;
  kind: string;
  partyId: string | null;
  crewId: string | null;
  actorId: string | null;
  refId: string | null;
  params: Record<string, string | number | boolean>;
  count: number;
  at: number;
  readAt: number | null;
}

interface InboxState {
  items: InboxItem[];
  unread: number;
  loaded: boolean;
}

export const useInbox = create<InboxState>(() => ({ items: [], unread: 0, loaded: false }));

/** The app icon badge follows the unread count; it clears once everything is seen (QOL-03). */
function syncBadge(unread: number): void {
  if (Platform.OS === "web") return;
  void Notifications.setBadgeCountAsync(unread).catch(() => undefined);
}

export async function refreshInbox(): Promise<InboxItem[]> {
  const data = await api<{ items: InboxItem[]; unread: number }>("/v1/notifications");
  useInbox.setState({ items: data.items, unread: data.unread, loaded: true });
  syncBadge(data.unread);
  return data.items;
}

/** Optimistic: the dot goes at once; the server count wins when it answers. */
export async function markRead(ids: string[] | "all"): Promise<void> {
  const now = Date.now();
  useInbox.setState((state) => {
    const items = state.items.map((item) => (item.readAt === null && (ids === "all" || ids.includes(item.id)) ? { ...item, readAt: now } : item));
    return { items, unread: ids === "all" ? 0 : Math.max(0, state.unread - state.items.filter((i) => i.readAt === null && ids.includes(i.id)).length) };
  });
  syncBadge(useInbox.getState().unread);
  const { unread } = await api<{ unread: number }>("/v1/notifications/read", { method: "POST", body: ids === "all" ? { all: true } : { ids } });
  useInbox.setState({ unread });
  syncBadge(unread);
}

export function clearInbox(): void {
  useInbox.setState({ items: [], unread: 0, loaded: false });
  syncBadge(0);
}

/** Where an item leads once opened: the id resolves to a screen (O-38, QOL-03 "deep-links to the exact item"). */
export function itemRoute(item: Pick<InboxItem, "kind" | "partyId" | "refId">): string {
  const party = item.partyId ? encodeURIComponent(item.partyId) : null;
  const ref = item.refId ? encodeURIComponent(item.refId) : null;
  switch (item.kind) {
    case "recapReady":
      return party ? `/recap?id=${party}` : "/recaps";
    case "round":
      return party ? `/round?partyId=${party}` : "/(tabs)";
    case "takeover":
    case "cheatAttempt":
      return ref ? `/venue?id=${ref}` : "/(tabs)/bars";
    case "overtaken":
    case "quietMember":
    case "unwell":
    case "notHome":
      return party ? `/live?id=${party}` : "/(tabs)";
    case "chatMessage":
      return ref ? `/chat/${ref}` : "/messages";
    case "newDevice":
      return "/settings?section=security";
    case "outCall":
      return "/(tabs)/crew";
    default:
      return "/(tabs)";
  }
}
