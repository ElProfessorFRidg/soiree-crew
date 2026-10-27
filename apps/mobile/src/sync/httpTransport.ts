import { api, ApiError } from "@/server/api";
import { refillNonces, wireEnvelope } from "./envelope";
import type { PendingMutation, RejectionReason, Transport, TransportResult } from "./types";

interface ServerResult {
  key: string;
  status: "accepted" | "rejected";
  serverTime?: number;
  reason?: string;
}

const KNOWN_REASONS: readonly RejectionReason[] = ["future_drink", "invalid", "party_closed"];

/** Sends one queued mutation to POST /v1/mutations with its idempotency key (ADR 0002). */
export class HttpTransport implements Transport {
  async send(pending: PendingMutation): Promise<TransportResult> {
    try {
      const { results } = await api<{ results: ServerResult[] }>("/v1/mutations", {
        method: "POST",
        body: { mutations: [{ key: pending.id, mutation: pending.mutation, ...(pending.envelope ? { envelope: wireEnvelope(pending.envelope) } : {}) }] },
      });
      const result = results[0];
      if (!result) return { status: "temporary" };
      if (result.status === "accepted") {
        void refillNonces().catch(() => undefined);
        return { status: "accepted", serverTime: result.serverTime ?? Date.now() };
      }
      const reason = KNOWN_REASONS.find((known) => known === result.reason) ?? "invalid";
      return { status: "rejected", reason };
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.failure.kind === "offline") return { status: "offline" };
        if (error.failure.kind === "http" && error.failure.status === 400) return { status: "rejected", reason: "invalid" };
      }
      return { status: "temporary" };
    }
  }
}
