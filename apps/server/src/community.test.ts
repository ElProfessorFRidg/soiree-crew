import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";

const MIN = 60_000;
const ZINC = { lat: 48.8566, lng: 2.3522 };
let clock = Date.UTC(2026, 10, 6, 21, 0);
let db: Db;
let app: FastifyInstance;

beforeEach(async () => {
  clock = Date.UTC(2026, 10, 6, 21, 0);
  db = await connectPglite();
  await migrate(db);
  app = await buildApp({ db, sealer: new Sealer(randomBytes(32).toString("base64")), live: new LiveHub(), now: () => clock, publicUrl: "https://crew.test", hashSecret: "s", operators: ["boss"] });
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
/** One crew with one bar at the Zinc. */
async function crewAtZinc(name: string) {
  const user = await account(name);
  const crewId = ((await app.inject({ method: "POST", url: "/v1/crews", headers: user.auth, payload: { name: `Crew ${name}` } })).json() as { crew: { id: string } }).crew.id;
  const venueId = randomUUID();
  await app.inject({ method: "POST", url: `/v1/crews/${crewId}/venues`, headers: user.auth, payload: { id: venueId, name: "Le Zinc", kind: "bar", ...ZINC } });
  return { user, crewId, venueId };
}
const checkIn = (user: User, venueId: string) =>
  app.inject({ method: "POST", url: "/v1/checkins", headers: user.auth, payload: { id: randomUUID(), venueId, lat: ZINC.lat + 0.00011, lng: ZINC.lng + 0.00007, accuracy: 15, mocked: false, deviceNow: clock } });
const place = async (user: User, venueId: string) => (await app.inject({ method: "GET", url: `/v1/places/${venueId}`, headers: user.auth })).json() as Record<string, unknown>;

describe("public places (COM-01, COM-02, PROF-04)", () => {
  it("takes reviews only after a verified visit and shows them as their authors chose", async () => {
    const a = await crewAtZinc("jade");
    const b = await crewAtZinc("theo");
    const review = (user: User, venueId: string, audience: string) =>
      app.inject({ method: "PUT", url: `/v1/places/${venueId}/review`, headers: user.auth, payload: { ratings: { vibe: 5, prices: 3 }, text: "Bonne ambiance", audience } });
    expect((await review(a.user, a.venueId, "public")).statusCode).toBe(403);
    await checkIn(a.user, a.venueId);
    expect((await review(a.user, a.venueId, "anonymous")).statusCode).toBe(200);

    // Théo's crew has its own pin at the same spot: same place, same reviews, author hidden.
    const seen = (await place(b.user, b.venueId)) as { reviews: { author: unknown; text: string }[]; ratings: { vibe: number | null }; ratingCount: number; usersThisMonth: number };
    expect(seen.reviews).toHaveLength(1);
    expect(seen.reviews[0]!.author).toBeNull();
    expect(seen.ratings.vibe).toBe(5);
    // COM-06: one visitor is a person, not a crowd. Strangers see nothing until there are five.
    expect(seen.usersThisMonth).toBe(0);

    // "Only me" leaves the rating and the page.
    await review(a.user, a.venueId, "me");
    const after = (await place(b.user, b.venueId)) as { reviews: unknown[]; ratingCount: number };
    expect(after.reviews).toHaveLength(0);
    expect(after.ratingCount).toBe(0);
  });

  it("records the door and events, and lists regulars who opted in only", async () => {
    const a = await crewAtZinc("jade");
    await checkIn(a.user, a.venueId);
    await app.inject({ method: "PUT", url: `/v1/places/${a.venueId}/door`, headers: a.user.auth, payload: { idCheck: "always", agePolicy: "adults" } });
    const eventId = randomUUID();
    await app.inject({ method: "POST", url: `/v1/places/${a.venueId}/events`, headers: a.user.auth, payload: { id: eventId, title: "Soirée étudiante", kind: "student", startsAt: clock + 24 * 60 * MIN } });
    let page = (await place(a.user, a.venueId)) as { door: { always: number; adultsOnly: number }; events: { going: number; mine: boolean }[]; regulars: unknown[] };
    expect(page.door).toMatchObject({ always: 1, adultsOnly: 1 });
    expect(page.events[0]).toMatchObject({ going: 1, mine: true });
    expect(page.regulars).toEqual([]);
    await app.inject({ method: "PUT", url: "/v1/me/profile", headers: a.user.auth, payload: { regularOptIn: true } });
    // COM-06: tonight never shows; the visit counts from the next day.
    page = (await place(a.user, a.venueId)) as typeof page;
    expect(page.regulars).toEqual([]);
    clock += 25 * 60 * MIN;
    page = (await place(a.user, a.venueId)) as typeof page;
    expect(page.regulars).toMatchObject([{ name: "jade", nights: 1, legend: true }]);
  });

  it("finds places nearby, one line per place, with filters", async () => {
    const a = await crewAtZinc("jade");
    await crewAtZinc("theo");
    await checkIn(a.user, a.venueId);
    await app.inject({ method: "PUT", url: `/v1/venues/${a.venueId}/prices`, headers: a.user.auth, payload: { kind: "pint", amount: 700, currency: "EUR" } });
    const near = (q: string) => app.inject({ method: "GET", url: `/v1/places?lat=${ZINC.lat}&lng=${ZINC.lng}${q}`, headers: a.user.auth }).then((r) => (r.json() as { places: { name: string; pint: number | null }[] }).places);
    expect(await near("")).toHaveLength(1);
    expect((await near("&maxPint=800"))[0]?.pint).toBe(700);
    expect(await near("&maxPint=500")).toHaveLength(0);
    expect(await near("&strict=1")).toHaveLength(0);
  });
});

describe("who can ask to be friends (COM-05)", () => {
  it("refuses a stranger's request when the person said nobody, and counts mutual friends", async () => {
    const jade = await account("jade");
    const theo = await account("theo");
    await app.inject({ method: "PUT", url: "/v1/me/profile", headers: jade.auth, payload: { requestsFrom: "nobody" } });
    const ask = await app.inject({ method: "POST", url: `/v1/users/${jade.id}/friend`, headers: theo.auth });
    expect(ask.statusCode).toBe(403);
    expect(ask.json()).toEqual({ error: "requests_closed" });
  });
});

describe("claimed venue pages (COM-11)", () => {
  it("lets the checked owner post hours, official events and replies, never remove a review", async () => {
    const a = await crewAtZinc("jade");
    const owner = await crewAtZinc("patron");
    const operator = await account("boss");
    await checkIn(a.user, a.venueId);
    await app.inject({ method: "PUT", url: `/v1/places/${a.venueId}/review`, headers: a.user.auth, payload: { ratings: { vibe: 2 }, text: "Service lent", audience: "public" } });

    expect((await app.inject({ method: "PUT", url: `/v1/places/${owner.venueId}/info`, headers: owner.user.auth, payload: { hours: "18 h - 2 h", happyHours: "" } })).statusCode).toBe(403);
    const claim = await app.inject({ method: "POST", url: `/v1/places/${owner.venueId}/claim`, headers: owner.user.auth, payload: { role: "Gérant", contact: "01 23 45 67 89" } });
    expect(claim.statusCode).toBe(201);
    expect((await app.inject({ method: "GET", url: "/v1/operator/claims", headers: a.user.auth })).statusCode).toBe(403);
    const pending = (await app.inject({ method: "GET", url: "/v1/operator/claims", headers: operator.auth })).json() as { claims: { id: string; contact: string }[] };
    expect(pending.claims[0]!.contact).toBe("01 23 45 67 89");
    expect((await db.query<{ proof: string }>("select proof from place_claims"))[0]!.proof).not.toContain("45 67");
    await app.inject({ method: "POST", url: `/v1/operator/claims/${pending.claims[0]!.id}`, headers: operator.auth, payload: { decision: "approved" } });

    expect((await app.inject({ method: "PUT", url: `/v1/places/${owner.venueId}/info`, headers: owner.user.auth, payload: { hours: "18 h - 2 h", happyHours: "18 h - 20 h" } })).statusCode).toBe(200);
    const seen = (await place(a.user, a.venueId)) as { claimed: boolean; info: { hours: string }; reviews: { id: string; reply: unknown }[] };
    expect(seen.claimed).toBe(true);
    expect(seen.info.hours).toBe("18 h - 2 h");
    const reviewId = seen.reviews[0]!.id;
    expect((await app.inject({ method: "PUT", url: `/v1/reviews/${reviewId}/reply`, headers: owner.user.auth, payload: { text: "Merci, on renforce l'équipe le samedi." } })).statusCode).toBe(200);
    expect((await app.inject({ method: "PUT", url: `/v1/reviews/${reviewId}/reply`, headers: a.user.auth, payload: { text: "moi aussi" } })).statusCode).toBe(403);
    const after = (await place(a.user, a.venueId)) as { reviews: { text: string; reply: { text: string } }[] };
    expect(after.reviews[0]!.text).toBe("Service lent");
    expect(after.reviews[0]!.reply.text).toContain("samedi");
    // No route deletes someone else's review: the owner's DELETE on the review is refused.
    expect((await app.inject({ method: "DELETE", url: `/v1/places/${owner.venueId}/review`, headers: owner.user.auth })).statusCode).not.toBe(500);
    expect(((await place(a.user, a.venueId)) as { reviews: unknown[] }).reviews).toHaveLength(1);

    await app.inject({ method: "POST", url: `/v1/places/${owner.venueId}/events`, headers: owner.user.auth, payload: { id: randomUUID(), title: "Soirée quiz", kind: "quiz", startsAt: clock + 86_400_000 } });
    const events = ((await place(a.user, a.venueId)) as { events: { official: boolean }[] }).events;
    expect(events[0]!.official).toBe(true);
  });
});
