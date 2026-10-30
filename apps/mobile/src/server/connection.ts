import { haptic } from "@/motion/haptics";
import { AppState as RNAppState } from "react-native";
import type { CustomDrink } from "@/drinks/presets";
import { createTranslator } from "@/i18n";
import { clearAccountHistory, useAppStore } from "@/state/store";
import { flush, onSyncEvent, setTransport, submit } from "@/sync/engine";
import { HttpTransport } from "@/sync/httpTransport";
import { LocalTransport } from "@/sync/localTransport";
import type { DrinkEntry, StoredProfile } from "@/sync/types";
import { api } from "./api";
import { refreshCrews, refreshLiveParty, refreshParties, useCrewData } from "./crewData";
import { refreshRadar, refreshSos } from "./radarData";
import { useSession, type ServerSession } from "./session";
import { showToast } from "@/ui/Toast";
import { backupIfDue } from "@/chat/backup";
import { onChatHint, onTyping, startChat } from "@/chat/engine";
import { onCheers } from "@/party/cheers";
import { clearInbox, refreshInbox } from "@/notify/inbox";
import { forgetPush, onNotificationHint, registerForPush } from "@/notify/push";

type Deleted = { id: string; deleted: true };
interface SyncResponse {
  serverTime: number;
  drinks: (Deleted | (Omit<DrinkEntry, "sync"> & { verified: boolean }))[];
  water: (Deleted | { id: string; at: number })[];
  customDrinks: (Deleted | CustomDrink)[];
  preferences: Record<string, unknown> | null;
  profile: StoredProfile | null;
}

const isDeleted = (item: object): item is Deleted => "deleted" in item;

/** Ids with a write still in the queue: the server copy must not overwrite them (SYNC-03). */
function pendingIds(): Set<string> {
  const ids = new Set<string>();
  for (const { mutation } of useAppStore.getState().outbox) {
    if ("drink" in mutation) ids.add(mutation.drink.id);
    if ("water" in mutation) ids.add(mutation.water.id);
  }
  return ids;
}

/** Delta sync (SYNC-05): the server copy wins for everything not waiting in the queue. */
export async function pull(): Promise<void> {
  const state = useAppStore.getState();
  const since = state.syncCursor ?? 0;
  const data = await api<SyncResponse>(`/v1/sync?since=${since}`);
  const pending = pendingIds();

  useAppStore.setState((current) => {
    const drinks = new Map(current.drinks.map((d) => [d.id, d]));
    for (const item of data.drinks) {
      if (pending.has(item.id)) continue;
      if (isDeleted(item)) drinks.delete(item.id);
      else {
        const { verified: _verified, ...drink } = item;
        drinks.set(item.id, { ...drink, sync: "saved" });
      }
    }
    const water = new Map(current.water.map((w) => [w.id, w]));
    for (const item of data.water) {
      if (pending.has(item.id)) continue;
      if (isDeleted(item)) water.delete(item.id);
      else water.set(item.id, { id: item.id, at: item.at, sync: "saved" });
    }
    const customDrinks = new Map(current.customDrinks.map((d) => [d.id, d]));
    for (const item of data.customDrinks) {
      if (isDeleted(item)) customDrinks.delete(item.id);
      else customDrinks.set(item.id, item);
    }
    return {
      drinks: [...drinks.values()],
      water: [...water.values()],
      customDrinks: [...customDrinks.values()],
      preferences: data.preferences ? { ...current.preferences, ...data.preferences } : current.preferences,
      profile: data.profile ?? current.profile,
      syncCursor: data.serverTime,
    };
  });
}

/**
 * First link with a server: everything logged before the account existed goes up once.
 * Ids are the client's UUIDs, so a retry never duplicates anything.
 */
function uploadLocalHistory(): void {
  const state = useAppStore.getState();
  if (state.uploadedToServerAt) return;
  if (state.profile) submit({ kind: "profile.set", profile: state.profile, previous: state.profile });
  submit({ kind: "preferences.set", patch: state.preferences, previous: state.preferences });
  for (const drink of state.drinks) submit({ kind: "drink.add", drink: { ...drink, sync: "pending" } });
  for (const water of state.water) submit({ kind: "water.add", water: { ...water, sync: "pending" } });
  for (const custom of state.customDrinks) submit({ kind: "customDrink.set", drink: custom, previous: custom });
  useAppStore.setState({ uploadedToServerAt: Date.now() });
}

let socket: WebSocket | null = null;
let retry = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let stopped = true;
const FOREGROUND_REFRESH_MS = 15_000;

