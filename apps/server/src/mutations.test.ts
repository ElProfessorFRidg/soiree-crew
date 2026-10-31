import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";
import { eventHash } from "./routes/mutations";

const clock = Date.UTC(2026, 10, 7, 21, 0);
let db: Db;
let app: FastifyInstance;

beforeEach(async () => {
  db = await connectPglite();
  await migrate(db);
  app = await buildApp({ db, sealer: new Sealer(randomBytes(32).toString("base64")), live: new LiveHub(), now: () => clock, publicUrl: "https://crew.test", hashSecret: "s" });
});
afterEach(async () => {
  await app.close();
  await db.close();
});

type Auth = { authorization: string };
async function account(username: string): Promise<Auth> {
  const body = (await app.inject({ method: "POST", url: "/v1/accounts", payload: { username, displayName: username } })).json() as { token: string };
  return { authorization: `Bearer ${body.token}` };
}
async function send(auth: Auth, key: string, mutation: unknown) {
  const res = await app.inject({ method: "POST", url: "/v1/mutations", headers: auth, payload: { mutations: [{ key, mutation }] } });
  expect(res.statusCode).toBe(200);
  return (res.json() as { results: { status: string; reason?: string }[] }).results[0]!;
}
const sync = async (auth: Auth) => (await app.inject({ method: "GET", url: "/v1/sync?since=0", headers: auth })).json() as Record<string, unknown>;

const drink = (id: string) => ({ id, presetId: "m-pint", kind: "pint", volumeMl: 500, abv: 0.05, consumedAt: clock - 60_000, loggedAt: clock, withFood: false });
const custom = (id: string) => ({ id, name: "Spritz maison", volumeMl: 250, abv: 0.11, icon: "wine", order: 1 });

/**
 * SYNC-08: every mutation kind, accepted, refused when malformed, idempotent on a
 * replayed key, and never applied to someone else's row.
 */
const CASES: {
  kind: string;
  valid: (id: string) => unknown;
  invalid: unknown;
  /** Where the accepted change shows up in delta sync. */
  check: (data: Record<string, unknown>, id: string) => boolean;
  /** A second user trying to touch the first user's row with the same id. */
  foreign?: (id: string) => unknown;
}[] = [
  {
    kind: "drink.add",
    valid: (id) => ({ kind: "drink.add", drink: drink(id) }),
    invalid: { kind: "drink.add", drink: { ...drink(randomUUID()), volumeMl: -1 } },
    check: (d, id) => (d.drinks as { id: string }[]).some((x) => x.id === id),
    foreign: (id) => ({ kind: "drink.add", drink: { ...drink(id), volumeMl: 50 } }),
  },
  {
    kind: "water.add",
    valid: (id) => ({ kind: "water.add", water: { id, at: clock - 60_000 } }),
    invalid: { kind: "water.add", water: { id: "not-a-uuid", at: clock } },
    check: (d, id) => (d.water as { id: string }[]).some((x) => x.id === id),
  },
  {
    kind: "profile.set",
    valid: () => ({ kind: "profile.set", profile: { weightKg: 70, bodyModel: "female", declaredBody: "female", healthConsentAt: clock } }),
    invalid: { kind: "profile.set", profile: { weightKg: 5, bodyModel: "female", declaredBody: "female", healthConsentAt: clock } },
    check: (d) => (d.profile as { weightKg?: number } | null)?.weightKg === 70,
  },
  {
    kind: "preferences.set",
    valid: () => ({ kind: "preferences.set", patch: { currency: "CHF", quietFromHour: 23 } }),
    invalid: { kind: "preferences.set", patch: { quietFromHour: 30 } },
    check: (d) => (d.preferences as { currency?: string } | null)?.currency === "CHF",
  },
  {
    kind: "customDrink.set",
    valid: (id) => ({ kind: "customDrink.set", drink: custom(id) }),
    invalid: { kind: "customDrink.set", drink: { ...custom(randomUUID()), name: "" } },
    check: (d, id) => (d.customDrinks as { id: string }[]).some((x) => x.id === id),
    foreign: (id) => ({ kind: "customDrink.set", drink: { ...custom(id), name: "Pris" } }),
  },
];

