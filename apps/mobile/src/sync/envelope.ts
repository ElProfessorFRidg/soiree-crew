import { sha256Hex } from "@crew/mls";
import { api } from "@/server/api";
import { newId, useAppStore } from "@/state/store";
import type { Mutation } from "./types";

// AC-12 (research/anticheat.md §2.6): each queued write carries a per-install sequence number, the
// monotonic clock, a link in a hash chain and a single-use nonce, so the server can date it and spot
// a replay even when it was written offline.

/** A fresh id every time the app starts: monotonic time only means something within one run. */
const BOOT_ID = newId();
const LOW_BOOK = 20;

export interface Envelope {
  installId: string;
  seq: number;
  bootId: string;
  /** performance.now() when the write was made. */
  monoCreated: number;
  prevHash: string;
  hash: string;
  nonce: string | null;
}

const mono = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Seals one write into the chain. Synchronous: it runs where the write is queued. */
export function makeEnvelope(key: string, mutation: Mutation): Envelope {
  const state = useAppStore.getState();
  const installId = state.installId ?? newId();
  const seq = state.eventSeq + 1;
  const prevHash = state.chainHead;
  const hash = sha256Hex(`${prevHash}|${key}|${JSON.stringify(mutation)}`);
  const now = Date.now();
  const book = state.nonceBook.filter((n) => n.expiresAt > now);
  const [first, ...rest] = book;
  useAppStore.setState({ installId, eventSeq: seq, chainHead: hash, nonceBook: rest });
  return { installId, seq, bootId: BOOT_ID, monoCreated: mono(), prevHash, hash, nonce: first?.nonce ?? null };
}

/** What goes on the wire: the monotonic age replaces the raw clock reading. */
export function wireEnvelope(envelope: Envelope) {
  const { monoCreated, ...rest } = envelope;
  return { ...rest, ageMs: envelope.bootId === BOOT_ID ? Math.max(0, Math.round(mono() - monoCreated)) : null };
}

/** Keeps the nonce book stocked while online. */
export async function refillNonces(): Promise<void> {
  const now = Date.now();
  const book = useAppStore.getState().nonceBook.filter((n) => n.expiresAt > now);
  if (book.length >= LOW_BOOK) return;
  const { nonces } = await api<{ nonces: { nonce: string; expiresAt: number }[] }>("/v1/nonces", { method: "POST" });
  useAppStore.setState((s) => ({ nonceBook: [...s.nonceBook.filter((n) => n.expiresAt > now), ...nonces] }));
}
