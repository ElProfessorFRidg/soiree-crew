import { HttpError } from "./context";

/**
 * SEC-07: a fixed-window counter per key (an IP, usually), in memory. Enough for
 * one server process; a cluster would move it to the database or Redis.
 */
export class RateLimiter {
  private readonly hits = new Map<string, { windowStart: number; count: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number,
  ) {}

  /** Throws 429 once `key` went over the limit in the current window. */
  check(key: string): void {
    const now = this.now();
    const entry = this.hits.get(key);
    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.hits.set(key, { windowStart: now, count: 1 });
      if (this.hits.size > 10_000) this.sweep(now);
      return;
    }
    entry.count += 1;
    if (entry.count > this.max) throw new HttpError(429, "too_many_attempts");
  }

  private sweep(now: number): void {
    for (const [key, entry] of this.hits) if (now - entry.windowStart >= this.windowMs) this.hits.delete(key);
  }
}
