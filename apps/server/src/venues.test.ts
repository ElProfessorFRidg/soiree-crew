import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";

const MIN = 60_000;
const ZINC = { lat: 48.8566, lng: 2.3522 };
let clock = Date.UTC(2026, 10, 6, 21, 0);
let db: Db;
let app: FastifyInstance;

beforeEach(async () => {
  clock = Date.UTC(2026, 10, 6, 21, 0);
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
  const body = (await app.inject({ method: "POST", url: "/v1/accounts", payload: { username, displayName: username } })).json() as {
    user: { id: string };
    token: string;
  };
  return { id: body.user.id, auth: { authorization: `Bearer ${body.token}` } };
}

async function setup(...names: string[]) {
  const users = await Promise.all(names.map(account));
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
    payload: { id: partyId, crewId, name: "Samedi", mood: "party", kind: "party", startsAt: clock - 30 * MIN, endsAt: clock + 8 * 60 * MIN },
  });
  for (const u of users.slice(1)) await app.inject({ method: "POST", url: `/v1/parties/${partyId}/response`, headers: u.auth, payload: { response: "going" } });
  return { users, crewId, venueId, partyId };
}

async function checkIn(user: User, venueId: string, fix: Partial<{ lat: number; lng: number; accuracy: number; mocked: boolean }> = {}) {
  const res = await app.inject({
    method: "POST",
    url: "/v1/checkins",
    headers: user.auth,
    payload: { id: randomUUID(), venueId, lat: ZINC.lat + 0.00011, lng: ZINC.lng + 0.00007, accuracy: 15, mocked: false, deviceNow: clock, ...fix },
  });
  return res.json() as { id: string; verdict: string; reason: string | null; takeover: { bossId: string | null; takenFrom: string | null } | null };
}

