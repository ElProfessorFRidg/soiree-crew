import { nativeNetworkProbe, hasNativeNetworkProbe, type NativeNetworkProbe } from "../../modules/network-diagnostics";
import { api, ApiError } from "./api";
import type { ServerSession } from "./session";
import { normaliseServerUrl } from "./session";
import { safeDiagnosticCode, safeRequestId, serverOrigin } from "@/ui/pure/diagnosticCodes";
import type { NetworkDiagnostic } from "./diagnosticLog";
import { recordPublicProbe } from "./diagnosticLog";
import { retryAfterMs } from "@/ui/pure/requestCooldown";

export interface DiagnosticCheck {
  id: string;
  path: string;
  state: "ok" | "failed" | "unsupported" | "not-run";
  code: string;
  httpStatus: number;
  durationMs: number;
  source: "native" | "fetch" | "api";
  requestId?: string;
  nativeErrorCode?: number;
  timings?: Record<string, number>;
}
export interface ApiRouteStatus {
  method: string;
  path: string;
  state: "available" | "unavailable" | "retired" | "update-required";
  access: "public" | "account" | "operator";
}
export interface OperatorDiagnostic {
  generatedAt: number;
  apiVersion: number;
  revision: string | null;
  readiness: { state: "ready" | "degraded"; code: string; checkedAt: number; durationMs: number; missingMigrations?: string[] };
  services: { appleSignIn: boolean; ai: boolean; iosPush: boolean; androidPush: boolean };
  routes: ApiRouteStatus[];
}
export interface ServerDiagnosticReport {
  server: string;
  at: number;
  checks: DiagnosticCheck[];
  operator: OperatorDiagnostic | null;
  authorized: boolean;
  native: boolean;
  complete: boolean;
}

const record = (raw: unknown): raw is Record<string, unknown> => raw !== null && typeof raw === "object" && !Array.isArray(raw);
const finite = (raw: unknown): raw is number => typeof raw === "number" && Number.isFinite(raw) && raw >= 0;
const incompatible = () => new ApiError({ kind: "http", status: 502, code: "api_response_incompatible" });
const publicEndpoints = ["/v1/health", "/v1/info", "/v1/ready"] as const;
const blockedUntil = new Map<string, number>();
export const diagnosticWait = (url: string) => Math.max(0, (blockedUntil.get(url) ?? 0) - Date.now());

export function decodeOperatorDiagnostic(raw: unknown): OperatorDiagnostic {
  if (!record(raw) || !finite(raw.generatedAt) || !finite(raw.apiVersion) || !record(raw.readiness) || !record(raw.services) || !Array.isArray(raw.routes) || raw.routes.length > 1000) throw incompatible();
  const r = raw.readiness;
  if (!["ready", "degraded"].includes(String(r.state)) || !safeDiagnosticCode(r.code) || !finite(r.checkedAt) || !finite(r.durationMs)) throw incompatible();
  const serviceKeys = ["appleSignIn", "ai", "iosPush", "androidPush"] as const;
  const services = raw.services;
  if (serviceKeys.some((key) => typeof services[key] !== "boolean")) throw incompatible();
  const routes: ApiRouteStatus[] = raw.routes.map((row: unknown) => {
    if (!record(row) || !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(String(row.method)) || typeof row.path !== "string" || row.path.length > 200 || !/^\/v1\/[A-Za-z0-9/:_.-]+$/.test(row.path)
      || !["available", "unavailable", "retired", "update-required"].includes(String(row.state)) || !["public", "account", "operator"].includes(String(row.access))) throw incompatible();
    return { method: row.method as string, path: row.path, state: row.state as ApiRouteStatus["state"], access: row.access as ApiRouteStatus["access"] };
  });
  const missing = Array.isArray(r.missingMigrations) ? r.missingMigrations.filter((v): v is string => typeof v === "string" && /^[A-Za-z0-9_.-]{1,100}$/.test(v)).slice(0, 100) : undefined;
  return { generatedAt: raw.generatedAt, apiVersion: raw.apiVersion, revision: typeof raw.revision === "string" && /^[a-f0-9]{7,40}$/i.test(raw.revision) ? raw.revision : null,
    readiness: { state: r.state as "ready" | "degraded", code: r.code as string, checkedAt: r.checkedAt, durationMs: r.durationMs, ...(missing ? { missingMigrations: missing } : {}) },
    services: Object.fromEntries(serviceKeys.map((key) => [key, services[key]])) as OperatorDiagnostic["services"], routes };
}

