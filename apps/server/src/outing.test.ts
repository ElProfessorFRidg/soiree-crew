import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import type { Context } from "./context";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";
import { habitOf, learn, outcomeOf, sweepOuting, type HabitRow } from "./outing";

const MIN = 60_000;
const HOUR = 60 * MIN;
// 21:00 in Paris (UTC+1 in November): at night, before the default quiet hours (22:00).
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
  const body = (await app.inject({ method: "POST", url: "/v1/accounts", payload: { birthDate: "1990-01-01", username: name, displayName: name } })).json() as { user: { id: string }; token: string };
  return { id: body.user.id, auth: { authorization: `Bearer ${body.token}` } };
}
async function crewOf(...users: User[]): Promise<string> {
  const crewId = ((await app.inject({ method: "POST", url: "/v1/crews", headers: users[0]!.auth, payload: { name: "Les Quais" } })).json() as { crew: { id: string } }).crew.id;
  const { code } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/invites`, headers: users[0]!.auth })).json() as { code: string };
  for (const u of users.slice(1)) await app.inject({ method: "POST", url: `/v1/invites/${code}/accept`, headers: u.auth });
  return crewId;
}
const report = (u: User, lat: number, lng: number) => app.inject({ method: "POST", url: "/v1/me/whereabouts", headers: u.auth, payload: { lat, lng } });
const inbox = async (u: User) =>
  ((await app.inject({ method: "GET", url: "/v1/notifications", headers: u.auth })).json() as { items: { kind: string; params: Record<string, unknown> }[] }).items;
async function drink(u: User, consumedAt: number, loggedAt = consumedAt) {
  await db.query("insert into drinks (id, user_id, kind, preset_id, sealed, consumed_at, logged_at, updated_at) values ($1, $2, 'beer', 'pint', 'x', $3, $4, $4)", [
    randomUUID(),
    u.id,
    consumedAt,
    loggedAt,
  ]);
}

describe("outcomes and habits", () => {
  const at = Date.UTC(2026, 10, 7, 21, 0);
  it("reads forgot, unused and logged", () => {
    expect(outcomeOf(at, [{ consumed_at: at + 30 * MIN, logged_at: at + 30 * MIN }], [])).toBe("forgot");
    expect(outcomeOf(at, [{ consumed_at: at - 40 * MIN, logged_at: at + 3 * HOUR }], [])).toBe("forgot");
    expect(outcomeOf(at, [], [at + 20 * MIN])).toBe("forgot");
    expect(outcomeOf(at, [], [])).toBe("unused");
    expect(outcomeOf(at, [{ consumed_at: at + 3 * HOUR, logged_at: at + 3 * HOUR }], [])).toBe("logged");
  });
  it("forgetful people get it earlier, people who never log get less, then a pause", () => {
    let row: HabitRow | undefined;
    for (let i = 0; i < 3; i++) row = learn(row, "forgot", at + i * 24 * HOUR);
    expect(habitOf(row, at)).toMatchObject({ profile: "forgetful", stayMinutes: 10, maxPerNight: 3 });
    row = undefined;
    for (let i = 0; i < 3; i++) row = learn(row, "unused", at + i * 24 * HOUR);
    expect(habitOf(row, at)).toMatchObject({ profile: "noLog", maxPerNight: 1, pausedUntil: null });
    // Two nudges of one night are one ignored night.
    row = learn(row, "unused", at + 2 * 24 * HOUR + HOUR);
    expect(row.paused_until).toBeNull();
    // The fourth ignored night pauses them for two weeks.
    row = learn(row, "unused", at + 3 * 24 * HOUR);
    expect(habitOf(row, at + 3 * 24 * HOUR).pausedUntil).toBe(at + 17 * 24 * HOUR);
  });
});

describe("crew match", () => {
  it("keeps one rounded position, nudges the idle member next to a live one, and forgets after 30 min", async () => {
    const [lea, max, zoe] = await Promise.all(["lea", "max", "zoe"].map(account));
    await crewOf(lea!, max!, zoe!);
    await drink(lea!, clock - 30 * MIN);
    expect((await report(lea!, 48.85661, 2.35222)).statusCode).toBe(200);
    const stored = await db.query<{ lat: number; lng: number }>("select lat, lng from whereabouts where user_id = $1", [lea!.id]);
    expect(stored[0]).toEqual({ lat: 48.857, lng: 2.352 });
    const answer = (await report(max!, 48.8567, 2.3525)).json() as { nudges: number[] };
    expect(answer.nudges).toEqual([clock]);
    const items = await inbox(max!);
    expect(items[0]).toMatchObject({ kind: "crewNearby", params: { live: true, name: "lea" } });
    // Lea has a night going on: no nudge for her. Zoe is far away.
    expect((await inbox(lea!)).some((i) => i.kind === "crewNearby")).toBe(false);
    await report(zoe!, 48.9, 2.5);
    expect((await inbox(zoe!)).some((i) => i.kind === "crewNearby")).toBe(false);

    // Not again within 45 min, whatever comes in.
    clock += 20 * MIN;
    await report(max!, 48.8567, 2.3525);
    expect((await inbox(max!)).filter((i) => i.kind === "crewNearby")).toHaveLength(1);

    clock += 31 * MIN;
    await sweepOuting(ctx);
    expect(await db.query("select user_id from whereabouts")).toHaveLength(0);
  });

  it("stays quiet in quiet hours and outside the night, and stops on delete", async () => {
    const [a, b] = await Promise.all(["ana", "ben"].map(account));
    await crewOf(a!, b!);
    clock = Date.UTC(2026, 10, 7, 23, 0); // midnight in Paris: quiet hours by default
    await report(a!, 48.8566, 2.3522);
    await report(b!, 48.8566, 2.3522);
    expect((await inbox(b!)).some((i) => i.kind === "crewNearby")).toBe(false);
    expect((await app.inject({ method: "DELETE", url: "/v1/me/whereabouts", headers: a!.auth })).statusCode).toBe(204);
    expect(await db.query("select user_id from whereabouts where user_id = $1", [a!.id])).toHaveLength(0);
  });

  it("gathered without a live night says so, and a local nudge shares the budget", async () => {
    const [a, b] = await Promise.all(["ana", "ben"].map(account));
    await crewOf(a!, b!);
    const local = (await app.inject({ method: "POST", url: "/v1/me/outing-nudges", headers: a!.auth, payload: { at: clock - 10 * MIN } })).json() as { nudges: number[] };
    expect(local.nudges).toEqual([clock - 10 * MIN]);
    await report(a!, 48.8566, 2.3522);
    await report(b!, 48.8566, 2.3522);
    expect((await inbox(b!))[0]).toMatchObject({ kind: "crewNearby", params: { live: false } });
    // Ana had a nudge 10 min ago: too soon for another.
    expect((await inbox(a!)).some((i) => i.kind === "crewNearby")).toBe(false);
    // The night passes with nothing logged: unused.
    clock += 13 * HOUR;
    await sweepOuting(ctx);
    const outcomes = await db.query<{ outcome: string }>("select outcome from outing_nudges where user_id = $1", [a!.id]);
    expect(outcomes).toEqual([{ outcome: "unused" }]);
  });

  it("refuses a malformed position", async () => {
    const u = await account("solo");
    expect((await report(u, 123, 2)).statusCode).toBe(400);
  });
});
