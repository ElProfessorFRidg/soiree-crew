import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingMutation } from "../../sync/types";

const memory = vi.hoisted(() => ({
  state: { outbox: [] as PendingMutation[] },
  applied: [] as unknown[],
  reverted: [] as unknown[],
}));
vi.mock("@/ui/Toast", () => ({ showToast: vi.fn() }));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("@/system/extra", () => ({ extraNumber: () => 115 }));
vi.mock("@/server/session", () => ({ useSession: { getState: () => ({ session: { url: "https://api.example", token: "fixture-session" } }) } }));
vi.mock("@/sync/envelope", () => ({ makeEnvelope: () => undefined, wireEnvelope: () => ({}), refillNonces: async () => undefined }));
vi.mock("@/state/store", () => ({
  useAppStore: {
    getState: () => memory.state,
    setState: (patch: object | ((state: typeof memory.state) => object)) => Object.assign(memory.state, typeof patch === "function" ? patch(memory.state) : patch),
  },
  applyMutation: (mutation: unknown) => memory.applied.push(mutation),
  revertMutation: (mutation: unknown) => memory.reverted.push(mutation),
  setSyncState: () => undefined,
  newId: () => "idempotent-local-change",
}));
import { api, ApiError } from "../../server/api";
import { failureMessage } from "../../server/errors";
import { fr } from "../../i18n/fr";
import { HttpTransport } from "../../sync/httpTransport";
import { LocalTransport } from "../../sync/localTransport";
import { flush, setTransport, submit } from "../../sync/engine";
import { takeCompatibilityNotices } from "../../server/compatibilityEvents";

