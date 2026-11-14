import { describe, expect, it, vi } from "vitest";
import { PublicCache } from "./publicCache";

describe("public cache", () => {
  it("coalesces concurrent reads, expires and invalidates after writes", async () => {
    let now = 0;
    const cache = new PublicCache<number>(15_000, () => now);
    const load = vi.fn().mockResolvedValue(1);
    await Promise.all([cache.get("place", load), cache.get("place", load)]);
    expect(load).toHaveBeenCalledTimes(1);
    now = 15_001;
    await cache.get("place", load);
    expect(load).toHaveBeenCalledTimes(2);
    cache.clear();
    await cache.get("place", load);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("does not let a read already in flight restore data invalidated by a write", async () => {
    const cache = new PublicCache<number>(15_000, () => 0);
    let resolve!: (value: number) => void;
    const old = cache.get("place", () => new Promise<number>((yes) => { resolve = yes; }));
    await Promise.resolve();
    cache.clear();
    await cache.get("place", async () => 2);
    resolve(1);
    await old;
    expect(await cache.get("place", async () => 3)).toBe(2);
  });

  it("does not cache an error", async () => {
    const cache = new PublicCache<number>(15_000, () => 0);
    await expect(cache.get("place", async () => { throw new Error("offline"); })).rejects.toThrow();
    expect(await cache.get("place", async () => 2)).toBe(2);
  });
});
