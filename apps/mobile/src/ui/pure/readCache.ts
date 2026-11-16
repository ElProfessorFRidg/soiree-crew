/** Short-lived, bounded cache for explicitly public reads; never stores credentials or private pages. */
export class ReadCache {
  private entries = new Map<string, { until: number; value: Promise<unknown> }>();
  constructor(private readonly now: () => number = Date.now, private readonly max = 100) {}
  get<T>(key: string, load: () => Promise<T>, ttlMs = 10_000): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && hit.until > this.now()) return hit.value as Promise<T>;
    this.entries.delete(key);
    if (this.entries.size >= this.max) this.entries.delete(this.entries.keys().next().value!);
    const value = Promise.resolve().then(load).catch((error: unknown) => {
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
      throw error;
    });
    this.entries.set(key, { until: this.now() + ttlMs, value });
    return value;
  }
  clear(): void { this.entries.clear(); }
}
export const publicReads = new ReadCache();