/** Public probes never use api()'s stored account, cookies, or authorization headers. */
async function fetchPublicProbe(base: string, path: string): Promise<NativeNetworkProbe> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(base + path, { signal: controller.signal, credentials: "omit", redirect: "manual", cache: "no-store", headers: { accept: "application/json" } });
    if (response.type === "opaqueredirect" || [300, 301, 302, 303, 307, 308].includes(response.status)) return { code: "SC_HTTP_REDIRECT", httpStatus: response.status, durationMs: Date.now() - started, native: false, contractValid: false };
    if (response.status >= 300) {
      // An error status and Retry-After are useful even when the refusal body never finishes.
      void response.body?.cancel().catch(() => undefined);
      const retry = response.headers.get("retry-after") ? retryAfterMs(response.headers.get("retry-after")) / 1000 : 0;
      return { code: safeDiagnosticCode(response.headers.get("x-crew-diagnostic-code")) ?? `SC_HTTP_${response.status}`, httpStatus: response.status, durationMs: Date.now() - started, native: false, contractValid: false,
        ...(safeRequestId(response.headers.get("x-crew-request-id")) ? { requestId: response.headers.get("x-crew-request-id")! } : {}), ...(retry > 0 ? { retryAfterSeconds: retry } : {}) };
    }
    let text = "";
    if (response.body?.getReader) {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const item = await reader.read();
        if (item.done) break;
        size += item.value.length;
        if (size > 65536) { void reader.cancel().catch(() => undefined); return { code: "SC_API_06", httpStatus: response.status, durationMs: Date.now() - started, native: false, contractValid: false }; }
        chunks.push(item.value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      text = new TextDecoder().decode(bytes);
    } else { text = await response.text(); }
    let json: unknown; try { json = text.length <= 65536 ? JSON.parse(text) : null; } catch { json = null; }
    const valid = record(json) && (path === "/v1/info" ? typeof json.name === "string" && typeof json.public === "boolean" : json.ok === true);
    const code = response.status >= 400 ? safeDiagnosticCode(response.headers.get("x-crew-diagnostic-code")) ?? `SC_HTTP_${response.status}` : valid ? "SC_OK" : "SC_API_01";
    const retry = response.headers.get("retry-after") ? retryAfterMs(response.headers.get("retry-after")) / 1000 : 0;
    return { code, httpStatus: response.status, durationMs: Date.now() - started, native: false, contractValid: valid,
      ...(safeRequestId(response.headers.get("x-crew-request-id")) ? { requestId: response.headers.get("x-crew-request-id")! } : {}), ...(Number.isFinite(retry) && retry > 0 ? { retryAfterSeconds: Math.min(3600, retry) } : {}) };
  } catch { return { code: controller.signal.aborted ? "SC_TIMEOUT_01" : "SC_NET_04", httpStatus: 0, durationMs: Date.now() - started, native: false, contractValid: false }; }
  finally { clearTimeout(timer); }
}

export async function probePublicServer(base: string, path: (typeof publicEndpoints)[number]): Promise<NativeNetworkProbe> {
  if (!publicEndpoints.includes(path) || normaliseServerUrl(base) !== base) return { code: "SC_CFG_02", httpStatus: 0, durationMs: 0, native: false, contractValid: false };
  const native = nativeNetworkProbe(base, path);
  if (!native) return fetchPublicProbe(base, path);
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<NativeNetworkProbe>((resolve) => { timer = setTimeout(() => resolve({ code: "SC_TIMEOUT_01", httpStatus: 0, durationMs: 9000, native: true, contractValid: false }), 9000); });
  try {
    const found = await Promise.race([native, deadline]);
    if (!safeDiagnosticCode(found.code) || !finite(found.durationMs) || !Number.isInteger(found.httpStatus) || found.httpStatus < 0 || found.httpStatus > 599 || typeof found.contractValid !== "boolean") throw incompatible();
    return found;
  } catch (error) { return { code: error instanceof ApiError ? error.diagnostic.code : "SC_NET_04", httpStatus: 0, durationMs: 0, native: true, contractValid: false }; }
  finally { clearTimeout(timer!); }
}