const unavailable = (reason = "update_required") => new Response(JSON.stringify({ error: "client_update_required", message: "Update this feature", compatibility: { reason, apiVersion: 1, minimumBuild: 120 } }), { status: reason === "feature_unavailable" ? 503 : 426, headers: { "content-type": "application/json", "retry-after": "60" } });
let caseTime = Date.UTC(2026, 10, 14);
beforeEach(() => { vi.useFakeTimers(); caseTime += 1_000_000; vi.setSystemTime(caseTime); takeCompatibilityNotices(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("client feature failures", () => {
  it("times out a response body that stalls after the server sends its headers", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      signal = init.signal ?? undefined;
      return { status: 200, ok: true, json: () => new Promise((_resolve, reject) => signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))) } as Response;
    }));
    const response = api("/v1/slow-profile-body").catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(10_001);
    expect(signal?.aborted).toBe(true);
    await expect(response).resolves.toMatchObject({ failure: { kind: "timeout" } });
  });
  it("preserves a network failure while receiving JSON instead of reporting an incompatible API", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => { throw new TypeError("Network connection interrupted"); } } as unknown as Response));
    await expect(api("/v1/interrupted-profile-body")).rejects.toMatchObject({ failure: { kind: "offline" } });
  });
  it("honors Retry-After from headers without waiting for a broken refusal body", async () => {
    const json = vi.fn(async () => { throw new TypeError("Network connection interrupted"); });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 429, ok: false, headers: new Headers({ "retry-after": "25" }), json } as unknown as Response));
    await expect(api("/v1/refused-profile-body")).rejects.toMatchObject({ failure: { status: 429, retryAfterMs: 25_000 } });
    expect(json).not.toHaveBeenCalled();
  });
  it("sends version information with authentication and throttles only the failing feature", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(unavailable()).mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(api("/v1/places?lat=48&lng=2")).rejects.toBeInstanceOf(ApiError);
    await expect(api("/v1/places?lat=49&lng=3")).rejects.toMatchObject({ failure: { compatibility: { reason: "update_required" }, retryAfterMs: 300_000 } });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[1].headers).toMatchObject({ authorization: "Bearer fixture-session", accept: "application/json; crew-api=1; crew-build=115; crew-client=ios" });
    expect(takeCompatibilityNotices()).toHaveLength(1);
    await expect(api("/v1/health")).resolves.toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(300_001);
    fetcher.mockResolvedValueOnce(new Response('{"places":[]}', { status: 200 }));
    await expect(api("/v1/places")).resolves.toEqual({ places: [] });
  });
  it("reports an HTML API response and preserves ordinary missing-resource errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response('<!doctype html><title>Proxy</title>', { status: 200, headers: { 'content-type': 'text/html' } })).mockResolvedValueOnce(new Response('{"error":"not_found"}', { status: 404 })));
    await expect(api("/v1/users/private-id/profile?secret=1")).rejects.toMatchObject({ failure: { code: "api_response_incompatible", compatibility: { reason: "server_outdated" } } });
    expect(takeCompatibilityNotices()).toMatchObject([{ feature: "/v1/users/:id/profile", method: "GET", code: "SC_API_01", status: 200 }]);
    await expect(api("/v1/places/missing")).rejects.toMatchObject({ failure: { status: 404, code: "not_found" } });
    expect(takeCompatibilityNotices()).toHaveLength(0);
  });
  it("keeps local writes queued with the same idempotency key when the server requires an update", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(unavailable()));
    memory.state.outbox = []; memory.applied = []; memory.reverted = [];
    setTransport(new HttpTransport());
    const mutation = { kind: "water.add" as const, water: { id: "water-local", at: Date.now(), sync: "pending" as const } };
    const id = submit(mutation);
    await vi.advanceTimersByTimeAsync(0);
    expect(memory.applied).toEqual([mutation]);
    expect(memory.reverted).toEqual([]);
    expect(memory.state.outbox).toMatchObject([{ id, mutation, attempts: 1 }]);
    await vi.advanceTimersByTimeAsync(299_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [{ key: id, status: "accepted", serverTime: Date.now() }] }), { status: 200 })));
    await vi.advanceTimersByTimeAsync(1001);
    expect(memory.state.outbox).toEqual([]);
    expect(memory.reverted).toEqual([]);
  });
  it("lets a guest keep adding local entries without making any API request", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    memory.state.outbox = []; memory.applied = []; memory.reverted = [];
    setTransport(new LocalTransport());
    submit({ kind: "water.add", water: { id: "guest-water", at: Date.now(), sync: "pending" } });
    await vi.advanceTimersByTimeAsync(0);
    await flush();
    expect(memory.applied).toHaveLength(1);
    expect(memory.state.outbox).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("keeps emergency requests retryable after an incompatible proxy response", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('<!doctype html><title>Proxy</title>', { status: 200, headers: { 'content-type': 'text/html' } })).mockResolvedValueOnce(new Response('{"ok":true}', { status: 201 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(api("/v1/sos", { method: "POST", body: {} })).rejects.toMatchObject({ failure: { compatibility: { reason: "server_outdated" } } });
    await expect(api("/v1/sos", { method: "POST", body: {} })).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("honors server retry delays across reads without delaying safety actions", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('{"error":"too_many_attempts"}', { status: 429, headers: { "retry-after": "30" } })).mockResolvedValueOnce(new Response('{"ok":true}', { status: 201 })).mockResolvedValueOnce(new Response('{"places":[]}', { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const failure: unknown = await api("/v1/limited-read").catch((error: unknown) => error);
    expect(failure).toMatchObject({ failure: { status: 429, retryAfterMs: 30_000 } });
    const translator = { t: (key: string, params?: { seconds: number }) => key === "serverCodes.rate_limited_wait" ? fr.serverCodes.rate_limited_wait.replace("{seconds}", String(params?.seconds)) : key } as unknown as Parameters<typeof failureMessage>[1];
    expect(failureMessage(failure, translator)).toBe("Trop de demandes. Réessaie dans 30 s. (SC_HTTP_429)");
    await expect(api("/v1/other-read", { recheckCompatibility: true })).rejects.toMatchObject({ failure: { status: 429, retryAfterMs: 30_000 } });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(api("/v1/sos", { method: "POST", body: {} })).resolves.toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(30_001);
    await expect(api("/v1/other-read")).resolves.toEqual({ places: [] });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
