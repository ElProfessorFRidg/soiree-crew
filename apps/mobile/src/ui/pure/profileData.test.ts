import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerSession } from "../../server/session";

const account = vi.hoisted(() => ({ session: null as ServerSession | null }));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("@/system/extra", () => ({ extraNumber: () => 0 }));
vi.mock("@/server/session", () => ({ useSession: { getState: () => ({ session: account.session }) } }));
import { fetchProfile } from "../../server/profileData";
import { ApiError } from "../../server/api";

const id = "9c7445aa-a412-42e8-8827-f42e1e248f22";
const profile = (userId = id) => ({ userId, relation: { me: true, friend: false, crewMate: false }, friendship: "none", muted: false, sections: { identity: { displayName: "Camille", username: "camille", bio: "", country: "" } } });
beforeEach(() => { account.session = { userId: id, url: "https://profile.example", token: "fixture-token", username: "camille", displayName: "Camille" }; });
afterEach(() => { vi.unstubAllGlobals(); });

describe("personal profile requests", () => {
  it("uses the account's real UUID with its own server and credentials, including older servers", async () => {
    const fetcher = vi.fn(async (url: string) => url.endsWith("/me/profile")
      ? new Response('{"error":"not_found"}', { status: 404 })
      : new Response(JSON.stringify(profile()), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(fetchProfile("me")).resolves.toMatchObject({ userId: id, sections: { identity: { displayName: "Camille" } } });
    expect(fetcher.mock.calls[0]?.[0]).toBe(`https://profile.example/v1/users/${id}/profile`);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not send profile requests without an account", async () => {
    account.session = null;
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(fetchProfile("me")).rejects.toMatchObject({ failure: { kind: "http", status: 401 } });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("preserves real network and session failures rather than manufacturing an empty profile", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(new Response('{"error":"unauthenticated"}', { status: 401 })).mockResolvedValueOnce(new Response('{"error":"internal"}', { status: 500 })).mockResolvedValueOnce(new Response(JSON.stringify(profile()), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(fetchProfile("me")).rejects.toMatchObject({ failure: { kind: "offline" } });
    await expect(fetchProfile("me")).rejects.toMatchObject({ failure: { status: 401, code: "unauthenticated" } });
    await expect(fetchProfile("me")).rejects.toMatchObject({ failure: { status: 500, code: "internal" } });
    await expect(fetchProfile("me")).resolves.toMatchObject({ userId: id });
  });
  it("rejects malformed or wrong-account responses and can recover on the next attempt", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    for (const data of [null, {}, { ...profile(), sections: [] }, { ...profile(), sections: {} }, { ...profile(), relation: null }, profile("another-account")]) {
      fetcher.mockResolvedValueOnce(new Response(JSON.stringify(data), { status: 200 }));
      await expect(fetchProfile("me")).rejects.toMatchObject({ failure: { code: "api_response_incompatible" } });
    }
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify(profile()), { status: 200 }));
    await expect(fetchProfile("me")).resolves.toMatchObject({ sections: { identity: { username: "camille" } } });
  });
  it("keeps an intentionally hidden public preview distinct from a failed request", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...profile(), relation: { me: false, friend: false, crewMate: false }, sections: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(fetchProfile("me", "stranger")).resolves.toMatchObject({ sections: {} });
    expect(fetcher.mock.calls[0]?.[0]).toBe(`https://profile.example/v1/users/${id}/profile?as=stranger`);
  });
  it("propagates inaccessible profiles as 404 failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"error":"not_found"}', { status: 404 })));
    await expect(fetchProfile("another-account")).rejects.toBeInstanceOf(ApiError);
  });
  it("lets an explicit retry recover immediately after a proxy returns HTML, then clears the cached failure", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("<html>Proxy</html>", { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify(profile()), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify(profile()), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(fetchProfile("me")).rejects.toMatchObject({ failure: { code: "api_response_incompatible" } });
    await expect(fetchProfile("me", undefined, { recheckCompatibility: true })).resolves.toMatchObject({ userId: id });
    await expect(fetchProfile("me")).resolves.toMatchObject({ userId: id });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
