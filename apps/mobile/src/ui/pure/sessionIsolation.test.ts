import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerSession } from "../../server/session";

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK: "afterFirstUnlock",
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}));
vi.mock("@/system/launchGuard", () => ({ withDeadline: async (_label: string, work: Promise<unknown>) => work }));

import { sessionStillCurrent, useSession } from "../../server/session";

const account = (userId: string, url = "https://crew.example"): ServerSession => ({
  userId,
  url,
  username: userId,
  displayName: userId,
  token: `token-${userId}`,
});

afterEach(() => useSession.setState({ ready: false, session: null }));

describe("in-flight response isolation", () => {
  it("accepts a response only while the exact captured session remains active", () => {
    const first = account("alice");
    useSession.setState({ ready: true, session: first });
    expect(sessionStillCurrent(first)).toBe(true);
    expect(sessionStillCurrent(null)).toBe(false);

    // A fresh sign-in for the same user still invalidates previous requests.
    useSession.setState({ session: { ...first } });
    expect(sessionStillCurrent(first)).toBe(false);
  });

  it("discards responses from an old account, server or logged-out session", () => {
    const first = account("alice");
    useSession.setState({ ready: true, session: first });
    useSession.setState({ session: account("bob") });
    expect(sessionStillCurrent(first)).toBe(false);

    const second = useSession.getState().session;
    useSession.setState({ session: account("bob", "https://other.example") });
    expect(sessionStillCurrent(second)).toBe(false);

    const third = useSession.getState().session;
    useSession.setState({ session: null });
    expect(sessionStillCurrent(third)).toBe(false);
  });
});