describe("every mutation (SYNC-08)", () => {
  for (const c of CASES) {
    it(`${c.kind}: accepted, refused when malformed, idempotent, owner only`, async () => {
      const jade = await account(`jade${c.kind.replace(".", "")}`.slice(0, 20).toLowerCase());
      const id = randomUUID();
      const key = randomUUID();

      expect(await send(jade, key, c.valid(id))).toMatchObject({ status: "accepted" });
      expect(c.check(await sync(jade), id)).toBe(true);

      // Same key again: same answer, nothing applied twice.
      expect(await send(jade, key, c.valid(id))).toMatchObject({ status: "accepted" });
      const after = await sync(jade);
      for (const list of ["drinks", "water", "customDrinks"]) {
        const rows = (after[list] as { id: string }[] | undefined) ?? [];
        expect(rows.filter((r) => r.id === id).length).toBeLessThanOrEqual(1);
      }

      expect(await send(jade, randomUUID(), c.invalid)).toMatchObject({ status: "rejected" });

      if (c.foreign) {
        const malik = await account(`malik${c.kind.replace(".", "")}`.slice(0, 20).toLowerCase());
        expect(await send(malik, randomUUID(), c.foreign(id))).toMatchObject({ status: "rejected" });
        expect(c.check(await sync(malik), id)).toBe(false);
      }
    });
  }

  it("removals are idempotent and only remove my own rows", async () => {
    const jade = await account("jaderm");
    const malik = await account("malikrm");
    const ids = { drink: randomUUID(), water: randomUUID(), custom: randomUUID() };
    await send(jade, randomUUID(), { kind: "drink.add", drink: drink(ids.drink) });
    await send(jade, randomUUID(), { kind: "water.add", water: { id: ids.water, at: clock - 60_000 } });
    await send(jade, randomUUID(), { kind: "customDrink.set", drink: custom(ids.custom) });

    const removals = [
      { kind: "drink.remove", drink: { id: ids.drink } },
      { kind: "water.remove", water: { id: ids.water } },
      { kind: "customDrink.remove", drink: { id: ids.custom } },
    ];
    // Someone else's removal changes nothing.
    for (const m of removals) await send(malik, randomUUID(), m);
    let data = await sync(jade);
    expect((data.drinks as { id: string; deleted?: boolean }[]).find((d) => d.id === ids.drink)?.deleted).toBeFalsy();

    for (const m of removals) {
      const key = randomUUID();
      expect(await send(jade, key, m)).toMatchObject({ status: "accepted" });
      expect(await send(jade, key, m)).toMatchObject({ status: "accepted" });
    }
    data = await sync(jade);
    expect((data.drinks as { id: string; deleted?: boolean }[]).find((d) => d.id === ids.drink)?.deleted).toBe(true);
    expect((data.water as { id: string; deleted?: boolean }[]).find((w) => w.id === ids.water)?.deleted).toBe(true);
    expect((data.customDrinks as { id: string; deleted?: boolean }[]).find((d) => d.id === ids.custom)?.deleted).toBe(true);
  });

  it("refuses a drink logged in the future and an unknown mutation kind", async () => {
    const jade = await account("jadefuture");
    expect(await send(jade, randomUUID(), { kind: "drink.add", drink: { ...drink(randomUUID()), consumedAt: clock + 3_600_000 } })).toMatchObject({
      status: "rejected",
      reason: "future_drink",
    });
    expect(await send(jade, randomUUID(), { kind: "drink.teleport" })).toMatchObject({ status: "rejected" });
  });

  it("keeps the pours of a mixed glass, refuses broken ones, and drops what is not listed", async () => {
    const jade = await account("jademix");
    const id = randomUUID();
    const parts = [
      { name: "Whisky", volumeMl: 40, abv: 0.4 },
      { name: "Rhum", volumeMl: 40, abv: 0.4 },
      { name: "Cola", volumeMl: 200, abv: 0 },
    ];
    // A photo never leaves the phone: a field sent by mistake is not stored.
    const mixed = { ...custom(id), name: "Whisky rhum cola", volumeMl: 280, abv: 0.11429, icon: "cocktail", parts, photo: "file:///x.jpg" };
    expect(await send(jade, randomUUID(), { kind: "customDrink.set", drink: mixed })).toMatchObject({ status: "accepted" });
    const stored = (await sync(jade)).customDrinks as { id: string; parts?: unknown; photo?: unknown }[];
    expect(stored.find((d) => d.id === id)?.parts).toEqual(parts);
    expect(stored.find((d) => d.id === id)?.photo).toBeUndefined();

    for (const broken of [[], [{ name: "Gin", volumeMl: -4, abv: 0.4 }], [{ name: "Gin", volumeMl: 40, abv: 4 }]]) {
      expect(await send(jade, randomUUID(), { kind: "customDrink.set", drink: { ...custom(randomUUID()), parts: broken } })).toMatchObject({ status: "rejected" });
    }
    // A drink saved before mixed glasses existed is still accepted as it was.
    expect(await send(jade, randomUUID(), { kind: "customDrink.set", drink: custom(randomUUID()) })).toMatchObject({ status: "accepted" });
  });
});

