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
