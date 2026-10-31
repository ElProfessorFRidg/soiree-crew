import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { inRanges, priceChange, spendPerVisit } from "./hours";
import { LiveHub } from "./live";
import { picks, rank, type WhereToCandidate } from "./whereTo";

const MIN = 60_000;
const ZINC = { lat: 48.8566, lng: 2.3522 };
const QUAI = { lat: 48.8606, lng: 2.3376 };
// Friday 6 November 2026, 22:00 in Paris.
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
async function crewOf(...users: User[]): Promise<string> {
  const crewId = ((await app.inject({ method: "POST", url: "/v1/crews", headers: users[0]!.auth, payload: { name: "Les Quais" } })).json() as { crew: { id: string } }).crew.id;
  const { code } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/invites`, headers: users[0]!.auth })).json() as { code: string };
  for (const u of users.slice(1)) await app.inject({ method: "POST", url: `/v1/invites/${code}/accept`, headers: u.auth });
  return crewId;
}
async function addVenue(user: User, crewId: string, body: Record<string, unknown>) {
  const id = randomUUID();
  const res = await app.inject({ method: "POST", url: `/v1/crews/${crewId}/venues`, headers: user.auth, payload: { id, kind: "bar", ...ZINC, ...body } });
  return { id, status: res.statusCode };
}
async function checkIn(user: User, venueId: string, at = ZINC) {
  return app.inject({
    method: "POST",
    url: "/v1/checkins",
    headers: user.auth,
    payload: { id: randomUUID(), venueId, lat: at.lat + 0.00011, lng: at.lng + 0.00007, accuracy: 15, mocked: false, deviceNow: clock },
  });
}
const everyDay = [0, 1, 2, 3, 4, 5, 6];

describe("weekly hours (N-08)", () => {
  it("reads ranges past midnight and in the venue's time zone", () => {
    const evening = [{ days: [4], from: 18 * 60, to: 2 * 60 }];
    // Friday 22:00 Paris.
    expect(inRanges(evening, Date.UTC(2026, 10, 6, 21, 0), "Europe/Paris")).toBe(true);
    // Saturday 01:30 Paris belongs to Friday's range.
    expect(inRanges(evening, Date.UTC(2026, 10, 7, 0, 30), "Europe/Paris")).toBe(true);
    // Saturday 03:00 Paris is closed.
    expect(inRanges(evening, Date.UTC(2026, 10, 7, 2, 0), "Europe/Paris")).toBe(false);
    // Thursday 22:00 is not in a Friday-only range.
    expect(inRanges(evening, Date.UTC(2026, 10, 5, 21, 0), "Europe/Paris")).toBe(false);
  });
});

describe("prices and spend helpers (N-09, N-12)", () => {
  it("finds the last change and flags it while recent", () => {
    const now = Date.UTC(2026, 10, 6);
    expect(priceChange([{ amount: 600, at: now - 40 * 86_400_000 }, { amount: 650, at: now - 3 * 86_400_000 }, { amount: 650, at: now - 86_400_000 }], now)).toEqual({
      from: 600,
      to: 650,
      at: now - 3 * 86_400_000,
      recent: true,
    });
    expect(priceChange([{ amount: 600, at: now - 90 * 86_400_000 }, { amount: 700, at: now - 60 * 86_400_000 }], now)?.recent).toBe(false);
    expect(priceChange([{ amount: 600, at: now }], now)).toBeNull();
  });

  it("prices each stay's drinks at the crew's prices, unknown kinds at the average", () => {
    const prices = [
      { kind: "pint", amount: 700, currency: "EUR" },
      { kind: "shot", amount: 300, currency: "EUR" },
    ];
    // (700 + 700 + 300) and (500, the average, for an unpriced cocktail) over two stays.
    expect(spendPerVisit([["pint", "pint", "shot"], ["cocktail"]], prices)).toEqual({ amount: 1100, currency: "EUR" });
    expect(spendPerVisit([["pint"]], [])).toBeNull();
  });
});

describe("Where to? ranking (N-11, TER-08)", () => {
  const base: WhereToCandidate = { venueId: "a", openNow: null, happyNow: false, pint: null, average: null, distanceM: null, wanted: false, hereNow: 0, visits: 0, explored: true };
  it("filters, ranks with reasons, never suggests a closed place, and proposes a venue to conquer", () => {
    const candidates: WhereToCandidate[] = [
      { ...base, venueId: "closed", openNow: false, visits: 10 },
      { ...base, venueId: "happy", openNow: true, happyNow: true, pint: 500 },
      { ...base, venueId: "far", openNow: true, pint: 900, distanceM: 2900 },
      { ...base, venueId: "new", openNow: true, explored: false },
    ];
    const ranked = rank(candidates, {});
    expect(ranked[0]!.venueId).toBe("happy");
    expect(ranked[0]!.reasons[0]).toBe("happyNow");
    expect(ranked.at(-1)!.venueId).toBe("closed");
    expect(picks(ranked, candidates)).toEqual({ suggestion: "happy", conquest: "new" });
    expect(rank(candidates, { maxPrice: 600 }).map((r) => r.venueId)).toEqual(["happy"]);
    expect(rank(candidates, { openNow: true }).map((r) => r.venueId)).not.toContain("closed");
    expect(rank(candidates, { happyNow: true }).map((r) => r.venueId)).toEqual(["happy"]);
  });
});

describe("crew venues: address, HQ, hours (N-08, COM-01)", () => {
  it("keeps one HQ per crew; only an admin moves it", async () => {
    const [jade, malik] = [await account("jade"), await account("malik")];
    const crewId = await crewOf(jade, malik);
    const first = await addVenue(malik, crewId, { name: "Le Zinc", address: "12 rue Oberkampf", isHq: true });
    expect(first.status).toBe(201);
    const second = await addVenue(malik, crewId, { name: "Quai 12", ...QUAI, isHq: true });
    expect(second.status).toBe(403);
    const third = await addVenue(malik, crewId, { name: "Quai 12", ...QUAI });
    expect((await app.inject({ method: "PATCH", url: `/v1/venues/${third.id}`, headers: malik.auth, payload: { isHq: true } })).statusCode).toBe(403);
    expect((await app.inject({ method: "PATCH", url: `/v1/venues/${third.id}`, headers: jade.auth, payload: { isHq: true, address: "2 quai de Jemmapes" } })).statusCode).toBe(200);
    const list = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/venues`, headers: jade.auth })).json() as { venues: { id: string; isHq: boolean; address: string }[] };
    expect(list.venues.filter((v) => v.isHq).map((v) => v.id)).toEqual([third.id]);
    expect(list.venues.find((v) => v.id === third.id)!.address).toBe("2 quai de Jemmapes");
    expect(list.venues.find((v) => v.id === first.id)!.address).toBe("12 rue Oberkampf");
    const home = await addVenue(jade, crewId, { name: "Chez Jade", kind: "home", ...QUAI, isHq: true });
    expect(home.status).toBe(201);
    const after = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/venues`, headers: jade.auth })).json() as { venues: { id: string; isHq: boolean }[] };
    expect(after.venues.find((v) => v.id === home.id)!.isHq).toBe(false);
  });

  it("lets the crew set hours until an owner claims the place, and shows them on the public page as user-entered", async () => {
    const [jade, malik, owner, stranger] = [await account("jade"), await account("malik"), await account("owner"), await account("stranger")];
    const crewId = await crewOf(jade, malik);
    const zinc = await addVenue(jade, crewId, { name: "Le Zinc" });
    const schedule = { open: [{ days: everyDay, from: 18 * 60, to: 2 * 60 }], happy: [{ days: [4], from: 21 * 60, to: 23 * 60 }] };
    expect((await app.inject({ method: "PUT", url: `/v1/venues/${zinc.id}/hours`, headers: stranger.auth, payload: schedule })).statusCode).toBe(404);
    expect((await app.inject({ method: "PUT", url: `/v1/venues/${zinc.id}/hours`, headers: malik.auth, payload: schedule })).statusCode).toBe(200);

    const page = (await app.inject({ method: "GET", url: `/v1/venues/${zinc.id}`, headers: jade.auth })).json() as { facts: { source: string; openNow: boolean; happyNow: boolean; canEdit: boolean } };
    expect(page.facts).toMatchObject({ source: "crew", openNow: true, happyNow: true, canEdit: true });
    const list = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/venues`, headers: jade.auth })).json() as { venues: { openNow: boolean; happyNow: boolean }[] };
    expect(list.venues[0]).toMatchObject({ openNow: true, happyNow: true });
    const place = (await app.inject({ method: "GET", url: `/v1/places/${zinc.id}`, headers: stranger.auth })).json() as { facts: { source: string; openNow: boolean } };
    expect(place.facts).toMatchObject({ source: "crew", openNow: true });

    // The owner's page wins and the crew can no longer write.
    await db.query("insert into place_claims (id, venue_id, user_id, status, proof, requested_at, decided_at) values ($1, $2, $3, 'approved', 'x', $4, $4)", [randomUUID(), zinc.id, owner.id, clock]);
    const closed = { open: [{ days: [0], from: 12 * 60, to: 14 * 60 }], happy: [] };
    expect((await app.inject({ method: "PUT", url: `/v1/places/${zinc.id}/info`, headers: owner.auth, payload: { hours: "Lundi midi", happyHours: "", schedule: closed } })).statusCode).toBe(200);
    expect((await app.inject({ method: "PUT", url: `/v1/venues/${zinc.id}/hours`, headers: malik.auth, payload: schedule })).statusCode).toBe(409);
    const claimed = (await app.inject({ method: "GET", url: `/v1/venues/${zinc.id}`, headers: jade.auth })).json() as { facts: { source: string; openNow: boolean; hoursText: string; canEdit: boolean } };
    expect(claimed.facts).toMatchObject({ source: "owner", openNow: false, hoursText: "Lundi midi", canEdit: false });
  });

  it("adds an open-now filter to discovery (COM-10)", async () => {
    const [jade, stranger] = [await account("jade"), await account("stranger")];
    const crewId = await crewOf(jade);
    const zinc = await addVenue(jade, crewId, { name: "Le Zinc" });
    await addVenue(jade, crewId, { name: "Quai 12", ...QUAI });
    await app.inject({ method: "PUT", url: `/v1/venues/${zinc.id}/hours`, headers: jade.auth, payload: { open: [{ days: everyDay, from: 17 * 60, to: 2 * 60 }], happy: [] } });
    const all = (await app.inject({ method: "GET", url: `/v1/places?lat=${ZINC.lat}&lng=${ZINC.lng}`, headers: stranger.auth })).json() as { places: { name: string; openNow: boolean | null }[] };
    expect(all.places.map((p) => p.name).sort()).toEqual(["Le Zinc", "Quai 12"]);
    const open = (await app.inject({ method: "GET", url: `/v1/places?lat=${ZINC.lat}&lng=${ZINC.lng}&open=1`, headers: stranger.auth })).json() as { places: { name: string }[] };
    expect(open.places.map((p) => p.name)).toEqual(["Le Zinc"]);
  });
});

