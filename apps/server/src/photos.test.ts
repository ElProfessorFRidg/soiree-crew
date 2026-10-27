import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";

let db: Db;
let app: FastifyInstance;
let dir: string;
let clock = Date.UTC(2026, 10, 7, 21, 0);

beforeEach(async () => {
  clock = Date.UTC(2026, 10, 7, 21, 0);
  dir = mkdtempSync(join(tmpdir(), "crew-photos-"));
  db = await connectPglite();
  await migrate(db);
  app = await buildApp({ db, sealer: new Sealer(randomBytes(32).toString("base64")), live: new LiveHub(), now: () => clock, publicUrl: "https://crew.test", hashSecret: "s", uploadDir: dir });
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
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(400), Buffer.from([0xff, 0xd9])]).toString("base64");

describe("party album (N-21, O-84, QOL-09)", () => {
  it("keeps photos inside the party, behind links that expire", async () => {
    const [jade, malik, stranger] = (await Promise.all(["jade", "malik", "stranger"].map(account))) as [User, User, User];
    const crewId = ((await app.inject({ method: "POST", url: "/v1/crews", headers: jade.auth, payload: { name: "Crew" } })).json() as { crew: { id: string } }).crew.id;
    const { code } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/invites`, headers: jade.auth })).json() as { code: string };
    await app.inject({ method: "POST", url: `/v1/invites/${code}/accept`, headers: malik.auth });
    const partyId = randomUUID();
    await app.inject({ method: "POST", url: "/v1/parties", headers: jade.auth, payload: { id: partyId, crewId, name: "Samedi", mood: "party", kind: "party", startsAt: clock - 3_600_000, endsAt: clock + 3_600_000 } });
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/response`, headers: malik.auth, payload: { response: "going" } });

    const id = randomUUID();
    const up = await app.inject({ method: "POST", url: `/v1/parties/${partyId}/photos`, headers: jade.auth, payload: { id, data: JPEG, width: 1600, height: 1200 } });
    expect(up.statusCode).toBe(201);
    // Replayed upload: same answer, one photo.
    expect((await app.inject({ method: "POST", url: `/v1/parties/${partyId}/photos`, headers: jade.auth, payload: { id, data: JPEG, width: 1600, height: 1200 } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: `/v1/parties/${partyId}/photos`, headers: jade.auth, payload: { id: randomUUID(), data: Buffer.from("not a jpeg at all, just some text padding padding padding padding padding padding padding padding").toString("base64"), width: 10, height: 10 } })).statusCode).toBe(400);

    const list = (await app.inject({ method: "GET", url: `/v1/parties/${partyId}/photos`, headers: malik.auth })).json() as { photos: { id: string; url: string }[] };
    expect(list.photos).toHaveLength(1);
    expect((await app.inject({ method: "GET", url: `/v1/parties/${partyId}/photos`, headers: stranger.auth })).statusCode).toBe(404);

    const path = new URL(list.photos[0]!.url).pathname + new URL(list.photos[0]!.url).search;
    const image = await app.inject({ method: "GET", url: path });
    expect(image.statusCode).toBe(200);
    expect(image.headers["content-type"]).toBe("image/jpeg");
    expect((await app.inject({ method: "GET", url: path.replace(/sig=[^&]+/, "sig=forged") })).statusCode).toBe(404);
    clock += 2 * 3_600_000;
    expect((await app.inject({ method: "GET", url: path })).statusCode).toBe(404);

    expect((await app.inject({ method: "DELETE", url: `/v1/photos/${id}`, headers: malik.auth })).statusCode).toBe(404);
    expect((await app.inject({ method: "DELETE", url: `/v1/photos/${id}`, headers: jade.auth })).statusCode).toBe(204);
    expect(existsSync(join(dir, `${id}.jpg`))).toBe(false);
  });
});
