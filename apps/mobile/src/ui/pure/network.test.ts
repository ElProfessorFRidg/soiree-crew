import { describe, expect, it, vi } from "vitest";
import { ReadCache } from "./readCache";
import { RequestCooldown, retryAfterMs } from "./requestCooldown";

describe("public reads", () => {
  it("deduplicates reads, isolates server keys and expires snapshots", async () => {
    let now = 0;
    const cache = new ReadCache(() => now);
    const load = vi.fn().mockResolvedValue({ public: true });
    await Promise.all([cache.get("server-a/place", load), cache.get("server-a/place", load)]);
    expect(load).toHaveBeenCalledTimes(1);
    await cache.get("server-b/place", load);
    expect(load).toHaveBeenCalledTimes(2);
    now = 11_000;
    await cache.get("server-a/place", load);
    expect(load).toHaveBeenCalledTimes(3);
  });
});

describe("429 cooldown", () => {
  it("honours seconds and HTTP dates and tolerates malformed headers", () => {
    expect(retryAfterMs("10", 0)).toBe(10_000);
    expect(retryAfterMs("Thu, 01 Jan 1970 00:01:00 GMT", 0)).toBe(60_000);
    expect(retryAfterMs("bad", 0)).toBe(1000);
  });
  it("does not let one account's cooldown block another account or safety calls", () => {
    const cooldown = new RequestCooldown();
    cooldown.block("jade:read", 10_000, 0);
    expect(cooldown.remaining("jade:read", 1000)).toBe(9000);
    expect(cooldown.remaining("theo:read", 1000)).toBe(0);
    expect(cooldown.remaining("jade:safety", 1000)).toBe(0);
    expect(cooldown.remaining("jade:read", 10_001)).toBe(0);
  });
});
