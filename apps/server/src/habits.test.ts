import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";
import { calendarNights, nightsBetween, outings, usualTime } from "./stats";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
let db: Db;
let app: FastifyInstance;
let sealer: Sealer;
// Saturday 7 November 2026, 22:00 in Paris.
const clock = Date.UTC(2026, 10, 7, 21, 0);

beforeEach(async () => {
  db = await connectPglite();
  await migrate(db);
  sealer = new Sealer(randomBytes(32).toString("base64"));
  app = await buildApp({ db, sealer, live: new LiveHub(), now: () => clock, publicUrl: "https://crew.test", hashSecret: "s" });
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
/** A past party, written straight to the tables so its times are free. */
async function night(crewId: string, startsAt: number, going: User[]): Promise<string> {
  const id = randomUUID();
  await db.query("insert into parties (id, crew_id, name, mood, kind, starts_at, ends_at, created_by, created_at) values ($1, $2, 'Soir', 'party', 'party', $3, $4, $5, $3)", [
    id,
    crewId,
    startsAt,
    startsAt + 6 * HOUR,
    going[0]!.id,
  ]);
  for (const u of going) await db.query("insert into party_members (party_id, user_id, response) values ($1, $2, 'going')", [id, u.id]);
  return id;
}
async function drink(user: User, partyId: string | null, at: number): Promise<void> {
  await db.query("insert into drinks (id, user_id, party_id, kind, preset_id, sealed, consumed_at, logged_at, updated_at) values ($1, $2, $3, 'pint', 'm-pint', $5, $4, $4, $4)", [
    randomUUID(),
    user.id,
    partyId,
    at,
    sealer.seal({ volumeMl: 500, abv: 0.05, withFood: false, name: null }),
  ]);
}
async function checkIn(user: User, venueId: string, partyId: string | null, at: number, endedAt: number | null): Promise<void> {
  await db.query(
    `insert into check_ins (id, user_id, venue_id, party_id, at, ended_at, last_proof_at, verdict, risk, signals, config_version, fix_hash, created_at)
     values ($1, $2, $3, $4, $5, $6, $5, 'accepted', 0, '[]', 1, 'h', $5)`,
    [randomUUID(), user.id, venueId, partyId, at, endedAt],
  );
}
async function venue(owner: User, crewId: string, name: string): Promise<string> {
  const id = randomUUID();
  await app.inject({ method: "POST", url: `/v1/crews/${crewId}/venues`, headers: owner.auth, payload: { id, name, kind: "bar", lat: 48.85, lng: 2.35 } });
  return id;
}
const paris = (at: number) => (new Date(at).getUTCMonth() >= 3 && new Date(at).getUTCMonth() <= 9 ? 120 : 60);

describe("habit helpers (N-13, N-14)", () => {
  it("takes the usual leaving time on the night's clock, so 11 pm and 2 am give 0:30", () => {
    const at = (h: number) => Date.UTC(2026, 10, 7, h - 1, 0); // Paris is UTC+1 in November
    expect(usualTime([at(23), at(26)], paris, 6)).toBe(12 * 60 + 30);
    expect(usualTime([at(23), at(24 + 2), at(24 + 3)], paris, 6)).toBe(14 * 60);
    expect(usualTime([], paris, 6)).toBeNull();
  });
  it("splits a trip's activity into stretches and keeps one night's check-in whole", () => {
    const t = Date.UTC(2026, 10, 7, 20);
    const spans = outings([
      { key: "trip", from: t, to: t },
      { key: "trip", from: t + HOUR, to: t + 5 * HOUR },
      { key: "trip", from: t + DAY, to: t + DAY + 3 * HOUR },
      { key: "party", from: t, to: t + 2 * HOUR },
    ]);
    expect(spans.map((s) => [s.key, (s.last - s.first) / HOUR])).toEqual([
      ["trip", 5],
      ["trip", 3],
      ["party", 2],
    ]);
  });
  it("lists the calendar's nights and every night of a trip", () => {
    expect(calendarNights(["2026-11-07", "2026-11-07", "2026-05-01", "2026-10-31"], "2026-11-08", 26)).toEqual([
      { night: "2026-10-31", count: 1 },
      { night: "2026-11-07", count: 2 },
    ]);
    const key = (at: number) => new Date(at).toISOString().slice(0, 10);
    expect(nightsBetween(Date.UTC(2026, 10, 6, 20), Date.UTC(2026, 10, 9, 3), key)).toEqual(["2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09"]);
  });
});

describe("crew habits (N-14, N-16)", () => {
  it("adds the calendar and hours out, and filters by venue and by person without touching the streak", async () => {
    const { users, crewId } = await crew("jade", "malik", "ines");
    const [jade, malik, ines] = users as [User, User, User];
    const zinc = await venue(jade, crewId, "Le Zinc");
    // Two nights a week apart: the Zinc with Malik, then elsewhere with Inès.
    const first = clock - 7 * DAY;
    const p1 = await night(crewId, first, [jade, malik]);
    const p2 = await night(crewId, clock - HOUR, [jade, ines]);
    await checkIn(malik, zinc, p1, first, first + 3 * HOUR);
    await drink(jade, p1, first + HOUR);
    await db.query("update party_members set home_safe_at = $2 where party_id = $1 and user_id = $3", [p1, first + 5 * HOUR, jade.id]);
    await drink(ines, p2, clock - HOUR);
    await drink(ines, p2, clock + HOUR / 2);

    type Stats = { totalNights: number; streak: { current: number }; calendar: { night: string; count: number }[]; hoursOut: { total: number; perNight: number | null; nights: number }; filters: { venues: { id: string }[]; people: { userId: string }[] } };
    const get = async (u: User, query = "") => (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/stats${query}`, headers: u.auth })).json() as Stats;

    const all = await get(jade);
    expect(all.totalNights).toBe(2);
    expect(all.calendar).toEqual([
      { night: "2026-10-31", count: 1 },
      { night: "2026-11-07", count: 1 },
    ]);
    expect(all.hoursOut).toEqual({ total: 6.5, perNight: 3.3, nights: 2 });
    expect(all.filters.venues.map((v) => v.id)).toEqual([zinc]);
    expect(all.filters.people.map((p) => p.userId).sort()).toEqual([malik.id, ines.id].sort());

    const atZinc = await get(jade, `?venueId=${zinc}`);
    expect(atZinc.totalNights).toBe(1);
    expect(atZinc.hoursOut.total).toBe(5);
    expect(atZinc.streak.current).toBe(all.streak.current);
    const withInes = await get(jade, `?userId=${ines.id}`);
    expect(withInes.calendar).toEqual([{ night: "2026-11-07", count: 1 }]);

    // Inès keeps her nights to herself: nobody can filter by her any more.
    await app.inject({ method: "PUT", url: "/v1/me/profile", headers: ines.auth, payload: { audiences: { nights: "me" } } });
    expect((await get(jade)).filters.people.map((p) => p.userId)).toEqual([malik.id]);
    expect((await app.inject({ method: "GET", url: `/v1/crews/${crewId}/stats?userId=${ines.id}`, headers: jade.auth })).statusCode).toBe(403);
  });
});

describe("my habits and filters (N-13, N-16)", () => {
  it("gives the usual leaving time and the nights a venue or a person narrows to", async () => {
    const { users, crewId } = await crew("jade", "malik");
    const [jade, malik] = users as [User, User];
    const zinc = await venue(jade, crewId, "Le Zinc");
    // Night 1 at the Zinc with Malik, home at 1:00. Night 2 alone, last drink at 3:00.
    const n1 = Date.UTC(2026, 9, 31, 20); // 21:00 Paris
    const p1 = await night(crewId, n1, [jade, malik]);
    await checkIn(jade, zinc, p1, n1, n1 + 2 * HOUR);
    await drink(jade, p1, n1 + HOUR / 2);
    await drink(jade, p1, n1 + 2 * HOUR);
    await db.query("update party_members set home_safe_at = $2 where party_id = $1 and user_id = $3", [p1, n1 + 4 * HOUR, jade.id]);
    const n2 = Date.UTC(2026, 10, 6, 21); // 22:00 Paris
    await drink(jade, null, n2);
    await drink(jade, null, n2 + 5 * HOUR);

    type Mine = { nights: string[] | null; habits: { nights: number; usualLeaving: number | null; usualFirstDrink: number | null }; filters: { venues: { id: string }[]; people: { userId: string }[] } };
    const get = async (query = "") => (await app.inject({ method: "GET", url: `/v1/me/stats${query}`, headers: jade.auth })).json() as Mine;
    const all = await get();
    expect(all.nights).toBeNull();
    expect(all.habits.nights).toBe(2);
    // Median of 1:00 and 3:00: 2:00, i.e. 14 hours after noon.
    expect(all.habits.usualLeaving).toBe(14 * 60);
    expect(all.filters.venues.map((v) => v.id)).toEqual([zinc]);
    expect(all.filters.people.map((p) => p.userId)).toEqual([malik.id]);

    const atZinc = await get(`?venueId=${zinc}`);
    expect(atZinc.nights).toEqual(["2026-10-31"]);
    expect(atZinc.habits).toMatchObject({ nights: 1, usualLeaving: 13 * 60, usualFirstDrink: 9 * 60 + 30 });
    expect((await get(`?withUserId=${malik.id}`)).nights).toEqual(["2026-10-31"]);

    const stranger = await account("stranger");
    expect((await app.inject({ method: "GET", url: `/v1/me/stats?withUserId=${stranger.id}`, headers: jade.auth })).statusCode).toBe(403);

    // N-13 on the profile too.
    const profile = (await app.inject({ method: "GET", url: `/v1/users/${jade.id}/profile`, headers: malik.auth })).json() as { sections: { drinks?: { usualLeaving: number | null } } };
    expect(profile.sections.drinks?.usualLeaving).toBe(14 * 60);
  });
});
