import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";
import { winnerOf } from "./routes/games";

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
  const body = (await app.inject({ method: "POST", url: "/v1/accounts", payload: { username, displayName: username } })).json() as { user: { id: string }; token: string };
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
  // The crew's HQ counts for territories from the first night (TER-11).
  await db.query("update venues set is_hq = true where id = $1", [venueId]);
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

async function checkIn(user: User, venueId: string) {
  const res = await app.inject({
    method: "POST",
    url: "/v1/checkins",
    headers: user.auth,
    payload: { id: randomUUID(), venueId, lat: ZINC.lat + 0.00011, lng: ZINC.lng + 0.00007, accuracy: 15, mocked: false, deviceNow: clock },
  });
  return res.json() as { verdict: string };
}

interface ResultBody {
  id?: string;
  crewId: string;
  partyId?: string | null;
  gameId?: string;
  playedAt?: number;
  members: { userId: string; penalties: number }[];
  guests?: number[];
  record?: { key: string; userId: string; count: number } | null;
}

function post(user: User, body: ResultBody) {
  return app.inject({
    method: "POST",
    url: "/v1/games/results",
    headers: user.auth,
    payload: { id: randomUUID(), gameId: "bigDeck", playedAt: clock, guests: [], ...body },
  });
}

const myPoints = async (user: User, crewId: string) =>
  ((await app.inject({ method: "GET", url: `/v1/crews/${crewId}/venues`, headers: user.auth })).json() as { venues: { myPoints: number }[] }).venues[0]!.myPoints;

