import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";

let db: Db;
let app: FastifyInstance;
const clock = Date.UTC(2026, 10, 7, 19, 0);

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
async function crewOf(...users: User[]) {
  const crewId = ((await app.inject({ method: "POST", url: "/v1/crews", headers: users[0]!.auth, payload: { name: "Crew" } })).json() as { crew: { id: string } }).crew.id;
  const { code } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/invites`, headers: users[0]!.auth })).json() as { code: string };
  for (const u of users.slice(1)) await app.inject({ method: "POST", url: `/v1/invites/${code}/accept`, headers: u.auth });
  return crewId;
}

describe("radar (N-01 to N-03)", () => {
  it("shows a status to the crew and to nobody else", async () => {
    const [jade, malik, stranger] = [await account("jade"), await account("malik"), await account("stranger")];
    const crewId = await crewOf(jade, malik);
    await crewOf(stranger);
    const radar0 = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/radar`, headers: jade.auth })).json() as { tonight: string };
    await app.inject({ method: "PUT", url: "/v1/status", headers: jade.auth, payload: { night: radar0.tonight, status: "going_out", fromMinute: 1320, place: "Le Zinc" } });
    const radar = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/radar`, headers: malik.auth })).json() as { statuses: { userId: string; status: string; place: string }[]; nights: string[] };
    expect(radar.nights).toHaveLength(7);
    expect(radar.statuses).toEqual([expect.objectContaining({ userId: jade.id, status: "going_out", place: "Le Zinc" })]);
    expect((await app.inject({ method: "GET", url: `/v1/crews/${crewId}/radar`, headers: stranger.auth })).statusCode).toBe(404);
  });

  it("turns replies to 'who's in?' into statuses", async () => {
    const [jade, malik] = [await account("jade"), await account("malik")];
    const crewId = await crewOf(jade, malik);
    const { id } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/out-calls`, headers: jade.auth, payload: { note: "Le Zinc vers 22 h" } })).json() as { id: string };
    await app.inject({ method: "POST", url: `/v1/out-calls/${id}/reply`, headers: malik.auth, payload: { reply: "in" } });
    const radar = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/radar`, headers: jade.auth })).json() as {
      calls: { replies: { userId: string; reply: string }[] }[];
      statuses: { userId: string; status: string }[];
    };
    expect(radar.calls[0]!.replies).toEqual([{ userId: malik.id, reply: "in" }]);
    expect(radar.statuses.map((s) => s.status).sort()).toEqual(["going_out", "going_out"]);
  });
});

describe("SOS (N-28)", () => {
  it("alerts the crew with the location, and nobody outside it", async () => {
    const [jade, malik, stranger] = [await account("jade"), await account("malik"), await account("stranger")];
    await crewOf(jade, malik);
    await crewOf(stranger);
    const sent = await app.inject({ method: "POST", url: "/v1/sos", headers: jade.auth, payload: { location: { lat: 48.86, lng: 2.38, accuracy: 20 } } });
    expect(sent.statusCode).toBe(201);
    const seen = (await app.inject({ method: "GET", url: "/v1/sos", headers: malik.auth })).json() as { alerts: { name: string; location: { lat: number } | null }[] };
    expect(seen.alerts[0]).toMatchObject({ name: "jade", location: { lat: 48.86 } });
    const outside = (await app.inject({ method: "GET", url: "/v1/sos", headers: stranger.auth })).json() as { alerts: unknown[] };
    expect(outside.alerts).toEqual([]);
    const raw = JSON.stringify(await db.query("select * from sos_alerts"));
    expect(raw).not.toContain("48.86");
    const id = (sent.json() as { ids: string[] }).ids[0]!;
    await app.inject({ method: "POST", url: `/v1/sos/${id}/resolve`, headers: malik.auth });
    const [row] = await db.query<{ sealed_location: string | null }>("select sealed_location from sos_alerts where id = $1", [id]);
    expect(row!.sealed_location).toBeNull();
  });
});
