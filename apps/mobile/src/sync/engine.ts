import { applyMutation, newId, revertMutation, setSyncState, useAppStore } from "@/state/store";
import { LocalTransport } from "./localTransport";
import { makeEnvelope } from "./envelope";
import type { Mutation, PendingMutation, RejectionReason, Transport } from "./types";

// The one path for every write (engineering standards: no screen calls the backend on its own).
// Optimistic apply, persistent ordered queue, idempotency key, reconciliation, rollback.

export type SyncEvent =
  | { type: "accepted"; mutation: Mutation }
  | { type: "rejected"; mutation: Mutation; reason: RejectionReason }
  | { type: "offline"; queued: number }
  | { type: "slow" };

type Listener = (event: SyncEvent) => void;

const listeners = new Set<Listener>();
let transport: Transport = new LocalTransport();
let flushing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

const BASE_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;
/** After this many temporary failures in a row the user is told, but retries go on. */
const SLOW_AFTER_ATTEMPTS = 3;

export function onSyncEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(event: SyncEvent): void {
  for (const listener of listeners) listener(event);
}

export function setTransport(next: Transport): void {
  transport = next;
}

/** Applies the change at once, queues it for the server and returns its idempotency key. */
export function submit(mutation: Mutation): string {
  applyMutation(mutation);
  const id = newId();
  const pending: PendingMutation = { id, mutation, createdAt: Date.now(), attempts: 0, envelope: makeEnvelope(id, mutation) };
  useAppStore.setState((state) => ({ outbox: [...state.outbox, pending] }));
  void flush();
  return pending.id;
}

function dequeue(id: string): void {
  useAppStore.setState((state) => ({ outbox: state.outbox.filter((item) => item.id !== id) }));
}

function scheduleRetry(attempts: number): void {
  if (retryTimer) return;
  // Exponential backoff with jitter (SYNC-04).
  const delay = Math.min(MAX_RETRY_MS, BASE_RETRY_MS * 2 ** attempts) * (0.5 + Math.random() / 2);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flush();
  }, delay);
}

/** Sends queued mutations in order. Safe to call any time: on launch, on foreground, on reconnect. */
export async function flush(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    for (;;) {
      const next = useAppStore.getState().outbox[0];
      if (!next) return;
      const result = await transport.send(next);

      if (result.status === "accepted") {
        dequeue(next.id);
        setSyncState(next.mutation, "saved");
        emit({ type: "accepted", mutation: next.mutation });
        continue;
      }
      if (result.status === "rejected") {
        // Definitive: roll back at once, never retried silently.
        dequeue(next.id);
        revertMutation(next.mutation);
        emit({ type: "rejected", mutation: next.mutation, reason: result.reason });
        continue;
      }

      const attempts = next.attempts + 1;
      useAppStore.setState((state) => ({
        outbox: state.outbox.map((item) => (item.id === next.id ? { ...item, attempts } : item)),
      }));
      if (result.status === "offline") {
        const queue = useAppStore.getState().outbox;
        for (const item of queue) setSyncState(item.mutation, "queued");
        emit({ type: "offline", queued: queue.length });
      } else if (attempts === SLOW_AFTER_ATTEMPTS) {
        emit({ type: "slow" });
      }
      scheduleRetry(attempts);
      return;
    }
  } finally {
    flushing = false;
  }
}
