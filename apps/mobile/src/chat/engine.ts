import {
  ChatGroup,
  fromBase64,
  keySetTag,
  newKeyPackages,
  newSignatureKeys,
  readKeyPackage,
  readPayload,
  toBase64,
  writePayload,
  type ChatPayload,
  type Directory,
  type KeyPackageBundle,
} from "@crew/mls";
import { api, ApiError } from "@/server/api";
import { useSession } from "@/server/session";
import { newId } from "@/state/store";
import { vaultClosed } from "@/vault/vault";
import { loadSealed, removeAllSealed, removeSealed, saveSealed } from "./secure";
import { EMPTY_META, useChat, type ChatMessage, type ChatMeta, type Conversation, type HeldMessage } from "./store";

// MSG-01, MSG-02, MSG-10: this phone's MLS client. Group state, keys and history stay sealed on the
// phone (secure.ts); the server only relays ciphertext (apps/server/src/routes/chat.ts).

const KEY_PACKAGES_LOW = 5;
const KEY_PACKAGES_BATCH = 10;
const HISTORY_CAP = 1500;
/** MSG-10: edit or delete for everyone, within this time of sending. */
export const EDIT_WINDOW_MS = 15 * 60_000;
const COMMIT_ATTEMPTS = 3;
/** Each device renews its leaf keys at least this often, so a stolen key stops working. */
const SELF_UPDATE_MS = 24 * 3_600_000;

interface DeviceRecord {
  userId: string;
  deviceId: string | null;
  signKey: string;
  publicKey: string;
  /** Private halves of the key packages on the server, by KeyPackageRef. */
  packages: Record<string, { publicData: string; privateData: string }>;
}

interface GroupRecord {
  /** The leaf this state belongs to: a state saved for another device id is worthless. */
  deviceId?: string | null;
  state: string;
  /** Last server sequence number handled. */
  cursor: number;
  /** When this device last refreshed its own leaf keys (post-compromise security). */
  selfUpdatedAt?: number;
}

interface OutboxItem {
  id: string;
  conversationId: string;
  payload: ChatPayload;
  /** Encrypted once and kept, so a retry never reuses a key with different content. */
  ciphertext?: string;
  epoch?: number;
}

interface Roster {
  epoch: number | null;
  initDevice: string | null;
  members: string[];
  expected: { deviceId: string; userId: string; signatureKey: string; keyPackages: number }[];
  inGroup: string[];
}

interface ServerMessage {
  seq: number;
  kind: "commit" | "application";
  epoch: number;
  mine: boolean;
  data: string | null;
  at: number;
  expiresAt: number | null;
}

let device: DeviceRecord | null = null;
let outbox: OutboxItem[] = [];
let starting: Promise<void> | null = null;
/** Registered with the server during this run of the app. */
let registered = false;
const directoryCache = new Map<string, { userId: string; key: Uint8Array }>();
const locks = new Map<string, Promise<unknown>>();

const isHttp = (error: unknown, status: number, code?: string) =>
  error instanceof ApiError && error.failure.kind === "http" && error.failure.status === status && (code === undefined || error.failure.code === code);

function me(): string | null {
  return useSession.getState().session?.userId ?? null;
}

/** Sealed names are per account, so two accounts on one phone never mix. */
const name = (suffix: string) => `${me()}.${suffix}`;

/** One operation at a time per conversation: a group state is never used twice. */
function serial<T>(key: string, run: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(run);
  locks.set(
    key,
    next.catch(() => undefined),
  );
  return next;
}

const directory: Directory = async (ref) => {
  let entry = directoryCache.get(ref.deviceId);
  if (!entry) {
    await loadDirectory([ref.deviceId]).catch(() => undefined);
    entry = directoryCache.get(ref.deviceId);
  }
  return entry && entry.userId === ref.userId ? entry.key : undefined;
};

async function loadDirectory(deviceIds: string[]): Promise<void> {
  const res = await api<{ devices: { deviceId: string; userId: string; signatureKey: string }[] }>("/v1/chat/directory", { method: "POST", body: { deviceIds } });
  for (const d of res.devices) directoryCache.set(d.deviceId, { userId: d.userId, key: fromBase64(d.signatureKey) });
}

