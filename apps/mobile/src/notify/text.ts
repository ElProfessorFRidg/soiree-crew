import type { MessageKey, Translator } from "@/i18n";
import { isKind, type InboxItem, type NotificationKind } from "./inbox";

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** The inbox line for an item, with the names the server stored (never shown on a lock screen). */
export function itemText(i18n: Translator, item: InboxItem): string {
  const params = { name: text(item.params.name), venue: text(item.params.venue), party: text(item.params.party) };
  if (item.kind === "chatMessage") return i18n.plural("notify.items.chatMessage", item.count);
  if (item.kind === "takeover") return i18n.t(item.params.mine ? "notify.items.takeoverMine" : "notify.items.takeover", params);
  if (!isKind(item.kind)) return i18n.t("notify.title");
  return i18n.t(`notify.items.${item.kind as Exclude<NotificationKind, "chatMessage">}` as MessageKey, params);
}

/** Lock-screen copy: the same generic text the server pushes (QOL-27, MSG-04). */
export function genericCopy(i18n: Translator, kind: NotificationKind): { title: string; body: string } {
  return { title: i18n.t(`notify.push.${kind}.title` as MessageKey), body: i18n.t(`notify.push.${kind}.body` as MessageKey) };
}
