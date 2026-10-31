import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";

let clock = Date.UTC(2026, 9, 24, 20, 0);
let db: Db;
let app: FastifyInstance;

async function boot(isPublic: boolean) {
  db = await connectPglite();
  await migrate(db);
  app = await buildApp({
    db,
    sealer: new Sealer(randomBytes(32).toString("base64")),
    live: new LiveHub(),
    now: () => clock,
    publicUrl: "https://crew.test",
    hashSecret: "test-secret",
    serverInfo: { name: "Crew test", description: "", public: isPublic },
  });
}

beforeEach(() => {
  clock = Date.UTC(2026, 9, 24, 20, 0);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

async function account(username: string) {
  const res = await app.inject({ method: "POST", url: "/v1/accounts", payload: { username, displayName: username.toUpperCase() } });
  expect(res.statusCode).toBe(201);
  const body = res.json() as { user: { id: string }; token: string };
  return { id: body.user.id, auth: { authorization: `Bearer ${body.token}` } };
}

async function crew(auth: Record<string, string>, payload: Record<string, unknown>) {
  const res = await app.inject({ method: "POST", url: "/v1/crews", headers: auth, payload });
  expect(res.statusCode).toBe(201);
  return (res.json() as { crew: { id: string } }).crew.id;
}

type Listing = { crews: Record<string, unknown>[] };
const listing = async (query = "", headers: Record<string, string> = {}) => app.inject({ method: "GET", url: `/v1/crews/open${query}`, headers });

describe("public crew listing", () => {
  it("is readable without an account on a public server and never shows who is in a crew", async () => {
    await boot(true);
    const jade = await account("jade");
    const malik = await account("malik");
    const bars = await crew(jade.auth, { name: "Les piliers", open: true, category: "bars", city: "  Lyon  " });
    await app.inject({ method: "POST", url: `/v1/crews/${bars}/join`, headers: malik.auth });
    await app.inject({ method: "PATCH", url: `/v1/crews/${bars}/settings`, headers: jade.auth, payload: { description: "Tous les jeudis\nà la Croix-Rousse" } });

    const res = await listing();
    expect(res.statusCode).toBe(200);
    const body = res.json() as Listing;
    expect(body.crews).toEqual([{ id: bars, name: "Les piliers", category: "bars", city: "Lyon", description: "Tous les jeudis à la Croix-Rousse", members: 2 }]);
    // Nothing about members travels: not their names, usernames or ids.
    const raw = res.body;
    for (const leak of ["jade", "malik", "JADE", "MALIK", jade.id, malik.id]) expect(raw).not.toContain(leak);
  });

  it("finds crews by name, city or description and filters by category", async () => {
    await boot(true);
    const jade = await account("jade");
    await crew(jade.auth, { name: "Les piliers", open: true, category: "bars", city: "Lyon" });
    await crew(jade.auth, { name: "Running du dimanche", open: true, category: "sport", city: "Nantes" });
    const names = async (query: string) => ((await listing(query)).json() as Listing).crews.map((c) => c.name);
    expect(await names("?q=lyon")).toEqual(["Les piliers"]);
    expect(await names("?q=dimanche")).toEqual(["Running du dimanche"]);
    expect(await names("?category=sport")).toEqual(["Running du dimanche"]);
    expect(await names("?q=lyon&category=sport")).toEqual([]);
    // A % typed in the search is a character, not a wildcard.
    expect(await names("?q=%25")).toEqual([]);
    expect((await listing("?category=nightclub")).statusCode).toBe(400);
  });

  it("never lists a private crew, and an admin turning one private takes it out at once", async () => {
    await boot(true);
    const jade = await account("jade");
    await crew(jade.auth, { name: "La coloc", category: "flatmates" });
    const open = await crew(jade.auth, { name: "BDE Info", open: true, category: "students" });
    expect(((await listing()).json() as Listing).crews.map((c) => c.id)).toEqual([open]);

    const off = await app.inject({ method: "PATCH", url: `/v1/crews/${open}/settings`, headers: jade.auth, payload: { open: false } });
    expect(off.statusCode).toBe(200);
    expect(((await listing()).json() as Listing).crews).toEqual([]);
    // Joining needs an account, and a private crew answers like an unknown one.
    const noor = await account("noor");
    expect((await app.inject({ method: "POST", url: `/v1/crews/${open}/join` })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: `/v1/crews/${open}/join`, headers: noor.auth })).statusCode).toBe(404);
  });

  it("leaves out the crews I am already in once signed in", async () => {
    await boot(true);
    const jade = await account("jade");
    const noor = await account("noor");
    const open = await crew(jade.auth, { name: "BDE Info", open: true });
    expect(((await listing("", jade.auth)).json() as Listing).crews).toEqual([]);
    expect(((await listing("", noor.auth)).json() as Listing).crews.map((c) => c.id)).toEqual([open]);
  });

  it("stays closed to visitors without an account on a private server", async () => {
    await boot(false);
    const jade = await account("jade");
    await crew(jade.auth, { name: "BDE Info", open: true });
    expect((await listing()).statusCode).toBe(401);
    const noor = await account("noor");
    expect((await listing("", noor.auth)).statusCode).toBe(200);
  });

  it("is rate limited per address", async () => {
    await boot(true);
    for (let i = 0; i < 60; i += 1) expect((await listing()).statusCode).toBe(200);
    expect((await listing()).statusCode).toBe(429);
    // The window passes, the address may search again.
    clock += 61_000;
    expect((await listing()).statusCode).toBe(200);
  });
});

