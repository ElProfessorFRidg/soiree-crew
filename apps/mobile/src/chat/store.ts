import { create } from "zustand";
import type { ChatPayload } from "@crew/mls";

export interface Conversation {
  id: string;
  kind: "crew" | "party" | "direct";
  crewId: string | null;
  partyId: string | null;
  otherUserId: string | null;
  title: string;
  startsAt: number | null;
  epoch: number | null;
  disappearSeconds: number;
  readOnly: boolean;
  inGroup: boolean;
  lastSeq: number;
  lastAt: number | null;
  members: string[];
}

export interface ChatMedia {
  kind: "photo" | "voice";
  blob: string;
  key: string;
  mime: string;
  width?: number;
  height?: number;
  durationMs?: number;
  thumb?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  /** Server time when known, so edit windows cannot be stretched by a wrong clock. */
  at: number;
  kind: "text" | "media" | "timer";
  body?: string;
  reply?: string;
  mentions?: string[];
  media?: ChatMedia;
  seconds?: number;
  reactions: Record<string, string>;
  editedAt?: number;
  deleted?: boolean;
  status?: "sending" | "sent" | "failed" | "held";
  expiresAt?: number;
}

/** ADP-10: a message kept on the phone until the morning. */
export interface HeldMessage {
  id: string;
  conversationId: string;
  payload: ChatPayload;
  at: number;
}

export interface ChatSettings {
  readReceipts: boolean;
  typing: boolean;
  /** ADP-10: people whose messages wait for the morning at levels 2 and 3. Off until someone is picked. */
  guarded: string[];
}

export interface ChatMeta {
  settings: ChatSettings;
  held: HeldMessage[];
  /** Last message I read per conversation, for the unread count and my receipts. */
  lastRead: Record<string, string>;
  /** Conversation, then person, then the last message they read. */
  readBy: Record<string, Record<string, string>>;
  /** MSG-05: the key set I last saw for each person, and the one I verified. */
  knownKeys: Record<string, string>;
  verified: Record<string, string>;
  keyChanged: Record<string, number>;
  muted: string[];
  backupAt: number | null;
}

export const EMPTY_META: ChatMeta = {
  settings: { readReceipts: true, typing: true, guarded: [] },
  held: [],
  lastRead: {},
  readBy: {},
  knownKeys: {},
  verified: {},
  keyChanged: {},
  muted: [],
  backupAt: null,
};

interface ChatState {
  ready: boolean;
  /** Set when this phone cannot run chats yet (no server, or the device could not register). */
  problem: "offline" | "server" | null;
  conversations: Conversation[];
  messages: Record<string, ChatMessage[]>;
  meta: ChatMeta;
  /** Conversation, then person, then when they last typed. */
  typing: Record<string, Record<string, number>>;
  /** Conversations still waiting for someone to add this phone to the group. */
  waiting: Record<string, true>;
}

export const useChat = create<ChatState>(() => ({ ready: false, problem: null, conversations: [], messages: {}, meta: EMPTY_META, typing: {}, waiting: {} }));

export function unreadCount(conversationId: string, me: string): number {
  const { messages, meta } = useChat.getState();
  const list = messages[conversationId] ?? [];
  const last = meta.lastRead[conversationId];
  const from = last ? list.findIndex((m) => m.id === last) + 1 : 0;
  return list.slice(from).filter((m) => m.senderId !== me && !m.deleted && m.kind !== "timer").length;
}
