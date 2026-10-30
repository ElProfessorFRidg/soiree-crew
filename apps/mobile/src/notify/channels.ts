import type { AnyIconName } from "@/ui/Icon";
import { isKind, type Channel, type NotificationKind } from "./inbox";

/** QOL-30: each kind's channel, as on the server (apps/server/src/notifications/kinds.ts). */
export const CHANNEL_OF: Record<NotificationKind, Channel> = {
  outCall: "plans",
  round: "party",
  recapReady: "party",
  takeover: "game",
  overtaken: "game",
  cheatAttempt: "game",
  sos: "safety",
  quietMember: "safety",
  unwell: "safety",
  homeCheck: "safety",
  notHome: "safety",
  newDevice: "account",
  chatMessage: "messages",
};

export const CHANNEL_ICONS: Record<Channel, AnyIconName> = {
  safety: "alert",
  plans: "users",
  party: "glass",
  game: "crown",
  messages: "chat",
  account: "lock",
};

export function channelOf(kind: string): Channel {
  return isKind(kind) ? CHANNEL_OF[kind] : "party";
}

/** Safety goes through whatever the settings say (N-28, N-29, N-36, N-25, SEC-07). */
export function isSafety(kind: NotificationKind): boolean {
  return CHANNEL_OF[kind] === "safety" || kind === "newDevice";
}