async function saveDevice(): Promise<void> {
  if (device) await saveSealed(name("device"), device);
}

async function loadGroup(conversationId: string): Promise<GroupRecord | null> {
  const record = await loadSealed<GroupRecord>(name(`g.${conversationId}`));
  return record && record.deviceId === device?.deviceId ? record : null;
}

async function saveGroup(conversationId: string, record: Omit<GroupRecord, "deviceId">): Promise<void> {
  await saveSealed(name(`g.${conversationId}`), { ...record, deviceId: device!.deviceId });
}

const historyTimers = new Map<string, ReturnType<typeof setTimeout>>();
function saveHistorySoon(conversationId: string): void {
  clearTimeout(historyTimers.get(conversationId));
  historyTimers.set(
    conversationId,
    setTimeout(() => {
      const list = useChat.getState().messages[conversationId] ?? [];
      void saveSealed(name(`h.${conversationId}`), list.slice(-HISTORY_CAP));
    }, 400),
  );
}

let metaTimer: ReturnType<typeof setTimeout> | undefined;
function saveMetaSoon(): void {
  clearTimeout(metaTimer);
  metaTimer = setTimeout(() => void saveSealed(name("meta"), useChat.getState().meta), 300);
}

export function updateMeta(change: (meta: ChatMeta) => ChatMeta): void {
  useChat.setState((s) => ({ meta: change(s.meta) }));
  saveMetaSoon();
}

function setMessages(conversationId: string, change: (list: ChatMessage[]) => ChatMessage[]): void {
  useChat.setState((s) => ({ messages: { ...s.messages, [conversationId]: change(s.messages[conversationId] ?? []) } }));
  saveHistorySoon(conversationId);
}

const patchMessage = (conversationId: string, id: string, change: Partial<ChatMessage>) =>
  setMessages(conversationId, (list) => list.map((m) => (m.id === id ? { ...m, ...change } : m)));

/** Registers this phone's MLS client and keeps a stock of key packages on the server. */
async function ensureDevice(): Promise<DeviceRecord> {
  const userId = me();
  if (!userId) throw new ApiError({ kind: "offline" });
  if (device?.userId !== userId) {
    device = await loadSealed<DeviceRecord>(name("device"));
    registered = false;
  }
  if (device && registered) return device;
  if (!device) {
    const keys = await newSignatureKeys();
    device = { userId, deviceId: null, signKey: toBase64(keys.signKey), publicKey: toBase64(keys.publicKey), packages: {} };
    await saveDevice();
  }
  let reg: { deviceId: string; keyPackages: number };
  try {
    reg = await api("/v1/chat/device", { method: "PUT", body: { signatureKey: device.publicKey } });
  } catch (error) {
    if (!isHttp(error, 409, "key_mismatch")) throw error;
    reg = await api("/v1/chat/device", { method: "PUT", body: { signatureKey: device.publicKey, reset: true } });
  }
  if (reg.deviceId !== device.deviceId) {
    // A new device id (first start, new session, reset): saved groups were for another leaf.
    device = { ...device, deviceId: reg.deviceId, packages: {} };
    await saveDevice();
    reg.keyPackages = (await api<{ deviceId: string; keyPackages: number }>("/v1/chat/device", { method: "PUT", body: { signatureKey: device.publicKey } })).keyPackages;
  }
  if (reg.keyPackages < KEY_PACKAGES_LOW) await uploadKeyPackages();
  registered = true;
  return device;
}

function signatureKeys() {
  return { signKey: fromBase64(device!.signKey), publicKey: fromBase64(device!.publicKey) };
}

async function uploadKeyPackages(): Promise<void> {
  if (!device?.deviceId) return;
  const bundles = await newKeyPackages({ userId: device.userId, deviceId: device.deviceId }, signatureKeys(), KEY_PACKAGES_BATCH);
  // The private halves are saved before anything leaves the phone.
  for (const b of bundles) device.packages[b.ref] = { publicData: b.publicData, privateData: b.privateData };
  await saveDevice();
  await api("/v1/chat/key-packages", { method: "POST", body: { packages: bundles.map((b) => ({ ref: b.ref, data: b.publicData })) } });
}

