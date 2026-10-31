import * as Notifications from "expo-notifications";
import { getCalendars } from "expo-localization";
import { router } from "expo-router";
import { AppState, Platform } from "react-native";
import { createTranslator } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { api } from "@/server/api";
import { refreshLiveParty } from "@/server/crewData";
import { refreshRadar } from "@/server/radarData";
import { useAppStore } from "@/state/store";
import { showToast } from "@/ui/Toast";
import { CHANNEL_OF, isSafety } from "./channels";
import { CHANNELS, isKind, itemRoute, markRead, refreshInbox, type InboxItem, type NotificationKind } from "./inbox";
import { REMOTE_PUSH } from "./remote";
import { genericCopy, itemText } from "./text";

export { REMOTE_PUSH } from "./remote";

const native = Platform.OS === "ios" || Platform.OS === "android";

/** QOL-03 action ids. The categories match the server's (apps/server/src/notifications/kinds.ts). */
const ACTION = {
  in: "out-in",
  maybe: "out-maybe",
  no: "out-no",
  home: "home-safe",
  roundOk: "round-ok",
  mute: "party-mute",
} as const;
const CATEGORY: Partial<Record<NotificationKind, string>> = {
  outCall: "outCall",
  round: "round",
  homeCheck: "home",
  recapReady: "party",
  overtaken: "party",
  quietMember: "party",
  unwell: "party",
  danger: "party",
  notHome: "party",
};

let prepared: string | null = null;

/** Categories (action buttons) and Android channels, in the app's language. Redone when it changes. */
export async function prepareNotifications(): Promise<void> {
  if (!native) return;
  const language = useAppStore.getState().preferences.language;
  if (prepared === language) return;
  prepared = language;
  const i18n = createTranslator(language);
  // QOL-30: at most three actions, and every party notification can be muted until the morning.
  const background = { opensAppToForeground: false };
  const mute = { identifier: ACTION.mute, buttonTitle: i18n.t("notify.actions.mute"), options: background };
  await Promise.all([
    Notifications.setNotificationCategoryAsync("outCall", [
      { identifier: ACTION.in, buttonTitle: i18n.t("notify.actions.in"), options: background },
      { identifier: ACTION.maybe, buttonTitle: i18n.t("notify.actions.maybe"), options: background },
      { identifier: ACTION.no, buttonTitle: i18n.t("notify.actions.no"), options: background },
    ]),
    Notifications.setNotificationCategoryAsync("round", [{ identifier: ACTION.roundOk, buttonTitle: i18n.t("notify.actions.roundOk"), options: background }, mute]),
    Notifications.setNotificationCategoryAsync("home", [{ identifier: ACTION.home, buttonTitle: i18n.t("notify.actions.home"), options: background }, mute]),
    Notifications.setNotificationCategoryAsync("party", [mute]),
  ]).catch(() => undefined);
  if (Platform.OS === "android") {
    for (const channel of CHANNELS) {
      await Notifications.setNotificationChannelAsync(channel, {
        name: i18n.t(`notify.channels.${channel}`),
        importance: channel === "safety" ? Notifications.AndroidImportance.MAX : Notifications.AndroidImportance.DEFAULT,
        // QOL-27: the lock screen shows the app name only.
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
        bypassDnd: channel === "safety",
      }).catch(() => undefined);
    }
  }
}

function timeZone(): string | undefined {
  try {
    return getCalendars()[0]?.timeZone ?? undefined;
  } catch {
    return undefined;
  }
}

let registered: string | null = null;
let tokenListener: { remove: () => void } | null = null;

async function sendToken(token: string): Promise<void> {
  const zone = timeZone();
  await api("/v1/push/devices", { method: "POST", body: { token, platform: Platform.OS, ...(zone ? { timeZone: zone } : {}) } });
  registered = token;
}

/**
 * O-38: after sign-in, a build that can receive pushes hands its token to the server. The token
 * belongs to the session: signing out drops it on the server. Builds without push only send the
 * time zone, for quiet hours.
 */
export async function registerForPush(): Promise<void> {
  if (!native) return;
  await prepareNotifications();
  if (!REMOTE_PUSH) {
    const zone = timeZone();
    if (zone) await api("/v1/notifications/settings", { method: "PUT", body: { timeZone: zone } }).catch(() => undefined);
    return;
  }
  // Signing in never asks: the permission comes with an explanation (arrival step, askPermission),
  // and registering runs again once it is given.
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;
  const token = await Notifications.getDevicePushTokenAsync();
  if (typeof token.data === "string") await sendToken(token.data);
  tokenListener?.remove();
  tokenListener = Notifications.addPushTokenListener((next) => {
    if (typeof next.data === "string" && next.data !== registered) void sendToken(next.data).catch(() => undefined);
  });
}

export function forgetPush(): void {
  tokenListener?.remove();
  tokenListener = null;
  registered = null;
}

