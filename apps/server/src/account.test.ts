import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";

let db: Db;
let app: FastifyInstance;
let live: LiveHub;
const clock = Date.UTC(2026, 10, 7, 21, 0);

beforeEach(async () => {
  db = await connectPglite();
  await migrate(db);
  live = new LiveHub();
  app = await buildApp({ db, sealer: new Sealer(randomBytes(32).toString("base64")), live, now: () => clock, publicUrl: "https://crew.test", hashSecret: "s" });
});
afterEach(async () => {
  await app.close();
  await db.close();
});

async function signUp(username: string) {
  const body = (await app.inject({ method: "POST", url: "/v1/accounts", payload: { username, displayName: username, deviceLabel: "iPhone" } })).json() as {
    user: { id: string };
    token: string;
  };
  return { id: body.user.id, token: body.token, auth: { authorization: `Bearer ${body.token}` } };
}

describe("sessions (SEC-07)", () => {
  it("lists sessions with the current one marked, and signing out ends it on the server", async () => {
    const jade = await signUp("jade");
    const { code } = (await app.inject({ method: "POST", url: "/v1/sessions/transfer-code", headers: jade.auth })).json() as { code: string };
    const heard: string[] = [];
    live.add(jade.id, { send: (data) => heard.push(data) });
    const second = (await app.inject({ method: "POST", url: "/v1/sessions/claim", payload: { code, deviceLabel: "Pixel" } })).json() as { token: string };
    expect(heard.some((m) => m.includes("security.newDevice"))).toBe(true);

    const list = (await app.inject({ method: "GET", url: "/v1/sessions", headers: jade.auth })).json() as { sessions: { deviceLabel: string; current: boolean }[] };
    expect(list.sessions).toHaveLength(2);
    expect(list.sessions.find((s) => s.current)?.deviceLabel).toBe("iPhone");

    const secondAuth = { authorization: `Bearer ${second.token}` };
    expect((await app.inject({ method: "DELETE", url: "/v1/sessions/current", headers: secondAuth })).statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: "/v1/me", headers: secondAuth })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/v1/me", headers: jade.auth })).statusCode).toBe(200);
  });

  it("rate-limits guessing transfer codes", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      statuses.push((await app.inject({ method: "POST", url: "/v1/sessions/claim", payload: { code: "AAAAAAAAAA" } })).statusCode);
    }
    expect(statuses.slice(0, 10).every((s) => s === 400)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });
});

describe("export (N-17, SEC-08)", () => {
  it("returns my data decrypted and nothing about other people's drinks", async () => {
    const jade = await signUp("jade");
    const malik = await signUp("malik");
    const drink = (user: { auth: Record<string, string> }, volumeMl: number) =>
      app.inject({
        method: "POST",
        url: "/v1/mutations",
        headers: user.auth,
        payload: {
          mutations: [
            {
              key: randomUUID(),
              mutation: { kind: "drink.add", drink: { id: randomUUID(), presetId: "m-pint", kind: "pint", volumeMl, abv: 0.05, consumedAt: clock, loggedAt: clock, withFood: false } },
            },
          ],
        },
      });
    await drink(jade, 500);
    await drink(malik, 330);
    await app.inject({ method: "PUT", url: "/v1/me/payment", headers: jade.auth, payload: { iban: "FR7630006000011234567890189" } });

    const data = (await app.inject({ method: "GET", url: "/v1/me/export", headers: jade.auth })).json() as {
      account: { username: string };
      drinks: { volumeMl: number }[];
      paymentDetails: { iban: string };
    };
    expect(data.account.username).toBe("jade");
    expect(data.drinks.map((d) => d.volumeMl)).toEqual([500]);
    expect(data.paymentDetails.iban).toBe("FR7630006000011234567890189");
  });
});

describe("email and password (O-01)", () => {
  const signUpWith = (username: string, email: string, password: string) =>
    app.inject({ method: "POST", url: "/v1/accounts", payload: { username, displayName: username, email, password } });
  const signIn = (login: string, password: string) => app.inject({ method: "POST", url: "/v1/sessions/password", payload: { login, password, deviceLabel: "Pixel" } });

  it("signs in with the email or the username, and keeps the email sealed", async () => {
    expect((await signUpWith("jade", "Jade@Example.com", "long enough pass")).statusCode).toBe(201);
    expect((await signIn("jade@example.com", "long enough pass")).statusCode).toBe(201);
    expect((await signIn("JADE", "long enough pass")).statusCode).toBe(201);
    const stored = await db.query<{ email_sealed: string; email_lookup: string; password_hash: string }>("select * from credentials");
    expect(JSON.stringify(stored)).not.toContain("example.com");
    expect(stored[0]!.password_hash.startsWith("scrypt$")).toBe(true);
  });

  it("answers the same for an unknown login and a wrong password", async () => {
    await signUpWith("jade", "jade@example.com", "long enough pass");
    const wrong = await signIn("jade@example.com", "not the password");
    const unknown = await signIn("nobody@example.com", "not the password");
    expect([wrong.statusCode, unknown.statusCode]).toEqual([401, 401]);
    expect(wrong.json()).toEqual(unknown.json());
  });

  it("refuses a short password, an email without password and a taken email", async () => {
    expect((await signUpWith("jade", "jade@example.com", "short")).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/v1/accounts", payload: { username: "jade", displayName: "Jade", email: "jade@example.com" } })).statusCode).toBe(400);
    await signUpWith("jade", "jade@example.com", "long enough pass");
    const again = await signUpWith("theo", "JADE@example.com", "long enough pass");
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ error: "email_taken" });
  });

  it("adds credentials later, and changing them needs the current password", async () => {
    const jade = await signUp("jade");
    expect((await app.inject({ method: "GET", url: "/v1/me/credentials", headers: jade.auth })).json()).toEqual({ hasPassword: false, email: null });
    const put = (payload: object) => app.inject({ method: "PUT", url: "/v1/me/credentials", headers: jade.auth, payload });
    expect((await put({ email: "jade@example.com", password: "first password" })).statusCode).toBe(200);
    expect((await put({ email: null, password: "second password" })).statusCode).toBe(403);
    expect((await put({ email: null, password: "second password", currentPassword: "first password" })).statusCode).toBe(200);
    expect((await signIn("jade@example.com", "second password")).statusCode).toBe(401);
    expect((await signIn("jade", "second password")).statusCode).toBe(201);
    const exported = (await app.inject({ method: "GET", url: "/v1/me/export", headers: jade.auth })).json() as { account: { email: string | null } };
    expect(exported.account.email).toBeNull();
  });

  it("rate-limits password guesses on one login", async () => {
    await signUpWith("jade", "jade@example.com", "long enough pass");
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await signIn("jade", `guess number ${i}`)).statusCode);
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });
});

describe("error answers (red team AC-10)", () => {
  it("keeps Fastify's 4xx and turns a malformed id into a 404, never a 500", async () => {
    const jade = await signUp("jade");
    const empty = await app.inject({ method: "POST", url: "/v1/sessions/transfer-code", headers: { ...jade.auth, "content-type": "application/json" }, payload: "" });
    expect(empty.statusCode).toBe(400);
    const big = await app.inject({ method: "POST", url: "/v1/accounts", headers: { "content-type": "application/json" }, payload: JSON.stringify({ username: "x".repeat(600_000) }) });
    expect(big.statusCode).toBe(413);
    const bad = await app.inject({ method: "POST", url: "/v1/drinks/not-a-uuid/confirm", headers: jade.auth });
    expect(bad.statusCode).toBe(404);
  });
});
