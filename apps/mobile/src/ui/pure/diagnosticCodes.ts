/** Stable support codes; these describe observed facts, not a guessed loss of internet. */
export function diagnosticCode(failure: { kind: string; status?: number; code?: string; compatibility?: { reason: string } }): string {
  if (failure.kind === "configuration") return "SC_CFG_01";
  if (failure.kind === "timeout") return "SC_TIMEOUT_01";
  if (failure.kind === "offline") return "SC_NET_04";
  if (failure.code === "api_response_incompatible") return "SC_API_01";
  const reason = failure.compatibility?.reason;
  if (reason) return ({ server_outdated: "SC_API_02", update_required: "SC_API_03", feature_removed: "SC_API_04", feature_unavailable: "SC_API_05" } as Record<string, string>)[reason] ?? "SC_API_01";
  return Number.isInteger(failure.status) ? `SC_HTTP_${failure.status}` : "SC_UNKNOWN";
}

export const safeDiagnosticCode = (value: unknown): string | undefined => typeof value === "string" && /^SC_[A-Z0-9_]{1,60}$/.test(value) ? value : undefined;
export const safeRequestId = (value: unknown): string | undefined => typeof value === "string" && /^(?:sc_)?[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value) ? value : undefined;
export function serverOrigin(raw?: string | null): string | null {
  try { const u = new URL(raw ?? ""); return ["https:", "http:"].includes(u.protocol) ? u.origin : null; }
  catch { return null; }
}

const resources = new Set(["accounts", "sessions", "me", "users", "crews", "parties", "places", "venues", "photos", "notifications", "operator", "live", "health", "info", "ready", "mutations", "sync", "games", "sos", "receipts", "invites"]);
/** No resource IDs, user names, query strings or bodies in support reports. */
export function diagnosticFeature(path: string): string {
  const resource = path.split("?")[0]?.split("/")[2] ?? "";
  return resources.has(resource) ? `/v1/${resource}` : "api";
}
