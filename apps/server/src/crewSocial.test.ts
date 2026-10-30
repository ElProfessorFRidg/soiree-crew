import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub, type LiveEvent } from "./live";
import { cleanNickname } from "./routes/crews";

let db: Db;
let app: FastifyInstance;
let live: LiveHub;
let clock = Date.UTC(2026, 10, 7, 19, 0);
const HOUR = 3_600_000;
const ZINC = { lat: 48.8566, lng: 2.3522 };

beforeEach(async () => {
  clock = Date.UTC(2026, 10, 7, 19, 0);
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
  const body = (await app.inject({ method: "POST", url: "/v1/accounts", payload: { username, displayName: username } })).json() as {
    user: { id: string };
    token: string;
  };
  return { id: body.user.id, auth: { authorization: `Bearer ${body.token}` } };
}
async function crewOf(...users: User[]) {
  const crewId = ((await app.inject({ method: "POST", url: "/v1/crews", headers: users[0]!.auth, payload: { name: "Crew" } })).json() as { crew: { id: string } }).crew.id;
  const { code } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/invites`, headers: users[0]!.auth })).json() as { code: string };
  for (const u of users.slice(1)) await app.inject({ method: "POST", url: `/v1/invites/${code}/accept`, headers: u.auth });
  return crewId;
}
async function partyOf(user: User, crewId: string, name = "Ce soir") {
  const id = randomUUID();
  const res = await app.inject({
    method: "POST",
    url: "/v1/parties",
    headers: user.auth,
    payload: { id, crewId, name, mood: "party", kind: "party", startsAt: clock + HOUR, endsAt: clock + 6 * HOUR },
  });
  expect(res.statusCode).toBe(201);
  return id;
}
function listen(user: User): LiveEvent[] {
  const events: LiveEvent[] = [];
  live.add(user.id, { send: (data) => events.push(JSON.parse(data) as LiveEvent) });
  return events;
}

describe("nicknames (QOL-11)", () => {
  it("lets any crew member name a crew mate, shows who did, and refuses outsiders", async () => {
    const [jade, malik, stranger] = [await account("jade"), await account("malik"), await account("stranger")];
    const crewId = await crewOf(jade, malik);
    const set = await app.inject({ method: "PUT", url: `/v1/crews/${crewId}/members/${jade.id}/nickname`, headers: malik.auth, payload: { nickname: "  La  Reine " } });
    expect(set.json()).toEqual({ nickname: "La Reine" });
    const crews = (await app.inject({ method: "GET", url: "/v1/crews", headers: jade.auth })).json() as { crews: { members: { id: string; nickname: string | null; nicknameSetBy: string | null }[] }[] };
    expect(crews.crews[0]!.members.find((m) => m.id === jade.id)).toMatchObject({ nickname: "La Reine", nicknameSetBy: malik.id });
    expect((await app.inject({ method: "PUT", url: `/v1/crews/${crewId}/members/${jade.id}/nickname`, headers: stranger.auth, payload: { nickname: "x" } })).statusCode).toBe(404);
    expect((await app.inject({ method: "PUT", url: `/v1/crews/${crewId}/members/${stranger.id}/nickname`, headers: jade.auth, payload: { nickname: "x" } })).statusCode).toBe(404);
    expect((await app.inject({ method: "PUT", url: `/v1/crews/${crewId}/members/${jade.id}/nickname`, headers: malik.auth, payload: { nickname: "x".repeat(25) } })).statusCode).toBe(400);
    // Clearing, or giving the name itself, removes the nickname.
    await app.inject({ method: "PUT", url: `/v1/crews/${crewId}/members/${jade.id}/nickname`, headers: jade.auth, payload: { nickname: "JADE" } });
    const after = (await app.inject({ method: "GET", url: "/v1/crews", headers: jade.auth })).json() as { crews: { members: { id: string; nickname: string | null }[] }[] };
    expect(after.crews[0]!.members.find((m) => m.id === jade.id)!.nickname).toBeNull();
  });

  it("strips invisible and direction characters", () => {
    const hidden = String.fromCharCode(0x202e) + "abc" + String.fromCharCode(0x200b) + "\n d";
    expect(cleanNickname(hidden)).toBe("abc d");
  });
});

describe("crew feed (N-31)", () => {
  it("folds runs into a digest and takes reactions and comments with mentions", async () => {
    const [jade, malik, ines] = [await account("jade"), await account("malik"), await account("ines")];
    const crewId = await crewOf(jade, malik, ines);
    clock += 60_000;
    for (const name of ["Un", "Deux", "Trois"]) {
      await partyOf(jade, crewId, name);
      clock += 60_000;
    }
    type Item = { kind: string; key: string; of?: string; count?: number; items?: Item[]; reactions: { reaction: string; count: number; mine: boolean }[]; comments: { text: string; mentions: string[] }[]; mentionsMe: boolean };
    const feed = async (u: User) => (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/feed`, headers: u.auth })).json() as { items: Item[]; unseenMentions: number };
    const first = await feed(malik);
    const digest = first.items.find((i) => i.kind === "digest");
    expect(digest).toMatchObject({ of: "party", count: 3 });
    const inner = digest!.items![0]!;

    expect((await app.inject({ method: "PUT", url: `/v1/crews/${crewId}/feed/reactions`, headers: malik.auth, payload: { key: inner.key, reaction: "fire", on: true } })).statusCode).toBe(200);
    expect((await app.inject({ method: "PUT", url: `/v1/crews/${crewId}/feed/reactions`, headers: malik.auth, payload: { key: "party:made-up", reaction: "fire", on: true } })).statusCode).toBe(404);
    expect((await app.inject({ method: "PUT", url: `/v1/crews/${crewId}/feed/reactions`, headers: malik.auth, payload: { key: inner.key, reaction: "poop", on: true } })).statusCode).toBe(400);

    const heard = listen(ines);
    const outsider = await account("outsider");
    const comment = await app.inject({
      method: "POST",
      url: `/v1/crews/${crewId}/feed/comments`,
      headers: malik.auth,
      payload: { key: inner.key, text: "@ines tu viens ?", mentions: [ines.id, outsider.id, malik.id] },
    });
    expect(comment.statusCode).toBe(201);
    expect((comment.json() as { mentions: string[] }).mentions).toEqual([ines.id]);
    expect(heard).toContainEqual({ type: "feed.changed", crewId, mention: true });

    const seenByInes = await feed(ines);
    const line = seenByInes.items.find((i) => i.kind === "digest")!.items!.find((i) => i.key === inner.key)!;
    expect(line.reactions).toEqual([{ reaction: "fire", count: 1, mine: false }]);
    expect(line.comments[0]).toMatchObject({ text: "@ines tu viens ?", mentions: [ines.id] });
    expect(line.mentionsMe).toBe(true);
    expect(seenByInes.unseenMentions).toBe(1);
    const counts = (await app.inject({ method: "GET", url: "/v1/invitations", headers: ines.auth })).json() as { mentions: Record<string, number> };
    expect(counts.mentions[crewId]).toBe(1);
    await app.inject({ method: "POST", url: `/v1/crews/${crewId}/feed/seen`, headers: ines.auth });
    expect((await feed(ines)).unseenMentions).toBe(0);
    expect((await app.inject({ method: "GET", url: `/v1/crews/${crewId}/feed`, headers: outsider.auth })).statusCode).toBe(404);
  });
});