const readChecks = [
  { id: "account", path: "/v1/me", valid: (raw: unknown, id: string) => record(raw) && record(raw.user) && raw.user.id === id },
  { id: "crews", path: "/v1/crews", valid: (raw: unknown) => record(raw) && Array.isArray(raw.crews) },
  { id: "profile", path: "/v1/users/:id/profile", valid: (raw: unknown, id: string) => record(raw) && raw.userId === id && record(raw.sections) && record(raw.sections.identity) && record(raw.relation) && raw.relation.me === true },
  { id: "stats", path: "/v1/me/stats", valid: (raw: unknown) => record(raw) && typeof raw.timeZone === "string" && record(raw.filters) },
  // Inbox reads prune old notifications; diagnostics use the settings read instead.
  { id: "notifications", path: "/v1/notifications/settings", valid: (raw: unknown) => record(raw) && Array.isArray(raw.kinds) && Array.isArray(raw.channels) },
  { id: "sessions", path: "/v1/sessions", valid: (raw: unknown) => record(raw) && Array.isArray(raw.sessions) },
] as const;

export async function inspectServer(base: string, session: ServerSession | null, current: () => boolean, progress: (report: ServerDiagnosticReport) => void): Promise<ServerDiagnosticReport> {
  const wait = diagnosticWait(base);
  if (wait) throw new ApiError({ kind: "http", status: 429, code: "too_many_attempts", retryAfterMs: wait });
  if (blockedUntil.size >= 20) blockedUntil.delete(blockedUntil.keys().next().value!);
  blockedUntil.set(base, Date.now() + 30_000);
  const report: ServerDiagnosticReport = { server: base, at: Date.now(), checks: publicEndpoints.map((path) => ({ id: path.split("/").pop()!, path, source: hasNativeNetworkProbe ? "native" : "fetch", state: "not-run", code: "SC_NOT_RUN", httpStatus: 0, durationMs: 0 })), operator: null, authorized: false, native: hasNativeNetworkProbe, complete: false };
  const publish = () => { if (current()) progress({ ...report, checks: [...report.checks] }); };
  const finish = () => { report.complete = true; publish(); return report; };
  publish();
  let limited = false;
  for (const path of publicEndpoints) {
    if (!current() || limited) break;
    const result = await probePublicServer(base, path);
    if (!current()) return report;
    if (result.httpStatus === 429) { limited = true; blockedUntil.set(base, Date.now() + Math.max(30, result.retryAfterSeconds ?? 30) * 1000); }
    const { retryAfterSeconds: _retry, contractValid: _contract, native: _native, ...details } = result;
    const check: DiagnosticCheck = { ...details, id: path.split("/").pop()!, path, source: result.native ? "native" : "fetch", state: path === "/v1/ready" && result.httpStatus === 404 ? "unsupported" : result.code === "SC_OK" ? "ok" : "failed" };
    report.checks[publicEndpoints.indexOf(path)] = check;
    recordPublicProbe(base, path, `${check.state} · ${formatDiagnosticCheck(check)}`);
    publish();
    if (result.httpStatus === 0 && result.code !== "SC_OK" && !report.checks.some((check) => check.httpStatus > 0)) break;
  }
  if (!current()) return report;
  if (limited || !session || serverOrigin(session.url) !== base || !report.checks.some((c) => c.httpStatus > 0)) return finish();
  const options = { baseUrl: base, token: session.token, recheckCompatibility: true };
  const run = async (id: string, path: string, work: () => Promise<void>) => {
    const started = Date.now();
    try { await work(); if (current()) report.checks.push({ id, path, source: "api", state: "ok", code: "SC_OK", httpStatus: 200, durationMs: Date.now() - started }); }
    catch (error) {
      const failure = error instanceof ApiError ? error : incompatible();
      if (current()) report.checks.push({ id, path, source: "api", state: path === "/v1/me/capabilities" && failure.failure.kind === "http" && failure.failure.status === 404 ? "unsupported" : "failed", code: failure.diagnostic.code, httpStatus: failure.failure.kind === "http" ? failure.failure.status : 0, durationMs: Date.now() - started, ...(failure.diagnostic.requestId ? { requestId: failure.diagnostic.requestId } : {}) });
      if (failure.failure.kind === "http" && failure.failure.status === 429) { limited = true; blockedUntil.set(base, Date.now() + Math.max(30_000, failure.failure.retryAfterMs ?? 30_000)); }
      if (failure.failure.kind === "http" && [401, 403].includes(failure.failure.status)) { report.authorized = false; report.operator = null; }
    }
    publish();
  };
  await run("session", "/v1/me/capabilities", async () => {
    const capability = await api<unknown>("/v1/me/capabilities", options);
    if (!record(capability) || capability.userId !== session.userId || typeof capability.serverDiagnostics !== "boolean") throw incompatible();
    if (current()) report.authorized = capability.serverDiagnostics;
  });
  if (!current()) return report;
  if (limited || !report.authorized) return finish();
  await run("operator", "/v1/operator/diagnostics", async () => {
    const found = decodeOperatorDiagnostic(await api<unknown>("/v1/operator/diagnostics", options));
    if (current()) report.operator = found;
  });
  if (!current()) return report;
  if (limited || !report.authorized || !report.operator) return finish();
  for (const check of readChecks) {
    if (!current() || limited || !report.authorized) break;
    await run(check.id, check.path, async () => {
      const response = await api<unknown>(check.path.replace(":id", encodeURIComponent(session.userId)), options);
      if (!check.valid(response, session.userId)) throw incompatible();
    });
  }
  return current() ? finish() : report;
}

