import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";

const MIN = 60_000;
const H = 60 * MIN;
let clock = Date.UTC(2026, 10, 7, 21, 0);
let db: Db;
let app: FastifyInstance;
let live: LiveHub;
let heard: { userId: string; event: Record<string, unknown> }[] = [];

beforeEach(async () => {
  clock = Date.UTC(2026, 10, 7, 21, 0);
  heard = [];
  db = await connectPglite();
  await migrate(db);
  live = new LiveHub();
  app = await buildApp({ db, sealer: new Sealer(randomBytes(32).toString("base64")), live, now: () => clock, publicUrl: "https://crew.test", hashSecret: "s" });
});
afterEach(async () => {
  await app.close();
  await db.close();
});

type User = { id: string; auth: { authorization: string } };
async function account(username: string): Promise<User> {
  const body = (await app.inject({ method: "POST", url: "/v1/accounts", payload: { username, displayName: username } })).json() as { user: { id: string }; token: string };
  const user = { id: body.user.id, auth: { authorization: `Bearer ${body.token}` } };
  live.add(user.id, { send: (data: string) => heard.push({ userId: user.id, event: JSON.parse(data) as Record<string, unknown> }) });
  return user;
}
async function crewWithParty(...names: string[]) {
  const users = await Promise.all(names.map(account));
  const crewId = ((await app.inject({ method: "POST", url: "/v1/crews", headers: users[0]!.auth, payload: { name: "Crew" } })).json() as { crew: { id: string } }).crew.id;
  const { code } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/invites`, headers: users[0]!.auth })).json() as { code: string };
  for (const u of users.slice(1)) await app.inject({ method: "POST", url: `/v1/invites/${code}/accept`, headers: u.auth });
  const partyId = await newParty(users, crewId, clock - H);
  return { users, crewId, partyId };
}
async function newParty(users: User[], crewId: string, startsAt: number) {
  const partyId = randomUUID();
  await app.inject({ method: "POST", url: "/v1/parties", headers: users[0]!.auth, payload: { id: partyId, crewId, name: "Samedi", mood: "party", kind: "party", startsAt, endsAt: startsAt + 6 * H } });
  for (const u of users.slice(1)) await app.inject({ method: "POST", url: `/v1/parties/${partyId}/response`, headers: u.auth, payload: { response: "going" } });
  return partyId;
}
let keys = 0;
async function send(u: User, mutation: unknown) {
  keys += 1;
  const res = await app.inject({ method: "POST", url: "/v1/mutations", headers: u.auth, payload: { mutations: [{ key: `key-${keys}-${randomUUID()}`, mutation }] } });
  return (res.json() as { results: { status: string; reason?: string }[] }).results[0]!;
}
const drink = (at: number, extra: Record<string, unknown> = {}) => ({ id: randomUUID(), presetId: "m-pint", kind: "pint", volumeMl: 500, abv: 0.05, consumedAt: at, loggedAt: at, withFood: false, ...extra });
const profile = { weightKg: 70, bodyModel: "male", declaredBody: "male", healthConsentAt: Date.UTC(2026, 0, 1) };
type Member = Record<string, unknown> & { userId: string };
const liveOf = async (u: User, partyId: string) => (await app.inject({ method: "GET", url: `/v1/parties/${partyId}/live`, headers: u.auth })).json() as { party: Record<string, unknown>; members: Member[] };
const events = (type: string) => heard.filter((h) => h.event.type === type);
const status = (u: User, partyId: string, payload: Record<string, unknown>) => app.inject({ method: "POST", url: `/v1/parties/${partyId}/status`, headers: u.auth, payload });
const at = (u: User, partyId: string, lat: number, lng: number) => app.inject({ method: "PUT", url: `/v1/parties/${partyId}/location`, headers: u.auth, payload: { lat, lng, accuracy: 10 } });

describe("editing a logged drink (O-23, O-85)", () => {
  it("changes time, volume and food, drops a friend's confirmation, refuses others and the future", async () => {
    const { users } = await crewWithParty("jade", "malik");
    const [jade, malik] = users as [User, User];
    const d = drink(clock - 30 * MIN);
    expect((await send(jade, { kind: "drink.add", drink: d })).status).toBe("accepted");
    await db.query("insert into drink_confirmations (drink_id, confirmer_id, at) values ($1, $2, $3)", [d.id, malik.id, clock]);

    // Food alone keeps the confirmation: the friend saw the same glass at the same time.
    expect((await send(jade, { kind: "drink.edit", drink: { ...d, food: "light" } })).status).toBe("accepted");
    expect(await db.query("select 1 from drink_confirmations where drink_id = $1", [d.id])).toHaveLength(1);

    expect((await send(jade, { kind: "drink.edit", drink: { ...d, food: "light", consumedAt: clock - 50 * MIN, volumeMl: 330 } })).status).toBe("accepted");
    expect(await db.query("select 1 from drink_confirmations where drink_id = $1", [d.id])).toHaveLength(0);

    const sync = (await app.inject({ method: "GET", url: "/v1/sync?since=0", headers: jade.auth })).json() as { drinks: Record<string, unknown>[] };
    expect(sync.drinks.find((x) => x.id === d.id)).toMatchObject({ volumeMl: 330, consumedAt: clock - 50 * MIN, food: "light", withFood: true });

    expect((await send(malik, { kind: "drink.edit", drink: { ...d, volumeMl: 1000 } })).reason).toBe("invalid");
    expect((await send(jade, { kind: "drink.edit", drink: { ...d, consumedAt: clock + H } })).reason).toBe("future_drink");
    expect((await send(jade, { kind: "drink.edit", drink: drink(clock - MIN) })).reason).toBe("invalid");
  });
});

describe("watching over the night", () => {
  it("tells the party once when someone goes quiet, with a threshold set per party (N-29)", async () => {
    const { users, partyId } = await crewWithParty("jade", "malik", "ines");
    const [jade, malik, ines] = users as [User, User, User];
    await send(malik, { kind: "water.add", water: { id: randomUUID(), at: clock } });
    expect((await liveOf(jade, partyId)).party.quietAfterMinutes).toBe(45);

    // Only the creator or an admin changes it.
    expect((await app.inject({ method: "PATCH", url: `/v1/parties/${partyId}/settings`, headers: ines.auth, payload: { quietAfterMinutes: 90 } })).statusCode).toBe(403);
    expect((await app.inject({ method: "PATCH", url: `/v1/parties/${partyId}/settings`, headers: jade.auth, payload: { quietAfterMinutes: 90 } })).statusCode).toBe(200);

    clock += 50 * MIN;
    await liveOf(jade, partyId);
    expect(events("party.quiet")).toHaveLength(0);

    clock += 45 * MIN;
    const view = await liveOf(jade, partyId);
    expect(view.members.find((m) => m.userId === malik.id)?.quiet).toBe(true);
    const told = events("party.quiet");
    expect(told.map((h) => h.userId).sort()).toEqual([jade.id, ines.id].sort());
    expect(told[0]!.event).toMatchObject({ userId: malik.id, batteryLow: false });

    await liveOf(ines, partyId);
    expect(events("party.quiet")).toHaveLength(2);
  });

  it("tells the others when an estimate goes past 2.0 g/L, once (O-88)", async () => {
    const { users, partyId } = await crewWithParty("jade", "malik");
    const [jade, malik] = users as [User, User];
    await send(malik, { kind: "profile.set", profile });
    await send(malik, { kind: "drink.add", drink: drink(clock - 30 * MIN, { presetId: "m-bottle", kind: "spirit", volumeMl: 700, abv: 0.4 }) });
    const danger = events("party.danger");
    expect(danger.map((h) => h.userId)).toEqual([jade.id]);
    expect(danger[0]!.event).toMatchObject({ partyId, userId: malik.id });
    await send(malik, { kind: "drink.add", drink: drink(clock - 20 * MIN) });
    await liveOf(jade, partyId);
    expect(events("party.danger")).toHaveLength(1);
  });

  it("tells the nearest first when someone is unwell, then everyone (N-36)", async () => {
    const { users, partyId } = await crewWithParty("jade", "malik", "ines", "theo", "lou", "sam");
    const [jade, malik, ines, theo, lou, sam] = users as [User, User, User, User, User, User];
    await at(jade, partyId, 48.85, 2.35);
    await at(malik, partyId, 48.8505, 2.35);
    await at(ines, partyId, 48.9, 2.4);
    await at(theo, partyId, 48.851, 2.351);
    await at(lou, partyId, 45.76, 4.83);
    await status(jade, partyId, { unwell: true });
    const first = events("party.unwell");
    expect(first.map((h) => h.userId).sort()).toEqual([malik.id, theo.id, ines.id].sort());
    expect(first.every((h) => h.event.near === true)).toBe(true);

    clock += 3 * MIN;
    await liveOf(jade, partyId);
    const later = events("party.unwell").slice(3);
    expect(later.map((h) => h.userId).sort()).toEqual([malik.id, ines.id, theo.id, lou.id, sam.id].sort());
    clock += 3 * MIN;
    await liveOf(jade, partyId);
    expect(events("party.unwell")).toHaveLength(8);
  });

  it("tells everyone at once when nobody shares a position (N-36)", async () => {
    const { users, partyId } = await crewWithParty("jade", "malik", "ines");
    const [jade, malik, ines] = users as [User, User, User];
    await status(malik, partyId, { unwell: true });
    expect(events("party.unwell").map((h) => h.userId).sort()).toEqual([jade.id, ines.id].sort());
  });

  it("keeps the last position of a dying phone for the party only, until the end (QOL-10)", async () => {
    const { users, crewId, partyId } = await crewWithParty("jade", "malik");
    const [jade, malik] = users as [User, User];
    const outsider = await account("ines");
    const { code } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/invites`, headers: jade.auth })).json() as { code: string };
    await app.inject({ method: "POST", url: `/v1/invites/${code}/accept`, headers: outsider.auth });

    await at(malik, partyId, 48.85, 2.35);
    await status(malik, partyId, { batteryLow: true });
    const seen = (await liveOf(jade, partyId)).members.find((m) => m.userId === malik.id)!;
    expect(seen.batteryLowAt).toBe(clock);
    expect(seen.lastKnown).toMatchObject({ lat: 48.85, lng: 2.35, at: clock });
    expect((await liveOf(outsider, partyId)).members.find((m) => m.userId === malik.id)?.lastKnown).toBeNull();

    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/close`, headers: jade.auth });
    expect((await liveOf(jade, partyId)).members.find((m) => m.userId === malik.id)?.lastKnown).toBeNull();
    expect(await db.query("select 1 from party_members where last_known_sealed is not null")).toHaveLength(0);
  });

  it("asks who is home when the night closes (N-25)", async () => {
    const { users, partyId } = await crewWithParty("jade", "malik", "ines");
    const [jade, malik, ines] = users as [User, User, User];
    await status(ines, partyId, { homeSafe: true });
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/close`, headers: jade.auth });
    expect(events("party.homeCheck").map((h) => h.userId).sort()).toEqual([jade.id, malik.id].sort());
    // Saying so still works once the night is closed.
    expect((await status(malik, partyId, { homeSafe: true })).statusCode).toBe(200);
    const members = (await liveOf(jade, partyId)).members;
    expect(members.filter((m) => m.homeSafeAt === null).map((m) => m.userId)).toEqual([jade.id]);
  });

  it("shows arrivals, pace and each member's venue (O-37, HUB-01)", async () => {
    const { users, crewId, partyId } = await crewWithParty("jade", "malik");
    const [jade, malik] = users as [User, User];
    await send(malik, { kind: "drink.add", drink: drink(clock - 90 * MIN) });
    await send(malik, { kind: "drink.add", drink: drink(clock - 20 * MIN) });
    await send(malik, { kind: "drink.add", drink: drink(clock - 10 * MIN) });
    const venueId = randomUUID();
    await app.inject({ method: "POST", url: `/v1/crews/${crewId}/venues`, headers: jade.auth, payload: { id: venueId, name: "Le Zinc", kind: "bar", lat: 48.85, lng: 2.35 } });
    await db.query(
      `insert into check_ins (id, user_id, venue_id, party_id, at, last_proof_at, verdict, risk, signals, config_version, fix_hash, created_at)
       values ($1, $2, $3, $4, $5, $5, 'accepted', 0, '[]', 1, 'x', $5)`,
      [randomUUID(), malik.id, venueId, partyId, clock - 5 * MIN],
    );
    const m = (await liveOf(jade, partyId)).members.find((x) => x.userId === malik.id)!;
    expect(m.arrivedAt).toBe(clock);
    expect(m.pace).toEqual({ lastHour: 2, previousHour: 1 });
    expect(m.venue).toEqual({ id: venueId, name: "Le Zinc" });
    expect((await liveOf(jade, partyId)).members.find((x) => x.userId === jade.id)?.venue).toBeNull();
  });
});