describe("game results (TER-02, RANK-05, N-24)", () => {
  it("names the winner from the penalties, never a tie, never a guest", () => {
    expect(winnerOf([{ userId: "a", penalties: 1 }, { userId: "b", penalties: 3 }], [])).toBe("a");
    expect(winnerOf([{ userId: "a", penalties: 2 }, { userId: "b", penalties: 2 }], [5])).toBeNull();
    expect(winnerOf([{ userId: "a", penalties: 2 }], [0])).toBeNull();
    expect(winnerOf([{ userId: "a", penalties: 0 }], [])).toBeNull();
  });

  it("records a game once, computes the winner and refuses strangers", async () => {
    const { users, crewId } = await setup("jade", "malik");
    const [jade, malik] = users as [User, User];
    const outsider = await account("theo");
    const id = randomUUID();
    const body = { id, crewId, members: [{ userId: jade.id, penalties: 4 }, { userId: malik.id, penalties: 1 }], guests: [6] };
    const first = await post(jade, body);
    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({ winnerId: malik.id, venueId: null });
    // A retry from the same phone is a no-op.
    expect((await post(jade, body)).statusCode).toBe(200);
    expect((await db.query("select 1 from game_results")).length).toBe(1);
    // Someone outside the crew, as reporter or as a player.
    expect((await post(outsider, { crewId, members: [{ userId: jade.id, penalties: 1 }], guests: [2] })).statusCode).toBe(404);
    expect((await post(jade, { crewId, members: [{ userId: outsider.id, penalties: 1 }], guests: [2] })).statusCode).toBe(403);
    // A game from three days ago is not accepted.
    expect((await post(jade, { crewId, playedAt: clock - 72 * 60 * MIN, members: [{ userId: jade.id, penalties: 1 }], guests: [2] })).statusCode).toBe(400);
  });

  it("gives territory points for a game won at the venue, from three members present (TER-02)", async () => {
    const { users, crewId, venueId, partyId } = await setup("jade", "malik", "ines");
    const [jade, malik, ines] = users as [User, User, User];
    for (const u of users) expect((await checkIn(u, venueId)).verdict).toBe("accepted");
    clock += 25 * MIN;
    const before = await myPoints(malik, crewId);
    expect(before).toBeGreaterThan(0);
    const members = [
      { userId: jade.id, penalties: 3 },
      { userId: malik.id, penalties: 0 },
      { userId: ines.id, penalties: 2 },
    ];
    const res = await post(jade, { crewId, partyId, members });
    expect(res.json()).toMatchObject({ winnerId: malik.id, venueId });
    expect(await myPoints(malik, crewId)).toBe(before + 5);
    // Two members and a guest: on the boards, but no territory points.
    await post(jade, { crewId, partyId, members: members.slice(0, 2), guests: [9] });
    expect(await myPoints(malik, crewId)).toBe(before + 5);
    // Capped at two wins a night per venue.
    await post(ines, { crewId, partyId, members });
    await post(ines, { crewId, partyId, members });
    expect(await myPoints(malik, crewId)).toBe(before + 10);
  });

  it("shares the hall of fame with the crew and feeds the boards and badges (N-24, RANK-05, N-34)", async () => {
    const { users, crewId } = await setup("jade", "malik");
    const [jade, malik] = users as [User, User];
    for (let i = 0; i < 5; i++) {
      await post(jade, {
        crewId,
        gameId: i < 3 ? "fuse" : "crash",
        members: [{ userId: jade.id, penalties: 3 }, { userId: malik.id, penalties: 1 }],
        record: i === 0 ? { key: "fuse.recordExplosions", userId: jade.id, count: 3 } : null,
      });
    }
    // A win against guests only is kept for the record but does not count.
    await post(jade, { crewId, members: [{ userId: jade.id, penalties: 0 }], guests: [2, 3] });

    const hall = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/games/hall`, headers: malik.auth })).json() as {
      games: { gameId: string; played: number; wins: { name: string; wins: number }[]; record: { name: string; count: number } | null }[];
      top: { name: string; wins: number }[];
    };
    expect(hall.top).toEqual([{ userId: malik.id, name: "malik", wins: 5 }]);
    const fuse = hall.games.find((g) => g.gameId === "fuse")!;
    expect(fuse.played).toBe(3);
    expect(fuse.wins[0]).toMatchObject({ name: "malik", wins: 3 });
    expect(fuse.record).toMatchObject({ name: "jade", count: 3 });

    const stats = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/stats`, headers: jade.auth })).json() as {
      boards: { userId: string; gamesWon: number }[];
      honours: { userId: string; badges: string[] }[];
    };
    expect(stats.boards.find((b) => b.userId === malik.id)?.gamesWon).toBe(5);
    expect(stats.boards.find((b) => b.userId === jade.id)?.gamesWon).toBe(0);
    expect(stats.honours.find((h) => h.userId === malik.id)?.badges).toContain("gameWinner");

    const board = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/leaderboard?period=all&metric=games`, headers: jade.auth })).json() as {
      rows: { userId: string; value: number; rank: number }[];
    };
    expect(board.rows[0]).toMatchObject({ userId: malik.id, value: 5, rank: 1 });
  });

  it("names last week's games champion in the honours (RANK-04)", async () => {
    const { users, crewId } = await setup("jade", "malik");
    const [jade, malik] = users as [User, User];
    await post(jade, { crewId, members: [{ userId: jade.id, penalties: 0 }, { userId: malik.id, penalties: 2 }] });
    clock += 8 * 24 * 60 * MIN;
    const stats = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/stats`, headers: malik.auth })).json() as {
      honours: { userId: string; badges: string[]; titles: { period: string; board: string }[] }[];
    };
    const honours = stats.honours.find((h) => h.userId === jade.id)!;
    expect(honours.titles).toContainEqual({ period: "week", board: "games" });
    expect(honours.badges).toContain("champion");
  });

  it("puts games and highlights in the recap timeline (N-22)", async () => {
    const { users, crewId, partyId } = await setup("jade", "malik");
    const [jade, malik] = users as [User, User];
    await post(jade, { crewId, partyId, gameId: "wheel", members: [{ userId: jade.id, penalties: 1 }, { userId: malik.id, penalties: 0 }] });
    const recap = (await app.inject({ method: "GET", url: `/v1/parties/${partyId}/recap`, headers: jade.auth })).json() as {
      timeline: { kind: string; gameId?: string; userId?: string }[];
    };
    expect(recap.timeline).toContainEqual(expect.objectContaining({ kind: "game", gameId: "wheel", userId: malik.id }));
  });
});
