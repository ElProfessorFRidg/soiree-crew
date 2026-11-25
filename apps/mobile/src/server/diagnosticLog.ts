import type { CompatibilityReason } from "@/ui/pure/apiCompatibility";
import { diagnosticFeature, safeDiagnosticCode, safeRequestId, serverOrigin } from "@/ui/pure/diagnosticCodes";

export interface NetworkDiagnostic {
  at: number;
  server: string | null;
  /** Scopes the local journal. This value is excluded from displayed and copied reports. */
  accountId: string | null;
  feature: string;
  method: string;
  code: string;
  requestId?: string;
  status?: number;
  durationMs: number;
  attempted: boolean;
  format?: "json" | "html" | "other";
  reason?: CompatibilityReason;
}

const entries: NetworkDiagnostic[] = [];
export function recordNetworkDiagnostic(entry: NetworkDiagnostic): void {
  if (development) {
    const { at, server, method, feature, code, requestId, status, durationMs, attempted, format, reason } = entry;
    console.info("[SC_NETWORK] API failure", { at: new Date(at).toISOString(), server, method, feature, code, requestId, status, durationMs, attempted, format, reason });
  }
  entries.push(entry);
  if (entries.length > 30) entries.shift();
  const sanitized = decodeNetworkDiagnostic(entry);
  if (sanitized) append(apiLogKey, sanitized, decodeNetworkDiagnostic);
}
export const recentNetworkDiagnostics = (server: string | null, accountId: string | null) => entries.filter((entry) => entry.server === server && entry.accountId === accountId).slice(-12);

const development = typeof __DEV__ !== "undefined" && __DEV__;
const logKey = "crew-network-probes-v1";
const apiLogKey = "crew-network-errors-v1";
interface PublicProbeEntry { server: string; line: string }
let writes = Promise.resolve();
const storage = () => import("@react-native-async-storage/async-storage").then((module) => module.default);
function decodePublicProbe(value: unknown): PublicProbeEntry | undefined {
  if (!value || typeof value !== "object") return;
  const { server, line } = value as Partial<PublicProbeEntry>;
  if (server && serverOrigin(server) === server && typeof line === "string" && line.length <= 600) return { server, line };
}

function decodeNetworkDiagnostic(value: unknown): NetworkDiagnostic | undefined {
  if (!value || typeof value !== "object") return;
  const entry = value as Partial<NetworkDiagnostic>;
  const { at, server, accountId, feature, method, durationMs, attempted } = entry;
  const code = safeDiagnosticCode(entry.code);
  if (typeof at !== "number" || !Number.isFinite(at) || Math.abs(at) > 8.64e15
    || !(server === null || (typeof server === "string" && serverOrigin(server) === server))
    || !(accountId === null || typeof accountId === "string") || typeof feature !== "string"
    || !code || !method || !["GET", "POST", "PATCH", "PUT", "DELETE"].includes(method)
    || typeof durationMs !== "number" || !Number.isFinite(durationMs) || typeof attempted !== "boolean") return;
  return { at, server, accountId, feature: diagnosticFeature(feature), method, code, durationMs, attempted,
    status: Number.isInteger(entry.status) ? entry.status : undefined,
    requestId: safeRequestId(entry.requestId),
    format: entry.format && ["json", "html", "other"].includes(entry.format) ? entry.format : undefined,
    reason: entry.reason && ["update_required", "feature_unavailable", "feature_removed", "server_outdated"].includes(entry.reason) ? entry.reason : undefined };
}

async function readEntries<T>(store: Awaited<ReturnType<typeof storage>>, key: string, decode: (value: unknown) => T | undefined): Promise<T[]> {
  const stored = await store.getItem(key);
  try {
    const raw: unknown = JSON.parse(stored ?? "[]");
    return Array.isArray(raw) ? raw.map(decode).filter((entry): entry is T => entry !== undefined) : [];
  } catch {
    return [];
  }
}

function append<T>(key: string, entry: T, decode: (value: unknown) => T | undefined): void {
  writes = writes.then(async () => {
    const store = await storage();
    const previous = await readEntries(store, key, decode);
    await store.setItem(key, JSON.stringify([...previous, entry].slice(-60)));
  }).catch(() => {
    if (development) console.warn("[SC_NETWORK] Local diagnostic entry could not be saved.");
  });
}

export function recordPublicProbe(server: string, path: string, details: string): void {
  const line = `${new Date().toISOString()} GET ${path} · ${details}`;
  if (development) console.info("[SC_NETWORK]", server, line);
  append(logKey, { server, line }, decodePublicProbe);
}

export async function recentPublicProbes(server: string | null): Promise<string[]> {
  if (!server) return [];
  try {
    await writes;
    return (await readEntries(await storage(), logKey, decodePublicProbe)).filter((entry) => entry.server === server).slice(-12).map((entry) => entry.line);
  } catch {
    return [];
  }
}

export async function savedNetworkDiagnostics(server: string | null, accountId: string | null): Promise<NetworkDiagnostic[]> {
  const matches = (entry: NetworkDiagnostic) => entry.server === server && entry.accountId === accountId;
  let saved: NetworkDiagnostic[] = [];
  try {
    await writes;
    saved = (await readEntries(await storage(), apiLogKey, decodeNetworkDiagnostic)).filter(matches);
  } catch { /* Keep the current process journal if local storage is unavailable. */ }
  const unique = new Map(saved.map((entry) => [JSON.stringify(entry), entry]));
  for (const entry of entries.filter(matches)) {
    const sanitized = decodeNetworkDiagnostic(entry);
    if (sanitized) unique.set(JSON.stringify(sanitized), sanitized);
  }
  return [...unique.values()].sort((a, b) => b.at - a.at).slice(0, 30);
}
