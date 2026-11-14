import { useSession } from "./session";
import { RequestCooldown, retryAfterMs } from "@/ui/pure/requestCooldown";
import { publicReads } from "@/ui/pure/readCache";

const TIMEOUT_MS = 10_000;
const cooldown = new RequestCooldown();

export type ApiFailure =
  | { kind: "offline" }
  | { kind: "timeout" }
  | { kind: "http"; status: number; code: string; retryAfterMs?: number };

export class ApiError extends Error {
  constructor(readonly failure: ApiFailure) {
    super(failure.kind === "http" ? failure.code : failure.kind);
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Defaults to the stored session; account creation passes the typed address instead. */
  baseUrl?: string;
  token?: string | null;
}

/** Every call to the server goes through here: timeout, auth header, typed failures. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const session = useSession.getState().session;
  const baseUrl = options.baseUrl ?? session?.url;
  if (!baseUrl) throw new ApiError({ kind: "offline" });
  const token = options.token === undefined ? session?.token : options.token;
  const urgent = options.method === "POST" && (path === "/v1/sos" || /^\/v1\/sos\/[^/]+\/resolve$/.test(path) || /^\/v1\/parties\/[^/]+\/status$/.test(path));
  const scope = urgent ? "safety" : !options.method || options.method === "GET" ? "read" : "write";
  const quota = JSON.stringify([baseUrl, token ?? "guest", scope]);
  const wait = cooldown.remaining(quota);
  if (wait) throw new ApiError({ kind: "http", status: 429, code: "too_many_attempts", retryAfterMs: wait });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    throw new ApiError(controller.signal.aborted ? { kind: "timeout" } : { kind: "offline" });
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 204) {
    if (options.method && options.method !== "GET") publicReads.clear();
    return undefined as T;
  }
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (response.status === 429) {
    const delay = retryAfterMs(response.headers.get("retry-after"));
    cooldown.block(quota, delay);
    throw new ApiError({ kind: "http", status: 429, code: data.error ?? "too_many_attempts", retryAfterMs: delay });
  }
  if (!response.ok) throw new ApiError({ kind: "http", status: response.status, code: data.error ?? "unknown" });
  if (options.method && options.method !== "GET") publicReads.clear();
  return data as T;
}
