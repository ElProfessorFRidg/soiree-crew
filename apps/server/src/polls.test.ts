import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";

const HOUR = 3_600_000;
// Wednesday 4 November 2026, 12:00 UTC.
const clock = Date.UTC(2026, 10, 4, 12, 0);
let db: Db;
let app: FastifyInstance;

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
async function crew(...names: string[]) {
  const users = await Promise.all(names.map(account));
  const crewId = ((await app.inject({ method: "POST", url: "/v1/crews", headers: users[0]!.auth, payload: { name: "Crew" } })).json() as { crew: { id: string } }).crew.id;
  const { code } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/invites`, headers: users[0]!.auth })).json() as { code: string };
  for (const u of users.slice(1)) await app.inject({ method: "POST", url: `/v1/invites/${code}/accept`, headers: u.auth });
  return { users, crewId };
}

describe("outing polls (N-04)", () => {
  it("collects answers per slot and creates the party with everyone who said yes", async () => {
    const { users, crewId } = await crew("jade", "malik", "ines");
    const [jade, malik, ines] = users as [User, User, User];
    const pollId = randomUUID();
    const friday = { id: randomUUID(), startsAt: clock + 2 * 24 * HOUR + 9 * HOUR, endsAt: clock + 3 * 24 * HOUR + 2 * HOUR };
    const saturday = { id: randomUUID(), startsAt: friday.startsAt + 24 * HOUR, endsAt: friday.endsAt + 24 * HOUR };
    const created = await app.inject({
      method: "POST",
      url: `/v1/crews/${crewId}/polls`,
      headers: jade.auth,
      payload: { id: pollId, title: "Anniv de Théo", place: "Le Zinc", slots: [friday, saturday] },
    });
    expect(created.statusCode).toBe(201);

    await app.inject({ method: "PUT", url: `/v1/polls/${pollId}/votes`, headers: malik.auth, payload: { votes: { [friday.id]: "no", [saturday.id]: "yes" } } });
    await app.inject({ method: "PUT", url: `/v1/polls/${pollId}/votes`, headers: ines.auth, payload: { votes: { [saturday.id]: "maybe" } } });

    const list = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/polls`, headers: ines.auth })).json() as {
      polls: { slots: { id: string; answers: { userId: string; answer: string }[] }[] }[];
    };
    const sat = list.polls[0]!.slots.find((s) => s.id === saturday.id)!;
    expect(sat.answers).toHaveLength(3);

    // Only the author or an admin closes it.
    const partyId = randomUUID();
    expect((await app.inject({ method: "POST", url: `/v1/polls/${pollId}/close`, headers: malik.auth, payload: { slotId: saturday.id, partyId } })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: `/v1/polls/${pollId}/close`, headers: jade.auth, payload: { slotId: saturday.id, partyId } })).statusCode).toBe(200);
    const members = await db.query<{ user_id: string; response: string }>("select user_id, response from party_members where party_id = $1", [partyId]);
    const going = members.filter((m) => m.response === "going").map((m) => m.user_id).sort();
    expect(going).toEqual([jade.id, malik.id].sort());
    expect(members.find((m) => m.user_id === ines.id)?.response).toBe("invited");

    // A closed poll takes no more votes.
    expect((await app.inject({ method: "PUT", url: `/v1/polls/${pollId}/votes`, headers: ines.auth, payload: { votes: { [saturday.id]: "yes" } } })).statusCode).toBe(409);
  });

  it("refuses slots in the past, too long or too far ahead, and polls of other crews", async () => {
    const { users, crewId } = await crew("jade");
    const other = await crew("theo");
    const post = (slot: { startsAt: number; endsAt: number }, user = users[0]!, crew = crewId) =>
      app.inject({ method: "POST", url: `/v1/crews/${crew}/polls`, headers: user.auth, payload: { id: randomUUID(), title: "Soirée", slots: [{ id: randomUUID(), ...slot }] } });
    expect((await post({ startsAt: clock - 48 * HOUR, endsAt: clock - 40 * HOUR })).statusCode).toBe(400);
    expect((await post({ startsAt: clock + HOUR, endsAt: clock + 30 * HOUR })).statusCode).toBe(400);
    expect((await post({ startsAt: clock + 90 * 24 * HOUR, endsAt: clock + 90 * 24 * HOUR + HOUR })).statusCode).toBe(400);
    expect((await post({ startsAt: clock + HOUR, endsAt: clock + 5 * HOUR }, other.users[0]!)).statusCode).toBe(404);
  });
});