/** Loads what this phone keeps, then catches up with the server. Safe to call often. */
export function startChat(): Promise<void> {
  starting ??= (async () => {
    try {
      const meta = (await loadSealed<ChatMeta>(name("meta"))) ?? EMPTY_META;
      outbox = (await loadSealed<OutboxItem[]>(name("outbox"))) ?? [];
      useChat.setState({ meta: { ...EMPTY_META, ...meta, settings: { ...EMPTY_META.settings, ...meta.settings } } });
      await ensureDevice();
      await refreshConversations();
      await processWelcomes();
      for (const c of useChat.getState().conversations) {
        if (!useChat.getState().messages[c.id]) {
          const history = (await loadSealed<ChatMessage[]>(name(`h.${c.id}`))) ?? [];
          useChat.setState((s) => ({ messages: { ...s.messages, [c.id]: history } }));
        }
      }
      useChat.setState({ ready: true, problem: null });
      for (const c of useChat.getState().conversations) await syncConversation(c.id).catch(() => undefined);
      await flushOutbox();
    } catch (error) {
      useChat.setState({ ready: true, problem: error instanceof ApiError && error.failure.kind !== "http" ? "offline" : "server" });
    } finally {
      starting = null;
    }
  })();
  return starting;
}

export async function refreshConversations(): Promise<void> {
  const res = await api<{ conversations: Conversation[] }>("/v1/conversations");
  const order = (c: Conversation) => c.lastAt ?? c.startsAt ?? 0;
  useChat.setState({ conversations: res.conversations.sort((a, b) => order(b) - order(a)) });
}

/** `inside` is the conversation whose lock the caller already holds. */
async function processWelcomes(inside?: string): Promise<void> {
  if (!device?.deviceId) return;
  const res = await api<{ welcomes: { id: string; conversationId: string; keyPackageRef: string; data: string; afterSeq: number }[] }>("/v1/chat/welcomes");
  for (const w of res.welcomes) {
    const run = async () => {
      const own = device!.packages[w.keyPackageRef];
      if (own) {
        try {
          const bundle: KeyPackageBundle = { ref: w.keyPackageRef, ...own };
          const group = await ChatGroup.join(w.data, bundle, directory);
          await saveGroup(w.conversationId, { state: group.save(), cursor: w.afterSeq });
          useChat.setState((s) => {
            const { [w.conversationId]: _done, ...waiting } = s.waiting;
            return { waiting };
          });
        } catch {
          // A welcome that does not open is useless: the group re-adds this phone with a new package.
        }
        delete device!.packages[w.keyPackageRef];
        await saveDevice();
      }
      await api(`/v1/chat/welcomes/${w.id}`, { method: "DELETE" }).catch(() => undefined);
    };
    await (w.conversationId === inside ? run() : serial(w.conversationId, run));
  }
  if (Object.keys(device.packages).length < KEY_PACKAGES_LOW) await uploadKeyPackages().catch(() => undefined);
}

/** Applies what the server holds after the cursor. Returns null when this phone is out of the group. */
async function pull(conversationId: string, group: ChatGroup, record: GroupRecord): Promise<{ group: ChatGroup; record: GroupRecord } | null> {
  for (;;) {
    let page: { messages: ServerMessage[]; more: boolean };
    try {
      page = await api(`/v1/conversations/${conversationId}/messages?after=${record.cursor}`);
    } catch (error) {
      if (isHttp(error, 409, "not_in_group")) {
        await removeSealed(name(`g.${conversationId}`));
        return null;
      }
      throw error;
    }
    for (const message of page.messages) {
      if (!message.mine && message.data) {
        try {
          const result = await group.process(message.data);
          group = result.group;
          if (result.kind === "application") {
            const payload = readPayload(result.plaintext);
            if (payload) receive(conversationId, result.sender.userId, payload, message.at, message.expiresAt);
          } else if (result.removed) {
            await removeSealed(name(`g.${conversationId}`));
            return null;
          }
        } catch {
          if (message.kind === "commit") {
            // A commit this phone cannot apply leaves its state behind for good: start over.
            await removeSealed(name(`g.${conversationId}`));
            await api(`/v1/conversations/${conversationId}/rejoin`, { method: "POST" }).catch(() => undefined);
            return null;
          }
          // An application message that does not open (too old, damaged) is skipped.
        }
      }
      record = { ...record, state: group.save(), cursor: message.seq };
    }
    await saveGroup(conversationId, record);
    if (!page.more) return { group, record };
  }
}