describe("SOS called off by the sender (N-28)", () => {
  it("lists my open alerts and clears every banner when I call one off", async () => {
    const { users, partyId } = await crewWithParty("jade", "malik");
    const [jade, malik] = users as [User, User];
    const { ids } = (await app.inject({ method: "POST", url: "/v1/sos", headers: jade.auth, payload: { partyId } })).json() as { ids: string[] };
    const mine = (await app.inject({ method: "GET", url: "/v1/sos", headers: jade.auth })).json() as { mine: { id: string }[] };
    expect(mine.mine.map((a) => a.id)).toEqual(ids);
    heard = [];
    await app.inject({ method: "POST", url: `/v1/sos/${ids[0]}/resolve`, headers: jade.auth });
    expect(events("crew.changed").map((h) => h.userId)).toContain(malik.id);
    const seen = (await app.inject({ method: "GET", url: "/v1/sos", headers: malik.auth })).json() as { alerts: unknown[] };
    expect(seen.alerts).toHaveLength(0);
  });
});

describe("crews", () => {
  it("lets only an admin delete a crew, its nights with it (ADP-06)", async () => {
    const { users, crewId, partyId } = await crewWithParty("jade", "malik");
    const [jade, malik] = users as [User, User];
    expect((await app.inject({ method: "DELETE", url: `/v1/crews/${crewId}`, headers: malik.auth })).statusCode).toBe(403);
    expect((await app.inject({ method: "DELETE", url: `/v1/crews/${crewId}`, headers: jade.auth })).statusCode).toBe(204);
    expect(await db.query("select 1 from parties where id = $1", [partyId])).toHaveLength(0);
    expect(((await app.inject({ method: "GET", url: "/v1/crews", headers: malik.auth })).json() as { crews: unknown[] }).crews).toHaveLength(0);
  });

  it("learns when nights end, where and with whom (QOL-16)", async () => {
    const { users, crewId, partyId } = await crewWithParty("jade", "malik", "ines");
    const [jade, malik] = users as [User, User, User];
    const empty = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/habits`, headers: jade.auth })).json() as { endMinutes: number | null };
    expect(empty.endMinutes).toBeNull();

    const venueId = randomUUID();
    await app.inject({ method: "POST", url: `/v1/crews/${crewId}/venues`, headers: jade.auth, payload: { id: venueId, name: "Le Zinc", kind: "bar", lat: 48.85, lng: 2.35 } });
    const second = await newParty(users, crewId, clock - 30 * MIN);
    for (const id of [partyId, second]) {
      await send(malik, { kind: "water.add", water: { id: randomUUID(), at: clock } });
      await db.query(
        `insert into check_ins (id, user_id, venue_id, party_id, at, last_proof_at, verdict, risk, signals, config_version, fix_hash, created_at)
         values ($1, $2, $3, $4, $5, $5, 'accepted', 0, '[]', 1, 'x', $5)`,
        [randomUUID(), jade.id, venueId, id, clock],
      );
      // Both close at 01:00 Paris time (00:00 UTC in November).
      await db.query("update parties set closed_at = $2 where id = $1", [id, Date.UTC(2026, 10, 8, 0, 0)]);
    }
    const habits = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/habits`, headers: jade.auth })).json() as {
      nights: number;
      endMinutes: number;
      venue: { name: string } | null;
      friends: { userId: string }[];
    };
    expect(habits.nights).toBe(2);
    expect(habits.endMinutes).toBe(25 * 60);
    expect(habits.venue?.name).toBe("Le Zinc");
    expect(habits.friends.map((f) => f.userId)).toEqual([malik.id]);
  });
});