describe("usual nights (N-05)", () => {
  it("shows who usually goes out on each of the next 14 nights", async () => {
    const { users, crewId } = await crew("jade", "malik");
    const [jade, malik] = users as [User, User];
    await app.inject({ method: "PUT", url: `/v1/crews/${crewId}/usual-nights`, headers: jade.auth, payload: { weekdays: [4, 5, 5] } });
    await app.inject({ method: "PUT", url: `/v1/crews/${crewId}/usual-nights`, headers: malik.auth, payload: { weekdays: [5] } });
    const res = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/usual-nights`, headers: jade.auth })).json() as {
      members: { userId: string; weekdays: number[] }[];
      nights: { night: string; weekday: number; usually: string[] }[];
    };
    expect(res.members.find((m) => m.userId === jade.id)?.weekdays).toEqual([4, 5]);
    expect(res.nights).toHaveLength(14);
    expect(res.nights[0]!.night).toBe("2026-11-04");
    const friday = res.nights.find((n) => n.night === "2026-11-06")!;
    expect(friday.weekday).toBe(5);
    expect(friday.usually.sort()).toEqual([jade.id, malik.id].sort());
  });
});

describe("crew cards (N-33)", () => {
  it("plays a member's card only once the admin approved it", async () => {
    const { users, crewId } = await crew("jade", "malik", "ines");
    const [jade, malik, ines] = users as [User, User, User];
    const id = randomUUID();
    const sent = await app.inject({ method: "POST", url: `/v1/crews/${crewId}/cards`, headers: malik.auth, payload: { id, kind: "neverEver", level: "normal", text: "pris le dernier bus de {player} {sneaky}." } });
    expect(sent.json()).toEqual({ status: "pending" });
    const list = async (u: User) => ((await app.inject({ method: "GET", url: `/v1/crews/${crewId}/cards`, headers: u.auth })).json() as { cards: { id: string; text: string; status: string }[] }).cards;
    expect(await list(ines)).toEqual([]);
    expect((await list(malik))[0]?.text).toBe("pris le dernier bus de {player} .");
    expect((await app.inject({ method: "POST", url: `/v1/cards/${id}/review`, headers: ines.auth, payload: { approve: true } })).statusCode).toBe(403);
    await app.inject({ method: "POST", url: `/v1/cards/${id}/review`, headers: jade.auth, payload: { approve: true } });
    expect((await list(ines)).map((c) => c.status)).toEqual(["approved"]);
    // The admin's own cards need nobody's approval.
    const own = await app.inject({ method: "POST", url: `/v1/crews/${crewId}/cards`, headers: jade.auth, payload: { id: randomUUID(), kind: "dare", level: "hard", text: "Imite {other} au réveil." } });
    expect(own.json()).toEqual({ status: "approved" });
  });
});

describe("crew wrapped (N-15)", () => {
  it("sums up the month: nights together, regulars, the biggest night", async () => {
    const { users, crewId } = await crew("jade", "malik");
    const [jade, malik] = users as [User, User];
    const partyId = randomUUID();
    await app.inject({
      method: "POST",
      url: "/v1/parties",
      headers: jade.auth,
      payload: { id: partyId, crewId, name: "Mercredi", mood: "party", kind: "party", startsAt: clock - 2 * HOUR, endsAt: clock + 4 * HOUR },
    });
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/response`, headers: malik.auth, payload: { response: "going" } });
    const wrapped = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/wrapped?period=month&key=2026-11`, headers: malik.auth })).json() as {
      nights: number;
      regulars: { name: string; nights: number }[];
      biggestNight: { name: string; people: number } | null;
      busiestWeekday: number | null;
      drinks?: number;
    };
    expect(wrapped.nights).toBe(1);
    expect(wrapped.regulars.map((r) => r.nights)).toEqual([1, 1]);
    expect(wrapped.biggestNight).toMatchObject({ name: "Mercredi", people: 2 });
    expect(wrapped.busiestWeekday).toBe(3);
    expect(wrapped.drinks).toBe(0);
    const year = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/wrapped?period=year&key=2026`, headers: malik.auth })).json() as { nights: number };
    expect(year.nights).toBe(1);
    const october = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/wrapped?period=month&key=2026-10`, headers: malik.auth })).json() as { nights: number };
    expect(october.nights).toBe(0);
  });
});

describe("crew feed (N-31)", () => {
  it("groups what happened, newest first", async () => {
    const { users, crewId } = await crew("jade", "malik", "ines");
    const [jade] = users as [User, User, User];
    await app.inject({ method: "POST", url: `/v1/crews/${crewId}/polls`, headers: jade.auth, payload: { id: randomUUID(), title: "Vendredi", slots: [{ id: randomUUID(), startsAt: clock + HOUR, endsAt: clock + 5 * HOUR }] } });
    const feed = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/feed`, headers: jade.auth })).json() as { items: { kind: string; userIds?: string[] }[] };
    // Two arrivals the same day are one line.
    const joined = feed.items.filter((i) => i.kind === "joined");
    expect(joined).toHaveLength(1);
    expect(joined[0]!.userIds).toHaveLength(3);
    expect(feed.items.map((i) => i.kind)).toContain("poll");
  });
});

