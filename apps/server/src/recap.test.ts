import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";

let db: Db;
let app: FastifyInstance;
let clock = Date.UTC(2026, 10, 7, 21, 0);
const H = 3_600_000;

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
async function account(username: string): Promise<User> {
  const body = (await app.inject({ method: "POST", url: "/v1/accounts", payload: { username, displayName: username } })).json() as { user: { id: string }; token: string };
  return { id: body.user.id, auth: { authorization: `Bearer ${body.token}` } };
}
async function mutate(user: User, mutation: unknown) {
  await app.inject({ method: "POST", url: "/v1/mutations", headers: user.auth, payload: { mutations: [{ key: randomUUID(), mutation }] } });
}
const pint = (at: number) => ({ kind: "drink.add", drink: { id: randomUUID(), presetId: "m-pint", kind: "pint", volumeMl: 500, abv: 0.05, consumedAt: at, loggedAt: at, withFood: false } });

describe("recap (O-41, N-22)", () => {
  it("shows only the people really there, with curves, figures, timeline and reactions", async () => {
    const [jade, malik, ines] = await Promise.all(["jade", "malik", "ines"].map(account)) as [User, User, User];
    const crewId = ((await app.inject({ method: "POST", url: "/v1/crews", headers: jade.auth, payload: { name: "Crew" } })).json() as { crew: { id: string } }).crew.id;
    const { code } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/invites`, headers: jade.auth })).json() as { code: string };
    for (const u of [malik, ines]) await app.inject({ method: "POST", url: `/v1/invites/${code}/accept`, headers: u.auth });
    const partyId = randomUUID();
    await app.inject({ method: "POST", url: "/v1/parties", headers: jade.auth, payload: { id: partyId, crewId, name: "Samedi", mood: "party", kind: "party", startsAt: clock, endsAt: clock + 6 * H } });
    // Inès says she is going but never shows up.
    for (const u of [malik, ines]) await app.inject({ method: "POST", url: `/v1/parties/${partyId}/response`, headers: u.auth, payload: { response: "going" } });
    for (const u of [jade, malik]) {
      await mutate(u, { kind: "profile.set", profile: { weightKg: 70, bodyModel: "female", declaredBody: "female", healthConsentAt: clock } });
    }
    clock += 30 * 60_000;
    await mutate(jade, pint(clock));
    await mutate(malik, pint(clock));
    clock += H;
    await mutate(jade, pint(clock));
    for (let i = 0; i < 3; i++) await mutate(malik, { kind: "water.add", water: { id: randomUUID(), at: clock } });

    const early = (await app.inject({ method: "GET", url: `/v1/parties/${partyId}/recap`, headers: jade.auth })).json() as { ready: boolean };
    expect(early.ready).toBe(false);

    clock += H;
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/close`, headers: jade.auth });
    const recap = (await app.inject({ method: "GET", url: `/v1/parties/${partyId}/recap`, headers: malik.auth })).json() as {
      ready: boolean;
      figures: { participants: number; drinks: number; averagePeak: number };
      participants: { userId: string; drinks: number; peak: number; curve: [number, number][] }[];
      badges: { kind: string; userId: string }[];
      timeline: { kind: string }[];
    };
    expect(recap.ready).toBe(true);
    expect(recap.participants.map((p) => p.userId).sort()).toEqual([jade.id, malik.id].sort());
    expect(recap.figures).toMatchObject({ participants: 2, drinks: 3 });
    expect(recap.figures.averagePeak).toBeGreaterThan(0);
    const jadeRow = recap.participants.find((p) => p.userId === jade.id)!;
    expect(jadeRow.curve.length).toBeGreaterThan(10);
    expect(jadeRow.curve.at(-1)![1]).toBeLessThan(0.05);
    expect(recap.badges).toContainEqual(expect.objectContaining({ kind: "camel", userId: malik.id }));
    expect(recap.timeline.map((t) => t.kind)).toEqual(expect.arrayContaining(["start", "arrival", "end"]));

    expect((await app.inject({ method: "PUT", url: `/v1/parties/${partyId}/recap/reactions`, headers: malik.auth, payload: { toId: jade.id, emoji: "🔥" } })).statusCode).toBe(200);
    expect((await app.inject({ method: "PUT", url: `/v1/parties/${partyId}/recap/reactions`, headers: malik.auth, payload: { toId: jade.id, emoji: "🍕" } })).statusCode).toBe(400);
    const list = (await app.inject({ method: "GET", url: "/v1/recaps", headers: malik.auth })).json() as { recaps: { id: string; seenAt: number | null }[] };
    expect(list.recaps[0]).toMatchObject({ id: partyId });
    expect(list.recaps[0]!.seenAt).not.toBeNull();
  });

  it("is closed to people outside the crew", async () => {
    const [jade, stranger] = await Promise.all(["jade", "stranger"].map(account)) as [User, User];
    const crewId = ((await app.inject({ method: "POST", url: "/v1/crews", headers: jade.auth, payload: { name: "Crew" } })).json() as { crew: { id: string } }).crew.id;
    const partyId = randomUUID();
    await app.inject({ method: "POST", url: "/v1/parties", headers: jade.auth, payload: { id: partyId, crewId, name: "Samedi", mood: "party", kind: "party", startsAt: clock, endsAt: clock + 6 * H } });
    expect((await app.inject({ method: "GET", url: `/v1/parties/${partyId}/recap`, headers: stranger.auth })).statusCode).toBe(404);
  });
});

