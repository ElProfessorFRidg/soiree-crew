import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";
import type { Context } from "./context";
import { DatabaseFailure, classifyDatabaseFailure } from "./databaseErrors";
import { ReadinessMonitor } from "./diagnostics";

let db: Db;
let ctx: Context;
let owner: { user: { id: string }; token: string };
let member: { user: { id: string }; token: string };
const apps: FastifyInstance[] = [];
const make = async (changes: Partial<Context> = {}) => { const app = await buildApp({ ...ctx, ...changes }); apps.push(app); return app; };
const auth = (token: string) => ({ authorization: `Bearer ${token}` });

beforeAll(async () => {
  db = await connectPglite(); await migrate(db);
  ctx = { db, sealer: new Sealer(randomBytes(32).toString("base64")), live: new LiveHub(), now: () => Date.now(), publicUrl: "https://diagnostic.example", hashSecret: "test" };
  const app = await make();
  const account = async (username: string) => (await app.inject({ method: "POST", url: "/v1/accounts", payload: { username, displayName: username, birthDate: "1990-01-01" } })).json();
  owner = await account("diagnosticboss"); member = await account("diagnosticmember");
});
afterEach(async () => { vi.useRealTimers(); await Promise.all(apps.splice(0).map((app) => app.close())); });
afterAll(async () => { await db?.close(); });

