import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GribouilleView } from "@crew/games";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";

let clock = Date.UTC(2026, 10, 6, 21, 0);
let db: Db;
let app: FastifyInstance;
let live: LiveHub;
const heard: { userId: string; payload: string }[] = [];

beforeEach(async () => {
  clock = Date.UTC(2026, 10, 6, 21, 0);
  heard.length = 0;
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
  const body = (await app.inject({ method: "POST", url: "/v1/accounts", payload: { birthDate: "1990-01-01", username, displayName: username } })).json() as { user: { id: string }; token: string };
  const user = { id: body.user.id, auth: { authorization: `Bearer ${body.token}` } };
  live.add(user.id, { send: (payload) => heard.push({ userId: user.id, payload }) });
  return user;
}

const call = (user: User, method: "GET" | "POST", url: string, payload?: object) =>
  payload === undefined ? app.inject({ method, url, headers: user.auth }) : app.inject({ method, url, headers: user.auth, payload });
const view = async (user: User, id: string, since = 0) => (await call(user, "GET", `/v1/gribouille/${id}?since=${since}`)).json() as GribouilleView;

async function table(names: string[]) {
  const users = await Promise.all(names.map(account));
  const created = await call(users[0]!, "POST", "/v1/gribouille", { language: "en", level: "normal", rounds: 1 });
  expect(created.statusCode).toBe(201);
  const room = created.json() as GribouilleView;
  for (const user of users.slice(1)) expect((await call(user, "POST", "/v1/gribouille/join", { code: room.code.toLowerCase() })).statusCode).toBe(200);
  return { users, id: room.id, code: room.code };
}

/** Every phone polls, as the app does. */
const pollAll = (users: User[], id: string) => Promise.all(users.map((u) => view(u, id)));

describe("Gribouille rooms", () => {
  it("starts with 3 players, hides the word from guessers and scores a correct guess on the server", async () => {
    const { users, id } = await table(["ann", "bob", "cat"]);
    expect((await call(users[1]!, "POST", `/v1/gribouille/${id}/start`)).statusCode).toBe(403);
    expect((await call(users[0]!, "POST", `/v1/gribouille/${id}/start`)).statusCode).toBe(200);

    const views = await Promise.all(users.map((u) => view(u, id)));
    const drawerIndex = views[0]!.turn!.drawerId === users[0]!.id ? 0 : views[0]!.turn!.drawerId === users[1]!.id ? 1 : 2;
    const word = views[drawerIndex]!.turn!.word!;
    expect(word).toBeTruthy();
    views.forEach((v, i) => {
      if (i !== drawerIndex) {
        expect(v.turn!.word).toBeNull();
        expect(JSON.stringify(v)).not.toContain(`"${word}"`);
      }
    });

    const guesser = users[(drawerIndex + 1) % 3]!;
    const other = users[(drawerIndex + 2) % 3]!;
    expect((await call(users[drawerIndex]!, "POST", `/v1/gribouille/${id}/guess`, { text: word })).json()).toMatchObject({ result: "ignored" });
    expect((await call(guesser, "POST", `/v1/gribouille/${id}/guess`, { text: "definitely not it" })).json()).toMatchObject({ result: "wrong" });
    clock += 10_000;
    const right = (await call(guesser, "POST", `/v1/gribouille/${id}/guess`, { text: word })).json() as { result: string; points: number };
    expect(right.result).toBe("correct");
    expect(right.points).toBeGreaterThan(100);

    const afterwards = await view(other, id);
    expect(afterwards.players.find((p) => p.id === guesser.id)!.score).toBe(right.points);
    expect(afterwards.players.find((p) => p.id === users[drawerIndex]!.id)!.score).toBe(50);
    expect(afterwards.turn!.word).toBeNull();
    expect(afterwards.feed.map((l) => l.kind)).toEqual(["guess", "found"]);
  });

  it("takes strokes from the drawer only and gives guessers the ones after their cursor", async () => {
    const { users, id } = await table(["ann", "bob", "cat"]);
    await call(users[0]!, "POST", `/v1/gribouille/${id}/start`);
    const first = await view(users[0]!, id);
    const drawer = users.find((u) => u.id === first.turn!.drawerId)!;
    const guesser = users.find((u) => u.id !== drawer.id)!;
    const start = { type: "stroke.start", id: "s1", colour: "#2F6F8F", width: 0.016, point: { x: 0.1, y: 0.2 } };
    const extend = { type: "stroke.extend", id: "s1", points: [{ x: 0.2, y: 0.3 }, { x: 0.3, y: 0.4 }] };
    expect((await call(guesser, "POST", `/v1/gribouille/${id}/strokes`, { events: [start] })).statusCode).toBe(403);
    expect((await call(drawer, "POST", `/v1/gribouille/${id}/strokes`, { events: [{ ...start, point: { x: 4, y: 0 } }] })).statusCode).toBe(400);
    const sent = await call(drawer, "POST", `/v1/gribouille/${id}/strokes`, { events: [start, extend, { ...extend, points: [{ x: 0.5, y: 0.5 }] }] });
    expect(sent.json()).toEqual({ count: 2 });
    heard.length = 0;
    await call(drawer, "POST", `/v1/gribouille/${id}/strokes`, { events: [{ type: "undo" }] });
    expect(heard.some((h) => h.userId === guesser.id && h.payload.includes("gribouille.changed"))).toBe(true);
    expect(heard.some((h) => h.userId === drawer.id)).toBe(false);
    expect((await view(guesser, id, 0)).turn!.events).toHaveLength(3);
    expect((await view(guesser, id, 2)).turn!.events).toEqual([{ type: "undo" }]);
  });

  it("ends the turn when time is up, reveals the word, then moves on and finishes", async () => {
    const { users, id } = await table(["ann", "bob", "cat"]);
    await call(users[0]!, "POST", `/v1/gribouille/${id}/start`);
    for (let turn = 0; turn < 3; turn++) {
      clock += 75_000;
      const views = await pollAll(users, id);
      expect(views[0]!.phase).toBe("reveal");
      expect(views[0]!.turn!.word).toBeTruthy();
      expect(views[0]!.turn!.endReason).toBe("timeUp");
      clock += 7_000;
      await pollAll(users, id);
    }
    const last = await view(users[2]!, id);
    expect(last.phase).toBe("end");
    expect(last.ranking).toHaveLength(3);
  });

  it("lets a phone that dropped come back and carry on", async () => {
    const { users, id, code } = await table(["ann", "bob", "cat"]);
    await call(users[0]!, "POST", `/v1/gribouille/${id}/start`);
    const first = await view(users[0]!, id);
    const guesserIndex = users.findIndex((u) => u.id !== first.turn!.drawerId);
    clock += 25_000;
    // The guesser's phone was off; the others went on polling.
    await Promise.all(users.filter((_, i) => i !== guesserIndex).map((u) => view(u, id)));
    const during = await view(users[(guesserIndex + 1) % 3]!, id);
    expect(during.players.find((p) => p.id === users[guesserIndex]!.id)!.connected).toBe(false);
    expect(during.phase).toBe("drawing");
    const back = await call(users[guesserIndex]!, "POST", "/v1/gribouille/join", { code });
    expect(back.statusCode).toBe(200);
    expect((back.json() as GribouilleView).players.find((p) => p.id === users[guesserIndex]!.id)!.connected).toBe(true);
  });

  it("refuses strangers and late joiners", async () => {
    const { users, id, code } = await table(["ann", "bob", "cat"]);
    const outsider = await account("dan");
    expect((await call(outsider, "GET", `/v1/gribouille/${id}`)).statusCode).toBe(404);
    expect((await call(outsider, "POST", "/v1/gribouille/join", { code: "ZZZZ" })).statusCode).toBe(404);
    await call(users[0]!, "POST", `/v1/gribouille/${id}/start`);
    expect((await call(outsider, "POST", "/v1/gribouille/join", { code })).statusCode).toBe(409);

  });

  it("shows a crew's waiting lobby to its members only", async () => {
    const [ann, bob, eve] = await Promise.all(["ann", "bob", "eve"].map(account)) as [User, User, User];
    const crewId = ((await call(ann, "POST", "/v1/crews", { name: "Les Quais" })).json() as { crew: { id: string } }).crew.id;
    const { code } = (await call(ann, "POST", `/v1/crews/${crewId}/invites`)).json() as { code: string };
    await call(bob, "POST", `/v1/invites/${code}/accept`);
    const created = await call(ann, "POST", "/v1/gribouille", { crewId, language: "fr", level: "hard", rounds: 2 });
    expect(created.statusCode).toBe(201);
    expect(heard.some((h) => h.userId === bob.id && h.payload.includes("gribouille.changed"))).toBe(true);
    expect(((await call(bob, "GET", "/v1/gribouille/open")).json() as { rooms: { id: string }[] }).rooms).toHaveLength(1);
    expect(((await call(eve, "GET", "/v1/gribouille/open")).json() as { rooms: unknown[] }).rooms).toHaveLength(0);
    expect((await call(eve, "POST", "/v1/gribouille", { crewId, language: "fr" })).statusCode).toBe(404);
  });

  it("hides filtered guesses from the feed", async () => {
    const { users, id } = await table(["ann", "bob", "cat"]);
    await call(users[0]!, "POST", `/v1/gribouille/${id}/start`);
    const first = await view(users[0]!, id);
    const guesser = users.find((u) => u.id !== first.turn!.drawerId)!;
    await call(guesser, "POST", `/v1/gribouille/${id}/guess`, { text: "connard" });
    const feed = (await view(users[0]!, id)).feed;
    expect(feed).toHaveLength(1);
    expect(feed[0]!.text).toBeUndefined();
  });
});
