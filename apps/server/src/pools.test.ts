import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  app = await buildApp({
    db,
    sealer: new Sealer(randomBytes(32).toString("base64")),
    live: new LiveHub(),
    now: () => clock,
    publicUrl: "https://crew.test",
    hashSecret: "s",
    uploadDir: mkdtempSync(join(tmpdir(), "crew-receipts-")),
  });
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
async function crew(...names: string[]) {
  const users = await Promise.all(names.map(account));
  const crewId = ((await app.inject({ method: "POST", url: "/v1/crews", headers: users[0]!.auth, payload: { name: "Crew" } })).json() as { crew: { id: string } }).crew.id;
  const { code } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/invites`, headers: users[0]!.auth })).json() as { code: string };
  for (const u of users.slice(1)) await app.inject({ method: "POST", url: `/v1/invites/${code}/accept`, headers: u.auth });
  return { users, crewId };
}
async function party(owner: User, crewId: string, kind: "party" | "trip", going: User[]) {
  const id = randomUUID();
  await app.inject({
    method: "POST",
    url: "/v1/parties",
    headers: owner.auth,
    payload: { id, crewId, name: kind === "trip" ? "Lisbonne" : "Samedi", mood: "party", kind, startsAt: clock - 3_600_000, endsAt: clock + (kind === "trip" ? 72 : 5) * 3_600_000 },
  });
  for (const u of going) await app.inject({ method: "POST", url: `/v1/parties/${id}/response`, headers: u.auth, payload: { response: "going" } });
  return id;
}
const newPool = (u: User, crewId: string, memberIds: string[], extra: Record<string, unknown> = {}) => {
  const id = randomUUID();
  return app.inject({ method: "POST", url: `/v1/crews/${crewId}/pools`, headers: u.auth, payload: { id, name: "Week-end", currency: "EUR", memberIds, ...extra } }).then((res) => ({ id, res }));
};
const addExpense = (u: User, poolId: string, payload: Record<string, unknown>) =>
  app.inject({ method: "POST", url: `/v1/pools/${poolId}/expenses`, headers: u.auth, payload: { id: randomUUID(), description: "Courses", ...payload } });

type Detail = {
  pool: { crewId: string };
  members: { userId: string }[];
  expenses: { id: string; amount: number; currency: string; poolAmount: number | null; rate: string | null; party: { kind: string } | null; venue: { name: string } | null; receiptUrl: string | null }[];
  settlement: { currency: string; balance: Record<string, number>; transfers: { fromId: string; toId: string; amount: number }[] }[];
};
const detail = async (u: User, poolId: string) => (await app.inject({ method: "GET", url: `/v1/pools/${poolId}`, headers: u.auth })).json() as Detail;

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(400), Buffer.from([0xff, 0xd9])]).toString("base64");

describe("pool members (O-70)", () => {
  it("creates a pool for the people picked, refuses outsiders, adds members later without touching balances", async () => {
    const { users, crewId } = await crew("jade", "malik", "ines", "theo");
    const [jade, malik, ines, theo] = users as [User, User, User, User];
    const stranger = await account("stranger");

    expect((await newPool(jade, crewId, [malik.id, stranger.id])).res.statusCode).toBe(400);
    const { id: poolId } = await newPool(jade, crewId, [malik.id]);
    expect((await detail(jade, poolId)).members.map((m) => m.userId).sort()).toEqual([jade.id, malik.id].sort());
    // Inès was left out: she sees nothing of it.
    expect((await app.inject({ method: "GET", url: `/v1/pools/${poolId}`, headers: ines.auth })).statusCode).toBe(404);

    await addExpense(jade, poolId, { payerId: jade.id, amount: 3000, currency: "EUR", split: { kind: "equal", members: [jade.id, malik.id] } });
    const before = (await detail(jade, poolId)).settlement;

    const add = (u: User, userIds: string[]) => app.inject({ method: "POST", url: `/v1/pools/${poolId}/members`, headers: u.auth, payload: { userIds } });
    expect((await add(malik, [stranger.id])).statusCode).toBe(400);
    expect((await add(ines, [ines.id])).statusCode).toBe(404);
    expect((await add(malik, [ines.id, theo.id])).json()).toEqual({ added: 2 });
    expect((await add(malik, [ines.id])).json()).toEqual({ added: 0 });

    const after = await detail(ines, poolId);
    expect(after.members).toHaveLength(4);
    // The newcomers owe nothing for what came before them.
    expect(after.settlement).toEqual(before);
    expect(after.settlement[0]!.balance[ines.id]).toBeUndefined();
    // And they can be part of the next expense.
    expect((await addExpense(ines, poolId, { payerId: ines.id, amount: 4000, currency: "EUR", split: { kind: "equal", members: [ines.id, theo.id] } })).statusCode).toBe(201);
  });
});

describe("expenses in another currency, tied to a trip and a venue, with a receipt (N-19)", () => {
  it("converts at the typed rate, settles in the pool currency and keeps both amounts", async () => {
    const { users, crewId } = await crew("jade", "malik");
    const [jade, malik] = users as [User, User];
    const tripId = await party(jade, crewId, "trip", [malik]);
    const venueId = randomUUID();
    await app.inject({ method: "POST", url: `/v1/crews/${crewId}/venues`, headers: jade.auth, payload: { id: venueId, name: "Le Zinc", kind: "bar", lat: 48.85, lng: 2.35 } });
    const { id: poolId } = await newPool(jade, crewId, [malik.id]);
    const both = [jade.id, malik.id];

    // Without a rate, a foreign amount is refused: the server never looks one up.
    expect((await addExpense(jade, poolId, { payerId: jade.id, amount: 1_200_000, currency: "JPY", split: { kind: "equal", members: both } })).json()).toMatchObject({ error: "rate_required" });
    expect((await addExpense(jade, poolId, { payerId: jade.id, amount: 1_200_000, currency: "JPY", rate: "0", split: { kind: "equal", members: both } })).statusCode).toBe(400);
    const res = await addExpense(jade, poolId, { payerId: jade.id, amount: 1_200_000, currency: "JPY", rate: "0,0061", partyId: tripId, venueId, split: { kind: "equal", members: both } });
    expect(res.statusCode).toBe(201);
    // Amounts typed in yen, split converted as weights.
    await addExpense(malik, poolId, { payerId: malik.id, amount: 100_000, currency: "JPY", rate: "0.0061", split: { kind: "amounts", amounts: { [jade.id]: 20_000, [malik.id]: 80_000 } } });

    const state = await detail(malik, poolId);
    const yen = state.expenses.find((e) => e.amount === 1_200_000)!;
    expect(yen).toMatchObject({ currency: "JPY", poolAmount: 7320, rate: "0.0061", party: { kind: "trip" }, venue: { name: "Le Zinc" } });
    // One settlement, in euros: jade paid 73.20 for both, malik 6.10 of which jade owes 1.22.
    expect(state.settlement.map((s) => s.currency)).toEqual(["EUR"]);
    expect(state.settlement[0]!.balance).toEqual({ [jade.id]: 3660 - 122, [malik.id]: -(3660 - 122) });
    expect(state.settlement[0]!.transfers).toEqual([{ fromId: malik.id, toId: jade.id, amount: 3538 }]);
  });

  it("refuses a party or a venue of another crew", async () => {
    const { users, crewId } = await crew("jade", "malik");
    const other = await crew("theo");
    const otherParty = await party(other.users[0]!, other.crewId, "party", []);
    const { id: poolId } = await newPool(users[0]!, crewId, [users[1]!.id]);
    const res = await addExpense(users[0]!, poolId, { payerId: users[0]!.id, amount: 1000, currency: "EUR", partyId: otherParty, split: { kind: "equal", members: [users[0]!.id] } });
    expect(res.json()).toMatchObject({ error: "not_in_crew" });
  });

  it("stores a receipt that only pool members get a link to", async () => {
    const { users, crewId } = await crew("jade", "malik", "ines");
    const [jade, malik, ines] = users as [User, User, User];
    const { id: poolId } = await newPool(jade, crewId, [malik.id]);
    const expenseId = randomUUID();
    await app.inject({
      method: "POST",
      url: `/v1/pools/${poolId}/expenses`,
      headers: jade.auth,
      payload: { id: expenseId, description: "Apéro", payerId: jade.id, amount: 6430, currency: "EUR", split: { kind: "equal", members: [jade.id, malik.id] } },
    });
    const put = (u: User, data: string) => app.inject({ method: "PUT", url: `/v1/pools/${poolId}/expenses/${expenseId}/receipt`, headers: u.auth, payload: { data } });
    expect((await put(ines, JPEG)).statusCode).toBe(404);
    expect((await put(jade, Buffer.from("plain text, long enough to pass the size check but not a jpeg file at all....").toString("base64"))).statusCode).toBe(400);
    expect((await put(jade, JPEG)).statusCode).toBe(200);

    const url = (await detail(malik, poolId)).expenses[0]!.receiptUrl!;
    expect(url).toContain("/v1/receipts/");
    const image = await app.inject({ method: "GET", url: url.replace("https://crew.test", "") });
    expect(image.statusCode).toBe(200);
    expect(image.headers["content-type"]).toBe("image/jpeg");
    // A tampered signature, or a party-photo route, opens nothing.
    expect((await app.inject({ method: "GET", url: url.replace("https://crew.test", "").replace(/sig=.{4}/, "sig=AAAA") })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: url.replace("https://crew.test", "").replace("/v1/receipts/", "/v1/photos/") })).statusCode).toBe(404);
  });
});

describe("tonight's spend for the budget alert (N-20)", () => {
  it("adds up my share of the party's pools and of expenses tied to the party", async () => {
    const { users, crewId } = await crew("jade", "malik");
    const [jade, malik] = users as [User, User];
    const partyId = await party(jade, crewId, "party", [malik]);
    const { id: partyPool } = await newPool(jade, crewId, [malik.id], { partyId });
    const { id: otherPool } = await newPool(jade, crewId, [malik.id]);
    const both = [jade.id, malik.id];
    await addExpense(jade, partyPool, { payerId: jade.id, amount: 2000, currency: "EUR", split: { kind: "equal", members: both } });
    await addExpense(malik, otherPool, { payerId: malik.id, amount: 1000, currency: "EUR", partyId, split: { kind: "equal", members: both } });
    await addExpense(malik, otherPool, { payerId: malik.id, amount: 9000, currency: "EUR", split: { kind: "equal", members: both } });
    const spend = (await app.inject({ method: "GET", url: `/v1/parties/${partyId}/spend`, headers: jade.auth })).json() as { spent: { currency: string; amount: number }[] };
    expect(spend.spent).toEqual([{ currency: "EUR", amount: 1500 }]);
    const stranger = await account("stranger");
    expect((await app.inject({ method: "GET", url: `/v1/parties/${partyId}/spend`, headers: stranger.auth })).statusCode).toBe(404);
  });
});