/**
 * Brings this phone's copy of a group up to date, creating or joining it when needed, then adds the
 * devices that should be in it and removes those that should not (members who left, signed-out
 * phones). `steer` is set while someone looks at the conversation; otherwise only one device,
 * the first in the group, does the membership work, so phones do not race each other.
 */
export function syncConversation(conversationId: string, steer = false): Promise<void> {
  return serial(conversationId, async () => {
    const mine = await ensureDevice();
    const deviceId = mine.deviceId!;
    let roster = await api<Roster>(`/v1/conversations/${conversationId}/roster`);
    for (const d of roster.expected) directoryCache.set(d.deviceId, { userId: d.userId, key: fromBase64(d.signatureKey) });
    let record = await loadGroup(conversationId);

    if (!record) {
      // Nobody runs this group (new, or every device left it): this phone starts it.
      const active = new Set(roster.expected.map((d) => d.deviceId));
      if (roster.epoch === null || !roster.inGroup.some((d) => active.has(d))) {
        try {
          await api(`/v1/conversations/${conversationId}/init`, { method: "POST" });
          const [own] = await newKeyPackages({ userId: mine.userId, deviceId }, signatureKeys(), 1);
          const group = await ChatGroup.create(conversationId, own!, directory);
          record = { state: group.save(), cursor: 0, selfUpdatedAt: Date.now() };
          await saveGroup(conversationId, record);
          roster = await api<Roster>(`/v1/conversations/${conversationId}/roster`);
          steer = true;
        } catch (error) {
          if (!isHttp(error, 409)) throw error;
        }
      }
      if (!record) {
        await processWelcomes(conversationId);
        record = await loadGroup(conversationId);
      }
      if (!record) {
        // In the server's list but without a state here: ask to be added again.
        if (roster.inGroup.includes(deviceId)) await api(`/v1/conversations/${conversationId}/rejoin`, { method: "POST" }).catch(() => undefined);
        useChat.setState((s) => ({ waiting: { ...s.waiting, [conversationId]: true } }));
        return;
      }
    }

    let group = ChatGroup.load(record.state, directory);
    let pulled = await pull(conversationId, group, record);
    if (!pulled) {
      useChat.setState((s) => ({ waiting: { ...s.waiting, [conversationId]: true } }));
      return;
    }
    ({ group, record } = pulled);
    noticeKeyChanges(roster);

    const leader = [...roster.inGroup].sort()[0] === deviceId;
    if (group.active && (steer || leader)) {
      for (let attempt = 0; attempt < COMMIT_ATTEMPTS; attempt++) {
        const outcome = await reconcile(conversationId, group, deviceId, Date.now() - (record.selfUpdatedAt ?? 0) > SELF_UPDATE_MS);
        if (outcome === "done") break;
        if (outcome !== "retry") {
          ({ group, record } = outcome);
          break;
        }
        pulled = await pull(conversationId, group, record);
        if (!pulled) return;
        ({ group, record } = pulled);
      }
    }
    await flushConversation(conversationId, group).catch(() => undefined);
  });
}

