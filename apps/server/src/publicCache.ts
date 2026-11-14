/** Bounded public representations only. Failed reads and reads overlapping a write are never cached. */
export class PublicCache<T> {
  private version = 0;
  private entries = new Map<string, { expires: number; value: Promise<T> }>();
  constructor(private readonly ttlMs: number, private readonly now: () => number, private readonly maxEntries = 200) {}

  get(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && hit.expires > this.now()) return hit.value;
    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
    const version = this.version;
    const value = Promise.resolve().then(load).catch((error: unknown) => {
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
      throw error;
    }).then((result) => {
      if (this.version !== version && this.entries.get(key)?.value === value) this.entries.delete(key);
      return result;
    });
    this.entries.set(key, { expires: this.now() + this.ttlMs, value });
    return value;
  }

  clear(): void {
    this.version++;
    this.entries.clear();
  }
}