describe("price history and venue stats (N-09, N-12)", () => {
  it("keeps every price and flags a recent change", async () => {
    const [jade, malik] = [await account("jade"), await account("malik")];
    const crewId = await crewOf(jade, malik);
    const zinc = await addVenue(jade, crewId, { name: "Le Zinc" });
    await app.inject({ method: "PUT", url: `/v1/venues/${zinc.id}/prices`, headers: jade.auth, payload: { kind: "pint", amount: 600, currency: "EUR" } });
    clock += 3 * 86_400_000;
    await app.inject({ method: "PUT", url: `/v1/venues/${zinc.id}/prices`, headers: jade.auth, payload: { kind: "pint", amount: 650, currency: "EUR" } });
    const res = (await app.inject({ method: "GET", url: `/v1/venues/${zinc.id}/prices`, headers: malik.auth })).json() as {
      prices: { kind: string; amount: number; change: { from: number; to: number; recent: boolean } | null; history: { amount: number }[] }[];
    };
    expect(res.prices[0]).toMatchObject({ kind: "pint", amount: 650, change: { from: 600, to: 650, recent: true } });
    expect(res.prices[0]!.history.map((h) => h.amount)).toEqual([650, 600]);
  });

  it("estimates the average spend per visit from drinks logged there", async () => {
    const [jade] = [await account("jade")];
    const crewId = await crewOf(jade);
    const zinc = await addVenue(jade, crewId, { name: "Le Zinc" });
    await app.inject({ method: "PUT", url: `/v1/venues/${zinc.id}/prices`, headers: jade.auth, payload: { kind: "pint", amount: 700, currency: "EUR" } });
    expect((await checkIn(jade, zinc.id)).statusCode).toBe(201);
    for (const at of [clock + 5 * MIN, clock + 40 * MIN]) {
      await db.query("insert into drinks (id, user_id, kind, preset_id, sealed, consumed_at, logged_at, updated_at) values ($1, $2, 'pint', 'm-pint', 'x', $3, $3, $3)", [randomUUID(), jade.id, at]);
    }
    clock += 60 * MIN;
    await app.inject({ method: "POST", url: "/v1/checkins/x/end", headers: jade.auth });
    await db.query("update check_ins set ended_at = $1", [clock]);
    const stats = (await app.inject({ method: "GET", url: `/v1/venues/${zinc.id}/stats`, headers: jade.auth })).json() as { averageSpend: { amount: number; currency: string } | null; averageDrinks: number };
    expect(stats.averageDrinks).toBe(2);
    expect(stats.averageSpend).toEqual({ amount: 1400, currency: "EUR" });
  });
});

