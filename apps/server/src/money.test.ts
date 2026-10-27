import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";

let db: Db;
let app: FastifyInstance;
const clock = Date.UTC(2026, 10, 7, 21, 0);

beforeEach(async () => {
  db = await connectPglite();
  await migrate(db);
  app = await buildApp({ db, sealer: new Sealer(randomBytes(32).toString("base64")), live: new LiveHub(), now: () => clock, publicUrl: "https://crew.test", hashSecret: "s" });
});
afterEach(async () => {
  await app.close();
  await db.close();
});

type User = { id: string; auth: { authorization: string } };
async function account(username: string): Promise<User> {
  const body = (await app.inject({ method: "POST", url: "/v1/accounts", payload: { username, displayName: username } })).json() as { user: { id: string }; token: string };
  return { id: body.user.id, auth: { authorization: `Bearer ${body.token}` } };
}
async function crewWithParty(...names: string[]) {
  const users = await Promise.all(names.map(account));
  const crewId = ((await app.inject({ method: "POST", url: "/v1/crews", headers: users[0]!.auth, payload: { name: "Crew" } })).json() as { crew: { id: string } }).crew.id;
  const { code } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/invites`, headers: users[0]!.auth })).json() as { code: string };
  for (const u of users.slice(1)) await app.inject({ method: "POST", url: `/v1/invites/${code}/accept`, headers: u.auth });
  const partyId = randomUUID();
  await app.inject({ method: "POST", url: "/v1/parties", headers: users[0]!.auth, payload: { id: partyId, crewId, name: "Samedi", mood: "party", kind: "party", startsAt: clock - 3_600_000, endsAt: clock + 5 * 3_600_000 } });
  for (const u of users.slice(1)) await app.inject({ method: "POST", url: `/v1/parties/${partyId}/response`, headers: u.auth, payload: { response: "going" } });
  return { users, crewId, partyId };
}

describe("pools (O-70, N-19)", () => {
  it("settles a pool with the fewest transfers and records repayments", async () => {
    const { users, crewId } = await crewWithParty("jade", "malik", "ines");
    const [jade, malik, ines] = users as [User, User, User];
    const poolId = randomUUID();
    await app.inject({ method: "POST", url: `/v1/crews/${crewId}/pools`, headers: jade.auth, payload: { id: poolId, name: "Week-end", currency: "EUR", memberIds: [malik.id, ines.id] } });
    const all = [jade.id, malik.id, ines.id];
    const add = (payer: User, amount: number) =>
      app.inject({ method: "POST", url: `/v1/pools/${poolId}/expenses`, headers: payer.auth, payload: { id: randomUUID(), payerId: payer.id, amount, currency: "EUR", description: "Courses", split: { kind: "equal", members: all } } });
    expect((await add(jade, 6000)).statusCode).toBe(201);
    expect((await add(malik, 3000)).statusCode).toBe(201);
    const state = (await app.inject({ method: "GET", url: `/v1/pools/${poolId}`, headers: ines.auth })).json() as {
      settlement: { currency: string; transfers: { fromId: string; toId: string; amount: number }[] }[];
    };
    expect(state.settlement[0]!.transfers).toEqual([{ fromId: ines.id, toId: jade.id, amount: 3000 }]);
    await app.inject({ method: "POST", url: `/v1/pools/${poolId}/repayments`, headers: ines.auth, payload: { id: randomUUID(), fromId: ines.id, toId: jade.id, amount: 3000, currency: "EUR" } });
    const list = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/pools`, headers: jade.auth })).json() as { pools: { myBalance: number }[] };
    expect(list.pools[0]!.myBalance).toBe(0);
  });

  it("refuses a split that does not add up", async () => {
    const { users, crewId } = await crewWithParty("jade", "malik");
    const poolId = randomUUID();
    await app.inject({ method: "POST", url: `/v1/crews/${crewId}/pools`, headers: users[0]!.auth, payload: { id: poolId, name: "Bar", currency: "EUR", memberIds: [users[1]!.id] } });
    const res = await app.inject({
      method: "POST",
      url: `/v1/pools/${poolId}/expenses`,
      headers: users[0]!.auth,
      payload: { id: randomUUID(), payerId: users[0]!.id, amount: 1000, currency: "EUR", description: "Pintes", split: { kind: "amounts", amounts: { [users[0]!.id]: 300, [users[1]!.id]: 300 } } },
    });
    expect(res.json()).toMatchObject({ error: "amounts_mismatch" });
  });

  it("keeps IBANs sealed and shows them to pool members only", async () => {
    const { users, crewId } = await crewWithParty("jade", "malik", "theo");
    await app.inject({ method: "PUT", url: "/v1/me/payment", headers: users[0]!.auth, payload: { iban: "FR7630006000011234567890189" } });
    const poolId = randomUUID();
    await app.inject({ method: "POST", url: `/v1/crews/${crewId}/pools`, headers: users[0]!.auth, payload: { id: poolId, name: "Bar", currency: "EUR", memberIds: [users[1]!.id] } });
    const state = (await app.inject({ method: "GET", url: `/v1/pools/${poolId}`, headers: users[1]!.auth })).json() as { members: { payment: { iban?: string } | null }[] };
    expect(state.members.some((m) => m.payment?.iban === "FR7630006000011234567890189")).toBe(true);
    expect(JSON.stringify(await db.query("select * from payment_details"))).not.toContain("FR76");
    // Théo is in the crew, not in the pool: no IBAN, no expenses (red team AC-10).
    expect((await app.inject({ method: "GET", url: `/v1/pools/${poolId}`, headers: users[2]!.auth })).statusCode).toBe(404);
  });
});

describe("rounds (N-18)", () => {
  it("logs a drink for each member and the expense in one tap, then names the next payer", async () => {
    const { users, partyId } = await crewWithParty("jade", "malik", "ines");
    const [jade, malik, ines] = users as [User, User, User];
    const res = await app.inject({
      method: "POST",
      url: `/v1/parties/${partyId}/rounds`,
      headers: jade.auth,
      payload: { id: randomUUID(), payerId: jade.id, memberIds: [jade.id, malik.id, ines.id], drink: { presetId: "m-pint", kind: "pint", volumeMl: 500, abv: 0.05 }, amount: 2100, currency: "EUR" },
    });
    expect(res.statusCode).toBe(201);
    const drinks = await db.query<{ user_id: string }>("select user_id from drinks where party_id = $1", [partyId]);
    expect(drinks.map((d) => d.user_id).sort()).toEqual([jade.id, malik.id, ines.id].sort());
    const sync = (await app.inject({ method: "GET", url: "/v1/sync?since=0", headers: malik.auth })).json() as { drinks: { kind: string }[] };
    expect(sync.drinks).toHaveLength(1);
    const rounds = (await app.inject({ method: "GET", url: `/v1/parties/${partyId}/rounds`, headers: malik.auth })).json() as { nextPayerId: string; rounds: unknown[] };
    expect(rounds.rounds).toHaveLength(1);
    expect(rounds.nextPayerId).not.toBe(jade.id);
  });
});
