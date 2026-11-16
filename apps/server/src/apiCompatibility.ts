import { z } from "zod";
import { HttpError } from "./context";

export const API_VERSION = 1;
export type CompatibilityReason = "update_required" | "feature_unavailable" | "feature_removed" | "server_outdated";
export interface CompatibilityNotice {
  reason: CompatibilityReason;
  apiVersion: number;
  minimumBuild?: number;
  minimumApiVersion?: number;
  webUrl?: string;
}

const essential = (route: string) => / \/v1\/(?:health$|info$|accounts(?:\/|$)|sessions(?:\/|$)|sos(?:\/|$)|parties\/[^/]+\/status$)/.test(route);
// These public screens can be opened without transferring local health data or encryption keys.
const WEB_ROUTES: Record<string, string> = {
  "GET /v1/places": "/discover",
  "GET /v1/places/:id": "/discover",
  "GET /v1/crews/open": "/crew",
};
const ruleSchema = z.object({
  minimumBuild: z.number().int().positive().optional(),
  minimumApiVersion: z.number().int().positive().optional(),
  state: z.enum(["available", "unavailable", "retired"]).optional(),
  webFallback: z.boolean().optional(),
}).strict();
export type CompatibilityRules = Record<string, z.infer<typeof ruleSchema>>;
const rulesSchema = z.record(z.string().max(200).regex(/^(GET|POST|PUT|PATCH|DELETE) \/v1\/[A-Za-z0-9/:_-]+$/), ruleSchema)
  .refine((rules) => Object.keys(rules).length <= 100, "At most 100 API compatibility rules")
  .superRefine((rules, issue) => {
    for (const [route, rule] of Object.entries(rules)) {
      if (essential(route)) issue.addIssue({ code: "custom", message: "Authentication, discovery and safety endpoints must stay available", path: [route] });
      if (rule.webFallback && !WEB_ROUTES[route]) issue.addIssue({ code: "custom", message: "Web fallback is restricted to public read-only screens", path: [route] });
    }
  });

export function compatibilityRulesFromEnv(raw?: string): CompatibilityRules {
  return rulesSchema.parse(raw ? JSON.parse(raw) : {});
}

export function clientCompatibility(accept: string | undefined) {
  const parameter = (name: string) => new RegExp(`(?:^|[;,]\\s*)${name}=([A-Za-z0-9]+)(?=[;,\\s]|$)`, "i").exec((accept ?? "").slice(0, 2048))?.[1];
  const integer = (value: string | undefined, fallback: number) => value && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : fallback;
  return { build: integer(parameter("crew-build"), 0), apiVersion: integer(parameter("crew-api"), 1), web: parameter("crew-client") === "web" };
}

const messages = {
  update_required: "This feature changed. Update your app to use it. Local data remains available.",
  feature_unavailable: "This feature is temporarily unavailable. Try again later.",
  feature_removed: "This server no longer provides this feature.",
  server_outdated: "This server does not provide this API feature, or its contract has changed.",
} as const;
const codes = { update_required: "client_update_required", feature_unavailable: "feature_unavailable", feature_removed: "feature_removed", server_outdated: "api_endpoint_unavailable" } as const;

export function compatibilityFailure(reason: CompatibilityReason, details: Omit<CompatibilityNotice, "reason" | "apiVersion"> = {}): HttpError {
  const status = { update_required: 426, feature_unavailable: 503, feature_removed: 410, server_outdated: 404 }[reason];
  return new HttpError(status, codes[reason], { message: messages[reason], compatibility: { reason, apiVersion: API_VERSION, ...details } });
}

export class ApiCompatibility {
  private readonly rules: CompatibilityRules;
  private readonly patterns: { route: string; pattern: RegExp }[];
  private readonly webOrigin: string | null;
  constructor(rules: CompatibilityRules = {}, webAppUrl?: string) {
    this.rules = rulesSchema.parse(rules);
    this.patterns = Object.keys(this.rules).map((route) => ({ route, pattern: new RegExp(`^${route.split("/").map((part) => part.startsWith(":") ? "[^/]+" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("/")}$`) }));
    const web = webAppUrl ? new URL(webAppUrl) : null;
    if (web && (web.protocol !== "https:" || web.username || web.password || web.search || web.hash || web.pathname !== "/")) throw new Error("WEB_APP_URL must be an HTTPS origin without credentials, query or path");
    this.webOrigin = web?.origin ?? null;
  }
  check(method: string, route: string, path: string, accept: string | undefined): void {
    const key = this.rules[`${method} ${route}`] ? `${method} ${route}` : this.patterns.find((item) => item.pattern.test(`${method} ${path}`))?.route;
    if (!key) return;
    const rule = this.rules[key]!;
    const client = clientCompatibility(accept);
    const webUrl = rule.webFallback && this.webOrigin && WEB_ROUTES[key] ? new URL(WEB_ROUTES[key]!, this.webOrigin).href : undefined;
    const details = { ...(webUrl ? { webUrl } : {}), ...(rule.minimumBuild ? { minimumBuild: rule.minimumBuild } : {}), ...(rule.minimumApiVersion ? { minimumApiVersion: rule.minimumApiVersion } : {}) };
    if (rule.state === "unavailable") throw compatibilityFailure("feature_unavailable", details);
    if (rule.state === "retired") throw compatibilityFailure("feature_removed", details);
    if ((rule.minimumApiVersion && client.apiVersion < rule.minimumApiVersion) || (rule.minimumBuild && !client.web && client.build < rule.minimumBuild)) throw compatibilityFailure("update_required", details);
  }
}
