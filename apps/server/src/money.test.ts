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
  const body = (await app.inject({ method: "POST", url: "/v1/accounts", payload: { birthDate: "1990-01-01", username, displayName: username } })).json() as { user: { id: string }; token: string };
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

  type Summary = { id: string; drinksAdded: number; amount: number; currency: string; shares: Record<string, number>; nextPayerId: string };
  type State = { nextPayerId: string; rotation: string[]; standings: { userId: string; balance: number; nightsSincePaid: number | null }[]; pool: { currency: string } | null };
  const logRound = (party: string, by: User, payerId: string, memberIds: string[], amount: number, extra: Record<string, unknown> = {}) =>
    app.inject({
      method: "POST",
      url: `/v1/parties/${party}/rounds`,
      headers: by.auth,
      payload: { id: randomUUID(), payerId, memberIds, drink: { presetId: "m-pint", kind: "pint", volumeMl: 500, abv: 0.05 }, amount, currency: "EUR", ...extra },
    });

  it("explains the round with the server's own numbers and splits it server-side", async () => {
    const { users, partyId } = await crewWithParty("jade", "malik", "ines");
    const [jade, malik, ines] = users as [User, User, User];
    const res = await logRound(partyId, jade, jade.id, [jade.id, malik.id, ines.id, malik.id], 2000);
    expect(res.statusCode).toBe(201);
    const summary = res.json() as Summary;
    // The duplicate is dropped: three drinks, three shares adding up to the total.
    expect(summary.drinksAdded).toBe(3);
    expect(Object.values(summary.shares).reduce((s, v) => s + v, 0)).toBe(2000);
    expect(Object.values(summary.shares).sort()).toEqual([666, 667, 667]);
    expect(summary.nextPayerId).not.toBe(jade.id);
    const expense = (await db.query<{ split: string; party_id: string }>("select split, party_id from expenses"))[0]!;
    expect((JSON.parse(expense.split) as { members: string[] }).members).toHaveLength(3);
    expect(expense.party_id).toBe(partyId);
  });

  it("rotates fairly across the crew's nights, not just tonight", async () => {
    const { users, crewId, partyId } = await crewWithParty("jade", "malik", "ines");
    const [jade, malik, ines] = users as [User, User, User];
    const all = [jade.id, malik.id, ines.id];
    await logRound(partyId, jade, jade.id, all, 1800);
    await logRound(partyId, malik, malik.id, all, 1800);
    // A second night: Inès still owes the crew, so she is first.
    const tonight = randomUUID();
    await app.inject({ method: "POST", url: "/v1/parties", headers: jade.auth, payload: { id: tonight, crewId, name: "Vendredi", mood: "party", kind: "party", startsAt: clock - 1_800_000, endsAt: clock + 3_600_000 } });
    for (const u of [malik, ines]) await app.inject({ method: "POST", url: `/v1/parties/${tonight}/response`, headers: u.auth, payload: { response: "going" } });
    const state = (await app.inject({ method: "GET", url: `/v1/parties/${tonight}/rounds`, headers: malik.auth })).json() as State;
    expect(state.nextPayerId).toBe(ines.id);
    expect(state.rotation).toHaveLength(3);
    expect(state.rotation[0]).toBe(ines.id);
    expect(state.standings.find((s) => s.userId === ines.id)).toEqual({ userId: ines.id, balance: -2, nightsSincePaid: null });
    expect(state.standings.find((s) => s.userId === jade.id)?.nightsSincePaid).toBe(1);
  });

  it("refuses a round for someone who went home or is not at the party, and a pool in another currency", async () => {
    const { users, partyId } = await crewWithParty("jade", "malik", "ines");
    const [jade, malik, ines] = users as [User, User, User];
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/status`, headers: ines.auth, payload: { homeSafe: true } });
    expect((await logRound(partyId, jade, jade.id, [jade.id, ines.id], 1200)).json()).toMatchObject({ error: "not_in_party" });
    expect((await logRound(partyId, jade, ines.id, [jade.id], 1200)).json()).toMatchObject({ error: "not_in_party" });
    const stranger = await account("stranger");
    expect((await logRound(partyId, jade, jade.id, [jade.id, stranger.id], 1200)).json()).toMatchObject({ error: "not_in_party" });
    // The party's pool is in euros: a round in pounds would break its balances.
    expect((await logRound(partyId, jade, jade.id, [jade.id, malik.id], 1200)).statusCode).toBe(201);
    expect((await logRound(partyId, jade, jade.id, [jade.id, malik.id], 1200, { currency: "GBP" })).json()).toMatchObject({ error: "currency_mismatch" });
    const state = (await app.inject({ method: "GET", url: `/v1/parties/${partyId}/rounds`, headers: jade.auth })).json() as State;
    expect(state.pool?.currency).toBe("EUR");
  });

  it("answers a retried round with the same summary and logs it once", async () => {
    const { users, partyId } = await crewWithParty("jade", "malik");
    const [jade, malik] = users as [User, User];
    const payload = { id: randomUUID(), payerId: jade.id, memberIds: [jade.id, malik.id], drink: { presetId: "m-pint", kind: "pint", volumeMl: 500, abv: 0.05 }, amount: 1400, currency: "EUR" };
    const first = await app.inject({ method: "POST", url: `/v1/parties/${partyId}/rounds`, headers: jade.auth, payload });
    const again = await app.inject({ method: "POST", url: `/v1/parties/${partyId}/rounds`, headers: jade.auth, payload });
    expect(again.statusCode).toBe(200);
    expect((again.json() as Summary).drinksAdded).toBe((first.json() as Summary).drinksAdded);
    expect(await db.query("select id from drinks")).toHaveLength(2);
  });

  it("lets a member drop a drink they did not have, with their share of the expense", async () => {
    const { users, partyId } = await crewWithParty("jade", "malik", "ines");
    const [jade, malik, ines] = users as [User, User, User];
    const { id: roundId } = (await logRound(partyId, jade, jade.id, [jade.id, malik.id, ines.id], 1800)).json() as Summary;
    expect((await app.inject({ method: "POST", url: `/v1/rounds/${roundId}/leave`, headers: ines.auth })).statusCode).toBe(200);
    // A retry is harmless.
    expect((await app.inject({ method: "POST", url: `/v1/rounds/${roundId}/leave`, headers: ines.auth })).statusCode).toBe(200);
    const live = await db.query<{ user_id: string }>("select user_id from drinks where round_id = $1 and deleted_at is null", [roundId]);
    expect(live.map((d) => d.user_id).sort()).toEqual([jade.id, malik.id].sort());
    const split = JSON.parse((await db.query<{ split: string }>("select split from expenses"))[0]!.split) as { members: string[] };
    expect(split.members.sort()).toEqual([jade.id, malik.id].sort());
    // Inès gave nothing and took nothing: the rotation forgets that round for her.
    const state = (await app.inject({ method: "GET", url: `/v1/parties/${partyId}/rounds`, headers: ines.auth })).json() as State;
    expect(state.standings.find((s) => s.userId === ines.id)?.balance).toBe(0);
    expect(state.standings.find((s) => s.userId === malik.id)?.balance).toBe(-1);

    // Removing the drink from the history does the same; the last one out removes the round.
    const malikDrink = (await db.query<{ id: string }>("select id from drinks where round_id = $1 and user_id = $2", [roundId, malik.id]))[0]!.id;
    await app.inject({ method: "POST", url: "/v1/mutations", headers: malik.auth, payload: { mutations: [{ key: randomUUID(), mutation: { kind: "drink.remove", drink: { id: malikDrink } } }] } });
    await app.inject({ method: "POST", url: `/v1/rounds/${roundId}/leave`, headers: jade.auth });
    expect(await db.query("select 1 from rounds where id = $1", [roundId])).toHaveLength(0);
    expect((await db.query<{ deleted_at: number | null }>("select deleted_at from expenses"))[0]!.deleted_at).not.toBeNull();
    // Someone who was not in the round cannot touch it.
    const { id: other } = (await logRound(partyId, jade, jade.id, [jade.id], 600)).json() as Summary;
    expect((await app.inject({ method: "POST", url: `/v1/rounds/${other}/leave`, headers: malik.auth })).statusCode).toBe(404);
  });

  it("lets a party guest outside the crew leave a round, and only calls it done once the drink is really gone", async () => {
    const { users, partyId } = await crewWithParty("jade", "malik");
    const [jade, malik] = users as [User, User];
    const guest = await account("guest");
    await db.query("insert into party_members (party_id, user_id, response) values ($1, $2, 'going')", [partyId, guest.id]);
    const { id: roundId } = (await logRound(partyId, jade, jade.id, [jade.id, malik.id, guest.id], 1800)).json() as Summary;
    expect((await app.inject({ method: "POST", url: `/v1/rounds/${roundId}/leave`, headers: guest.auth })).statusCode).toBe(200);
    expect(await db.query("select 1 from drinks where round_id = $1 and user_id = $2 and deleted_at is null", [roundId, guest.id])).toHaveLength(0);
    // Not a member of the party: no.
    const stranger = await account("stranger");
    expect((await app.inject({ method: "POST", url: `/v1/rounds/${roundId}/leave`, headers: stranger.auth })).statusCode).toBe(404);
    // A drink still live is not "already done": a leave that cannot drop it answers 404, not ok.
    await db.query("update rounds set member_ids = $2 where id = $1", [roundId, JSON.stringify([jade.id, malik.id])]);
    await db.query("update drinks set deleted_at = null where round_id = $1 and user_id = $2", [roundId, guest.id]);
    expect((await app.inject({ method: "POST", url: `/v1/rounds/${roundId}/leave`, headers: guest.auth })).statusCode).toBe(404);
  });

  it("leaves a changed expense split alone when someone leaves the round", async () => {
    const { users, partyId } = await crewWithParty("jade", "malik", "ines");
    const [jade, malik, ines] = users as [User, User, User];
    const { id: roundId } = (await logRound(partyId, jade, jade.id, [jade.id, malik.id, ines.id], 1800)).json() as Summary;
    const custom = JSON.stringify({ kind: "shares", shares: { [jade.id]: 1, [malik.id]: 2, [ines.id]: 3 } });
    await db.query("update expenses set split = $1", [custom]);
    expect((await app.inject({ method: "POST", url: `/v1/rounds/${roundId}/leave`, headers: ines.auth })).statusCode).toBe(200);
    expect((await db.query<{ split: string }>("select split from expenses"))[0]!.split).toBe(custom);
    expect(JSON.parse((await db.query<{ member_ids: string }>("select member_ids from rounds where id = $1", [roundId]))[0]!.member_ids)).toHaveLength(2);
  });

  it("answers a round id already used in another party with that round's summary, not a 500", async () => {
    const { users, crewId, partyId } = await crewWithParty("jade", "malik");
    const [jade, malik] = users as [User, User];
    const id = randomUUID();
    expect((await logRound(partyId, jade, jade.id, [jade.id, malik.id], 1200, { id })).statusCode).toBe(201);
    const other = randomUUID();
    await app.inject({ method: "POST", url: "/v1/parties", headers: jade.auth, payload: { id: other, crewId, name: "Dimanche", mood: "party", kind: "party", startsAt: clock - 3_600_000, endsAt: clock + 5 * 3_600_000 } });
    const again = await logRound(other, jade, jade.id, [jade.id], 1200, { id });
    expect(again.statusCode).toBe(200);
    expect(await db.query("select 1 from rounds")).toHaveLength(1);
  });

  it("takes a member out of a round from its notification, and records a confirmation (QOL-03)", async () => {
    const { users, partyId } = await crewWithParty("jade", "malik", "ines");
    const [jade, malik, ines] = users as [User, User, User];
    const roundId = randomUUID();
    await app.inject({
      method: "POST",
      url: `/v1/parties/${partyId}/rounds`,
      headers: jade.auth,
      payload: { id: roundId, payerId: jade.id, memberIds: [jade.id, malik.id, ines.id], drink: { presetId: "m-pint", kind: "pint", volumeMl: 500, abv: 0.05 }, amount: 2100, currency: "EUR" },
    });
    const answer = (who: User, reply: string) => app.inject({ method: "POST", url: `/v1/parties/${partyId}/rounds/${roundId}/reply`, headers: who.auth, payload: { reply } });

    expect((await answer(ines, "ok")).statusCode).toBe(200);
    expect((await answer(malik, "notMe")).statusCode).toBe(200);
    // Twice is once.
    expect((await answer(malik, "notMe")).statusCode).toBe(200);
    // The drink taken out does not come back.
    expect((await answer(malik, "ok")).statusCode).toBe(409);

    const sync = (await app.inject({ method: "GET", url: "/v1/sync?since=0", headers: malik.auth })).json() as { drinks: { deleted?: boolean }[] };
    expect(sync.drinks).toEqual([expect.objectContaining({ deleted: true })]);
    const list = (await app.inject({ method: "GET", url: `/v1/parties/${partyId}/rounds`, headers: jade.auth })).json() as {
      rounds: { memberIds: string[]; confirmedIds: string[] }[];
    };
    expect(list.rounds[0]!.memberIds.sort()).toEqual([jade.id, ines.id].sort());
    expect(list.rounds[0]!.confirmedIds).toEqual([ines.id]);
    const split = (await db.query<{ split: string }>("select split from expenses"))[0]!;
    expect((JSON.parse(split.split) as { members: string[] }).members.sort()).toEqual([jade.id, ines.id].sort());
  });

  it("refuses an answer from someone the round is not for", async () => {
    const { users, partyId } = await crewWithParty("jade", "malik", "ines");
    const [jade, malik, ines] = users as [User, User, User];
    const roundId = randomUUID();
    await app.inject({
      method: "POST",
      url: `/v1/parties/${partyId}/rounds`,
      headers: jade.auth,
      payload: { id: roundId, payerId: jade.id, memberIds: [jade.id, malik.id], drink: { presetId: "m-pint", kind: "pint", volumeMl: 500, abv: 0.05 }, amount: 0, currency: "EUR" },
    });
    const res = await app.inject({ method: "POST", url: `/v1/parties/${partyId}/rounds/${roundId}/reply`, headers: ines.auth, payload: { reply: "notMe" } });
    expect(res.statusCode).toBe(404);
    expect(await db.query("select 1 from drinks where deleted_at is not null")).toHaveLength(0);
  });

  it("answers 400, not 500, to a round id that is not a UUID", async () => {
    const { users, partyId } = await crewWithParty("jade", "malik");
    const res = await app.inject({ method: "POST", url: `/v1/parties/${partyId}/rounds/not-a-uuid/reply`, headers: users[0]!.auth, payload: { reply: "ok" } });
    expect(res.statusCode).toBe(400);
  });
});
