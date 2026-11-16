export type CompatibilityReason = "update_required" | "feature_unavailable" | "feature_removed" | "server_outdated";
export interface CompatibilityNotice {
  reason: CompatibilityReason;
  apiVersion: number;
  minimumBuild?: number;
  minimumApiVersion?: number;
  webUrl?: string;
}
const codes = {
  update_required: "client_update_required",
  feature_unavailable: "feature_unavailable",
  feature_removed: "feature_removed",
  server_outdated: "api_endpoint_unavailable",
} as const;
const record = (raw: unknown): Record<string, unknown> => raw !== null && typeof raw === "object" ? raw as Record<string, unknown> : {};
const positive = (raw: unknown): raw is number => typeof raw === "number" && Number.isSafeInteger(raw) && raw > 0;
export const compatibilityCode = (reason: CompatibilityReason) => codes[reason];

/** Only explicit public browsing alternatives; never carry a query, account or resource ID. */
function webAlternative(raw: unknown, path: string): string | undefined {
  const pathname = path.split("?")[0];
  const screen = pathname === "/v1/places" || /^\/v1\/places\/[^/]+$/.test(pathname ?? "") ? "/discover" : pathname === "/v1/crews/open" ? "/crew" : null;
  if (!screen || typeof raw !== "string" || raw.length > 2048) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash && url.pathname === screen ? url.href : undefined;
  } catch { return undefined; }
}

export function decodeCompatibility(raw: unknown, status: number, path: string, method = "GET"): CompatibilityNotice | undefined {
  const body = record(raw);
  const notice = record(body.compatibility);
  const reason = notice.reason;
  if (typeof reason === "string" && Object.hasOwn(codes, reason) && ![401, 403, 429].includes(status) && status >= 400) {
    const webUrl = method === "GET" ? webAlternative(notice.webUrl, path) : undefined;
    return {
      reason: reason as CompatibilityReason,
      apiVersion: positive(notice.apiVersion) ? notice.apiVersion : 1,
      ...(positive(notice.minimumBuild) ? { minimumBuild: notice.minimumBuild } : {}),
      ...(positive(notice.minimumApiVersion) ? { minimumApiVersion: notice.minimumApiVersion } : {}),
      ...(webUrl ? { webUrl } : {}),
    };
  }
  // Older Fastify servers do not yet send structured compatibility metadata. An ordinary
  // resource-level {error:"not_found"} must keep its normal meaning.
  if (status === 404 && body.statusCode === 404 && body.error === "Not Found" && typeof body.message === "string" && body.message.startsWith("Route ")) return { reason: "server_outdated", apiVersion: 1 };
  return undefined;
}

/** API version parameters fit in the CORS-safelisted Accept header, including on old servers. */
export function compatibilityAccept(build: number | null, platform: string): string {
  return `application/json; crew-api=1; crew-build=${positive(build) ? build : 0}; crew-client=${platform === "web" ? "web" : platform === "android" ? "android" : "ios"}`;
}