describe("offline replay protection (AC-12)", () => {
  async function nonces(auth: Auth) {
    return ((await app.inject({ method: "POST", url: "/v1/nonces", headers: auth })).json() as { nonces: { nonce: string }[] }).nonces;
  }
  async function sendWith(auth: Auth, key: string, mutation: unknown, envelope: Record<string, unknown>) {
    const res = await app.inject({ method: "POST", url: "/v1/mutations", headers: auth, payload: { mutations: [{ key, mutation, envelope }] } });
    return (res.json() as { results: { status: string; reason?: string }[] }).results[0]!;
  }
  const trustOf = async (id: string) => (await db.query<{ envelope_trust: string; logged_at: number }>("select envelope_trust, logged_at from drinks where id = $1", [id]))[0]!;

  it("chains events, dates them by monotonic age, refuses replays and spent nonces", async () => {
    const jade = await account("jade");
    const book = await nonces(jade);
    expect(book).toHaveLength(50);
    expect(await nonces(jade)).toHaveLength(0);

    const k1 = randomUUID();
    const d1 = { kind: "drink.add", drink: drink(randomUUID()) };
    const h1 = eventHash("", k1, d1);
    const base = { installId: "install-jade-1", bootId: "boot-1", prevHash: "" };
    expect(await sendWith(jade, k1, d1, { ...base, seq: 1, ageMs: 30 * 60_000, hash: h1, nonce: book[0]!.nonce })).toMatchObject({ status: "accepted" });
    expect(await trustOf(d1.drink.id)).toEqual({ envelope_trust: "ok", logged_at: clock - 30 * 60_000 });

    // Same nonce again: a replay.
    const k2 = randomUUID();
    const d2 = { kind: "drink.add", drink: drink(randomUUID()) };
    expect(await sendWith(jade, k2, d2, { ...base, seq: 2, ageMs: 0, prevHash: h1, hash: eventHash(h1, k2, d2), nonce: book[0]!.nonce })).toMatchObject({ reason: "replay" });
    // A sequence number that goes back: a replay too.
    const k3 = randomUUID();
    expect(await sendWith(jade, k3, d2, { ...base, seq: 1, ageMs: 0, prevHash: h1, hash: eventHash(h1, k3, d2), nonce: book[1]!.nonce })).toMatchObject({ reason: "replay" });
    // A gap in the chain is kept, with weaker proof; so is an event over 24 h old.
    const k4 = randomUUID();
    const d4 = { kind: "drink.add", drink: drink(randomUUID()) };
    expect(await sendWith(jade, k4, d4, { ...base, seq: 5, ageMs: 0, prevHash: "lost", hash: eventHash("lost", k4, d4), nonce: book[2]!.nonce })).toMatchObject({ status: "accepted" });
    expect((await trustOf(d4.drink.id)).envelope_trust).toBe("broken_chain");
    const k5 = randomUUID();
    const d5 = { kind: "drink.add", drink: drink(randomUUID()) };
    const h4 = eventHash("lost", k4, d4);
    expect(await sendWith(jade, k5, d5, { ...base, seq: 6, ageMs: 30 * 3_600_000, prevHash: h4, hash: eventHash(h4, k5, d5), nonce: null })).toMatchObject({ status: "accepted" });
    expect((await trustOf(d5.drink.id)).envelope_trust).toBe("stale");
  });

  it("refuses another person's nonce or install", async () => {
    const jade = await account("jade");
    const malik = await account("malik");
    const book = await nonces(jade);
    const k = randomUUID();
    const d = { kind: "drink.add", drink: drink(randomUUID()) };
    expect(await sendWith(malik, k, d, { installId: "install-x-12", bootId: "b", prevHash: "", seq: 1, ageMs: 0, hash: eventHash("", k, d), nonce: book[0]!.nonce })).toMatchObject({ reason: "invalid" });
  });
});
