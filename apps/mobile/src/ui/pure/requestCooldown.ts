export function retryAfterMs(header: string | null, now = Date.now()): number {
  if (!header) return 1000;
  const seconds = Number(header);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - now;
  return Number.isFinite(delay) ? Math.max(1000, Math.min(delay, 24 * 3_600_000)) : 1000;
}

/** No automatic write replay: callers keep their idempotency keys and ordered outbox. */
export class RequestCooldown {
  private until = new Map<string, number>();
  remaining(key: string, now = Date.now()): number {
    const remaining = Math.max(0, (this.until.get(key) ?? 0) - now);
    if (!remaining) this.until.delete(key);
    return remaining;
  }
  block(key: string, ms: number, now = Date.now()): void {
    for (const [id, end] of this.until) if (end <= now) this.until.delete(id);
    if (this.until.size >= 100) this.until.delete(this.until.keys().next().value!);
    this.until.set(key, Math.max(this.until.get(key) ?? 0, now + ms));
  }
}