describe("guests and open parties (COM-05)", () => {
  it("invites someone and their crew, within their request setting and blocks", async () => {
    const [jade, malik, theo, sami] = [await account("jade"), await account("malik"), await account("theo"), await account("sami")];
    const crewId = await crewOf(jade, malik);
    const theirCrew = await crewOf(theo, sami);
    const partyId = await partyOf(jade, crewId);

    await app.inject({ method: "PUT", url: "/v1/me/profile", headers: theo.auth, payload: { requestsFrom: "nobody" } });
    const closed = await app.inject({ method: "POST", url: `/v1/parties/${partyId}/guests`, headers: malik.auth, payload: { userId: theo.id, withCrew: true } });
    expect(closed.statusCode).toBe(403);
    await app.inject({ method: "PUT", url: "/v1/me/profile", headers: theo.auth, payload: { requestsFrom: "everyone" } });
    const heard = listen(theo);
    const invited = await app.inject({ method: "POST", url: `/v1/parties/${partyId}/guests`, headers: malik.auth, payload: { userId: theo.id, withCrew: true } });
    expect(invited.statusCode).toBe(201);
    expect(heard).toContainEqual({ type: "invites.changed" });

    const counts = (await app.inject({ method: "GET", url: "/v1/invitations", headers: theo.auth })).json() as { partyInvites: number; total: number };
    expect(counts).toMatchObject({ partyInvites: 1, total: 1 });
    const parties = (await app.inject({ method: "GET", url: "/v1/parties", headers: theo.auth })).json() as { parties: { id: string; guest?: { invitedBy: string; mayBringCrew: boolean } }[] };
    expect(parties.parties[0]).toMatchObject({ id: partyId, guest: { invitedBy: "malik", mayBringCrew: true } });
    expect((await app.inject({ method: "POST", url: `/v1/parties/${partyId}/response`, headers: theo.auth, payload: { response: "going" } })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: `/v1/parties/${partyId}/live`, headers: theo.auth })).statusCode).toBe(200);

    const brought = await app.inject({ method: "POST", url: `/v1/parties/${partyId}/bring-crew`, headers: theo.auth, payload: { crewId: theirCrew } });
    expect(brought.json()).toEqual({ invited: 1 });
    expect((await app.inject({ method: "POST", url: `/v1/parties/${partyId}/bring-crew`, headers: theo.auth, payload: { crewId: theirCrew } })).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: "/v1/invitations", headers: sami.auth })).json()).toMatchObject({ partyInvites: 1 });
    // A guest does not invite more guests.
    const other = await account("other");
    expect((await app.inject({ method: "POST", url: `/v1/parties/${partyId}/guests`, headers: theo.auth, payload: { userId: other.id } })).statusCode).toBe(404);

    // Blocked either way: the invitation finds nobody.
    await app.inject({ method: "POST", url: `/v1/users/${malik.id}/block`, headers: other.auth });
    expect((await app.inject({ method: "POST", url: `/v1/parties/${partyId}/guests`, headers: malik.auth, payload: { userId: other.id } })).statusCode).toBe(404);
  });

  it("opens a party at a venue, takes join requests, and lets the hosts decide", async () => {
    const [jade, malik, lea, max] = [await account("jade"), await account("malik"), await account("lea"), await account("max")];
    const crewId = await crewOf(jade, malik);
    const venueId = randomUUID();
    await app.inject({ method: "POST", url: `/v1/crews/${crewId}/venues`, headers: jade.auth, payload: { id: venueId, name: "Le Zinc", kind: "bar", ...ZINC } });
    const partyId = await partyOf(malik, crewId);

    // Only a host opens it, and only at a venue of the crew.
    expect((await app.inject({ method: "PUT", url: `/v1/parties/${partyId}/open`, headers: lea.auth, payload: { venueId } })).statusCode).toBe(404);
    expect((await app.inject({ method: "PUT", url: `/v1/parties/${partyId}/open`, headers: malik.auth, payload: { venueId } })).statusCode).toBe(200);

    const page = (await app.inject({ method: "GET", url: `/v1/places/${venueId}/open-parties`, headers: lea.auth })).json() as { parties: { id: string; mine: string | null; host: string }[] };
    expect(page.parties).toEqual([expect.objectContaining({ id: partyId, mine: null, host: "malik" })]);

    const hostHears = listen(jade);
    expect((await app.inject({ method: "POST", url: `/v1/parties/${partyId}/join-requests`, headers: lea.auth })).statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: `/v1/parties/${partyId}/join-requests`, headers: max.auth })).statusCode).toBe(201);
    expect(hostHears).toContainEqual({ type: "invites.changed" });
    const queue = (await app.inject({ method: "GET", url: "/v1/invitations", headers: jade.auth })).json() as { joinRequests: { userId: string }[]; total: number };
    expect(queue.joinRequests.map((r) => r.userId).sort()).toEqual([lea.id, max.id].sort());
    // Malik's party is also an invitation for Jade.
    expect(queue.total).toBe(3);
    expect((await app.inject({ method: "POST", url: `/v1/parties/${partyId}/join-requests/${lea.id}`, headers: jade.auth, payload: { approve: true } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: `/v1/parties/${partyId}/join-requests/${max.id}`, headers: malik.auth, payload: { approve: false } })).statusCode).toBe(200);

    const leaParties = (await app.inject({ method: "GET", url: "/v1/parties", headers: lea.auth })).json() as { parties: { id: string; myResponse: string }[] };
    expect(leaParties.parties).toEqual([expect.objectContaining({ id: partyId, myResponse: "going" })]);
    expect((await app.inject({ method: "POST", url: `/v1/parties/${partyId}/join-requests`, headers: max.auth })).statusCode).toBe(409);
    const maxPage = (await app.inject({ method: "GET", url: `/v1/places/${venueId}/open-parties`, headers: max.auth })).json() as { parties: { mine: string | null }[] };
    expect(maxPage.parties[0]!.mine).toBe("refused");

    // Closing it takes it off the page.
    await app.inject({ method: "PUT", url: `/v1/parties/${partyId}/open`, headers: malik.auth, payload: { venueId: null } });
    expect(((await app.inject({ method: "GET", url: `/v1/places/${venueId}/open-parties`, headers: max.auth })).json() as { parties: unknown[] }).parties).toEqual([]);
    expect((await app.inject({ method: "POST", url: `/v1/parties/${partyId}/join-requests`, headers: (await account("late")).auth })).statusCode).toBe(404);
  });
});
