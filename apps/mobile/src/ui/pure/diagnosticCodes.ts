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

const resources = new Set(["accounts", "sessions", "me", "users", "crews", "parties", "places", "venues", "photos", "notifications", "operator", "live", "health", "info", "ready", "mutations", "sync", "games", "sos", "receipts", "invites", "invitations", "friends", "conversations", "ai", "checkins", "gribouille", "recaps", "reports", "status", "chat", "auth", "cards", "cheers", "drinks", "events", "nonces", "out-calls", "polls", "pools", "push", "quotes", "referrals", "review-photos", "reviews", "usernames"]);
const fixedRoutes = new Set([
  "/v1/me/profile", "/v1/me/stats", "/v1/me/capabilities", "/v1/me/clock",
  "/v1/me/app-icons", "/v1/me/birth-date", "/v1/me/notices", "/v1/me/notices/read",
  "/v1/me/payment", "/v1/me/referral", "/v1/crews/open", "/v1/notifications/settings",
  "/v1/conversations/direct", "/v1/ai/order", "/v1/games/results", "/v1/games/wins",
  "/v1/gribouille/join", "/v1/gribouille/open", "/v1/operator/diagnostics",
]);

export const diagnosticFeatureLabels = {
  "/v1/me": "account.title",
  "/v1/me/profile": "people.myProfile",
  "/v1/users/:id/profile": "people.myProfile",
  "/v1/me/capabilities": "diagnostics.session",
  "/v1/friends": "people.friends",
  "/v1/crews": "people.crews",
  "/v1/crews/open": "people.crews",
  "/v1/mutations": "diagnostics.syncFeature",
  "/v1/sync": "diagnostics.syncFeature",
} as const satisfies Record<string, string>;

/** No resource IDs, user names, query strings or bodies in support reports. */
export function diagnosticFeature(path: string): string {
  const pathname = path.split(/[?#]/, 1)[0] ?? "";
  if (fixedRoutes.has(pathname)) return pathname;
  if (/^\/v1\/users\/[^/]+\/profile$/.test(pathname)) return "/v1/users/:id/profile";
  if (!pathname.startsWith("/v1/")) return "api";
  const resource = pathname.split("/")[2] ?? "";
  return resources.has(resource) ? `/v1/${resource}` : "api";
}

export const diagnosticFeatureLabel = (feature: string) => diagnosticFeatureLabels[feature as keyof typeof diagnosticFeatureLabels];
