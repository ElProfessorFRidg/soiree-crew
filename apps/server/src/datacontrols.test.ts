import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { csvCell, exportToCsv } from "./csv";
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
const mutate = (u: User, mutation: Record<string, unknown>) => app.inject({ method: "POST", url: "/v1/mutations", headers: u.auth, payload: { mutations: [{ key: randomUUID(), mutation }] } });
const addDrink = (u: User) =>
  mutate(u, { kind: "drink.add", drink: { id: randomUUID(), presetId: "m-pint", kind: "pint", volumeMl: 500, abv: 0.05, consumedAt: clock, loggedAt: clock, withFood: false } });
const addWater = (u: User) => mutate(u, { kind: "water.add", water: { id: randomUUID(), at: clock } });

describe("CSV cells and file (N-17)", () => {
  it("quotes what needs it and never lets a spreadsheet run a formula", () => {
    expect(csvCell('Le "Zinc", Paris')).toBe('"Le ""Zinc"", Paris"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(-12)).toBe("-12");
    expect(csvCell(null)).toBe("");
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"');
  });
  it("puts every record on its own row with its category first", () => {
    const csv = exportToCsv({ exportedAt: 1, account: { id: "u", username: "jade" }, drinks: [{ id: "d1", kind: "pint" }], water: [] });
    expect(csv.split("\r\n")).toEqual(["category,id,username,kind", "account,u,jade,", "drinks,d1,,pint", ""]);
  });
});

describe("export and erasing one kind of data (N-17)", () => {
  it("exports CSV next to JSON", async () => {
    const jade = await account("jade");
    await addDrink(jade);
    const res = (await app.inject({ method: "GET", url: "/v1/me/export?format=csv", headers: jade.auth })).json() as { csv: string };
    const lines = res.csv.split("\r\n");
    expect(lines[0]!.startsWith("category,")).toBe(true);
    expect(lines.filter((l) => l.startsWith("drinks,"))).toHaveLength(1);
    expect(lines.some((l) => l.startsWith("account,"))).toBe(true);
    expect((await app.inject({ method: "GET", url: "/v1/me/export?format=xml", headers: jade.auth })).statusCode).toBe(400);
  });

  it("erases drinks and keeps water, the body profile and everyone else's drinks", async () => {
    const jade = await account("jade");
    const malik = await account("malik");
    await addDrink(jade);
    await addWater(jade);
    await addDrink(malik);
    await mutate(jade, { kind: "profile.set", profile: { weightKg: 60, heightCm: 168, bodyModel: "female", declaredBody: "female", healthConsentAt: clock } });

    expect((await app.inject({ method: "DELETE", url: "/v1/me/data/drinks", headers: jade.auth })).statusCode).toBe(204);
    const data = (await app.inject({ method: "GET", url: "/v1/me/export", headers: jade.auth })).json() as { drinks: unknown[]; water: unknown[]; bodyProfile: unknown };
    expect(data.drinks).toEqual([]);
    expect(data.water).toHaveLength(1);
    expect(data.bodyProfile).toMatchObject({ weightKg: 60 });
    // The tombstone reaches my other phones on their next sync.
    const sync = (await app.inject({ method: "GET", url: "/v1/sync?since=0", headers: jade.auth })).json() as { drinks: { deleted?: boolean }[]; water: unknown[] };
    expect(sync.drinks.every((d) => d.deleted)).toBe(true);
    expect(sync.water).toHaveLength(1);
    const theirs = await db.query<{ n: number }>("select count(*)::int as n from drinks where user_id = $1 and deleted_at is null", [malik.id]);
    expect(theirs[0]!.n).toBe(1);
  });

  it("erases check-ins and keeps drinks, water and night statuses", async () => {
    const jade = await account("jade");
    const crewId = ((await app.inject({ method: "POST", url: "/v1/crews", headers: jade.auth, payload: { name: "Crew" } })).json() as { crew: { id: string } }).crew.id;
    const venueId = randomUUID();
    await app.inject({ method: "POST", url: `/v1/crews/${crewId}/venues`, headers: jade.auth, payload: { id: venueId, name: "Le Zinc", kind: "bar", lat: 48.85, lng: 2.35 } });
    await db.query(
      `insert into check_ins (id, user_id, venue_id, at, last_proof_at, verdict, risk, signals, config_version, fix_hash, created_at)
       values ($1, $2, $3, $4, $4, 'accepted', 0, '[]', 1, 'h', $4)`,
      [randomUUID(), jade.id, venueId, clock],
    );
    await db.query("insert into night_statuses (user_id, night, status, updated_at) values ($1, '2026-11-07', 'going_out', $2)", [jade.id, clock]);
    await addDrink(jade);
    await addWater(jade);

    expect((await app.inject({ method: "DELETE", url: "/v1/me/data/checkIns", headers: jade.auth })).statusCode).toBe(204);
    const count = async (table: string) => (await db.query<{ n: number }>(`select count(*)::int as n from ${table} where user_id = $1`, [jade.id]))[0]!.n;
    expect(await count("check_ins")).toBe(0);
    expect(await count("night_statuses")).toBe(1);
    expect((await db.query<{ n: number }>("select count(*)::int as n from drinks where user_id = $1 and deleted_at is null", [jade.id]))[0]!.n).toBe(1);
    expect((await db.query<{ n: number }>("select count(*)::int as n from water where user_id = $1 and deleted_at is null", [jade.id]))[0]!.n).toBe(1);

    expect((await app.inject({ method: "DELETE", url: "/v1/me/data/nightStatuses", headers: jade.auth })).statusCode).toBe(204);
    expect(await count("night_statuses")).toBe(0);
    expect((await db.query<{ n: number }>("select count(*)::int as n from drinks where user_id = $1 and deleted_at is null", [jade.id]))[0]!.n).toBe(1);
  });

  it("refuses an unknown category and does not offer shared expenses", async () => {
    const jade = await account("jade");
    expect((await app.inject({ method: "DELETE", url: "/v1/me/data/expenses", headers: jade.auth })).statusCode).toBe(400);
    expect((await app.inject({ method: "DELETE", url: "/v1/me/data/everything", headers: jade.auth })).statusCode).toBe(400);
    expect((await app.inject({ method: "DELETE", url: "/v1/me/data/drinks" })).statusCode).toBe(401);
  });
});
