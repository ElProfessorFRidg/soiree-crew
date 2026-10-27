import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";

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
});