export function formatDiagnosticCheck(check: DiagnosticCheck): string {
  const timings = ["dnsMs", "tcpMs", "tlsMs", "firstByteMs"].flatMap((key) => {
    const value = check.timings?.[key];
    return finite(value) ? [`${key}=${value}`] : [];
  });
  return [safeDiagnosticCode(check.code) ?? "SC_UNKNOWN", `source=${check.source}`,
    `HTTP=${check.httpStatus || "none"}`, `${check.durationMs}ms`,
    ...(safeRequestId(check.requestId) ? [`ref=${check.requestId}`] : []),
    ...(Number.isInteger(check.nativeErrorCode) ? [`NSURL=${check.nativeErrorCode}`] : []),
    ...timings].join(" · ");
}

export function formatNetworkFailure(entry: NetworkDiagnostic): string {
  return `${new Date(entry.at).toISOString()} ${entry.method} ${entry.feature} ${entry.code} HTTP=${entry.status ?? "none"} ${entry.durationMs}ms attempted=${entry.attempted}${entry.format ? ` response=${entry.format}` : ""}${entry.reason ? ` reason=${entry.reason}` : ""}${safeRequestId(entry.requestId) ? ` ref=${entry.requestId}` : ""}`;
}

export function formatServerDiagnostic(
  report: ServerDiagnosticReport | null,
  build: { version: string; build: number; channel: string | null; target: string | null },
  history: NetworkDiagnostic[] = [],
  context: { server?: string | null; issue?: string; localLog?: readonly string[] } = {},
): string {
  const server = serverOrigin(report?.server ?? context.server);
  const lines = ["SC_NETWORK_DIAGNOSTIC v1", `App: ${build.version} (${build.build}) ${build.channel ?? "unknown"} ${build.target ?? "unknown"}`, `Server: ${server ?? "none"}`, `At: ${new Date(report?.at ?? Date.now()).toISOString()}`, `Run: ${report ? report.complete ? "complete" : "in-progress" : "not-run"}; transport: ${(report?.native ?? hasNativeNetworkProbe) ? "native" : "fetch (DNS/TLS cause may be unavailable)"}`];
  if (safeDiagnosticCode(context.issue)) lines.push(`Issue: ${context.issue}`);
  for (const check of report?.checks ?? []) lines.push(`${check.path}: ${check.state} · ${formatDiagnosticCheck(check)}`);
  if (report?.operator && report.authorized) {
    lines.push(`Server API=${report.operator.apiVersion}; revision=${report.operator.revision ?? "unknown"}; readiness=${report.operator.readiness.code}`);
    const executed = new Set(report.checks.filter((check) => check.source === "api").map((check) => `GET ${check.path}`));
    lines.push(`Registered routes=${report.operator.routes.length}; not executed=${report.operator.routes.filter((route) => !executed.has(`${route.method} ${route.path}`)).length}`);
    for (const route of report.operator.routes.filter((route) => route.state !== "available").slice(0, 40)) lines.push(`${route.method} ${route.path}: configured=${route.state}`);
  }
  for (const entry of history.filter((entry) => entry.server === server).slice(-12)) lines.push(`Recent: ${formatNetworkFailure(entry)}`);
  for (const entry of context.localLog ?? []) lines.push(`Local: ${entry}`);
  return lines.join("\n").slice(0, 20000);
}