describe("check-ins and territories", () => {
  it("accepts a real check-in, rejects a faked one, and never stores raw coordinates", async () => {
    const { users, venueId } = await setup("jade", "malik");
    expect((await checkIn(users[0]!, venueId)).verdict).toBe("accepted");
    const fake = await checkIn(users[1]!, venueId, { lat: ZINC.lat, lng: ZINC.lng, mocked: true });
    expect(fake.verdict).toBe("unverified");
    const columns = await db.query<{ column_name: string }>("select column_name from information_schema.columns where table_name = 'check_ins'");
    expect(columns.map((c) => c.column_name)).not.toContain("lat");
    expect(JSON.stringify(fake)).not.toContain("mocked");
  });

  it("lets someone checked in at the same bar confirm an unverified check-in, and nobody else (AC-04)", async () => {
    const { users, venueId } = await setup("jade", "malik", "theo");
    const [jade, malik, theo] = users as [User, User, User];
    const doubtful = await checkIn(malik, venueId, { mocked: true });
    expect(doubtful.verdict).toBe("unverified");
    const confirm = (user: User) => app.inject({ method: "POST", url: `/v1/checkins/${doubtful.id}/confirm`, headers: user.auth });

    expect((await confirm(theo)).statusCode).toBe(403);
    expect((await confirm(malik)).statusCode).toBe(403);

    clock += 10 * MIN;
    await checkIn(jade, venueId);
    const venue = (await app.inject({ method: "GET", url: `/v1/venues/${venueId}`, headers: jade.auth })).json() as { toConfirm: { id: string; name: string }[] };
    expect(venue.toConfirm.map((c) => c.id)).toEqual([doubtful.id]);
    expect((await confirm(jade)).statusCode).toBe(200);
    const row = await db.query<{ verdict: string; corroborated: boolean }>("select verdict, corroborated from check_ins where id = $1", [doubtful.id]);
    expect(row[0]).toEqual({ verdict: "accepted", corroborated: true });
    expect((await confirm(jade)).statusCode).toBe(409);
  });

  it("refuses a confirmation from someone who arrived long after (AC-04)", async () => {
    const { users, venueId } = await setup("jade", "malik");
    const [jade, malik] = users as [User, User];
    const doubtful = await checkIn(malik, venueId, { mocked: true });
    clock += 2 * 60 * MIN;
    await checkIn(jade, venueId);
    expect((await app.inject({ method: "POST", url: `/v1/checkins/${doubtful.id}/confirm`, headers: jade.auth })).statusCode).toBe(403);
  });

  it("says 'not here' when the phone is far from the venue", async () => {
    const { users, venueId } = await setup("jade");
    expect((await checkIn(users[0]!, venueId, { lat: 48.9 })).verdict).toBe("not_here");
  });

  it("crowns a boss once the check-in vests and reports the takeover", async () => {
    const { users, venueId, crewId } = await setup("jade", "malik", "ines");
    const jade = await checkIn(users[0]!, venueId);
    const malik = await checkIn(users[1]!, venueId);
    clock += 170 * MIN;
    // "Still here" proofs: without them, time stops counting 20 min after the last proof.
    for (const [user, c] of [
      [users[0]!, jade],
      [users[1]!, malik],
    ] as const) {
      await app.inject({ method: "POST", url: `/v1/checkins/${c.id}/proof`, headers: user.auth, payload: { lat: ZINC.lat + 0.0001, lng: ZINC.lng, accuracy: 10, mocked: false, deviceNow: clock } });
    }
    clock += 5 * MIN;
    await checkIn(users[2]!, venueId);
    clock += 20 * MIN;
    // Ines's check-in vests and re-scores the venue: three people present, so the organiser bonus applies.
    await checkIn(users[2]!, venueId);
    const map = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/venues`, headers: users[0]!.auth })).json() as {
      venues: { bossId: string | null; myPoints: number; explored: boolean; hereNow: number }[];
    };
    expect(map.venues[0]!.explored).toBe(true);
    // Jade: check-in 10 + 3 h 18 + organiser 12 (3 people) + discovery 20.
    expect(map.venues[0]!.myPoints).toBe(60);
    expect(map.venues[0]!.bossId).toBe(users[0]!.id);
    const page = (await app.inject({ method: "GET", url: `/v1/venues/${venueId}`, headers: users[1]!.auth })).json() as { top: { points: number }[] };
    expect(page.top[0]!.points).toBe(60);
  });

  it("hides venues from other crews", async () => {
    const { venueId } = await setup("jade");
    const stranger = await account("stranger");
    expect((await app.inject({ method: "GET", url: `/v1/venues/${venueId}`, headers: stranger.auth })).statusCode).toBe(404);
  });
});

describe("leaderboard (RANK-01, RANK-06)", () => {
  async function drink(user: User, minutesFromNow = 0) {
    const id = randomUUID();
    const at = clock + minutesFromNow * MIN;
    await app.inject({
      method: "POST",
      url: "/v1/mutations",
      headers: user.auth,
      payload: { mutations: [{ key: `k-${id}`, mutation: { kind: "drink.add", drink: { id, presetId: "m-pint", kind: "pint", volumeMl: 500, abv: 0.05, consumedAt: at, loggedAt: at, withFood: false } } }] },
    });
    return id;
  }

  it("counts only drinks a friend confirmed", async () => {
    const { users, crewId, partyId } = await setup("jade", "malik");
    const [jade, malik] = users as [User, User];
    const confirmed = await drink(malik);
    await drink(malik, 1);
    const res = await app.inject({ method: "POST", url: `/v1/drinks/${confirmed}/confirm`, headers: jade.auth });
    expect(res.statusCode).toBe(200);
    const board = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/leaderboard?period=party&partyId=${partyId}&metric=drinks`, headers: malik.auth })).json() as {
      rows: { name: string; value: number; unverified?: number; rank: number }[];
    };
    const row = board.rows.find((r) => r.name === "malik")!;
    expect(row.value).toBe(1);
    expect(row.unverified).toBe(1);
    expect(row.rank).toBe(1);
  });

  it("keeps last week's champion and their streak in the honours list (RANK-04)", async () => {
    const { users, crewId } = await setup("jade", "malik");
    const [jade, malik] = users as [User, User];
    const confirmed = await drink(malik);
    await app.inject({ method: "POST", url: `/v1/drinks/${confirmed}/confirm`, headers: jade.auth });
    clock += 7 * 24 * 60 * MIN;
    const history = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/leaderboard/history?metric=drinks`, headers: jade.auth })).json() as {
      weeks: { champions: { name: string; value: number }[] }[];
      months: unknown[];
      streaks: { name: string; current: number; best: number }[];
    };
    expect(history.weeks).toHaveLength(8);
    expect(history.months).toHaveLength(6);
    expect(history.weeks[0]!.champions).toEqual([{ userId: malik.id, name: "malik", value: 1 }]);
    expect(history.streaks).toEqual([{ userId: malik.id, name: "malik", current: 1, best: 1 }]);
  });

  it("never lets someone confirm their own drink", async () => {
    const { users } = await setup("jade");
    const id = await drink(users[0]!);
    expect((await app.inject({ method: "POST", url: `/v1/drinks/${id}/confirm`, headers: users[0]!.auth })).statusCode).toBe(404);
  });

  it("lets a member leave the board and an admin switch it off (RANK-08)", async () => {
    const { users, crewId } = await setup("jade", "malik");
    await app.inject({ method: "PATCH", url: `/v1/crews/${crewId}/me`, headers: users[1]!.auth, payload: { leaderboardOptOut: true } });
    const board = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/leaderboard`, headers: users[0]!.auth })).json() as { rows: { name: string }[] };
    expect(board.rows.map((r) => r.name)).toEqual(["jade"]);
    await app.inject({ method: "PATCH", url: `/v1/crews/${crewId}/settings`, headers: users[0]!.auth, payload: { leaderboardEnabled: false } });
    expect((await app.inject({ method: "GET", url: `/v1/crews/${crewId}/leaderboard`, headers: users[0]!.auth })).json()).toMatchObject({ disabled: true });
  });
});