describe("quote of the night (N-23)", () => {
  it("adds lines, votes once per person, and lets the quoted person remove theirs", async () => {
    const [jade, malik] = (await Promise.all(["jade", "malik"].map(account))) as [User, User];
    const crewId = ((await app.inject({ method: "POST", url: "/v1/crews", headers: jade.auth, payload: { name: "Crew" } })).json() as { crew: { id: string } }).crew.id;
    const { code } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/invites`, headers: jade.auth })).json() as { code: string };
    await app.inject({ method: "POST", url: `/v1/invites/${code}/accept`, headers: malik.auth });
    const partyId = randomUUID();
    await app.inject({ method: "POST", url: "/v1/parties", headers: jade.auth, payload: { id: partyId, crewId, name: "Samedi", mood: "party", kind: "party", startsAt: clock, endsAt: clock + 6 * H } });
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/response`, headers: malik.auth, payload: { response: "going" } });
    const quoteId = randomUUID();
    expect((await app.inject({ method: "POST", url: `/v1/parties/${partyId}/quotes`, headers: jade.auth, payload: { id: quoteId, text: "Je rentre après celle-là.", saidBy: malik.id } })).statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: `/v1/quotes/${quoteId}/vote`, headers: jade.auth })).json()).toEqual({ voted: true });
    expect((await app.inject({ method: "POST", url: `/v1/quotes/${quoteId}/vote`, headers: malik.auth })).json()).toEqual({ voted: true });
    const recap = (await app.inject({ method: "GET", url: `/v1/parties/${partyId}/recap`, headers: malik.auth })).json() as { quotes: { votes: number; mine: boolean; saidBy: string }[] };
    expect(recap.quotes[0]).toMatchObject({ votes: 2, mine: true, saidBy: malik.id });
    expect((await app.inject({ method: "POST", url: `/v1/quotes/${quoteId}/vote`, headers: malik.auth })).json()).toEqual({ voted: false });
    expect((await app.inject({ method: "DELETE", url: `/v1/quotes/${quoteId}`, headers: malik.auth })).statusCode).toBe(204);
  });
});

describe("narrated recap (AI-02)", () => {
  it("publishes a story written by someone who was there, and drafts with AI only when the crew opted in", async () => {
    const calls: string[] = [];
    await app.close();
    app = await buildApp({
      db,
      sealer: new Sealer(randomBytes(32).toString("base64")),
      live: new LiveHub(),
      now: () => clock,
      publicUrl: "https://crew.test",
      hashSecret: "s",
      ai: { name: "fake", complete: async (_system, user) => (calls.push(user), "Une soirée — tranquille au Zinc.") },
    });
    const [jade, malik] = (await Promise.all(["jade", "malik"].map(account))) as [User, User];
    const crewId = ((await app.inject({ method: "POST", url: "/v1/crews", headers: jade.auth, payload: { name: "Crew" } })).json() as { crew: { id: string } }).crew.id;
    const { code } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/invites`, headers: jade.auth })).json() as { code: string };
    await app.inject({ method: "POST", url: `/v1/invites/${code}/accept`, headers: malik.auth });
    const partyId = randomUUID();
    await app.inject({ method: "POST", url: "/v1/parties", headers: jade.auth, payload: { id: partyId, crewId, name: "Samedi", mood: "party", kind: "party", startsAt: clock, endsAt: clock + 6 * H } });
    const facts = { party: "Samedi", date: "samedi", people: ["Jade", "Malik"], venues: ["Le Zinc"], firstIn: "Jade", takeovers: [], rounds: 0, lastHome: null, quote: null };
    const draft = (payload: object) => app.inject({ method: "POST", url: `/v1/parties/${partyId}/narration/draft`, headers: jade.auth, payload });
    expect((await draft({ tone: "plain", language: "fr", facts })).statusCode).toBe(403);
    await app.inject({ method: "PATCH", url: `/v1/crews/${crewId}/settings`, headers: jade.auth, payload: { aiEnabled: true } });
    const ok = await draft({ tone: "plain", language: "fr", facts });
    expect(ok.json()).toEqual({ text: "Une soirée , tranquille au Zinc." });
    expect(calls[0]).not.toContain("drinks");

    expect((await app.inject({ method: "POST", url: `/v1/parties/${partyId}/narration`, headers: jade.auth, payload: { text: "Une belle soirée au Zinc.", tone: "plain" } })).statusCode).toBe(200);
    const recap = (await app.inject({ method: "GET", url: `/v1/parties/${partyId}/recap`, headers: jade.auth })).json() as { narration: { text: string } | null; aiAvailable: boolean };
    expect(recap.narration?.text).toBe("Une belle soirée au Zinc.");
    expect(recap.aiAvailable).toBe(true);
  });
});
