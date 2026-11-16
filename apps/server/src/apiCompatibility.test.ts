import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { ApiCompatibility, clientCompatibility, compatibilityRulesFromEnv, type CompatibilityRules } from "./apiCompatibility";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";
import type { Context } from "./context";
import { compatibilityAccept, decodeCompatibility } from "../../mobile/src/ui/pure/apiCompatibility";

let db: Db;
let ctx: Context;
let token: string;
beforeAll(async () => {
  db = await connectPglite();
  await migrate(db);
  ctx = { db, sealer: new Sealer(randomBytes(32).toString("base64")), live: new LiveHub(), now: () => Date.now(), publicUrl: "https://api.example", hashSecret: "test", serverInfo: { name: "Public", description: "", public: true } };
  const app = await buildApp(ctx);
  const result = await app.inject({ method: "POST", url: "/v1/accounts", payload: { username: "compatibility", displayName: "Test", birthDate: "1990-01-01" } });
  expect(result.statusCode).toBe(201);
  token = result.json().token;
  await app.close();
});
afterAll(async () => { await db?.close(); });
const make = (apiCompatibility: CompatibilityRules = {}, webAppUrl?: string) => buildApp({ ...ctx, apiCompatibility, ...(webAppUrl ? { webAppUrl } : {}) });
const places = "/v1/places?lat=48.8566&lng=2.3522";

describe("per-feature compatibility", () => {
  it("keeps historical clients working until a specific route is configured", async () => {
    const app = await make();
    try {
      expect((await app.inject({ url: places })).statusCode).toBe(200);
      expect((await app.inject({ url: places, headers: { accept: compatibilityAccept(2, "ios") } })).statusCode).toBe(200);
      expect((await app.inject({ url: "/v1/info" })).json().api).toEqual({ version: 1, compatibilityMessages: true });
    } finally { await app.close(); }
  });
  it("returns a human message, a minimum build and an opt-in public web action", async () => {
    const app = await make({ "GET /v1/places": { minimumBuild: 120, webFallback: true } }, "https://crew.example");
    try {
      const response = await app.inject({ url: `${places}&token=never-forward-this`, headers: { accept: compatibilityAccept(115, "ios") } });
      expect(response.statusCode).toBe(426);
      expect(response.json()).toMatchObject({ error: "client_update_required", message: expect.any(String), compatibility: { reason: "update_required", apiVersion: 1, minimumBuild: 120, webUrl: "https://crew.example/discover" } });
      expect(response.body).not.toContain("never-forward-this");
      expect(decodeCompatibility(response.json(), response.statusCode, places)?.reason).toBe("update_required");
      expect((await app.inject({ url: places, headers: { accept: compatibilityAccept(120, "ios") } })).statusCode).toBe(200);
      expect((await app.inject({ url: places, headers: { accept: compatibilityAccept(0, "web") } })).statusCode).toBe(200);
      expect((await app.inject({ url: "/v1/crews/open" })).statusCode).toBe(200);
      // A browser can still use the old server's allowed headers; Accept is safelisted.
      const preflight = await app.inject({ method: "OPTIONS", url: places, headers: { origin: "https://crew.example", "access-control-request-method": "GET", "access-control-request-headers": "authorization" } });
      expect(preflight.statusCode).toBe(204);
    } finally { await app.close(); }
  });
  it("does not invent a website from an API hostname and applies API versions to web clients too", async () => {
    const app = await make({ "GET /v1/places": { minimumBuild: 120, minimumApiVersion: 2, webFallback: true } });
    try {
      const response = await app.inject({ url: places, headers: { accept: compatibilityAccept(500, "web") } });
      expect(response.statusCode).toBe(426);
      expect(response.json().compatibility.webUrl).toBeUndefined();
    } finally { await app.close(); }
  });
  it("distinguishes temporary outages, removed endpoints and missing resources", async () => {
    const app = await make({ "GET /v1/places": { state: "unavailable" }, "GET /v1/retired/:id": { state: "retired" } });
    try {
      const down = await app.inject({ url: places });
      expect(down.statusCode).toBe(503);
      expect(down.headers["retry-after"]).toBe("30");
      expect(down.json().compatibility.reason).toBe("feature_unavailable");
      const headers = { authorization: `Bearer ${token}` };
      const retired = await app.inject({ url: "/v1/retired/old-item", headers });
      expect(retired.statusCode).toBe(410);
      expect(retired.json().compatibility.reason).toBe("feature_removed");
      const absent = await app.inject({ url: "/v1/not-implemented-yet", headers });
      expect(absent.statusCode).toBe(404);
      expect(absent.json().compatibility.reason).toBe("server_outdated");
      const missingVenue = await app.inject({ url: `/v1/places/${randomUUID()}` });
      expect(missingVenue.statusCode).toBe(404);
      expect(missingVenue.json()).toEqual({ error: "not_found" });
    } finally { await app.close(); }
  });
  it("checks authentication and quotas before trusting client compatibility metadata", async () => {
    const app = await make({ "POST /v1/mutations": { minimumBuild: 120 }, "GET /v1/places": { minimumBuild: 120 } });
    try {
      expect((await app.inject({ method: "POST", url: "/v1/mutations", headers: { accept: compatibilityAccept(999, "web") }, payload: {} })).statusCode).toBe(401);
      expect((await app.inject({ url: places, headers: { authorization: "Bearer invalid", accept: compatibilityAccept(999, "ios") } })).statusCode).toBe(401);
      const headers = { authorization: `Bearer ${token}`, accept: compatibilityAccept(2, "ios") };
      expect((await app.inject({ method: "POST", url: "/v1/mutations", headers, payload: { mutations: [] } })).statusCode).toBe(426);
      for (let n = 0; n < 18; n++) expect((await app.inject({ url: places, remoteAddress: "203.0.113.51" })).statusCode).toBe(426);
      expect((await app.inject({ url: places, remoteAddress: "203.0.113.51" })).statusCode).toBe(429);
    } finally { await app.close(); }
  });
  it("rejects rules that disable authentication, discovery or emergency routes, or redirect writes", () => {
    for (const route of ["GET /v1/health", "GET /v1/info", "POST /v1/accounts", "POST /v1/sessions/password", "POST /v1/sos", "POST /v1/parties/:partyId/status", "POST /v1/parties/some-party/status"]) expect(() => new ApiCompatibility({ [route]: { state: "retired" } })).toThrow();
    expect(() => new ApiCompatibility({ "POST /v1/mutations": { webFallback: true } })).toThrow();
    expect(() => new ApiCompatibility({ "GET /v1/me": { webFallback: true } })).toThrow();
    for (const url of ["http://crew.example", "https://user:pass@crew.example", "https://crew.example/?token=secret", "https://crew.example/app"]) expect(() => new ApiCompatibility({}, url)).toThrow();
    expect(compatibilityRulesFromEnv()).toEqual({});
    expect(() => compatibilityRulesFromEnv('{"GET /v1/places":{"minimumBuild":-2}}')).toThrow();
  });
  it("parses mobile Accept parameters defensively", () => {
    expect(clientCompatibility(compatibilityAccept(120, "ios"))).toEqual({ build: 120, apiVersion: 1, web: false });
    expect(clientCompatibility(undefined)).toEqual({ build: 0, apiVersion: 1, web: false });
    expect(clientCompatibility("application/json; crew-build=NaN; crew-api=invalid")).toEqual({ build: 0, apiVersion: 1, web: false });
    expect(clientCompatibility("application/json; crew-build=99999999999999999999").build).toBe(0);
  });
});
