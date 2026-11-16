import { useSession } from "./session";
import { RequestCooldown, retryAfterMs } from "@/ui/pure/requestCooldown";
import { publicReads } from "@/ui/pure/readCache";
import { Platform } from "react-native";
import { extraNumber } from "@/system/extra";
import { compatibilityAccept, decodeCompatibility, type CompatibilityNotice } from "@/ui/pure/apiCompatibility";
import { reportCompatibility } from "./compatibilityEvents";
import { diagnosticCode, diagnosticFeature, safeDiagnosticCode, safeRequestId, serverOrigin } from "@/ui/pure/diagnosticCodes";
import { recordNetworkDiagnostic } from "./diagnosticLog";

const TIMEOUT_MS = 10_000;
const cooldown = new RequestCooldown();
const incompatible = new Map<string, { until: number; failure: Extract<ApiFailure, { kind: "http" }> }>();

export type ApiFailure =
  | { kind: "configuration" }
  | { kind: "offline" }
  | { kind: "timeout" }
  | { kind: "http"; status: number; code: string; retryAfterMs?: number; compatibility?: CompatibilityNotice };

export class ApiError extends Error {
  readonly diagnostic: { code: string; requestId?: string };
  constructor(readonly failure: ApiFailure, context: { code?: string; requestId?: string } = {}) {
    super(failure.kind === "http" ? failure.code : failure.kind);
    this.diagnostic = {
      code: (failure.kind === "http" && (failure.compatibility || failure.code === "api_response_incompatible") ? undefined : safeDiagnosticCode(context.code)) ?? diagnosticCode(failure),
      ...(safeRequestId(context.requestId) ? { requestId: context.requestId } : {}),
    };
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Defaults to the stored session; account creation passes the typed address instead. */
  baseUrl?: string;
  token?: string | null;
  /** Explicit read retry: recheck a changed server, while still honoring every 429 cooldown. */
  recheckCompatibility?: boolean;
}

/** Every call to the server goes through here: timeout, auth header, typed failures. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const session = useSession.getState().session;
  const baseUrl = options.baseUrl ?? session?.url;
  const started = Date.now();
  let attempted = false;
  let response: Response | undefined;
  const fail = (failure: ApiFailure) => {
    const error = new ApiError(failure, { code: response?.headers?.get("x-crew-diagnostic-code") ?? undefined, requestId: response?.headers?.get("x-crew-request-id") ?? undefined });
    recordNetworkDiagnostic({ at: Date.now(), server: serverOrigin(baseUrl), accountId: session?.userId ?? null, feature: diagnosticFeature(path), method: options.method ?? "GET", code: error.diagnostic.code, requestId: error.diagnostic.requestId, durationMs: Date.now() - started, attempted, ...(failure.kind === "http" ? { status: failure.status } : {}) });
    return error;
  };
  if (!baseUrl) throw fail({ kind: "configuration" });
  // A selected public/other server must not receive the current account's credentials by default.
  const sameServer = serverOrigin(baseUrl) !== null && serverOrigin(baseUrl) === serverOrigin(session?.url);
  const token = options.token === undefined ? sameServer ? session?.token : null : options.token;
  const urgent = options.method === "POST" && (path === "/v1/sos" || /^\/v1\/sos\/[^/]+\/resolve$/.test(path) || /^\/v1\/parties\/[^/]+\/status$/.test(path));
  const featureKey = JSON.stringify([baseUrl, token ?? "guest", options.method ?? "GET", path.split("?")[0]]);
  const now = Date.now();
  for (const [key, entry] of incompatible) if (entry.until <= now) incompatible.delete(key);
  const blocked = incompatible.get(featureKey);
  const recheck = options.recheckCompatibility && (!options.method || options.method === "GET");
  if (blocked && !urgent && !recheck) throw fail({ ...blocked.failure, retryAfterMs: blocked.until - now });
  const scope = urgent ? "safety" : !options.method || options.method === "GET" ? "read" : "write";
  const quota = JSON.stringify([baseUrl, token ?? "guest", scope]);
  const wait = cooldown.remaining(quota);
  if (wait) throw fail({ kind: "http", status: 429, code: "too_many_attempts", retryAfterMs: wait });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let data: unknown;
  try {
    attempted = true;
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        accept: compatibilityAccept(extraNumber("buildNumber"), Platform.OS),
        ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    if (response.status === 429) {
      // Retry-After applies immediately, even if a rate-limited server never finishes its body.
      void response.body?.cancel().catch(() => undefined);
    } else if (response.status !== 204) {
      try { data = await response.json(); }
      catch (error) {
        // A malformed payload is a compatibility problem; a broken/aborted body is a network failure.
        if (controller.signal.aborted || !(error instanceof SyntaxError)) throw error;
      }
    }
  } catch (error) {
    throw fail(controller.signal.aborted ? { kind: "timeout" } : { kind: "offline" });
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 204) {
    incompatible.delete(featureKey);
    if (options.method && options.method !== "GET") publicReads.clear();
    return undefined as T;
  }
  const code = data !== null && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "unknown";
  if (response.status === 429) {
    const delay = retryAfterMs(response.headers.get("retry-after"));
    cooldown.block(quota, delay);
    throw fail({ kind: "http", status: 429, code: code === "unknown" ? "too_many_attempts" : code, retryAfterMs: delay });
  }
  const compatibility = decodeCompatibility(data, response.status, path, options.method)
    ?? (data === undefined && (response.ok || response.status === 404) ? { reason: "server_outdated" as const, apiVersion: 1 } : undefined);
  if (compatibility) {
    reportCompatibility(baseUrl, compatibility);
    const delay = compatibility.reason === "feature_unavailable" ? Math.max(30_000, retryAfterMs(response.headers.get("retry-after"))) : 5 * 60_000;
    const failure = { kind: "http" as const, status: response.status, code: data === undefined ? "api_response_incompatible" : code, compatibility, retryAfterMs: delay };
    // Safety actions can be retried immediately if a proxy briefly returns an HTML page.
    if (!urgent) {
      if (incompatible.size >= 100) incompatible.delete(incompatible.keys().next().value!);
      incompatible.set(featureKey, { until: Date.now() + delay, failure });
    }
    throw fail(failure);
  }
  if (!response.ok) throw fail({ kind: "http", status: response.status, code });
  incompatible.delete(featureKey);
  if (options.method && options.method !== "GET") publicReads.clear();
  return data as T;
}
