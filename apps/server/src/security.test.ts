import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { SESSION_IDLE_MS } from "./context";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";

// Regression tests for the server security audit of 2026-10-28: each case is one hole, closed.

const MIN = 60_000;
const ZINC = { lat: 48.8566, lng: 2.3522 };
let clock = Date.UTC(2026, 10, 7, 21, 0);
let db: Db;
let app: FastifyInstance;

beforeEach(async () => {
  clock = Date.UTC(2026, 10, 7, 21, 0);
  db = await connectPglite();
  await migrate(db);
  app = await buildApp({ db, sealer: new Sealer(randomBytes(32).toString("base64")), live: new LiveHub(), now: () => clock, publicUrl: "https://crew.test", hashSecret: "s" });
});
afterEach(async () => {
  await app.close();
  await db.close();
});

type User = { id: string; auth: { authorization: string } };
async function account(username: string, password?: string): Promise<User> {
  const payload = password ? { username, displayName: username, email: `${username}@crew.test`, password } : { username, displayName: username };
  const body = (await app.inject({ method: "POST", url: "/v1/accounts", payload })).json() as { user: { id: string }; token: string };
  return { id: body.user.id, auth: { authorization: `Bearer ${body.token}` } };
}

async function crew(...names: string[]) {
  const users = await Promise.all(names.map((n) => account(n)));
  const admin = users[0]!;
  const crewId = ((await app.inject({ method: "POST", url: "/v1/crews", headers: admin.auth, payload: { name: "Les Quais" } })).json() as { crew: { id: string } }).crew.id;
  const { code } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/invites`, headers: admin.auth })).json() as { code: string };
  for (const u of users.slice(1)) await app.inject({ method: "POST", url: `/v1/invites/${code}/accept`, headers: u.auth });
  const venueId = randomUUID();
  await app.inject({ method: "POST", url: `/v1/crews/${crewId}/venues`, headers: admin.auth, payload: { id: venueId, name: "Le Zinc", kind: "bar", ...ZINC } });
  const partyId = randomUUID();
  await app.inject({
    method: "POST",
    url: "/v1/parties",
    headers: admin.auth,
    payload: { id: partyId, crewId, name: "Samedi", mood: "party", kind: "party", startsAt: clock - 30 * MIN, endsAt: clock + 6 * 60 * MIN },
  });
  return { users, crewId, venueId, partyId };
}

const respond = (u: User, partyId: string, response = "going") =>
  app.inject({ method: "POST", url: `/v1/parties/${partyId}/response`, headers: u.auth, payload: { response } });

describe("money", () => {
  it("never adds anyone to an existing pool through a reused id", async () => {
    const { users, crewId } = await crew("jade", "malik", "ines");
    const [jade, malik, ines] = users as [User, User, User];
    const poolId = randomUUID();
    const create = (u: User, memberIds: string[]) =>
      app.inject({ method: "POST", url: `/v1/crews/${crewId}/pools`, headers: u.auth, payload: { id: poolId, name: "Courses", currency: "EUR", memberIds } });
    expect((await create(jade, [malik.id])).statusCode).toBe(201);
    // My own replay stays idempotent.
    expect((await create(jade, [malik.id])).statusCode).toBe(201);
    expect((await create(ines, [ines.id])).statusCode).toBe(409);
    expect((await app.inject({ method: "GET", url: `/v1/pools/${poolId}`, headers: ines.auth })).statusCode).toBe(404);
  });

  it("only takes https payment links", async () => {
    const jade = await account("jade");
    const put = (link: string) => app.inject({ method: "PUT", url: "/v1/me/payment", headers: jade.auth, payload: { link } });
    expect((await put("javascript:alert(1)")).statusCode).toBe(400);
    expect((await put("http://pay.example/jade")).statusCode).toBe(400);
    expect((await put("https://pay.example/jade")).statusCode).toBe(200);
  });
});

describe("check-ins", () => {
  it("lets no admin overturn their own rejected check-in", async () => {
    const { users, venueId } = await crew("jade", "malik");
    const [jade, malik] = users as [User, User];
    const reject = async (u: User) => {
      const id = randomUUID();
      await db.query(
        `insert into check_ins (id, user_id, venue_id, at, last_proof_at, verdict, risk, signals, config_version, fix_hash, created_at)
         values ($1, $2, $3, $4, $4, 'rejected', 90, '[]', 1, 'h', $4)`,
        [id, u.id, venueId, clock - MIN],
      );
      return id;
    };
    const own = await reject(jade);
    expect((await app.inject({ method: "POST", url: `/v1/checkins/${own}/overturn`, headers: jade.auth })).statusCode).toBe(403);
    const theirs = await reject(malik);
    expect((await app.inject({ method: "POST", url: `/v1/checkins/${theirs}/overturn`, headers: jade.auth })).statusCode).toBe(200);
  });

  it("never accepts a web check-in on its own", async () => {
    const { users, venueId } = await crew("jade");
    const res = await app.inject({
      method: "POST",
      url: "/v1/checkins",
      headers: users[0]!.auth,
      payload: { id: randomUUID(), venueId, lat: ZINC.lat + 0.00011, lng: ZINC.lng + 0.00007, accuracy: 15, mocked: false, deviceNow: clock, platform: "web" },
    });
    expect((res.json() as { verdict: string }).verdict).toBe("unverified");
  });
});

describe("parties", () => {
  it("refuses to sign up to a finished night, and status from someone not going", async () => {
    const { users, partyId } = await crew("jade", "malik");
    const [, malik] = users as [User, User];
    expect((await app.inject({ method: "POST", url: `/v1/parties/${partyId}/status`, headers: malik.auth, payload: { batteryLow: false } })).statusCode).toBe(403);
    clock += 7 * 60 * MIN;
    expect((await respond(malik, partyId)).statusCode).toBe(409);
  });

  it("keeps someone who walked into an open crew out of a night already under way", async () => {
    const { users, crewId, partyId } = await crew("jade");
    await app.inject({ method: "PATCH", url: `/v1/crews/${crewId}/settings`, headers: users[0]!.auth, payload: { open: true } });
    const stranger = await account("stranger");
    expect((await app.inject({ method: "POST", url: `/v1/crews/${crewId}/join`, headers: stranger.auth })).statusCode).toBe(200);
    expect((await respond(stranger, partyId)).statusCode).toBe(403);
    const locations = (await app.inject({ method: "GET", url: `/v1/parties/${partyId}/locations`, headers: stranger.auth })).json() as { locations: unknown[] };
    expect(locations.locations).toEqual([]);
    const live = (await app.inject({ method: "GET", url: `/v1/parties/${partyId}/live`, headers: stranger.auth })).json() as { members: { bac: number | null }[] };
    expect(live.members.every((m) => m.bac === null)).toBe(true);
  });

  it("takes someone who leaves the crew out of its live night and its chat", async () => {
    const { users, crewId, partyId } = await crew("jade", "malik");
    const [, malik] = users as [User, User];
    await respond(malik, partyId);
    await app.inject({ method: "DELETE", url: `/v1/crews/${crewId}/members/me`, headers: malik.auth });
    expect(await db.query("select 1 from party_members where party_id = $1 and user_id = $2", [partyId, malik.id])).toHaveLength(0);
  });
});

describe("drinks", () => {
  it("drops a friend's confirmation when the drink is changed afterwards", async () => {
    const { users, partyId } = await crew("jade", "malik");
    const [jade, malik] = users as [User, User];
    await respond(malik, partyId);
    const id = randomUUID();
    const add = (volumeMl: number) =>
      app.inject({
        method: "POST",
        url: "/v1/mutations",
        headers: malik.auth,
        payload: {
          mutations: [
            { key: `k-${id}-${volumeMl}`, mutation: { kind: "drink.add", drink: { id, presetId: "m-pint", kind: "pint", volumeMl, abv: 0.05, consumedAt: clock, loggedAt: clock, withFood: false } } },
          ],
        },
      });
    await add(250);
    expect((await app.inject({ method: "POST", url: `/v1/drinks/${id}/confirm`, headers: jade.auth })).statusCode).toBe(200);
    expect(await db.query("select 1 from drink_confirmations where drink_id = $1", [id])).toHaveLength(1);
    await add(1000);
    expect(await db.query("select 1 from drink_confirmations where drink_id = $1", [id])).toHaveLength(0);
  });
});

describe("sessions", () => {
  it("lets the owner sign in from their own address while a stranger hammers the login", async () => {
    await account("jade", "correct horse battery");
    const login = (password: string, remoteAddress: string) =>
      app.inject({ method: "POST", url: "/v1/sessions/password", remoteAddress, payload: { login: "jade", password } });
    for (let i = 0; i < 5; i++) await login("wrong password!", "203.0.113.9");
    expect((await login("wrong password!", "203.0.113.9")).statusCode).toBe(429);
    expect((await login("correct horse battery", "198.51.100.7")).statusCode).toBe(201);
  });

  it("signs other devices out on a new password, and forgets an idle session", async () => {
    const first = await account("jade", "correct horse battery");
    const second = (await app.inject({ method: "POST", url: "/v1/sessions/password", payload: { login: "jade", password: "correct horse battery" } })).json() as { token: string };
    const secondAuth = { authorization: `Bearer ${second.token}` };
    expect((await app.inject({ method: "GET", url: "/v1/me", headers: secondAuth })).statusCode).toBe(200);
    const change = await app.inject({
      method: "PUT",
      url: "/v1/me/credentials",
      headers: first.auth,
      payload: { email: "jade@crew.test", password: "an even better one", currentPassword: "correct horse battery" },
    });
    expect(change.statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/v1/me", headers: secondAuth })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/v1/me", headers: first.auth })).statusCode).toBe(200);
    clock += SESSION_IDLE_MS + MIN;
    expect((await app.inject({ method: "GET", url: "/v1/me", headers: first.auth })).statusCode).toBe(401);
  });
});
