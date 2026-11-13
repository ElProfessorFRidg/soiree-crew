import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";
import type { Context } from "./context";

let app: FastifyInstance;
let db: Db;
let ctx: Context;
let clock = Date.UTC(2026, 10, 6, 21);
let owner: { user: { id: string }; token: string };
let other: { user: { id: string }; token: string };
let venue: string;
const auth = () => ({ authorization: `Bearer ${owner.token}` });

beforeAll(async () => {
  db = await connectPglite();
  await migrate(db);
  ctx = { db, sealer: new Sealer(randomBytes(32).toString("base64")), live: new LiveHub(), now: () => clock,
    publicUrl: "https://crew.test", hashSecret: "test", serverInfo: { name: "Public", description: "", public: true } };
  app = await buildApp(ctx);
  app.post("/test/budget", async () => ({ ok: true }));
  for (const username of ["jade", "theo"]) {
    const result = await app.inject({ method: "POST", url: "/v1/accounts", payload: { username, displayName: username, birthDate: "1990-01-01" } });
    expect(result.statusCode).toBe(201);
    if (username === "jade") owner = result.json(); else other = result.json();
  }
  const crew = (await app.inject({ method: "POST", url: "/v1/crews", headers: auth(), payload: { name: "Crew" } })).json().crew.id;
  venue = randomUUID();
  expect((await app.inject({ method: "POST", url: `/v1/crews/${crew}/venues`, headers: auth(), payload: { id: venue, name: "Le Zinc", kind: "bar", lat: 48.8566, lng: 2.3522 } })).statusCode).toBe(201);
  await app.inject({ method: "POST", url: "/v1/checkins", headers: auth(), payload: { id: randomUUID(), venueId: venue, lat: 48.8566, lng: 2.3522, accuracy: 15, mocked: false, deviceNow: clock } });
});
afterAll(async () => { await app?.close(); await db?.close(); });

describe("public browsing without an account", () => {
  it("shows public reviews across accounts and guests, never personalized flags or private reviews", async () => {
    expect((await app.inject({ method: "PUT", url: `/v1/places/${venue}/review`, headers: auth(), payload: { ratings: { vibe: 5 }, text: "Bonne ambiance", audience: "public" } })).statusCode).toBe(200);
    const privatePage = await app.inject({ method: "GET", url: `/v1/places/${venue}`, headers: auth() });
    expect(privatePage.json().reviews[0].mine).toBe(true);
    const guest = await app.inject({ method: "GET", url: `/v1/places/${venue}` });
    expect(guest.statusCode).toBe(200);
    expect(guest.json()).toMatchObject({ canReview: false, isOwner: false, myTags: [], ratingCount: 1 });
    expect(guest.json().reviews[0]).toMatchObject({ mine: false, markedUseful: false, text: "Bonne ambiance" });
    const switched = await app.inject({ method: "GET", url: `/v1/places/${venue}`, headers: { authorization: `Bearer ${other.token}` } });
    expect(switched.json().reviews[0]).toMatchObject({ mine: false, text: "Bonne ambiance" });
    // This successful mutation must invalidate the already-cached guest page immediately.
    const id = privatePage.json().reviews[0].id;
    expect((await app.inject({ method: "PATCH", url: `/v1/reviews/${id}`, headers: auth(), payload: { audience: "me" } })).statusCode).toBe(200);
    const hidden = await app.inject({ method: "GET", url: `/v1/places/${venue}` });
    expect(hidden.json().reviews).toEqual([]);
    expect(hidden.json().ratingCount).toBe(0);
    expect((await app.inject({ method: "GET", url: `/v1/places/${venue}`, headers: auth() })).json().reviews).toHaveLength(1);
  });

  it("allows public discovery but refuses anonymous writes, homes and private servers", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/places?lat=48.8566&lng=2.3522" })).json().places).toHaveLength(1);
    for (const url of ["/v1/mutations", "/v1/checkins", `/v1/places/${venue}/review`]) {
      const response = await app.inject({ method: url.endsWith("/review") ? "PUT" : "POST", url, payload: {} });
      expect(response.statusCode).toBe(401);
    }
    expect((await app.inject({ method: "GET", url: `/v1/places/${venue}`, headers: { authorization: "Bearer invalid" } })).statusCode).toBe(401);
    ctx.serverInfo!.public = false;
    expect((await app.inject({ method: "GET", url: `/v1/places/${venue}` })).statusCode).toBe(401);
    ctx.serverInfo!.public = true;
  });
});

describe("quotas on a shared Wi-Fi", () => {
  it("throttles one account, keeps the other working, reserves safety and refills", async () => {
    clock += 60_000;
    for (let n = 0; n < 120; n++) expect((await app.inject({ method: "POST", url: "/test/budget", headers: auth() })).statusCode).toBe(200);
    const limited = await app.inject({ method: "POST", url: "/test/budget", headers: auth() });
    expect(limited.statusCode).toBe(429);
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
    expect((await app.inject({ method: "POST", url: "/test/budget", headers: { authorization: `Bearer ${other.token}` } })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/v1/me", headers: auth() })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/v1/sos", headers: auth(), payload: {} })).statusCode).not.toBe(429);
    clock += 1000;
    expect((await app.inject({ method: "POST", url: "/test/budget", headers: auth() })).statusCode).toBe(200);
  });

  it("limits guests, ignores a forged forwarded address and returns Retry-After", async () => {
    const remoteAddress = "203.0.113.25";
    for (let n = 0; n < 180; n++) expect((await app.inject({ method: "GET", url: "/v1/health", remoteAddress, headers: { "x-forwarded-for": `198.51.100.${n}` } })).statusCode).toBe(200);
    const limited = await app.inject({ method: "GET", url: "/v1/health", remoteAddress, headers: { "x-forwarded-for": "198.51.100.254" } });
    expect(limited.statusCode).toBe(429);
    expect(limited.headers["retry-after"]).toBeDefined();
    expect((await app.inject({ method: "GET", url: "/v1/health", remoteAddress: "203.0.113.26" })).statusCode).toBe(200);
    // Valid authentication on the same network bypasses the exhausted guest quota.
    expect((await app.inject({ method: "GET", url: "/v1/me", remoteAddress, headers: auth() })).statusCode).toBe(200);
  });
});
