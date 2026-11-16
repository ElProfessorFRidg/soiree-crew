import { describe, expect, it } from "vitest";
import { networkKey, RateLimiter, RateLimitError, TokenBucket } from "./ratelimit";

describe("request budgets", () => {
  it("groups IPv6 privacy addresses and IPv4-mapped literals consistently", () => {
    expect(networkKey("2001:db8:1234:abcd::1")).toBe(networkKey("2001:0db8:1234:abcd:ffff:0:0:2"));
    expect(networkKey("2001:db8:1234:abce::1")).not.toBe(networkKey("2001:db8:1234:abcd::1"));
    expect(networkKey("::ffff:192.0.2.1")).toBe(networkKey("192.0.2.1"));
  });
  it("accepts a sync burst, throttles sustained use, and refills without a window-boundary burst", () => {
    let now = 0;
    const bucket = new TokenBucket(120, 240, () => now);
    bucket.check("jade", 120);
    expect(() => bucket.check("jade")).toThrow(RateLimitError);
    expect(() => bucket.check("theo")).not.toThrow();
    now = 250;
    expect(() => bucket.check("jade")).not.toThrow();
    expect(() => bucket.check("jade")).toThrow(RateLimitError);
    now = 60_000;
    expect(() => bucket.check("jade", 120)).not.toThrow();
  });

  it("keeps memory bounded without forgetting active throttled identities", () => {
    let now = 0;
    const bucket = new TokenBucket(1, 1, () => now, 2);
    bucket.check("one");
    bucket.check("two");
    expect(() => bucket.check("three")).toThrow(RateLimitError);
    expect(() => bucket.check("one")).toThrow(RateLimitError);
    now = 60_000;
    expect(() => bucket.check("three")).not.toThrow();
  });

  it("reports how long a route-specific fixed window has left", () => {
    let now = 0;
    const limiter = new RateLimiter(1, 60_000, () => now);
    limiter.check("ip");
    now = 20_000;
    try { limiter.check("ip"); throw new Error("Expected rate limit"); }
    catch (error) { expect(error).toMatchObject({ status: 429, retryAfterSeconds: 40 }); }
  });
});