async function reconcile(conversationId: string, group: ChatGroup, deviceId: string, renew: boolean): Promise<"done" | "retry" | { group: ChatGroup; record: GroupRecord }> {
  const roster = await api<Roster>(`/v1/conversations/${conversationId}/roster`);
  for (const d of roster.expected) directoryCache.set(d.deviceId, { userId: d.userId, key: fromBase64(d.signatureKey) });
  const expected = new Set(roster.expected.map((d) => d.deviceId));
  const inGroup = new Set(roster.inGroup);
  const toAdd = roster.expected.filter((d) => d.deviceId !== deviceId && !inGroup.has(d.deviceId) && d.keyPackages > 0).map((d) => d.deviceId);
  const leaves = group.members();
  const removeLeaves = leaves.filter((m) => m.deviceId !== deviceId && (!expected.has(m.deviceId) || !inGroup.has(m.deviceId) || toAdd.includes(m.deviceId)));
  if (!toAdd.length && !removeLeaves.length && !renew) return "done";

  const claimed = toAdd.length
    ? (await api<{ packages: { deviceId: string; ref: string; data: string }[] }>(`/v1/conversations/${conversationId}/claim`, { method: "POST", body: { deviceIds: toAdd } })).packages
    : [];
  const valid: typeof claimed = [];
  for (const p of claimed) {
    // The package must be the device's own: same id, same signature key as the directory.
    const read = await readKeyPackage(p.data).catch(() => null);
    const known = directoryCache.get(p.deviceId);
    if (read && known && read.device.deviceId === p.deviceId && toBase64(read.signatureKey) === toBase64(known.key)) valid.push(p);
  }
  if (!valid.length && !removeLeaves.length && !renew) return "done";
  const result = await group.commit({ add: valid.map((p) => p.data), removeLeaves: removeLeaves.map((m) => m.leaf) });
  try {
    const { seq } = await api<{ seq: number }>(`/v1/conversations/${conversationId}/messages`, {
      method: "POST",
      body: {
        kind: "commit",
        epoch: group.epoch,
        data: result.commit,
        ...(result.welcome ? { welcome: result.welcome } : {}),
        adds: valid.map((p) => ({ deviceId: p.deviceId, keyPackageRef: p.ref })),
        removes: removeLeaves.map((m) => m.deviceId),
      },
    });
    // Every commit carries a fresh path for this device: it counts as the key renewal.
    const record = { state: result.group.save(), cursor: seq, selfUpdatedAt: Date.now() };
    await saveGroup(conversationId, record);
    return { group: result.group, record };
  } catch (error) {
    if (isHttp(error, 409, "stale_epoch")) return "retry";
    throw error;
  }
}

/** MSG-05: notices when someone's set of devices changes after it was first seen. */
function noticeKeyChanges(roster: Roster): void {
  const byUser = new Map<string, Uint8Array[]>();
  for (const d of roster.expected) byUser.set(d.userId, [...(byUser.get(d.userId) ?? []), fromBase64(d.signatureKey)]);
  const { meta } = useChat.getState();
  const known = { ...meta.knownKeys };
  const changed = { ...meta.keyChanged };
  let dirty = false;
  for (const [userId, keys] of byUser) {
    if (userId === me()) continue;
    const tag = keySetTag(keys);
    if (known[userId] && known[userId] !== tag) changed[userId] = Date.now();
    if (known[userId] !== tag) {
      known[userId] = tag;
      dirty = true;
    }
  }
  if (dirty) updateMeta((m) => ({ ...m, knownKeys: known, keyChanged: changed }));
}