/** True when the phone gets this kind as a real push, so the app must not show it a second time. */
function pushCovers(): boolean {
  return REMOTE_PUSH && registered !== null;
}

async function showLocal(item: InboxItem, kind: NotificationKind): Promise<void> {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;
  await prepareNotifications();
  const i18n = createTranslator(useAppStore.getState().preferences.language);
  const copy = genericCopy(i18n, kind);
  const category = CATEGORY[kind];
  await Notifications.scheduleNotificationAsync({
    // A merged burst (a chat) replaces its own banner.
    identifier: item.id,
    content: {
      title: copy.title,
      body: copy.body,
      data: { n: item.id, k: kind, ...(item.partyId ? { p: item.partyId } : {}), ...(item.crewId ? { c: item.crewId } : {}), ...(item.refId ? { r: item.refId } : {}) },
      ...(category ? { categoryIdentifier: category } : {}),
      // QOL-30: one thread per party.
      ...(item.partyId || item.crewId ? { threadIdentifier: item.partyId ?? item.crewId ?? undefined } : {}),
      ...(isSafety(kind) ? { interruptionLevel: "timeSensitive" as const } : {}),
    },
    trigger: Platform.OS === "android" ? { channelId: CHANNEL_OF[kind] } : null,
  });
}

/**
 * A new inbox item came over the live socket. In the foreground: refresh, and a toast for what
 * matters. In the background without push: a local notification with the generic text. With
 * push, the system already shows it.
 */
export async function onNotificationHint(hint: { id: string; kind: string; alert: boolean }): Promise<void> {
  const items = await refreshInbox();
  const item = items.find((i) => i.id === hint.id);
  if (!item || !hint.alert || !isKind(item.kind)) return;
  const kind = item.kind;
  if (AppState.currentState === "active") {
    // The chat has its own unread marks; the rest gets a short toast that opens it.
    if (kind === "chatMessage") return;
    if (isSafety(kind)) haptic.error();
    const i18n = createTranslator(useAppStore.getState().preferences.language);
    showToast({
      message: itemText(i18n, item),
      tone: kind === "sos" ? "danger" : "info",
      action: { label: i18n.t("notify.title"), onPress: () => openItem(item) },
    });
    if (item.partyId && isSafety(kind)) void refreshLiveParty(item.partyId).catch(() => undefined);
    return;
  }
  // Without push, "recap ready" is scheduled locally for after the quiet hours (reminders.ts).
  if (!pushCovers() && kind !== "recapReady") await showLocal(item, kind).catch(() => undefined);
}

export function openItem(item: Pick<InboxItem, "id" | "kind" | "partyId" | "refId">): void {
  if (item.id) void markRead([item.id]).catch(() => undefined);
  router.push(itemRoute(item) as never);
}

function readData(response: Notifications.NotificationResponse): Record<string, string> | null {
  const data = response.notification.request.content.data as Record<string, unknown> | null | undefined;
  if (!data || typeof data.k !== "string") return null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) if (typeof value === "string") out[key] = value;
  return out;
}

/**
 * QOL-03: actions straight from the notification, through the routes the screens use. Returns
 * false when the response is not one of ours (local reminders handle their own).
 */
export function handleNotificationResponse(response: Notifications.NotificationResponse): boolean {
  const data = readData(response);
  if (!data) return false;
  const action = response.actionIdentifier;
  const inboxId = data.n;
  const markSeen = () => (inboxId ? markRead([inboxId]).catch(() => undefined) : undefined);
  const crewId = data.c;
  if ((action === ACTION.in || action === ACTION.maybe || action === ACTION.no) && data.r) {
    const reply = action === ACTION.in ? "in" : action === ACTION.maybe ? "maybe" : "no";
    void api(`/v1/out-calls/${data.r}/reply`, { method: "POST", body: { reply } })
      .then(() => (crewId ? refreshRadar(crewId) : undefined))
      .then(markSeen)
      .catch(() => undefined);
    return true;
  }
  if (action === ACTION.home && data.p) {
    void api(`/v1/parties/${data.p}/status`, { method: "POST", body: { homeSafe: true } })
      .then(markSeen)
      .catch(() => undefined);
    return true;
  }
  if (action === ACTION.roundOk) {
    void markSeen();
    return true;
  }
  if (action === ACTION.mute && data.p) {
    void api(`/v1/parties/${data.p}/mute`, { method: "POST", body: {} })
      .then(() => {
        if (AppState.currentState === "active") showToast({ message: createTranslator(useAppStore.getState().preferences.language).t("notify.muted") });
      })
      .then(markSeen)
      .catch(() => undefined);
    return true;
  }
  if (data.k === "summary") {
    router.push("/notifications");
    return true;
  }
  if (!isKind(data.k)) return false;
  openItem({ id: inboxId ?? "", kind: data.k, partyId: data.p ?? null, refId: data.r ?? null });
  return true;
}
