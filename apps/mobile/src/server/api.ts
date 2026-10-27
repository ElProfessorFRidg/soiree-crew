import { useSession } from "./session";

const TIMEOUT_MS = 10_000;

export type ApiFailure =
  | { kind: "offline" }
  | { kind: "timeout" }
  | { kind: "http"; status: number; code: string };

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
  if (response.status === 204) return undefined as T;
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new ApiError({ kind: "http", status: response.status, code: data.error ?? "unknown" });
  return data as T;
}
