import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ probe: vi.fn() }));
vi.mock("react-native", () => ({ Platform: { OS: "ios" }, Settings: { set: vi.fn() } }));
vi.mock("expo-secure-store", () => ({ getItemAsync: vi.fn(), setItemAsync: vi.fn(), deleteItemAsync: vi.fn(), AFTER_FIRST_UNLOCK: "unlocked" }));
vi.mock("@/system/extra", () => ({ extraNumber: () => 121 }));
vi.mock("../../../modules/network-diagnostics", () => ({ hasNativeNetworkProbe: true, nativeNetworkProbe: (base: string, path: string) => native.probe(base, path) }));

import { api, ApiError } from "../../server/api";
import { normaliseServerUrl, useSession, type ServerSession } from "../../server/session";
import { inspectServer, probePublicServer, formatServerDiagnostic, decodeOperatorDiagnostic, type ServerDiagnosticReport } from "../../server/serverDiagnostics";
import { recentNetworkDiagnostics } from "../../server/diagnosticLog";

const id = "36cb8f7d-4981-4244-80c0-5d8fba3dd073";
let count = 0;
let session: ServerSession;
const response = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });
const publicOK = () => ({ code: "SC_OK", httpStatus: 200, durationMs: 3, native: true, contractValid: true });
const catalog = () => ({ generatedAt: Date.now(), apiVersion: 1, revision: "a".repeat(40), readiness: { state: "ready", code: "SC_OK", checkedAt: Date.now(), durationMs: 1 }, services: { ai: false, appleSignIn: false, iosPush: false, androidPush: false }, routes: [
  { method: "GET", path: "/v1/me", state: "available", access: "account" },
  { method: "POST", path: "/v1/mutations", state: "available", access: "account" },
] });
beforeEach(() => {
  session = { userId: id, url: `https://diagnostic-${++count}.example`, token: "never-copy-session-token", username: "private-account-name", displayName: "Private name" };
  useSession.setState({ ready: true, session });
  native.probe.mockReset().mockResolvedValue(publicOK());
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("connection error evidence", () => {
  it("distinguishes an unconfigured server without sending any request", async () => {
    useSession.setState({ session: null }); const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const error = await api("/v1/me").catch((failure: ApiError) => failure);
    expect(error).toMatchObject({ failure: { kind: "configuration" }, diagnostic: { code: "SC_CFG_01" } });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not forward the stored account token to another server", async () => {
    const fetcher = vi.fn().mockImplementation(async () => response({ ok: true })); vi.stubGlobal("fetch", fetcher);
    await api("/v1/health", { baseUrl: "https://another-server.example" });
    expect(fetcher.mock.calls[0]![1].headers.authorization).toBeUndefined();
    await api("/v1/health");
    expect(fetcher.mock.calls[1]![1].headers.authorization).toBe(`Bearer ${session.token}`);
    await api("/v1/health", { baseUrl: "https://new-account-server.example", token: "explicit-new-account-token" });
    expect(fetcher.mock.calls[2]![1].headers.authorization).toBe("Bearer explicit-new-account-token");
  });
  it("keeps a database code and request reference without logging credentials, IDs or query strings", async () => {
    const ref = "sc_21e80a42-75bd-4ca0-9024-07515a534cf1";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: "database_unavailable" }, 503, { "x-crew-diagnostic-code": "SC_DB_02", "x-crew-request-id": ref })));
    const error = await api(`/v1/users/private-user-id/profile?token=private-query`).catch((failure: ApiError) => failure);
    expect(error).toMatchObject({ diagnostic: { code: "SC_DB_02", requestId: ref } });
    const history = recentNetworkDiagnostics(session.url, session.userId);
    const report: ServerDiagnosticReport = { server: session.url, at: Date.now(), checks: [], operator: null, authorized: false, native: true, complete: true };
    const copy = formatServerDiagnostic(report, { version: "test", build: 121, channel: "preview", target: "ipad" }, history);
    expect(copy).toContain("SC_DB_02"); expect(copy).toContain(ref);
    for (const secret of [session.token, session.username, session.displayName, id, "private-user-id", "private-query"]) expect(copy).not.toContain(secret);
  });
  it("preserves native DNS evidence and does not describe an HTTP 500 as offline", async () => {
    native.probe.mockResolvedValueOnce({ ...publicOK(), code: "SC_DNS_01", httpStatus: 0, nativeErrorCode: -1003, contractValid: false });
    expect(await probePublicServer(session.url, "/v1/health")).toMatchObject({ code: "SC_DNS_01", nativeErrorCode: -1003 });
    native.probe.mockResolvedValueOnce({ ...publicOK(), code: "SC_HTTP_500", httpStatus: 500, contractValid: false });
    expect(await probePublicServer(session.url, "/v1/info")).toMatchObject({ code: "SC_HTTP_500", httpStatus: 500 });
  });
  it("keeps public checks credential-free on the fetch fallback and validates the response shape", async () => {
    native.probe.mockReturnValue(null);
    const fetcher = vi.fn().mockResolvedValue(response({ error: "internal" }, 500)); vi.stubGlobal("fetch", fetcher);
    expect(await probePublicServer(session.url, "/v1/info")).toMatchObject({ code: "SC_HTTP_500", httpStatus: 500, native: false });
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ credentials: "omit", redirect: "manual" });
    expect(fetcher.mock.calls[0]![1].headers.authorization).toBeUndefined();
    fetcher.mockResolvedValueOnce(response({ unrelated: true }));
    expect(await probePublicServer(session.url, "/v1/info")).toMatchObject({ code: "SC_API_01" });
  });
  it("rejects credentials, paths and insecure public hosts in server addresses", () => {
    for (const raw of ["https://user:password@server.example", "https://server.example/path", "https://server.example/?token=secret", "http://10.evil.com", "http://public.example"]) expect(normaliseServerUrl(raw)).toBeNull();
    expect(normaliseServerUrl("https://server.example/")).toBe("https://server.example");
    expect(normaliseServerUrl("http://192.168.1.10:8787")).toBe("http://192.168.1.10:8787");
  });
  it("uses rate-limit headers without reading a stalled refusal body", async () => {
    native.probe.mockReturnValue(null);
    const text = vi.fn(() => new Promise(() => undefined));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 429, headers: new Headers({ "retry-after": "45" }), text }));
    await expect(probePublicServer(session.url, "/v1/health")).resolves.toMatchObject({ code: "SC_HTTP_429", httpStatus: 429, retryAfterSeconds: 45 });
    expect(text).not.toHaveBeenCalled();
  });
});