describe("server diagnostics access and readiness", () => {
  it("keeps liveness public and gives failures unique request references", async () => {
    const app = await make();
    const first = await app.inject({ url: "/v1/health" });
    const second = await app.inject({ url: "/v1/health" });
    expect(first.json()).toEqual({ ok: true });
    expect(first.headers["x-crew-request-id"]).toMatch(/^sc_[a-f0-9-]{36}$/);
    expect(second.headers["x-crew-request-id"]).not.toBe(first.headers["x-crew-request-id"]);
    const unauthenticated = await app.inject({ url: "/v1/operator/diagnostics" });
    expect(unauthenticated.statusCode).toBe(401);
    expect(unauthenticated.headers["x-crew-diagnostic-code"]).toBe("SC_HTTP_401");
    expect((await app.inject({ url: "/v1/ready" })).json()).toEqual({ ok: true });
  });
  it("requires a configured account UUID, including when a client claims to be verified", async () => {
    const app = await make({ operators: ["diagnosticboss"] });
    const me = await app.inject({ url: "/v1/me", headers: auth(owner.token) });
    expect(me.json().capabilities.serverDiagnostics).toBe(false);
    expect((await app.inject({ url: "/v1/me/capabilities", headers: auth(owner.token) })).json()).toEqual({ userId: owner.user.id, serverDiagnostics: false });
    const denied = await app.inject({ url: "/v1/operator/diagnostics?verified=true", headers: { ...auth(owner.token), accept: "application/json; crew-build=99999; crew-client=web" } });
    expect(denied.statusCode).toBe(403);
    expect(denied.json()).toEqual({ error: "forbidden" });
    expect(denied.body).not.toContain("routes");
  });
  it("returns an accurate route inventory and configuration, with every route initially untested", async () => {
    const app = await make({ operators: [owner.user.id], serverRevision: "a".repeat(40), apiCompatibility: { "GET /v1/me/stats": { state: "unavailable" } } });
    expect((await app.inject({ url: "/v1/me", headers: auth(owner.token) })).json().capabilities.serverDiagnostics).toBe(true);
    expect((await app.inject({ url: "/v1/operator/diagnostics", headers: auth(member.token) })).statusCode).toBe(403);
    const response = await app.inject({ url: "/v1/operator/diagnostics", headers: auth(owner.token) });
    expect(response.statusCode).toBe(200);
    const result = response.json();
    expect(result).toMatchObject({ apiVersion: 1, revision: "a".repeat(40), readiness: { state: "ready", code: "SC_OK" }, services: { ai: false, iosPush: false, androidPush: false, appleSignIn: false } });
    expect(result.routes.length).toBeGreaterThan(100);
    expect(result.routes).toContainEqual(expect.objectContaining({ method: "GET", path: "/v1/me/stats", state: "unavailable", tested: false }));
    expect(result.routes).toContainEqual(expect.objectContaining({ method: "POST", path: "/v1/mutations", tested: false }));
    expect(result.routes.every((route: { tested: boolean }) => route.tested === false)).toBe(true);
    expect(response.body).not.toContain(owner.token);
    expect(response.body).not.toContain(owner.user.id);
    expect(response.body).not.toContain("DATABASE_URL");
  });
  it("rechecks authorization and enforces the operator probe budget", async () => {
    const active = { ...ctx, operators: [owner.user.id] };
    const app = await buildApp(active); apps.push(app);
    const check = () => app.inject({ url: "/v1/operator/diagnostics", headers: auth(owner.token) });
    expect((await check()).statusCode).toBe(200);
    expect((await check()).statusCode).toBe(200);
    const limited = await check();
    expect(limited.statusCode).toBe(429);
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
    active.operators = [];
    expect((await check()).statusCode).toBe(403);
    expect((await app.inject({ url: "/v1/me", headers: auth(owner.token) })).json().capabilities.serverDiagnostics).toBe(false);
  });
  it("keeps permission discovery available when profile-specific tables fail", async () => {
    const partial: Db = {
      query: async (sql, params) => { if (sql.includes("profile_photos")) throw new DatabaseFailure("SC_DB_02", { code: "42P01" }); return db.query(sql, params); },
      transaction: (work) => db.transaction(work), close: async () => undefined,
    };
    const app = await make({ db: partial, operators: [owner.user.id] });
    expect((await app.inject({ url: "/v1/me", headers: auth(owner.token) })).statusCode).toBe(503);
    expect((await app.inject({ url: "/v1/me/capabilities", headers: auth(owner.token) })).json()).toEqual({ userId: owner.user.id, serverDiagnostics: true });
    expect((await app.inject({ url: "/v1/operator/diagnostics", headers: auth(owner.token) })).statusCode).toBe(200);
  });
  it("reports database failure while liveness stays green, without exposing database errors", async () => {
    const secret = "postgres://private-password@internal-db/private-schema";
    const failing: Db = { query: async () => { throw new DatabaseFailure("SC_DB_01", new Error(secret)); }, transaction: async (work) => work(failing), close: async () => undefined };
    const app = await make({ db: failing });
    expect((await app.inject({ url: "/v1/health" })).statusCode).toBe(200);
    const ready = await app.inject({ url: "/v1/ready" });
    expect(ready.statusCode).toBe(503);
    expect(ready.headers["x-crew-diagnostic-code"]).toBe("SC_DB_01");
    expect(ready.json()).toEqual({ ok: false });
    const info = await app.inject({ url: "/v1/info" });
    expect(info.statusCode).toBe(503);
    expect(info.json()).toEqual({ error: "database_unavailable" });
    expect(info.headers["x-crew-diagnostic-code"]).toBe("SC_DB_01");
    expect(info.body + ready.body).not.toContain(secret);
  });
  it("does not multiply hung database probes after their deadline", async () => {
    vi.useFakeTimers();
    let release!: (value: unknown[]) => void;
    const pending = new Promise<unknown[]>((resolve) => { release = resolve; });
    const query = vi.fn(() => pending);
    const hanging: Db = { query: query as Db["query"], transaction: async (work) => work(hanging), close: async () => undefined };
    const monitor = new ReadinessMonitor({ ...ctx, db: hanging });
    const checks = Array.from({ length: 8 }, () => monitor.check());
    await vi.advanceTimersByTimeAsync(2001);
    expect((await Promise.all(checks)).every((result) => result.code === "SC_DB_04")).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(6000);
    const again = monitor.check();
    await vi.advanceTimersByTimeAsync(2001);
    expect((await again).code).toBe("SC_DB_04");
    expect(query).toHaveBeenCalledTimes(1);
    release([]);
    await Promise.resolve();
  });
  it("classifies schema and connection failures while preserving application constraint errors", () => {
    for (const [code, expected] of [["42P01", "SC_DB_02"], ["42703", "SC_DB_02"], ["28P01", "SC_DB_03"], ["ECONNREFUSED", "SC_DB_01"], ["57014", "SC_DB_04"]]) {
      expect(classifyDatabaseFailure({ code })).toMatchObject({ diagnosticCode: expected });
    }
    for (const code of ["22P02", "23505"]) { const error = { code }; expect(classifyDatabaseFailure(error)).toBe(error); }
  });
});
