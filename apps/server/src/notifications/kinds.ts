/**
 * QOL-30: the fixed notification taxonomy. Six channels at most; every kind belongs to one.
 * The app has the same list (apps/mobile/src/notify/kinds.ts) for its settings screen.
 */
export const CHANNELS = ["safety", "plans", "party", "game", "messages", "account"] as const;
export type Channel = (typeof CHANNELS)[number];

export interface KindSpec {
  channel: Channel;
  /** Safety goes through whatever the settings, quiet hours and party mutes say. */
  safety: boolean;
  /** Can wait for the end of quiet hours (QOL-20); the rest goes out without sound instead. */
  canWait: boolean;
  /** QOL-03: the iOS category, i.e. the action buttons. Party kinds get "mute until morning". */
  category: "outCall" | "round" | "home" | "party" | null;
}

export const KINDS = {
  /** N-03: "I'm going out, who's in?" */
  outCall: { channel: "plans", safety: false, canWait: false, category: "outCall" },
  /** N-18: someone logged a round that includes you. */
  round: { channel: "party", safety: false, canWait: false, category: "round" },
  /** O-41 */
  recapReady: { channel: "party", safety: false, canWait: true, category: "party" },
  /** TER-04: a venue changed boss; `mine` when it was taken from the recipient. */
  takeover: { channel: "game", safety: false, canWait: true, category: null },
  /** RANK-02 */
  overtaken: { channel: "game", safety: false, canWait: false, category: "party" },
  /** AC-09 */
  cheatAttempt: { channel: "game", safety: false, canWait: true, category: null },
  /** N-28 */
  sos: { channel: "safety", safety: true, canWait: false, category: null },
  /** N-29 */
  quietMember: { channel: "safety", safety: true, canWait: false, category: "party" },
  /** O-88: someone's estimate passed 2.0 g/L. */
  danger: { channel: "safety", safety: true, canWait: false, category: "party" },
  /** N-36 */
  unwell: { channel: "safety", safety: true, canWait: false, category: "party" },
  /** N-25: to the person, once the night is over: are you home? */
  homeCheck: { channel: "safety", safety: true, canWait: false, category: "home" },
  /** N-25: to the crew, a while later: who has not said they are home. */
  notHome: { channel: "safety", safety: true, canWait: false, category: "party" },
  /** SEC-07 */
  newDevice: { channel: "account", safety: true, canWait: false, category: null },
  /** MSG-04: never the content, never the sender's words. */
  chatMessage: { channel: "messages", safety: false, canWait: true, category: null },
} as const satisfies Record<string, KindSpec>;

export type NotificationKind = keyof typeof KINDS;
export const KIND_NAMES = Object.keys(KINDS) as NotificationKind[];

export function isKind(value: string): value is NotificationKind {
  return Object.hasOwn(KINDS, value);
}
