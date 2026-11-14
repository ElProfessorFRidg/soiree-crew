import { HttpError } from "./context";
import { isIP } from "node:net";

/** IPv6 privacy addresses from the same /64 share a network budget, like IPv4 NAT clients. */
export function networkKey(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  const host = new URL(`http://[${ip}]`).hostname.slice(1, -1);
  const [left = "", right = ""] = host.split("::");
  const a = left ? left.split(":") : [];
  const b = right ? right.split(":") : [];
  const groups = host.includes("::") ? [...a, ...Array<string>(8 - a.length - b.length).fill("0"), ...b] : a;
  const numbers = groups.map((group) => Number.parseInt(group, 16));
  if (numbers.slice(0, 5).every((n) => n === 0) && numbers[5] === 0xffff) {
    return [numbers[6]! >> 8, numbers[6]! & 255, numbers[7]! >> 8, numbers[7]! & 255].join(".");
  }
  return `${numbers.slice(0, 4).map((n) => n.toString(16)).join(":")}::/64`;
}

export class RateLimitError extends HttpError {
  constructor(readonly retryAfterSeconds: number) {
    super(429, "too_many_attempts");
  }
}

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
      if (!entry && this.hits.size >= 10_000) {
        this.sweep(now);
        if (this.hits.size >= 10_000) throw new RateLimitError(Math.ceil(this.windowMs / 1000));
      }
      this.hits.set(key, { windowStart: now, count: 1 });
      if (this.hits.size > 10_000) this.sweep(now);
      return;
    }
    entry.count += 1;
    if (entry.count > this.max) throw new RateLimitError(Math.max(1, Math.ceil((entry.windowStart + this.windowMs - now) / 1000)));
  }

  private sweep(now: number): void {
    for (const [key, entry] of this.hits) if (now - entry.windowStart >= this.windowMs) this.hits.delete(key);
  }
}

/** A bounded token bucket: normal bursts fit, sustained floods must wait for refill. */
export class TokenBucket {
  private readonly buckets = new Map<string, { tokens: number; at: number }>();
  constructor(readonly capacity: number, private readonly refillPerMinute: number, private readonly now: () => number, private readonly maxKeys = 10_000) {}

  check(key: string, cost = 1): void {
    const now = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= this.maxKeys) {
        const idleMs = this.capacity * 60_000 / this.refillPerMinute;
        for (const [id, value] of this.buckets) if (now - value.at >= idleMs) this.buckets.delete(id);
        if (this.buckets.size >= this.maxKeys) throw new RateLimitError(60);
      }
      bucket = { tokens: this.capacity, at: now };
      this.buckets.set(key, bucket);
    }
    bucket.tokens = Math.min(this.capacity, bucket.tokens + Math.max(0, now - bucket.at) * this.refillPerMinute / 60_000);
    bucket.at = now;
    if (bucket.tokens < cost) throw new RateLimitError(Math.max(1, Math.ceil((cost - bucket.tokens) * 60 / this.refillPerMinute)));
    bucket.tokens -= cost;
  }
}
