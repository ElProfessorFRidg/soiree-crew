import { createSign, generateKeyPairSync, randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { nonceHash, type AppleJwk } from "./appleAuth";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";

// O-01, O-04: "Continue with Apple" is verified on the server, and the profile photo is stored there.

const clock = Date.UTC(2026, 10, 7, 21, 0);
const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk: AppleJwk = { ...(pair.publicKey.export({ format: "jwk" }) as AppleJwk), kid: "k1", alg: "RS256" };
const other = generateKeyPairSync("rsa", { modulusLength: 2048 });

function token(claims: Record<string, unknown> = {}, key = pair.privateKey, kid = "k1"): string {
  const enc = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const head = enc({ alg: "RS256", kid });
  const body = enc({ iss: "https://appleid.apple.com", aud: "app.soireecrew.mobile", sub: "001.abc", exp: Math.floor(clock / 1000) + 600, nonce: nonceHash("nonce-12345"), ...claims });
  const signature = createSign("RSA-SHA256").update(`${head}.${body}`).sign(key).toString("base64url");
  return `${head}.${body}.${signature}`;
}

let db: Db;
let app: FastifyInstance;
beforeEach(async () => {
  db = await connectPglite();
  await migrate(db);
  app = await buildApp({
    db,
    sealer: new Sealer(randomBytes(32).toString("base64")),
    live: new LiveHub(),
    now: () => clock,
    publicUrl: "https://crew.test",
    hashSecret: "s",
    uploadDir: mkdtempSync(join(tmpdir(), "crew-apple-")),
    apple: { clientIds: ["app.soireecrew.mobile"], keys: async () => [jwk] },
  });
});
afterEach(async () => {
  await app.close();
  await db.close();
});

const create = (identityToken: string, extra: object = {}) =>
  app.inject({ method: "POST", url: "/v1/accounts/apple", payload: { identityToken, nonce: "nonce-12345", username: "lea", displayName: "Lea", birthDate: "1998-05-02", ...extra } });

describe("Continue with Apple (O-01)", () => {
  it("makes an account from a valid token, then opens it again from the same identity", async () => {
    expect((await app.inject({ method: "POST", url: "/v1/sessions/apple", payload: { identityToken: token(), nonce: "nonce-12345" } })).statusCode).toBe(404);
    expect((await create(token())).statusCode).toBe(201);
    const again = await app.inject({ method: "POST", url: "/v1/sessions/apple", payload: { identityToken: token(), nonce: "nonce-12345" } });
    expect(again.statusCode).toBe(201);
    expect((again.json() as { user: { username: string } }).user.username).toBe("lea");
    expect((await create(token(), { username: "lea2" })).statusCode).toBe(409);
  });

  it("believes nothing the token does not prove", async () => {
    for (const bad of [
      token({}, other.privateKey),
      token({}, pair.privateKey, "unknown"),
      token({ aud: "someone.else" }),
      token({ iss: "https://evil.example" }),
      token({ exp: Math.floor(clock / 1000) - 5 }),
      token({ nonce: nonceHash("another-nonce") }),
      "not-a-token-but-long-enough",
    ]) {
      expect((await create(bad)).statusCode).toBe(401);
    }
    expect((await db.query("select 1 from users")).length).toBe(0);
  });

  it("refuses under 18 before anything is stored", async () => {
    const res = await create(token(), { birthDate: "2012-01-01" });
    expect(res.statusCode).toBe(403);
    expect((await db.query("select 1 from users")).length).toBe(0);
    expect((await db.query("select 1 from apple_identities")).length).toBe(0);
  });
});

describe("profile photo (O-04)", () => {
  it("stores one JPEG per account and serves it through a signed link", async () => {
    const auth = { authorization: `Bearer ${((await create(token())).json() as { token: string }).token}` };
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(200)]).toString("base64");
    const sent = await app.inject({ method: "PUT", url: "/v1/me/photo", headers: auth, payload: { data: jpeg } });
    expect(sent.statusCode).toBe(200);
    const url = new URL((sent.json() as { photoUrl: string }).photoUrl);
    expect((await app.inject({ method: "GET", url: url.pathname + url.search })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/v1/me", headers: auth })).json()).toMatchObject({ photoUrl: expect.stringContaining("/v1/photos/") });
    expect((await app.inject({ method: "PUT", url: "/v1/me/photo", headers: auth, payload: { data: Buffer.alloc(300).toString("base64") } })).statusCode).toBe(400);
    expect((await app.inject({ method: "DELETE", url: "/v1/me/photo", headers: auth })).statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: url.pathname + url.search })).statusCode).toBe(404);
  });
});