describe("operator diagnostic runner", () => {
  it("does not request the operator inventory or API probes for an ordinary account", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ userId: id, serverDiagnostics: false })); vi.stubGlobal("fetch", fetcher);
    const result = await inspectServer(session.url, session, () => true, () => undefined);
    expect(result.authorized).toBe(false); expect(result.operator).toBeNull(); expect(result.complete).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]![0]).toBe(session.url + "/v1/me/capabilities");
  });
  it("tests only audited GETs and never turns a catalog entry into a request", async () => {
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      expect(init.method ?? "GET").toBe("GET");
      expect(url.startsWith(session.url + "/v1/")).toBe(true);
      if (url.endsWith("/v1/me/capabilities")) return response({ userId: id, serverDiagnostics: true });
      if (url.endsWith("/v1/me")) return response({ user: { id }, capabilities: { serverDiagnostics: true } });
      if (url.endsWith("/v1/operator/diagnostics")) return response(catalog());
      if (url.endsWith("/profile")) return response({ userId: id, sections: { identity: {} }, relation: { me: true } });
      if (url.endsWith("/v1/crews")) return response({ crews: [] });
      if (url.endsWith("/v1/me/stats")) return response({ timeZone: "Europe/Paris", filters: {} });
      if (url.endsWith("/v1/notifications/settings")) return response({ kinds: [], channels: [] });
      if (url.endsWith("/v1/sessions")) return response({ sessions: [] });
      throw new Error("Unexpected probe");
    }); vi.stubGlobal("fetch", fetcher);
    const result = await inspectServer(session.url, session, () => true, () => undefined);
    expect(result.operator?.routes).toHaveLength(2);
    expect(result.checks).toHaveLength(11);
    expect(result.checks.every((check) => check.state === "ok")).toBe(true);
    expect(fetcher.mock.calls.map(([url]) => url)).not.toContain(session.url + "/v1/mutations");
    expect(fetcher.mock.calls.map(([url]) => url)).not.toContain(session.url + "/v1/notifications");
  });
  it("stops at Retry-After and leaves the remaining checks explicitly untested", async () => {
    native.probe.mockResolvedValue({ ...publicOK(), code: "SC_HTTP_429", httpStatus: 429, contractValid: false, retryAfterSeconds: 60 });
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const result = await inspectServer(session.url, session, () => true, () => undefined);
    expect(native.probe).toHaveBeenCalledTimes(1);
    expect(result.checks[0]?.code).toBe("SC_HTTP_429");
    expect(result.checks.slice(1).every((check) => check.state === "not-run")).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(inspectServer(session.url, session, () => true, () => undefined)).rejects.toMatchObject({ failure: { status: 429 } });
  });
  it("still checks readiness when a live server times out on its database-backed info route", async () => {
    native.probe.mockResolvedValueOnce(publicOK())
      .mockResolvedValueOnce({ ...publicOK(), code: "SC_TIMEOUT_01", httpStatus: 0, contractValid: false })
      .mockResolvedValueOnce({ ...publicOK(), code: "SC_DB_04", httpStatus: 503, contractValid: false });
    const result = await inspectServer(session.url, null, () => true, () => undefined);
    expect(result.checks[2]).toMatchObject({ id: "ready", state: "failed", code: "SC_DB_04" });
    expect(native.probe).toHaveBeenCalledTimes(3);
  });
  it("ignores an obsolete server/account run before displaying or authenticating anything", async () => {
    let release!: (value: ReturnType<typeof publicOK>) => void;
    native.probe.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    let active = true; const progress = vi.fn();
    const pending = inspectServer(session.url, session, () => active, progress);
    active = false; release(publicOK()); await pending;
    expect(progress).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  });
  it("refuses malformed or foreign URLs in the operator catalog", () => {
    const raw = catalog();
    raw.routes[0]!.path = "https://another-server.example/v1/me";
    expect(() => decodeOperatorDiagnostic(raw)).toThrow(ApiError);
  });
});
