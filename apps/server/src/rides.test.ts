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
