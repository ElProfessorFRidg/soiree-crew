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

type Live = { members: { userId: string; homeWith: string | null; homeMode: string | null; homeOfferFrom: string | null }[] };
const home = (u: User, partyId: string, payload: Record<string, unknown>) => app.inject({ method: "POST", url: `/v1/parties/${partyId}/home`, headers: u.auth, payload });
const liveOf = async (u: User, partyId: string) => ((await app.inject({ method: "GET", url: `/v1/parties/${partyId}/live`, headers: u.auth })).json() as Live).members;

describe("going home together (N-27)", () => {
  it("joins groups through their leader, offers a walk home and leaves cleanly", async () => {
    const { users, partyId } = await crewWithParty("jade", "malik", "ines", "theo");
    const [jade, malik, ines, theo] = users as [User, User, User, User];
    await home(malik, partyId, { withUserId: jade.id, mode: "walk" });
    await home(ines, partyId, { withUserId: malik.id });
    let members = await liveOf(jade, partyId);
    const leaderOf = (id: string) => members.find((m) => m.userId === id)?.homeWith;
    expect([leaderOf(jade.id), leaderOf(malik.id), leaderOf(ines.id)]).toEqual([jade.id, jade.id, jade.id]);
    expect(members.find((m) => m.userId === malik.id)?.homeMode).toBe("walk");

    await home(jade, partyId, { offerTo: theo.id });
    members = await liveOf(theo, partyId);
    expect(members.find((m) => m.userId === theo.id)?.homeOfferFrom).toBe(jade.id);
    await home(theo, partyId, { answerOffer: true });
    members = await liveOf(theo, partyId);
    expect(leaderOf(theo.id)).toBe(jade.id);
    expect(members.find((m) => m.userId === theo.id)?.homeOfferFrom).toBeNull();

    await home(jade, partyId, { withUserId: null });
    members = await liveOf(jade, partyId);
    expect(leaderOf(jade.id)).toBeNull();
    const newLeader = leaderOf(malik.id);
    expect(newLeader).not.toBe(jade.id);
    expect([leaderOf(ines.id), leaderOf(theo.id)]).toEqual([newLeader, newLeader]);
  });
});

describe("where to? (N-11)", () => {
  it("counts one changeable vote per member, crew venues only", async () => {
    const { users, crewId, partyId } = await crewWithParty("jade", "malik");
    const [jade, malik] = users as [User, User];
    const venue = async (name: string) => {
      const id = randomUUID();
      await app.inject({ method: "POST", url: `/v1/crews/${crewId}/venues`, headers: jade.auth, payload: { id, name, kind: "bar", lat: 48.85, lng: 2.35 } });
      return id;
    };
    const zinc = await venue("Le Zinc");
    const quai = await venue("Le Quai");
    const vote = (u: User, venueId: string | null) => app.inject({ method: "PUT", url: `/v1/parties/${partyId}/where-to`, headers: u.auth, payload: { venueId } });
    await vote(jade, zinc);
    await vote(malik, zinc);
    await vote(malik, quai);
    const tally = (await app.inject({ method: "GET", url: `/v1/parties/${partyId}/where-to`, headers: jade.auth })).json() as { votes: { venueId: string; count: number; mine: boolean }[] };
    expect(tally.votes).toEqual([expect.objectContaining({ venueId: zinc, count: 1, mine: true }), expect.objectContaining({ venueId: quai, count: 1, mine: false })]);
    expect((await vote(jade, randomUUID())).statusCode).toBe(404);
  });
});

