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

const SECTIONS = ["identity", "crews", "titles", "venues", "drinks", "records", "nights"] as const;
const AUDIENCES = ["me", "crews", "friends", "everyone"] as const;

async function setup() {
  const [owner, crewMate, friend, stranger] = (await Promise.all(["owner", "mate", "friend", "stranger"].map(account))) as [User, User, User, User];
  const crewId = ((await app.inject({ method: "POST", url: "/v1/crews", headers: owner.auth, payload: { name: "Crew" } })).json() as { crew: { id: string } }).crew.id;
  const { code } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/invites`, headers: owner.auth })).json() as { code: string };
  await app.inject({ method: "POST", url: `/v1/invites/${code}/accept`, headers: crewMate.auth });
  await app.inject({ method: "POST", url: `/v1/users/${friend.id}/friend`, headers: owner.auth });
  await app.inject({ method: "POST", url: `/v1/users/${owner.id}/friend`, headers: friend.auth });
  return { owner, crewMate, friend, stranger, crewId };
}

const view = async (viewer: User, ownerId: string, as?: string) =>
  (await app.inject({ method: "GET", url: `/v1/users/${ownerId}/profile${as ? `?as=${as}` : ""}`, headers: viewer.auth })).json() as {
    sections: Record<string, unknown>;
    friendship: string;
  };

describe("profile audiences (PROF-01, PROF-08)", () => {
  it("sends each section only to the audiences allowed, for every section and every audience", async () => {
    const { owner, crewMate, friend, stranger } = await setup();
    const expected: Record<(typeof AUDIENCES)[number], { mate: boolean; friend: boolean; stranger: boolean }> = {
      me: { mate: false, friend: false, stranger: false },
      crews: { mate: true, friend: false, stranger: false },
      friends: { mate: false, friend: true, stranger: false },
      everyone: { mate: true, friend: true, stranger: true },
    };
    for (const audience of AUDIENCES) {
      await app.inject({ method: "PUT", url: "/v1/me/profile", headers: owner.auth, payload: { audiences: Object.fromEntries(SECTIONS.map((s) => [s, audience])) } });
      const [m, f, s, me] = await Promise.all([view(crewMate, owner.id), view(friend, owner.id), view(stranger, owner.id), view(owner, owner.id)]);
      for (const section of SECTIONS) {
        expect([section, audience, "mate", section in m.sections]).toEqual([section, audience, "mate", expected[audience].mate]);
        expect([section, audience, "friend", section in f.sections]).toEqual([section, audience, "friend", expected[audience].friend]);
        expect([section, audience, "stranger", section in s.sections]).toEqual([section, audience, "stranger", expected[audience].stranger]);
        expect([section, audience, "me", section in me.sections]).toEqual([section, audience, "me", true]);
      }
    }
  });

  it("previews my profile as a stranger, a friend or a crew mate (PROF-07)", async () => {
    const { owner } = await setup();
    await app.inject({ method: "PUT", url: "/v1/me/profile", headers: owner.auth, payload: { preset: "friends" } });
    expect(Object.keys((await view(owner, owner.id, "stranger")).sections)).toEqual(["identity"]);
    expect(Object.keys((await view(owner, owner.id, "friend")).sections).sort()).toEqual([...SECTIONS].sort());
    expect(Object.keys((await view(owner, owner.id, "crew")).sections)).toEqual(["identity"]);
  });

  it("never gives strangers the dates of venue visits, and hides a hidden venue from everyone else (PROF-03, PROF-05)", async () => {
    const { owner, crewMate, stranger, crewId } = await setup();
    const venueId = randomUUID();
    await app.inject({ method: "POST", url: `/v1/crews/${crewId}/venues`, headers: owner.auth, payload: { id: venueId, name: "Le Zinc", kind: "bar", lat: 48.85, lng: 2.35 } });
    await db.query(
      `insert into check_ins (id, user_id, venue_id, at, last_proof_at, verdict, risk, signals, config_version, fix_hash, created_at)
       values ($1, $2, $3, $4, $4, 'accepted', 0, '[]', 1, 'h', $4)`,
      [randomUUID(), owner.id, venueId, clock - 3_600_000],
    );
    await app.inject({ method: "PUT", url: "/v1/me/profile", headers: owner.auth, payload: { preset: "public" } });
    const forStranger = (await view(stranger, owner.id)).sections.venues as { visits: number; lastAt?: number }[];
    expect(forStranger).toEqual([expect.objectContaining({ visits: 1 })]);
    expect(forStranger[0]!.lastAt).toBeUndefined();
    expect(((await view(crewMate, owner.id)).sections.venues as { lastAt?: number }[])[0]!.lastAt).toBeDefined();
    await app.inject({ method: "PUT", url: "/v1/me/profile", headers: owner.auth, payload: { hiddenVenues: [venueId] } });
    expect((await view(crewMate, owner.id)).sections.venues).toEqual([]);
    expect(((await view(owner, owner.id)).sections.venues as unknown[]).length).toBe(1);
  });

  it("makes friends in one tap each, and a block hides everything both ways", async () => {
    const { owner, friend, stranger } = await setup();
    expect((await view(owner, friend.id)).friendship).toBe("friends");
    await app.inject({ method: "POST", url: `/v1/users/${owner.id}/friend`, headers: stranger.auth });
    expect((await view(owner, stranger.id)).friendship).toBe("incoming");
    await app.inject({ method: "POST", url: `/v1/users/${stranger.id}/block`, headers: owner.auth });
    expect((await app.inject({ method: "GET", url: `/v1/users/${owner.id}/profile`, headers: stranger.auth })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: `/v1/users/${stranger.id}/profile`, headers: owner.auth })).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: `/v1/users/${owner.id}/friend`, headers: stranger.auth })).statusCode).toBe(404);
  });
});

describe("moderation (COM-08)", () => {
  it("mutes a member's crew calls for me only, and sends reports to the crew's admins", async () => {
    const { owner, crewMate, crewId } = await setup();
    await app.inject({ method: "POST", url: `/v1/crews/${crewId}/out-calls`, headers: crewMate.auth, payload: { note: "Qui vient ?" } });
    const calls = async (u: User) => ((await app.inject({ method: "GET", url: `/v1/crews/${crewId}/radar`, headers: u.auth })).json() as { calls: unknown[] }).calls.length;
    expect(await calls(owner)).toBe(1);
    await app.inject({ method: "POST", url: `/v1/users/${crewMate.id}/mute`, headers: owner.auth });
    expect(await calls(owner)).toBe(0);
    expect(await calls(crewMate)).toBe(1);

    expect((await app.inject({ method: "POST", url: "/v1/reports", headers: crewMate.auth, payload: { targetKind: "profile", targetId: owner.id, reason: "harassment" } })).statusCode).toBe(201);
    const list = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/reports`, headers: owner.auth })).json() as { reports: { reason: string; reporter?: string }[] };
    expect(list.reports).toEqual([expect.objectContaining({ reason: "harassment" })]);
    expect(list.reports[0]!.reporter).toBeUndefined();
    expect((await app.inject({ method: "GET", url: `/v1/crews/${crewId}/reports`, headers: crewMate.auth })).statusCode).toBe(403);
  });
});

