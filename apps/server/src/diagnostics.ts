import type { FastifyInstance } from "fastify";
import { HttpError, requireUser, type AuthedUser, type Context } from "./context";
import { API_VERSION, clientCompatibility } from "./apiCompatibility";
import { DatabaseFailure } from "./databaseErrors";
import { migrationNames } from "./db";
import { TokenBucket } from "./ratelimit";

/** An unclaimed username must never grant server diagnostics. Set the account UUID in OPERATOR_IDS. */
export const canInspectServer = (ctx: Context, user: Pick<AuthedUser, "id">) => (ctx.operators ?? []).includes(user.id);

export interface Readiness {
  state: "ready" | "degraded";
  code: string;
  checkedAt: number;
  durationMs: number;
  missingMigrations?: string[];
}

/** One bounded database probe per server process, shared by public and operator checks. */
export class ReadinessMonitor {
  private pending: Promise<Readiness> | null = null;
  private cached: { until: number; value: Readiness } | null = null;
  private readonly migrations = migrationNames();
  constructor(private readonly ctx: Context, private readonly deadlineMs = 2000) {}

  async check(): Promise<Readiness> {
    if (this.cached && this.cached.until > this.ctx.now()) return this.cached.value;
    if (!this.pending) {
      const started = Date.now();
      this.pending = this.inspect().catch((error: unknown): Readiness => ({ state: "degraded", code: error instanceof DatabaseFailure ? error.diagnosticCode : "SC_DB_99", checkedAt: this.ctx.now(), durationMs: Date.now() - started }))
        .then((value) => { this.cached = { until: this.ctx.now() + 5000, value }; return value; })
        .finally(() => { this.pending = null; });
    }
    let timer: ReturnType<typeof setTimeout>;
    const deadline = new Promise<Readiness>((resolve) => {
      timer = setTimeout(() => {
        const value: Readiness = { state: "degraded", code: "SC_DB_04", checkedAt: this.ctx.now(), durationMs: this.deadlineMs };
        this.cached = { until: this.ctx.now() + 5000, value };
        resolve(value);
      }, this.deadlineMs);
    });
    // A timed-out underlying query stays shared until it settles; callers cannot queue more probes.
    try { return await Promise.race([this.pending, deadline]); }
    finally { clearTimeout(timer!); }
  }

  private async inspect(): Promise<Readiness> {
    const started = Date.now();
    const applied = new Set((await this.ctx.db.query<{ name: string }>("select name from schema_migrations")).map((row) => row.name));
    const missing = this.migrations.filter((name) => !applied.has(name));
    if (missing.length) return { state: "degraded", code: "SC_DB_02", checkedAt: this.ctx.now(), durationMs: Date.now() - started, missingMigrations: missing };
    // Discovery currently depends on this schema, unlike the pure process liveness endpoint.
    await this.ctx.db.query("select 1 from crews where open limit 1");
    return { state: "ready", code: "SC_OK", checkedAt: this.ctx.now(), durationMs: Date.now() - started };
  }
}

export interface RegisteredApi { method: string; path: string }

export function diagnosticRoutes(app: FastifyInstance, ctx: Context, routes: Map<string, RegisteredApi>, isPublic: (method: string, path: string) => boolean): void {
  const monitor = new ReadinessMonitor(ctx);
  const operatorChecks = new TokenBucket(2, 2, ctx.now);

  // Permission discovery depends only on authentication, not on a working profile/photo schema.
  app.get("/v1/me/capabilities", async (request) => {
    const user = requireUser(request);
    return { userId: user.id, serverDiagnostics: canInspectServer(ctx, user) };
  });

  app.get("/v1/ready", async (_request, reply) => {
    const result = await monitor.check();
    if (result.state !== "ready") reply.status(503).header("retry-after", "5").header("x-crew-diagnostic-code", result.code);
    const revision = ctx.serverRevision;
    const sourceCommit = ctx.serverInfo?.public === false && revision && /^[a-f0-9]{40}$/i.test(revision)
      ? revision.toLowerCase() : undefined;
    if (sourceCommit) reply.header("cache-control", "no-store");
    return { ok: result.state === "ready", ...(sourceCommit ? { sourceCommit } : {}) };
  });

  app.get("/v1/operator/diagnostics", async (request) => {
    const user = requireUser(request);
    if (!canInspectServer(ctx, user)) throw new HttpError(403, "forbidden");
    operatorChecks.check(user.id);
    const client = clientCompatibility(request.headers.accept);
    const readiness = await monitor.check();
    const revision = ctx.serverRevision && /^[a-f0-9]{7,40}$/i.test(ctx.serverRevision) ? ctx.serverRevision : null;
    return {
      generatedAt: ctx.now(),
      apiVersion: API_VERSION,
      revision,
      readiness,
      services: {
        appleSignIn: !!ctx.apple,
        ai: !!ctx.ai,
        iosPush: ctx.push?.enabled("ios") ?? false,
        androidPush: ctx.push?.enabled("android") ?? false,
      },
      routes: [...routes.values()].sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method)).map(({ method, path }) => {
        const rule = ctx.apiCompatibility?.[`${method} ${path}`];
        const state = rule?.state === "retired" ? "retired" : rule?.state === "unavailable" ? "unavailable"
          : (rule?.minimumBuild && !client.web && client.build < rule.minimumBuild) || (rule?.minimumApiVersion && client.apiVersion < rule.minimumApiVersion) ? "update-required" : "available";
        return { method, path, state, access: path.startsWith("/v1/operator/") ? "operator" : isPublic(method, path) ? "public" : "account", tested: false,
          ...(rule?.minimumBuild ? { minimumBuild: rule.minimumBuild } : {}), ...(rule?.minimumApiVersion ? { minimumApiVersion: rule.minimumApiVersion } : {}) };
      }),
    };
  });
}