describe("territory titles endpoint (TER-06)", () => {
  it("lists players with venues ruled and leaves out members who opted out", async () => {
    const { users, crewId } = await crewWithParty("jade", "malik");
    const [jade, malik] = users as [User, User];
    await app.inject({ method: "PATCH", url: `/v1/crews/${crewId}/me`, headers: malik.auth, payload: { territoryOptOut: true } });
    const body = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/titles`, headers: jade.auth })).json() as { rows: { userId: string; ruled: number; titles: unknown[] }[] };
    expect(body.rows.map((r) => r.userId)).toEqual([jade.id]);
    expect(body.rows[0]).toMatchObject({ ruled: 0, titles: [] });
  });
});

describe("live location (N-07)", () => {
  it("shares a sealed position with the party's crew only, and drops it at the end of the party", async () => {
    const { users, partyId } = await crewWithParty("jade", "malik", "ines");
    const [jade, malik, ines] = users as [User, User, User];
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/response`, headers: ines.auth, payload: { response: "declined" } });
    expect((await app.inject({ method: "PUT", url: `/v1/parties/${partyId}/location`, headers: jade.auth, payload: { lat: 48.8611, lng: 2.3712, accuracy: 15 } })).statusCode).toBe(200);
    const seen = (await app.inject({ method: "GET", url: `/v1/parties/${partyId}/locations`, headers: malik.auth })).json() as { locations: { userId: string; lat: number }[] };
    expect(seen.locations).toEqual([expect.objectContaining({ userId: jade.id, lat: 48.8611 })]);
    const declined = (await app.inject({ method: "GET", url: `/v1/parties/${partyId}/locations`, headers: ines.auth })).json() as { locations: unknown[] };
    expect(declined.locations).toEqual([]);
    expect(JSON.stringify(await db.query("select * from party_locations"))).not.toContain("48.8611");
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/close`, headers: jade.auth });
    expect(await db.query("select * from party_locations")).toEqual([]);
  });
});

describe("crew and venue stats (N-12, N-14, JOY-06, JOY-08, RANK-05)", () => {
  it("counts nights together, the streak, the boards and a venue's numbers", async () => {
    const { users, crewId, partyId } = await crewWithParty("jade", "malik");
    const [jade, malik] = users as [User, User];
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/status`, headers: malik.auth, payload: { designatedDriver: true } });
    const stats = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/stats`, headers: jade.auth })).json() as {
      totalNights: number;
      streak: { current: number };
      milestones: { reached: number[] };
      boards: { userId: string; nights: number; soberDriver: number }[];
    };
    expect(stats.totalNights).toBe(1);
    expect(stats.streak.current).toBe(1);
    expect(stats.milestones.reached).toEqual([1]);
    expect(stats.boards.find((b) => b.userId === malik.id)).toMatchObject({ nights: 1, soberDriver: 1 });

    const venueId = randomUUID();
    await app.inject({ method: "POST", url: `/v1/crews/${crewId}/venues`, headers: jade.auth, payload: { id: venueId, name: "Le Zinc", kind: "bar", lat: 48.85, lng: 2.35 } });
    await db.query(
      `insert into check_ins (id, user_id, venue_id, party_id, at, last_proof_at, verdict, risk, signals, config_version, fix_hash, created_at)
       values ($1, $2, $3, $4, $5, $6, 'accepted', 0, '[]', 1, 'h', $5)`,
      [randomUUID(), jade.id, venueId, partyId, clock - 1_800_000, clock],
    );
    const venue = (await app.inject({ method: "GET", url: `/v1/venues/${venueId}/stats`, headers: malik.auth })).json() as { visits: number; people: number; nights: number };
    expect(venue).toMatchObject({ visits: 1, people: 1, nights: 1 });
  });
});

describe("shopping list (N-32)", () => {
  it("adds, claims, ticks and removes items for the party's crew only", async () => {
    const { users, partyId } = await crewWithParty("jade", "malik");
    const [jade, malik] = users as [User, User];
    const stranger = await account("stranger");
    const id = randomUUID();
    const post = (u: User, payload: Record<string, unknown>) => app.inject({ method: "POST", url: `/v1/parties/${partyId}/items`, headers: u.auth, payload });
    expect((await post(jade, { id, label: "Glaçons" })).statusCode).toBe(201);
    await post(malik, { id, claim: true });
    await post(malik, { id, done: true });
    const list = (await app.inject({ method: "GET", url: `/v1/parties/${partyId}/items`, headers: jade.auth })).json() as { items: { claimedBy: string; done: boolean }[] };
    expect(list.items).toEqual([expect.objectContaining({ claimedBy: malik.id, done: true })]);
    expect((await post(stranger, { id: randomUUID(), label: "Chips" })).statusCode).toBe(404);
    await post(jade, { id, remove: true });
    expect(((await app.inject({ method: "GET", url: `/v1/parties/${partyId}/items`, headers: jade.auth })).json() as { items: unknown[] }).items).toEqual([]);
  });
});

describe("drink prices per bar (N-09)", () => {
  it("keeps one price per person and drink, and shows the crew's median", async () => {
    const { users, crewId } = await crewWithParty("jade", "malik", "ines");
    const [jade, malik, ines] = users as [User, User, User];
    const venueId = randomUUID();
    await app.inject({ method: "POST", url: `/v1/crews/${crewId}/venues`, headers: jade.auth, payload: { id: venueId, name: "Le Zinc", kind: "bar", lat: 48.85, lng: 2.35 } });
    const put = (u: User, amount: number) => app.inject({ method: "PUT", url: `/v1/venues/${venueId}/prices`, headers: u.auth, payload: { kind: "pint", amount, currency: "EUR" } });
    await put(jade, 600);
    await put(jade, 700);
    await put(malik, 750);
    await put(ines, 900);
    const prices = (await app.inject({ method: "GET", url: `/v1/venues/${venueId}/prices`, headers: malik.auth })).json() as { prices: { kind: string; amount: number; reports: number }[] };
    expect(prices.prices).toEqual([{ kind: "pint", currency: "EUR", amount: 750, reports: 3 }]);
  });
});