describe("search and findability (O-43, PROF-09)", () => {
  const search = async (viewer: User, q: string) =>
    ((await app.inject({ method: "GET", url: `/v1/users/search?q=${encodeURIComponent(q)}`, headers: viewer.auth })).json() as { people: { userId: string; friendship: string }[] }).people.map((p) => p.userId);

  it("shows strangers only by exact username unless they open search, and crew mates always", async () => {
    const { owner, crewMate, stranger } = await setup();
    expect(await search(stranger, "own")).toEqual([]);
    expect(await search(stranger, "owner")).toEqual([owner.id]);
    expect(await search(crewMate, "own")).toEqual([owner.id]);

    await app.inject({ method: "PUT", url: "/v1/me/profile", headers: owner.auth, payload: { findable: "nobody" } });
    expect(await search(stranger, "owner")).toEqual([]);
    expect(await search(crewMate, "owner")).toEqual([owner.id]);

    await app.inject({ method: "PUT", url: "/v1/me/profile", headers: owner.auth, payload: { findable: "search" } });
    expect(await search(stranger, "wne")).toEqual([owner.id]);
    expect(await search(stranger, "%%")).toEqual([]);
  });

  it("hides blocked people both ways", async () => {
    const { owner, crewMate } = await setup();
    await app.inject({ method: "POST", url: `/v1/users/${owner.id}/block`, headers: crewMate.auth });
    expect(await search(owner, "mate")).toEqual([]);
    expect(await search(crewMate, "owner")).toEqual([]);
  });

  it("accepts a received request instead of sending a second one", async () => {
    const { owner, stranger } = await setup();
    await app.inject({ method: "POST", url: `/v1/users/${owner.id}/friend`, headers: stranger.auth });
    const again = (await app.inject({ method: "POST", url: `/v1/users/${owner.id}/friend`, headers: stranger.auth })).json() as { friendship: string };
    expect(again.friendship).toBe("requested");
    const back = (await app.inject({ method: "POST", url: `/v1/users/${stranger.id}/friend`, headers: owner.auth })).json() as { friendship: string };
    expect(back.friendship).toBe("friends");
    expect((await db.query("select * from friendships")).length).toBe(2);
  });
});
