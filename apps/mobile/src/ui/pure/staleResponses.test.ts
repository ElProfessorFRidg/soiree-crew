import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerSession } from "../../server/session";

const state = vi.hoisted(() => ({
  current: null as ServerSession | null,
  api: vi.fn(),
}));

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("expo-notifications", () => ({ setBadgeCountAsync: vi.fn(async () => undefined) }));
vi.mock("@/server/api", () => ({ api: state.api }));
vi.mock("@/server/session", () => ({
  useSession: { getState: () => ({ session: state.current }) },
  sessionStillCurrent: (captured: ServerSession | null) => !!captured && captured === state.current,
}));
vi.mock("@/server/crewData", () => ({
  useCrewData: { getState: () => ({ crews: [], parties: [], live: {} }), setState: vi.fn() },
  refreshCrews: vi.fn(),
  refreshParties: vi.fn(),
}));

import { clearInvitations, refreshInvitations, useInvitations } from "../../server/socialData";
import { clearInbox, refreshInbox, useInbox } from "../../notify/inbox";

const account = (name: string): ServerSession => ({
  userId: name,
  username: name,
  displayName: name,
  url: "https://crew.example",
  token: `token-${name}`,
});
const pending = <T>() => {
  let complete!: (value: T) => void;
  const promise = new Promise<T>((resolve) => { complete = resolve; });
  return { promise, complete };
};

beforeEach(() => {
  state.current = account("alice");
  state.api.mockReset();
  clearInvitations();
  clearInbox();
});
afterEach(() => { state.current = null; });

describe("out-of-order account responses", () => {
  it("does not repopulate invitations after account replacement", async () => {
    const response = pending<{ partyInvites: number; friendRequests: number; joinRequests: []; mentions: {}; total: number }>();
    state.api.mockReturnValueOnce(response.promise);
    const job = refreshInvitations();
    state.current = account("bob");
    clearInvitations();
    response.complete({ partyInvites: 9, friendRequests: 0, joinRequests: [], mentions: {}, total: 9 });
    await job;
    expect(useInvitations.getState().total).toBe(0);
  });

  it("does not restore old-account notifications after sign-out", async () => {
    const response = pending<{ items: []; unread: number }>();
    state.api.mockReturnValueOnce(response.promise);
    const job = refreshInbox();
    state.current = null;
    clearInbox();
    response.complete({ items: [], unread: 42 });
    await expect(job).resolves.toEqual([]);
    expect(useInbox.getState()).toEqual({ items: [], unread: 0, loaded: false });
  });

  it("continues to publish data from the unchanged session", async () => {
    state.api.mockResolvedValueOnce({ partyInvites: 2, friendRequests: 1, joinRequests: [], mentions: {}, total: 3 });
    await refreshInvitations();
    expect(useInvitations.getState().total).toBe(3);
  });
});
