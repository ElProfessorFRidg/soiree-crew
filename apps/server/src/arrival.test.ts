import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ageOn } from "./age";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";

// O-01, O-02, PROF-01, PROF-02, COM-06: what the arrival flow stores, and what a stranger can read.

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
async function account(username: string, extra: object = {}): Promise<User> {
  const body = (await app.inject({ method: "POST", url: "/v1/accounts", payload: { username, displayName: username, ...extra } })).json() as { user: { id: string }; token: string };
  return { id: body.user.id, auth: { authorization: `Bearer ${body.token}` } };
}
const put = (user: User, payload: object) => app.inject({ method: "PUT", url: "/v1/me/profile", headers: user.auth, payload });
const profileOf = async (viewer: User, ownerId: string) =>
  (await app.inject({ method: "GET", url: `/v1/users/${ownerId}/profile`, headers: viewer.auth })).json() as { sections: Record<string, unknown> };

async function crewWith(owner: User, member: User): Promise<string> {
  const crewId = ((await app.inject({ method: "POST", url: "/v1/crews", headers: owner.auth, payload: { name: "Crew" } })).json() as { crew: { id: string } }).crew.id;
  const { code } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/invites`, headers: owner.auth })).json() as { code: string };
  await app.inject({ method: "POST", url: `/v1/invites/${code}/accept`, headers: member.auth });
  return crewId;
}

describe("age (O-02)", () => {
  it("counts whole years on the day", () => {
    expect(ageOn("2008-11-07", clock)).toBe(18);
    expect(ageOn("2008-11-08", clock)).toBe(17);
    expect(ageOn("1990-02-28", clock)).toBe(36);
  });

  it("refuses an account under 18 before it exists, and one day short", async () => {
    const young = await app.inject({ method: "POST", url: "/v1/accounts", payload: { username: "kid", displayName: "Kid", birthDate: "2008-11-08" } });
    expect(young.statusCode).toBe(403);
    expect(young.json()).toEqual({ error: "under_age" });
    expect((await db.query("select 1 from users where username = 'kid'")).length).toBe(0);
    expect((await app.inject({ method: "POST", url: "/v1/accounts", payload: { username: "adult", displayName: "Adult", birthDate: "2008-11-07" } })).statusCode).toBe(201);
  });

  it("refuses an under 18 date later on, and answers with the age, never the date", async () => {
    const user = await account("late");
    const refused = await app.inject({ method: "PUT", url: "/v1/me/birth-date", headers: user.auth, payload: { birthDate: "2015-01-01" } });
    expect(refused.statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: "/v1/me", headers: user.auth })).json()).toMatchObject({ age: null });
    const ok = await app.inject({ method: "PUT", url: "/v1/me/birth-date", headers: user.auth, payload: { birthDate: "1996-05-12" } });
    expect(ok.json()).toEqual({ age: 30 });
    const me = (await app.inject({ method: "GET", url: "/v1/me", headers: user.auth })).body;
    expect(me).toContain('"age":30');
    expect(me).not.toContain("1996");
    expect(JSON.stringify(await profileOf(user, user.id))).not.toContain("1996");
  });

  it("refuses dates that do not exist", async () => {
    const user = await account("odd");
    for (const birthDate of ["1996-02-30", "2999-01-01x", "1800-01-01", "yesterday"]) {
      expect((await app.inject({ method: "PUT", url: "/v1/me/birth-date", headers: user.auth, payload: { birthDate } })).statusCode).toBe(400);
    }
  });
});

describe("username check (O-01)", () => {
  it("says whether a username is free, without being signed in", async () => {
    await account("taken_one");
    expect((await app.inject({ method: "GET", url: "/v1/usernames/taken_one/available" })).json()).toEqual({ available: false });
    expect((await app.inject({ method: "GET", url: "/v1/usernames/free_one/available" })).json()).toEqual({ available: true });
    expect((await app.inject({ method: "GET", url: "/v1/usernames/ab/available" })).statusCode).toBe(400);
  });
});

describe("the five visibility choices (PROF-01, PROF-02)", () => {
  it("keeps badges from a stranger when they are set to crews or me, and from a crew mate when set to me", async () => {
    const [owner, mate, stranger] = [await account("owner"), await account("mate"), await account("stranger")] as [User, User, User];
    await crewWith(owner, mate);
    for (const [audience, mateSees, strangerSees] of [
      ["me", false, false],
      ["crews", true, false],
      ["friends", false, false],
      ["everyone", true, true],
    ] as const) {
      await put(owner, { audiences: { badges: audience, titles: audience, venues: audience } });
      for (const section of ["badges", "titles", "venues"]) {
        expect([audience, section, "mate", section in (await profileOf(mate, owner.id)).sections]).toEqual([audience, section, "mate", mateSees]);
        expect([audience, section, "stranger", section in (await profileOf(stranger, owner.id)).sections]).toEqual([audience, section, "stranger", strangerSees]);
        expect(section in (await profileOf(owner, owner.id)).sections).toBe(true);
      }
    }
  });

  it("stores find and presence next to the other audiences, and shows them to the owner only", async () => {
    const [owner, stranger] = [await account("owner2"), await account("stranger2")] as [User, User];
    await put(owner, { audiences: { find: "me", presence: "friends" } });
    const mine = (await app.inject({ method: "GET", url: `/v1/users/${owner.id}/profile`, headers: owner.auth })).json() as { audiences: Record<string, string> };
    expect(mine.audiences).toMatchObject({ find: "me", presence: "friends" });
    const theirs = await profileOf(stranger, owner.id);
    expect(Object.keys(theirs.sections)).not.toContain("find");
    expect(Object.keys(theirs.sections)).not.toContain("presence");
    expect("audiences" in theirs).toBe(false);
  });

  it("lets a stranger find a person only when 'who can find me' is Everyone", async () => {
    const [owner, stranger, mate] = [await account("findme"), await account("seeker"), await account("crewmate")] as [User, User, User];
    await crewWith(owner, mate);
    const search = async (viewer: User) =>
      ((await app.inject({ method: "GET", url: "/v1/users/search?q=findme", headers: viewer.auth })).json() as { people: { userId: string }[] }).people.some((p) => p.userId === owner.id);
    for (const audience of ["me", "crews", "friends"] as const) {
      await put(owner, { audiences: { find: audience } });
      expect([audience, await search(stranger)]).toEqual([audience, false]);
      expect([audience, await search(mate)]).toEqual([audience, true]);
    }
    await put(owner, { audiences: { find: "everyone" } });
    expect(await search(stranger)).toBe(true);
  });

  it("hides 'out tonight' from crew mates when presence is Me or Friends, and shows it when it is Crews", async () => {
    const [owner, mate] = [await account("night_owl"), await account("night_mate")] as [User, User];
    const crewId = await crewWith(owner, mate);
    const status = await app.inject({ method: "PUT", url: "/v1/status", headers: owner.auth, payload: { night: "2026-11-07", status: "going_out", place: "Le Zinc" } });
    expect(status.statusCode).toBe(200);
    const seen = async () =>
      ((await app.inject({ method: "GET", url: `/v1/crews/${crewId}/radar`, headers: mate.auth })).json() as { statuses: { userId: string }[] }).statuses.some((s) => s.userId === owner.id);
    await put(owner, { audiences: { presence: "crews" } });
    expect(await seen()).toBe(true);
    for (const audience of ["me", "friends"] as const) {
      await put(owner, { audiences: { presence: audience } });
      expect([audience, await seen()]).toEqual([audience, false]);
    }
    await app.inject({ method: "POST", url: `/v1/users/${mate.id}/friend`, headers: owner.auth });
    await app.inject({ method: "POST", url: `/v1/users/${owner.id}/friend`, headers: mate.auth });
    expect(await seen()).toBe(true);
    // The owner always sees their own status.
    const own = ((await app.inject({ method: "GET", url: `/v1/crews/${crewId}/radar`, headers: owner.auth })).json() as { statuses: { userId: string }[] }).statuses;
    expect(own.some((s) => s.userId === owner.id)).toBe(true);
  });
});