/** What a received payload does to the local history. */
function receive(conversationId: string, senderId: string, payload: ChatPayload, at: number, expiresAt: number | null): void {
  const { meta } = useChat.getState();
  if (meta.muted.includes(senderId) && payload.t !== "read") return;
  const list = useChat.getState().messages[conversationId] ?? [];
  const target = "target" in payload ? list.find((m) => m.id === payload.target) : undefined;
  const ownWindow = (m: ChatMessage | undefined) => m && m.senderId === senderId && at - m.at <= EDIT_WINDOW_MS;
  switch (payload.t) {
    case "text":
    case "media":
    case "timer": {
      if (list.some((m) => m.id === payload.id)) return;
      const message: ChatMessage = {
        id: payload.id,
        senderId,
        at,
        kind: payload.t,
        reactions: {},
        ...(expiresAt ? { expiresAt } : {}),
        ...(payload.t === "text" ? { body: payload.body, ...(payload.reply ? { reply: payload.reply } : {}), ...(payload.mentions ? { mentions: payload.mentions } : {}) } : {}),
        ...(payload.t === "media"
          ? {
              media: {
                kind: payload.kind,
                blob: payload.blob,
                key: payload.key,
                mime: payload.mime,
                ...(payload.width ? { width: payload.width } : {}),
                ...(payload.height ? { height: payload.height } : {}),
                ...(payload.durationMs ? { durationMs: payload.durationMs } : {}),
                ...(payload.thumb ? { thumb: payload.thumb } : {}),
              },
              ...(payload.reply ? { reply: payload.reply } : {}),
            }
          : {}),
        ...(payload.t === "timer" ? { seconds: payload.seconds } : {}),
      };
      setMessages(conversationId, (l) => [...l, message].sort((a, b) => a.at - b.at));
      return;
    }
    case "react":
      if (!target) return;
      setMessages(conversationId, (l) =>
        l.map((m) => {
          if (m.id !== target.id) return m;
          const reactions = { ...m.reactions };
          if (payload.emoji) reactions[senderId] = payload.emoji;
          else delete reactions[senderId];
          return { ...m, reactions };
        }),
      );
      return;
    case "edit":
      if (ownWindow(target)) patchMessage(conversationId, target!.id, { body: payload.body, editedAt: at });
      return;
    case "delete":
      if (ownWindow(target)) setMessages(conversationId, (l) => l.map((m) => (m.id === target!.id ? { id: m.id, senderId: m.senderId, at: m.at, kind: m.kind, reactions: {}, deleted: true } : m)));
      return;
    case "read":
      updateMeta((m) => ({ ...m, readBy: { ...m.readBy, [conversationId]: { ...m.readBy[conversationId], [senderId]: payload.upTo } } }));
      return;
  }
}

async function saveOutbox(): Promise<void> {
  await saveSealed(name("outbox"), outbox);
}

/** Sends what waits for one conversation, in order; anything that fails stays for the next try. */
async function flushConversation(conversationId: string, group: ChatGroup): Promise<void> {
  for (const item of outbox.filter((o) => o.conversationId === conversationId)) {
    if (item.ciphertext === undefined || item.epoch !== group.epoch) {
      const encrypted = await group.encrypt(writePayload(item.payload));
      group = encrypted.group;
      // The ratchet moved: save it before the ciphertext leaves, so no key is ever used twice.
      const current = await loadGroup(conversationId);
      await saveGroup(conversationId, { state: group.save(), cursor: current?.cursor ?? 0 });
      item.ciphertext = encrypted.message;
      item.epoch = group.epoch;
      await saveOutbox();
    }
    try {
      await api(`/v1/conversations/${conversationId}/messages`, { method: "POST", body: { kind: "application", epoch: item.epoch, data: item.ciphertext } });
      outbox = outbox.filter((o) => o.id !== item.id);
      await saveOutbox();
      if (item.payload.t === "text" || item.payload.t === "media" || item.payload.t === "timer") patchMessage(conversationId, item.payload.id, { status: "sent" });
    } catch (error) {
      if (isHttp(error, 409, "stale_epoch")) {
        delete item.ciphertext;
        return;
      }
      if (isHttp(error, 403)) {
        outbox = outbox.filter((o) => o.id !== item.id);
        await saveOutbox();
        patchMessage(conversationId, item.payload.id, { status: "failed" });
        continue;
      }
      return;
    }
  }
}

export async function flushOutbox(): Promise<void> {
  const ids = [...new Set(outbox.map((o) => o.conversationId))];
  for (const id of ids) await syncConversation(id).catch(() => undefined);
}

function conversation(id: string): Conversation | undefined {
  return useChat.getState().conversations.find((c) => c.id === id);
}

/** ADP-10: a direct message to a guarded person, sent at level 2 or 3, waits for the morning. */
function heldBack(conversationId: string): boolean {
  const c = conversation(conversationId);
  const guarded = useChat.getState().meta.settings.guarded;
  return Boolean(c?.otherUserId && guarded.includes(c.otherUserId) && vaultClosed());
}

