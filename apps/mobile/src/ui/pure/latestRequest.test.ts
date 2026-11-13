import { describe, expect, it, vi } from "vitest";
import { latestRequest } from "./latestRequest";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("live map refreshes", () => {
  it("ignores a previous party's response after switching context", async () => {
    const old = deferred<string[]>();
    const publish = vi.fn();
    const request = latestRequest(() => old.promise, publish);
    const pending = request.load();
    request.dispose();
    old.resolve(["previous crew member"]);
    await pending;
    expect(publish).not.toHaveBeenCalled();
  });

  it("keeps a newer position when overlapping refreshes finish out of order", async () => {
    const older = deferred<number>();
    const newer = deferred<number>();
    const fetch = vi.fn().mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    const publish = vi.fn();
    const request = latestRequest(fetch, publish);
    const first = request.load();
    const second = request.load();
    newer.resolve(2);
    await second;
    older.resolve(1);
    await first;
    expect(publish.mock.calls).toEqual([[2]]);
  });

  it("recovers from a failed refresh and stops fetching after disposal", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(["friend"]);
    const publish = vi.fn();
    const request = latestRequest(fetch, publish);
    await request.load();
    expect(publish).not.toHaveBeenCalled();
    await request.load();
    expect(publish).toHaveBeenCalledWith(["friend"]);
    request.dispose();
    await request.load();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
