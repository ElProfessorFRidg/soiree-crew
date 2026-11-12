import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import type { Context } from "./context";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { closesAt, type HourRange } from "./hours";
import { LiveHub } from "./live";
import { gatheringsOf, suggestGathering, sweepClosingSoon, type VenueSpot } from "./suggestions";

const MIN = 60_000;
const HOUR = 60 * MIN;
const ZINC = { lat: 48.8566, lng: 2.3522 };
let clock = Date.UTC(2026, 10, 7, 20, 0);
let db: Db;
let app: FastifyInstance;
let ctx: Context;

beforeEach(async () => {
  clock = Date.UTC(2026, 10, 7, 20, 0);
  db = await connectPglite();
  await migrate(db);
  ctx = { db, sealer: new Sealer(randomBytes(32).toString("base64")), live: new LiveHub(), now: () => clock, publicUrl: "https://crew.test", hashSecret: "s" };
  app = await buildApp(ctx);
});
afterEach(async () => {
  await app.close();
  await db.close();
});

type User = { id: string; auth: { authorization: string } };
async function account(name: string): Promise<User> {
  const body = (await app.inject({ method: "POST", url: "/v1/accounts", payload: { username: name, displayName: name } })).json() as { user: { id: string }; token: string };
  return { id: body.user.id, auth: { authorization: `Bearer ${body.token}` } };
}
async function setup(count: number) {
  const users: User[] = [];
  for (let i = 0; i < count; i++) users.push(await account(`user${i}`));
  const crewId = ((await app.inject({ method: "POST", url: "/v1/crews", headers: users[0]!.auth, payload: { name: "Les Quais" } })).json() as { crew: { id: string } }).crew.id;
  const { code } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/invites`, headers: users[0]!.auth })).json() as { code: string };
  for (const u of users.slice(1)) await app.inject({ method: "POST", url: `/v1/invites/${code}/accept`, headers: u.auth });
  const venueId = randomUUID();
  await db.query("insert into venues (id, crew_id, name, kind, lat, lng, created_by, created_at) values ($1, $2, 'Le Zinc', 'bar', $3, $4, $5, $6)", [
    venueId,
    crewId,
    ZINC.lat,
    ZINC.lng,
    users[0]!.id,
    clock,
  ]);
  return { users, crewId, venueId };
}
async function checkInAt(user: User, venueId: string, priv = false) {
  await db.query(
    "insert into check_ins (id, user_id, venue_id, at, last_proof_at, verdict, risk, signals, config_version, private, fix_hash, created_at) values ($1, $2, $3, $4, $4, 'accepted', 0, '', 1, $5, 'h', $4)",
    [randomUUID(), user.id, venueId, clock, priv],
  );
}
const inbox = async (u: User) =>
  ((await app.inject({ method: "GET", url: "/v1/notifications", headers: u.auth })).json() as { items: { kind: string; params: Record<string, unknown> }[] }).items;
const gatheringOn = async (u: User, crewId: string) =>
  ((await app.inject({ method: "GET", url: `/v1/crews/${crewId}/venues`, headers: u.auth })).json() as { gathering: { count: number; venueName: string } | null }).gathering;
const launch = (u: User, crewId: string, startsAt: number) =>
  app.inject({
    method: "POST",
    url: "/v1/parties",
    headers: u.auth,
    payload: { id: randomUUID(), crewId, name: "Samedi", mood: "party", kind: "party", startsAt, endsAt: startsAt + 6 * HOUR },
  });

describe("gatheringsOf", () => {
  const venues: VenueSpot[] = [{ id: "a", name: "A", ...ZINC, radius_m: 75 }];
  it("counts a check-in once and a coarse position near the venue, nothing far away", () => {
    const g = gatheringsOf(
      venues,
      [{ user_id: "u1", venue_id: "a" }],
      [
        { user_id: "u1", ...ZINC },
        { user_id: "u2", lat: ZINC.lat + 0.0012, lng: ZINC.lng },
        { user_id: "u3", lat: ZINC.lat + 0.01, lng: ZINC.lng },
      ],
    );
    expect(g).toHaveLength(1);
    expect(g[0]!.checkedIn).toEqual(["u1"]);
    expect(g[0]!.detected).toEqual(["u2"]);
  });
});

describe("closesAt", () => {
  const all = [0, 1, 2, 3, 4, 5, 6];
  it("follows a range that runs past midnight and is null when closed", () => {
    const ranges: HourRange[] = [{ days: all, from: 18 * 60, to: 2 * 60 }];
    const at = Date.UTC(2026, 10, 7, 22, 0); // 23:00 in Paris
    expect(closesAt(ranges, at, "Europe/Paris")).toBe(Date.UTC(2026, 10, 8, 1, 0));
    expect(closesAt([{ days: all, from: 8 * 60, to: 12 * 60 }], at, "Europe/Paris")).toBeNull();
  });
});

describe("suggestions that save taps (QOL-17)", () => {
  it("asks the three at one venue once, and the crew card shows it", async () => {
    const { users, crewId, venueId } = await setup(4);
    await checkInAt(users[0]!, venueId);
    await checkInAt(users[1]!, venueId);
    await suggestGathering(ctx, crewId);
    expect((await inbox(users[0]!)).some((i) => i.kind === "gathering")).toBe(false);
    expect(await gatheringOn(users[3]!, crewId)).toBeNull();
    await checkInAt(users[2]!, venueId);
    await suggestGathering(ctx, crewId);
    await suggestGathering(ctx, crewId);
    for (const u of users.slice(0, 3)) expect((await inbox(u)).filter((i) => i.kind === "gathering")).toHaveLength(1);
    expect((await inbox(users[3]!)).some((i) => i.kind === "gathering")).toBe(false);
    expect(await gatheringOn(users[3]!, crewId)).toMatchObject({ count: 3, venueName: "Le Zinc" });
  });

  it("ignores private check-ins and stays quiet while a party is running", async () => {
    const { users, crewId, venueId } = await setup(3);
    await checkInAt(users[0]!, venueId);
    await checkInAt(users[1]!, venueId);
    await checkInAt(users[2]!, venueId, true);
    await suggestGathering(ctx, crewId);
    expect((await inbox(users[0]!)).some((i) => i.kind === "gathering")).toBe(false);
    await db.query("update check_ins set private = false");
    expect((await launch(users[0]!, crewId, clock)).statusCode).toBe(201);
    await suggestGathering(ctx, crewId);
    expect(await gatheringOn(users[1]!, crewId)).toBeNull();
    expect((await inbox(users[1]!)).some((i) => i.kind === "gathering")).toBe(false);
  });

  it("tells the rest of the crew once when a party is launched now, never the launcher", async () => {
    const { users, crewId } = await setup(3);
    expect((await launch(users[0]!, crewId, clock)).statusCode).toBe(201);
    const item = (await inbox(users[1]!)).find((i) => i.kind === "partyStarted");
    expect(item?.params).toMatchObject({ name: "user0", party: "Samedi" });
    expect((await inbox(users[0]!)).some((i) => i.kind === "partyStarted")).toBe(false);
    clock += 10 * MIN;
    await launch(users[2]!, crewId, clock);
    expect((await inbox(users[1]!)).filter((i) => i.kind === "partyStarted")).toHaveLength(1);
  });

  it("does not announce a party planned for tomorrow", async () => {
    const { users, crewId } = await setup(2);
    await launch(users[0]!, crewId, clock + 24 * HOUR);
    expect((await inbox(users[1]!)).some((i) => i.kind === "partyStarted")).toBe(false);
  });

  it("warns the people checked in 30 minutes before closing, once", async () => {
    const { users, venueId } = await setup(2);
    const schedule = { open: [{ days: [0, 1, 2, 3, 4, 5, 6], from: 18 * 60, to: 22 * 60 }], happy: [] };
    await db.query("insert into venue_hours (venue_id, schedule, updated_by, updated_at) values ($1, $2, $3, $4)", [venueId, JSON.stringify(schedule), users[0]!.id, clock]);
    await checkInAt(users[1]!, venueId);
    await sweepClosingSoon(ctx);
    expect((await inbox(users[1]!)).some((i) => i.kind === "closingSoon")).toBe(false);
    clock = Date.UTC(2026, 10, 7, 20, 40); // 21:40 in Paris, closing at 22:00
    await sweepClosingSoon(ctx);
    await sweepClosingSoon(ctx);
    const items = (await inbox(users[1]!)).filter((i) => i.kind === "closingSoon");
    expect(items).toHaveLength(1);
    expect(items[0]!.params).toMatchObject({ venue: "Le Zinc", minutes: 20 });
  });
});