describe("Where to? for a crew (N-11, TER-08, COM-10)", () => {
  it("ranks the crew's venues and its want-to-go list, with filters and a venue to conquer", async () => {
    const [jade, other] = [await account("jade"), await account("other")];
    const crewId = await crewOf(jade);
    const otherCrew = await crewOf(other);
    const zinc = await addVenue(jade, crewId, { name: "Le Zinc" });
    const quai = await addVenue(jade, crewId, { name: "Quai 12", ...QUAI });
    const far = await addVenue(other, otherCrew, { name: "La Capsule", lat: 48.87, lng: 2.37 });
    await app.inject({ method: "PUT", url: `/v1/venues/${zinc.id}/hours`, headers: jade.auth, payload: { open: [{ days: everyDay, from: 17 * 60, to: 2 * 60 }], happy: [{ days: everyDay, from: 21 * 60, to: 23 * 60 }] } });
    await app.inject({ method: "PUT", url: `/v1/venues/${zinc.id}/prices`, headers: jade.auth, payload: { kind: "pint", amount: 550, currency: "EUR" } });
    expect((await checkIn(jade, zinc.id)).statusCode).toBe(201);
    await app.inject({ method: "PUT", url: `/v1/crews/${crewId}/want-to-go`, headers: jade.auth, payload: { venueId: far.id, want: true } });

    const res = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/where-to?lat=${ZINC.lat}&lng=${ZINC.lng}&currency=EUR`, headers: jade.auth })).json() as {
      suggestion: string;
      conquest: string | null;
      options: { venueId: string; crewVenue: boolean; wanted: boolean; reasons: string[]; explored: boolean }[];
    };
    expect(res.options.map((o) => o.venueId).sort()).toEqual([zinc.id, quai.id, far.id].sort());
    expect(res.suggestion).toBe(zinc.id);
    expect(res.options[0]!.reasons).toContain("happyNow");
    expect(res.options.find((o) => o.venueId === far.id)).toMatchObject({ crewVenue: false, wanted: true });
    expect(res.conquest).toBe(quai.id);

    const open = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/where-to?open=1`, headers: jade.auth })).json() as { options: { venueId: string }[] };
    expect(open.options.map((o) => o.venueId)).toEqual([zinc.id]);
    const cheap = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/where-to?maxPrice=500&currency=EUR`, headers: jade.auth })).json() as { options: unknown[] };
    expect(cheap.options).toEqual([]);
    expect((await app.inject({ method: "GET", url: `/v1/crews/${crewId}/where-to`, headers: other.auth })).statusCode).toBe(404);
  });
});

describe("venue photos (TER-05)", () => {
  it("shows album photos taken there to the members of that night only", async () => {
    const [jade, malik, theo] = [await account("jade"), await account("malik"), await account("theo")];
    const crewId = await crewOf(jade, malik, theo);
    const zinc = await addVenue(jade, crewId, { name: "Le Zinc" });
    const partyId = randomUUID();
    await app.inject({ method: "POST", url: "/v1/parties", headers: jade.auth, payload: { id: partyId, crewId, name: "Vendredi", mood: "party", kind: "party", startsAt: clock - 30 * MIN, endsAt: clock + 6 * 60 * MIN } });
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/response`, headers: malik.auth, payload: { response: "going" } });
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/response`, headers: theo.auth, payload: { response: "declined" } });
    expect((await checkIn(jade, zinc.id)).statusCode).toBe(201);
    const photoId = randomUUID();
    await db.query("insert into photos (id, party_id, user_id, width, height, bytes, created_at) values ($1, $2, $3, 100, 100, 10, $4)", [photoId, partyId, jade.id, clock + 10 * MIN]);
    // A photo from before the crew got there stays out.
    await db.query("insert into photos (id, party_id, user_id, width, height, bytes, created_at) values ($1, $2, $3, 100, 100, 10, $4)", [randomUUID(), partyId, jade.id, clock - 20 * MIN]);
    const seen = (await app.inject({ method: "GET", url: `/v1/venues/${zinc.id}/photos`, headers: malik.auth })).json() as { photos: { id: string; url: string }[] };
    expect(seen.photos.map((p) => p.id)).toEqual([photoId]);
    expect(seen.photos[0]!.url).toContain("sig=");
    const notThere = (await app.inject({ method: "GET", url: `/v1/venues/${zinc.id}/photos`, headers: theo.auth })).json() as { photos: unknown[] };
    expect(notThere.photos).toEqual([]);
  });
});

describe("house pint strength", () => {
  it("is set by a member checked in at the bar, validated, and shared with the crew", async () => {
    const [jade, malik, other] = [await account("jade"), await account("malik"), await account("other")];
    const crewId = await crewOf(jade, malik);
    const zinc = await addVenue(jade, crewId, { name: "Le Zinc" });
    const put = (user: User, abv: unknown) => app.inject({ method: "PUT", url: `/v1/venues/${zinc.id}/house-pint`, headers: user.auth, payload: { abv } });

    // Not checked in there: refused, whatever the value.
    const away = await put(jade, 0.06);
    expect(away.statusCode).toBe(403);
    expect(away.body).toContain("not_checked_in");
    expect((await checkIn(jade, zinc.id)).statusCode).toBe(201);
    // Out of range: no beer on tap is 40 %.
    expect((await put(jade, 0.4)).statusCode).toBe(400);
    expect((await put(jade, 0.01)).statusCode).toBe(400);
    expect((await put(jade, "6")).statusCode).toBe(400);
    // Another crew never touches it.
    expect((await put(other, 0.06)).statusCode).toBe(404);

    const saved = (await put(jade, 0.0649)).json() as { housePint: { abv: number } };
    expect(saved.housePint.abv).toBe(0.065);
    // Malik is not checked in, but sees it in the crew's venues and on the venue page.
    const list = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/venues`, headers: malik.auth })).json() as { venues: { id: string; housePintAbv: number | null }[] };
    expect(list.venues.find((v) => v.id === zinc.id)?.housePintAbv).toBe(0.065);
    const page = (await app.inject({ method: "GET", url: `/v1/venues/${zinc.id}`, headers: malik.auth })).json() as { housePint: { abv: number; updatedByName: string } | null };
    expect(page.housePint).toMatchObject({ abv: 0.065, updatedByName: "jade" });

    // Null clears it.
    expect((await put(jade, null)).json()).toEqual({ housePint: null });
    const cleared = (await app.inject({ method: "GET", url: `/v1/venues/${zinc.id}`, headers: malik.auth })).json() as { housePint: unknown };
    expect(cleared.housePint).toBeNull();
  });
});
