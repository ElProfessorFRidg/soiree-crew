import { afterEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ Platform: { OS: "ios" }, Settings: { set: vi.fn() } }));
vi.mock("react-native", () => native);
import { reportStartup } from "../../system/startupReport";
import { stalledSteps, withDeadline } from "../../system/launchGuard";

afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); native.Platform.OS = "ios"; });

describe("startup diagnostics", () => {
  it("reports fixed states before Router loads and rejects arbitrary diagnostic content", () => {
    reportStartup("entry", "ready");
    reportStartup("entry", "ready");
    // Runtime checks also protect calls from the plain JavaScript entry point.
    reportStartup("token=secret" as never, "ready");
    reportStartup("session", "https://account.example/secret" as never);
    expect(native.Settings.set).toHaveBeenCalledTimes(1);
    const state = JSON.parse(native.Settings.set.mock.calls[0]![0].CrewStartupState);
    expect(state).toEqual({ entry: "ready" });
  });
  it("never fails startup when the native diagnostic channel is unavailable", () => {
    native.Settings.set.mockImplementationOnce(() => { throw new Error("unavailable"); });
    expect(() => reportStartup("router", "ready")).not.toThrow();
    native.Platform.OS = "web";
    reportStartup("fonts", "ready");
    expect(native.Settings.set).toHaveBeenCalledTimes(1);
  });
  it("remembers rejected Keychain reads as fallbacks and still resolves", async () => {
    await expect(withDeadline("rejected-keychain", Promise.reject(new Error("access denied")), null)).resolves.toBeNull();
    expect(stalledSteps()).toContain("rejected-keychain");
  });
  it("does not let a late native answer undo a deadline fallback", async () => {
    vi.useFakeTimers();
    let finish!: (value: string) => void;
    const work = new Promise<string>((resolve) => { finish = resolve; });
    const result = withDeadline("stalled-keychain", work, "fallback", 100);
    await vi.advanceTimersByTimeAsync(101);
    await expect(result).resolves.toBe("fallback");
    finish("too late");
    await expect(result).resolves.toBe("fallback");
    expect(stalledSteps()).toContain("stalled-keychain");
  });
});
