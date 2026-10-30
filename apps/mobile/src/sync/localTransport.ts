import type { PendingMutation, Transport, TransportResult } from "./types";

/** Tolerance for clock skew between taps and validation. */
const FUTURE_TOLERANCE_MS = 60_000;

/**
 * Stand-in for the backend until crew features need one (ADR 0001). It enforces
 * the same rules the server will, so screens already handle rejections, and it
 * answers asynchronously so "pending" is a real state rather than a fake delay.
 */
export class LocalTransport implements Transport {
  async send({ mutation }: PendingMutation): Promise<TransportResult> {
    await Promise.resolve();
    const now = Date.now();
    switch (mutation.kind) {
      case "drink.add":
      case "drink.edit": {
        const { drink } = mutation;
        if (drink.consumedAt > now + FUTURE_TOLERANCE_MS) return { status: "rejected", reason: "future_drink" };
        if (!(drink.volumeMl > 0) || drink.abv < 0 || drink.abv > 1) return { status: "rejected", reason: "invalid" };
        return { status: "accepted", serverTime: now };
      }
      case "profile.set": {
        const { weightKg } = mutation.profile;
        if (!(weightKg >= 35 && weightKg <= 250)) return { status: "rejected", reason: "invalid" };
        return { status: "accepted", serverTime: now };
      }
      default:
        return { status: "accepted", serverTime: now };
    }
  }
}