function queue(conversationId: string, payload: ChatPayload): void {
  outbox.push({ id: newId(), conversationId, payload });
  void saveOutbox().then(() => syncConversation(conversationId).catch(() => undefined));
}

/** Adds an own message to the history and queues it (MSG-10 offline send queue). */
function sendVisible(conversationId: string, payload: Extract<ChatPayload, { t: "text" | "media" | "timer" }>, extra: Partial<ChatMessage> = {}): "sent" | "held" {
  const userId = me()!;
  const c = conversation(conversationId);
  const now = Date.now();
  const base: ChatMessage = {
    id: payload.id,
    senderId: userId,
    at: now,
    kind: payload.t,
    reactions: {},
    ...(c?.disappearSeconds ? { expiresAt: now + c.disappearSeconds * 1000 } : {}),
    ...extra,
  };
  if (payload.t !== "timer" && heldBack(conversationId)) {
    const held: HeldMessage = { id: payload.id, conversationId, payload, at: now };
    updateMeta((m) => ({ ...m, held: [...m.held, held] }));
    return "held";
  }
  setMessages(conversationId, (l) => [...l, { ...base, status: "sending" }]);
  queue(conversationId, payload);
  return "sent";
}

export function sendText(conversationId: string, body: string, options: { reply?: string; mentions?: string[] } = {}): "sent" | "held" {
  const payload: ChatPayload = { t: "text", id: newId(), body, ...(options.reply ? { reply: options.reply } : {}), ...(options.mentions?.length ? { mentions: options.mentions } : {}) };
  return sendVisible(conversationId, payload, { body, ...(options.reply ? { reply: options.reply } : {}), ...(options.mentions?.length ? { mentions: options.mentions } : {}) });
}

export function sendMediaPayload(conversationId: string, media: Omit<Extract<ChatPayload, { t: "media" }>, "t" | "id">): "sent" | "held" {
  const payload: ChatPayload = { t: "media", id: newId(), ...media };
  const { reply, ...rest } = media;
  return sendVisible(conversationId, payload, { media: rest, ...(reply ? { reply } : {}) });
}

export function react(conversationId: string, messageId: string, emoji: string): void {
  const userId = me()!;
  setMessages(conversationId, (l) =>
    l.map((m) => {
      if (m.id !== messageId) return m;
      const reactions = { ...m.reactions };
      if (emoji && reactions[userId] !== emoji) reactions[userId] = emoji;
      else delete reactions[userId];
      return { ...m, reactions };
    }),
  );
  const mineNow = useChat.getState().messages[conversationId]?.find((m) => m.id === messageId)?.reactions[userId] ?? "";
  queue(conversationId, { t: "react", id: newId(), target: messageId, emoji: mineNow });
}

export function canChange(message: ChatMessage): boolean {
  return message.senderId === me() && !message.deleted && Date.now() - message.at < EDIT_WINDOW_MS - 30_000;
}

export function editMessage(conversationId: string, messageId: string, body: string): void {
  patchMessage(conversationId, messageId, { body, editedAt: Date.now() });
  queue(conversationId, { t: "edit", id: newId(), target: messageId, body });
}

export function deleteForEveryone(conversationId: string, messageId: string): void {
  setMessages(conversationId, (l) => l.map((m) => (m.id === messageId ? { id: m.id, senderId: m.senderId, at: m.at, kind: m.kind, reactions: {}, deleted: true } : m)));
  queue(conversationId, { t: "delete", id: newId(), target: messageId });
}

/** MSG-06: the timer is set for the whole conversation, and everyone sees who changed it. */
export async function setDisappearing(conversationId: string, seconds: number): Promise<void> {
  await api(`/v1/conversations/${conversationId}/settings`, { method: "PUT", body: { disappearSeconds: seconds } });
  useChat.setState((s) => ({ conversations: s.conversations.map((c) => (c.id === conversationId ? { ...c, disappearSeconds: seconds } : c)) }));
  sendVisible(conversationId, { t: "timer", id: newId(), seconds }, { seconds });
}