describe("AI card suggestions (AI-03)", () => {
  it("lets only the admin of an opted-in crew ask for suggestions, and saves nothing", async () => {
    await app.close();
    app = await buildApp({
      db,
      sealer: new Sealer(randomBytes(32).toString("base64")),
      live: new LiveHub(),
      now: () => clock,
      publicUrl: "https://crew.test",
      hashSecret: "s",
      ai: { name: "fake", complete: async () => '{"cards":["dormi dans le bus 42 — encore","appelé Théo par le nom du chien"]}' },
    });
    const { users, crewId } = await crew("jade", "malik");
    const [jade, malik] = users as [User, User];
    const ask = (u: User) =>
      app.inject({ method: "POST", url: `/v1/crews/${crewId}/cards/suggest`, headers: u.auth, payload: { kind: "neverEver", level: "normal", language: "fr", jokes: "Le bus 42, le chien de Théo, la fois au karaoké" } });
    expect((await ask(jade)).statusCode).toBe(403);
    await app.inject({ method: "PATCH", url: `/v1/crews/${crewId}/settings`, headers: jade.auth, payload: { aiEnabled: true } });
    expect((await ask(malik)).statusCode).toBe(403);
    const res = (await ask(jade)).json() as { cards: string[] };
    expect(res.cards).toEqual(["dormi dans le bus 42 , encore", "appelé Théo par le nom du chien"]);
    expect((await db.query("select * from crew_cards")).length).toBe(0);
  });
});

describe("not feeling well (N-36)", () => {
  it("tells the others at the party, and clears once home safe", async () => {
    await app.close();
    const live = new LiveHub();
    app = await buildApp({ db, sealer: new Sealer(randomBytes(32).toString("base64")), live, now: () => clock, publicUrl: "https://crew.test", hashSecret: "s" });
    const { users, crewId } = await crew("jade", "malik");
    const [jade, malik] = users as [User, User];
    const partyId = randomUUID();
    await app.inject({ method: "POST", url: "/v1/parties", headers: jade.auth, payload: { id: partyId, crewId, name: "Ce soir", mood: "party", kind: "party", startsAt: clock - HOUR, endsAt: clock + 4 * HOUR } });
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/response`, headers: malik.auth, payload: { response: "going" } });
    const heard: string[] = [];
    live.add(jade.id, { send: (data) => heard.push(data) });
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/status`, headers: malik.auth, payload: { unwell: true } });
    expect(heard.some((m) => m.includes("party.unwell"))).toBe(true);
    const view = async () =>
      ((await app.inject({ method: "GET", url: `/v1/parties/${partyId}/live`, headers: jade.auth })).json() as { members: { userId: string; unwellAt: number | null }[] }).members.find((m) => m.userId === malik.id)!;
    expect((await view()).unwellAt).toBe(clock);
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/status`, headers: malik.auth, payload: { homeSafe: true } });
    expect((await view()).unwellAt).toBeNull();
  });
});