describe("crew visibility and listing details", () => {
  it("only an admin switches public or private and sets category, city and description", async () => {
    await boot(true);
    const jade = await account("jade");
    const malik = await account("malik");
    const id = await crew(jade.auth, { name: "Les piliers" });
    const { code } = (await app.inject({ method: "POST", url: `/v1/crews/${id}/invites`, headers: jade.auth })).json() as { code: string };
    await app.inject({ method: "POST", url: `/v1/invites/${code}/accept`, headers: malik.auth });

    for (const payload of [{ open: true }, { category: "bars" }, { city: "Lyon" }, { description: "Le jeudi" }]) {
      expect((await app.inject({ method: "PATCH", url: `/v1/crews/${id}/settings`, headers: malik.auth, payload })).statusCode).toBe(403);
    }
    const outsider = await account("noor");
    expect((await app.inject({ method: "PATCH", url: `/v1/crews/${id}/settings`, headers: outsider.auth, payload: { open: true } })).statusCode).toBe(404);
    expect(((await listing()).json() as Listing).crews).toEqual([]);

    const res = await app.inject({ method: "PATCH", url: `/v1/crews/${id}/settings`, headers: jade.auth, payload: { open: true, category: "bars", city: "Lyon", description: "Le jeudi" } });
    expect(res.statusCode).toBe(200);
    const mine = (await app.inject({ method: "GET", url: "/v1/crews", headers: malik.auth })).json() as { crews: { open: boolean; category: string; city: string; description: string }[] };
    expect(mine.crews[0]).toMatchObject({ open: true, category: "bars", city: "Lyon", description: "Le jeudi" });

    // Cleared fields go back to empty.
    await app.inject({ method: "PATCH", url: `/v1/crews/${id}/settings`, headers: jade.auth, payload: { category: null, city: "" } });
    expect(((await listing()).json() as Listing).crews[0]).toMatchObject({ category: null, city: null });
  });

  it("validates and caps the listing fields", async () => {
    await boot(true);
    const jade = await account("jade");
    const id = await crew(jade.auth, { name: "Les piliers", open: true });
    const patch = (payload: Record<string, unknown>) => app.inject({ method: "PATCH", url: `/v1/crews/${id}/settings`, headers: jade.auth, payload });
    expect((await patch({ city: "x".repeat(61) })).statusCode).toBe(400);
    expect((await patch({ description: "x".repeat(201) })).statusCode).toBe(400);
    expect((await patch({ category: "nightclub" })).statusCode).toBe(400);
    // Public text goes through the same filters as reviews: no phone number in a description.
    expect((await patch({ description: "Appelle le 06 12 34 56 78" })).statusCode).toBe(422);
    expect((await app.inject({ method: "POST", url: "/v1/crews", headers: jade.auth, payload: { name: "Lyon", city: "y".repeat(61) } })).statusCode).toBe(400);
  });
});