/** Marks the conversation read; with receipts on, tells the others too (MSG-10). */
export function markRead(conversationId: string): void {
  const list = useChat.getState().messages[conversationId] ?? [];
  const last = [...list].reverse().find((m) => m.kind !== "timer");
  if (!last) return;
  const { meta } = useChat.getState();
  if (meta.lastRead[conversationId] === last.id) return;
  updateMeta((m) => ({ ...m, lastRead: { ...m.lastRead, [conversationId]: last.id } }));
  if (meta.settings.readReceipts && last.senderId !== me() && !conversation(conversationId)?.readOnly) queue(conversationId, { t: "read", id: newId(), upTo: last.id });
}

let lastTyping = 0;
export function sendTyping(conversationId: string): void {
  if (!useChat.getState().meta.settings.typing || Date.now() - lastTyping < 4000) return;
  lastTyping = Date.now();
  void api(`/v1/conversations/${conversationId}/typing`, { method: "POST" }).catch(() => undefined);
}

export function onTyping(conversationId: string, userId: string): void {
  if (!useChat.getState().meta.settings.typing) return;
  useChat.setState((s) => ({ typing: { ...s.typing, [conversationId]: { ...s.typing[conversationId], [userId]: Date.now() } } }));
}

/** ADP-10, the morning after: send what was held, or let it go. */
export function releaseHeld(id: string, send: boolean): void {
  const held = useChat.getState().meta.held.find((h) => h.id === id);
  if (!held) return;
  updateMeta((m) => ({ ...m, held: m.held.filter((h) => h.id !== id) }));
  if (!send) return;
  const payload = held.payload;
  if (payload.t === "text") sendVisible(held.conversationId, payload, { body: payload.body });
  else if (payload.t === "media") {
    const { t: _t, id: _id, reply, ...media } = payload;
    sendVisible(held.conversationId, payload, { media, ...(reply ? { reply } : {}) });
  }
}

/** Disappearing messages leave this phone too, on time (MSG-06). */
export function purgeExpired(now = Date.now()): void {
  const { messages } = useChat.getState();
  for (const [id, list] of Object.entries(messages)) {
    if (list.some((m) => m.expiresAt !== undefined && m.expiresAt <= now)) setMessages(id, (l) => l.filter((m) => m.expiresAt === undefined || m.expiresAt > now));
  }
}

/** Live hints from the server (connection.ts). */
export function onChatHint(type: string, conversationId?: string): void {
  if (!useChat.getState().ready) return;
  if (type === "chat.roster" && !conversationId) {
    void refreshConversations()
      .then(() => processWelcomes())
      .then(async () => {
        for (const c of useChat.getState().conversations) await syncConversation(c.id).catch(() => undefined);
      })
      .catch(() => undefined);
    return;
  }
  if (!conversationId) return;
  void (async () => {
    if (type === "chat.roster") {
      await refreshConversations();
      await processWelcomes();
    }
    await syncConversation(conversationId);
    if (type === "chat.message") await refreshConversations();
  })().catch(() => undefined);
}

/** MSG-07: this message and up to three around it, decrypted here, sent because the reporter chose to. */
export async function reportMessage(conversationId: string, messageId: string, reason: "harassment" | "fake" | "inappropriate" | "other"): Promise<void> {
  const list = (useChat.getState().messages[conversationId] ?? []).filter((m) => !m.deleted && m.kind !== "timer");
  const index = list.findIndex((m) => m.id === messageId);
  if (index < 0) return;
  const around = list.slice(Math.max(0, index - 2), index + 2);
  await api(`/v1/conversations/${conversationId}/report`, {
    method: "POST",
    body: {
      reason,
      messages: around.map((m) => ({ id: m.id, userId: m.senderId, body: m.body ?? (m.media ? `[${m.media.kind}]` : ""), at: m.at, reported: m.id === messageId })),
    },
  });
}

/** Sign-out: chat keys and history of this account leave the phone. */
export async function forgetChat(userId: string): Promise<void> {
  await removeAllSealed(`${userId}.`);
  device = null;
  registered = false;
  outbox = [];
  useChat.setState({ ready: false, conversations: [], messages: {}, meta: EMPTY_META, typing: {}, waiting: {} });
}

export const chatDeviceId = () => device?.deviceId ?? null;