function openSocket(session: ServerSession): void {
  if (stopped || socket) return;
  const url = `${session.url.replace(/^http/, "ws")}/v1/live?token=${encodeURIComponent(session.token)}`;
  const ws = new WebSocket(url);
  socket = ws;
  ws.onopen = () => {
    retry = 0;
    // Anything that arrived while the socket was down is picked up now.
    void startChat().then(() => backupIfDue());
  };
  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(String(event.data)) as {
        type: string;
        partyId?: string;
        crewId?: string;
        conversationId?: string;
        userId?: string;
        withName?: string;
        proof?: boolean;
        id?: string;
        kind?: string;
        alert?: boolean;
      };
      // O-38: a new inbox item; the inbox decides how it shows.
      if (message.type === "notification" && message.id && message.kind) {
        void onNotificationHint({ id: message.id, kind: message.kind, alert: Boolean(message.alert) }).catch(() => undefined);
      }
      if (message.type === "cheers") onCheers(message.withName ?? "", Boolean(message.proof));
      if (message.type === "chat.typing" && message.conversationId && message.userId) onTyping(message.conversationId, message.userId);
      else if (message.type.startsWith("chat.")) onChatHint(message.type, message.conversationId);
      if (message.type === "party.changed" && message.partyId) void refreshLiveParty(message.partyId).catch(() => undefined);
      if (message.type === "party.changed" || message.type === "crew.changed") void refreshParties().catch(() => undefined);
      if (message.type === "crew.changed") {
        void refreshCrews().catch(() => undefined);
        void refreshSos().catch(() => undefined);
        if (message.crewId) void refreshRadar(message.crewId).catch(() => undefined);
      }
      if (message.type === "sync") void pull().catch(() => undefined);
      if (message.type === "party.unwell" && message.partyId) {
        // N-36: a quiet heads-up; the banner on the party screen says who.
        haptic.error();
        void refreshLiveParty(message.partyId).catch(() => undefined);
      }
      // With the inbox (O-38) the new-device notice arrives as a notification; older servers send only this hint.
      if (message.type === "security.newDevice" && !hasInbox) showToast({ message: createTranslator(useAppStore.getState().preferences.language).t("account.newDevice") });
    } catch {
      // A malformed hint is ignored: the next foreground sync catches up anyway.
    }
  };
  ws.onclose = () => {
    socket = null;
    if (stopped) return;
    // Backoff with jitter, capped at 30 s.
    const delay = Math.min(30_000, 1_000 * 2 ** retry) * (0.5 + Math.random() / 2);
    retry += 1;
    retryTimer = setTimeout(() => {
      const current = useSession.getState().session;
      if (current) openSocket(current);
    }, delay);
  };
}

/** Servers without the notification inbox answer 404: the app then keeps the older hints. */
let hasInbox = false;

async function refreshAll(): Promise<void> {
  await flush();
  // N-35: the inbox is fetched on every return to the foreground, which also covers builds without push.
  const inbox = refreshInbox().then(
    () => (hasInbox = true),
    () => undefined,
  );
  await Promise.allSettled([pull(), refreshCrews(), refreshParties(), refreshSos(), inbox]);
  await Promise.allSettled(useCrewData.getState().crews.map((crew) => refreshRadar(crew.id)));
}

let unsubscribeAppState: (() => void) | null = null;
let unsubscribeSync: (() => void) | null = null;

/** Called whenever the session changes: picks the transport and keeps the socket alive. */
export function connect(session: ServerSession | null): void {
  stopped = true;
  socket?.close();
  socket = null;
  if (retryTimer) clearTimeout(retryTimer);
  unsubscribeAppState?.();
  unsubscribeSync?.();

  if (!session) {
    setTransport(new LocalTransport());
    clearInbox();
    forgetPush();
    hasInbox = false;
    return;
  }
  setTransport(new HttpTransport());
  stopped = false;
  const owner = useAppStore.getState().accountUserId;
  if (owner && owner !== session.userId) clearAccountHistory();
  // History that belonged to no account yet goes up to this one, once.
  else if (!owner) useAppStore.setState({ uploadedToServerAt: null });
  useAppStore.setState({ accountUserId: session.userId });
  uploadLocalHistory();
  void refreshAll();
  void registerForPush().catch(() => undefined);
  openSocket(session);

  let lastForeground = 0;
  const subscription = RNAppState.addEventListener("change", (status) => {
    if (status !== "active") return;
    // Flicking between apps fires "active" again and again: one catch-up per 15 s is plenty,
    // the live socket carries anything in between.
    if (Date.now() - lastForeground < FOREGROUND_REFRESH_MS) return;
    lastForeground = Date.now();
    void refreshAll();
    const current = useSession.getState().session;
    if (current && !socket) openSocket(current);
  });
  unsubscribeAppState = () => subscription.remove();
  // A drink confirmed by the server may change the live party: refetch it.
  unsubscribeSync = onSyncEvent((event) => {
    if (event.type === "accepted" && (event.mutation.kind === "drink.add" || event.mutation.kind === "water.add")) {
      void refreshParties().catch(() => undefined);
    }
  });
}
