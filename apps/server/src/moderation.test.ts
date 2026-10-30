import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub, type LiveSocket } from "./live";
import { checkText } from "./textFilter";

const MIN = 60_000;
const ZINC = { lat: 48.8566, lng: 2.3522 };
let clock = Date.UTC(2026, 10, 6, 21, 0);
let db: Db;
let app: FastifyInstance;
let live: LiveHub;

beforeEach(async () => {
  clock = Date.UTC(2026, 10, 6, 21, 0);
  db = await connectPglite();
  await migrate(db);
  live = new LiveHub();
  app = await buildApp({
    db,
    sealer: new Sealer(randomBytes(32).toString("base64")),
    live,
    now: () => clock,
    publicUrl: "https://crew.test",
    hashSecret: "s",
    operators: ["boss"],
    uploadDir: mkdtempSync(join(tmpdir(), "crew-moderation-")),
  });
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
  const crewId = ((await app.inject({ method: "POST", url: "/v1/crews", headers: users[0]!.auth, payload: { name: "Crew" } })).json() as { crew: { id: string } }).crew.id;
  const { code } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/invites`, headers: users[0]!.auth })).json() as { code: string };
  for (const u of users.slice(1)) await app.inject({ method: "POST", url: `/v1/invites/${code}/accept`, headers: u.auth });
  return crewId;
}
async function venueIn(crewId: string, by: User): Promise<string> {
  const venueId = randomUUID();
  await app.inject({ method: "POST", url: `/v1/crews/${crewId}/venues`, headers: by.auth, payload: { id: venueId, name: "Le Zinc", kind: "bar", ...ZINC } });
  return venueId;
}
const checkIn = (user: User, venueId: string) =>
  app.inject({ method: "POST", url: "/v1/checkins", headers: user.auth, payload: { id: randomUUID(), venueId, lat: ZINC.lat + 0.00011, lng: ZINC.lng + 0.00007, accuracy: 15, mocked: false, deviceNow: clock } });
const review = (user: User, venueId: string, text: string, audience?: string) =>
  app.inject({ method: "PUT", url: `/v1/places/${venueId}/review`, headers: user.auth, payload: { ratings: { vibe: 4 }, text, ...(audience ? { audience } : {}) } });
const get = async <T>(user: User, url: string) => (await app.inject({ method: "GET", url, headers: user.auth })).json() as T;
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(400), Buffer.from([0xff, 0xd9])]).toString("base64");

describe("automatic text filters (COM-02, COM-08)", () => {
  it("refuses insults, personal data and named people, and lets ordinary reviews through", () => {
    expect(checkText("Le barman est un connard")).toBe("text_abusive");
    expect(checkText("What a B1TCH at the door")).toBe("text_abusive");
    expect(checkText("Appelle-moi au 06 12 34 56 78")).toBe("text_personal_data");
    expect(checkText("call +44 20 7946 0958")).toBe("text_personal_data");
    expect(checkText("écris à julie.martin@example.com")).toBe("text_personal_data");
    expect(checkText("il habite 12 rue de la Paix")).toBe("text_personal_data");
    expect(checkText("Hauptstraße 5, zweiter Stock")).toBe("text_personal_data");
    expect(checkText("the bartender Kevin was rude", { names: true })).toBe("text_names_person");
    expect(checkText("la serveuse Julie est adorable", { names: true })).toBe("text_names_person");
    expect(checkText("Julie au bar nous a ignorés", { names: true })).toBe("text_names_person");
    expect(checkText("Merci Mme Durand", { names: true })).toBe("text_names_person");
    expect(checkText("demandez @kevin_bar", { names: true })).toBe("text_names_person");
    // Ordinary words that look close must pass.
    for (const ok of [
      "Super concert, on est arrivés en retard",
      "Drinks at the bar were cheap, the bartender was quick",
      "Pinte à 6,50 €, ouvert de 18 h à 2 h, 3 places assises",
      "Le DJ Snake set was great",
      "Je suis crevé mais ça valait le coup",
      "Service at the counter is slow on Fridays",
    ]) {
      expect([ok, checkText(ok, { names: true })]).toEqual([ok, null]);
    }
  });

  it("explains the refusal of a review with its own code, and stores nothing", async () => {
    const jade = await account("jade");
    const venueId = await venueIn(await crewOf(jade), jade);
    await checkIn(jade, venueId);
    const named = await review(jade, venueId, "Le videur Karim nous a refoulés");
    expect(named.statusCode).toBe(422);
    expect(named.json()).toEqual({ error: "text_names_person" });
    expect((await review(jade, venueId, "Réservez au 0612345678")).json()).toEqual({ error: "text_personal_data" });
    expect(await db.query("select 1 from place_reviews")).toHaveLength(0);
    expect((await review(jade, venueId, "Bonne ambiance, prix corrects")).statusCode).toBe(200);
    // Bios, party names and quotes go through the same filters.
    expect((await app.inject({ method: "PUT", url: "/v1/me/profile", headers: jade.auth, payload: { bio: "06 12 34 56 78 pour sortir" } })).json()).toEqual({ error: "text_personal_data" });
  });
});

describe("review photos (COM-02, QOL-09)", () => {
  it("adds up to three photos to my review, which follow the review's audience", async () => {
    const [jade, theo] = [await account("jade"), await account("theo")];
    const venueId = await venueIn(await crewOf(jade), jade);
    const theoVenue = await venueIn(await crewOf(theo), theo);
    await checkIn(jade, venueId);
    const upload = () => app.inject({ method: "POST", url: `/v1/places/${venueId}/review/photos`, headers: jade.auth, payload: { id: randomUUID(), data: JPEG, width: 800, height: 600 } });
    expect((await upload()).statusCode).toBe(404);
    await review(jade, venueId, "Terrasse au soleil", "public");
    for (let i = 0; i < 3; i++) expect((await upload()).statusCode).toBe(201);
    expect((await upload()).json()).toEqual({ error: "too_many_photos" });
    const seen = await get<{ reviews: { photos: { url: string }[] }[] }>(theo, `/v1/places/${theoVenue}`);
    expect(seen.reviews[0]!.photos).toHaveLength(3);
    const link = new URL(seen.reviews[0]!.photos[0]!.url);
    expect((await app.inject({ method: "GET", url: `${link.pathname}${link.search}` })).statusCode).toBe(200);
    await app.inject({ method: "PATCH", url: `/v1/reviews/${(await db.query<{ id: string }>("select id from place_reviews"))[0]!.id}`, headers: jade.auth, payload: { audience: "me" } });
    expect((await get<{ reviews: unknown[] }>(theo, `/v1/places/${theoVenue}`)).reviews).toHaveLength(0);
  });
});

describe("reports, decisions and strikes (COM-08, O-77)", () => {
  it("sends a public review to the operator, who takes it down with a reason, a strike and, at three, a ban", async () => {
    const [jade, theo, operator] = [await account("jade"), await account("theo"), await account("boss")];
    const venueId = await venueIn(await crewOf(jade), jade);
    const theoVenue = await venueIn(await crewOf(theo), theo);
    await checkIn(jade, venueId);
    for (let round = 1; round <= 3; round++) {
      await review(jade, venueId, `Avis numéro ${round}`, "public");
      const reviewId = (await get<{ reviews: { id: string }[] }>(theo, `/v1/places/${theoVenue}`)).reviews[0]!.id;
      const sent = await app.inject({ method: "POST", url: "/v1/reports", headers: theo.auth, payload: { targetKind: "review", targetId: reviewId, reason: "inappropriate" } });
      expect(sent.json()).toMatchObject({ to: "operator" });
      expect((await app.inject({ method: "GET", url: "/v1/operator/reports", headers: jade.auth })).statusCode).toBe(403);
      const queue = await get<{ reports: { id: string; content: { text: string } }[] }>(operator, "/v1/operator/reports");
      expect(queue.reports).toHaveLength(1);
      expect(queue.reports[0]!.content.text).toBe(`Avis numéro ${round}`);
      await app.inject({ method: "POST", url: `/v1/operator/reports/${queue.reports[0]!.id}`, headers: operator.auth, payload: { decision: "upheld" } });
      expect(await db.query("select 1 from place_reviews")).toHaveLength(0);
    }
    const notices = await get<{ strikes: number; bannedUntil: number | null; notices: { kind: string; ground: string; excerpt: string; strikes: number; canAppeal: boolean }[] }>(jade, "/v1/me/notices");
    expect(notices.strikes).toBe(3);
    expect(notices.bannedUntil).toBeGreaterThan(clock);
    expect(notices.notices[0]).toMatchObject({ kind: "removed", ground: "inappropriate", excerpt: "Avis numéro 3", strikes: 3, canAppeal: true });
    expect((await get<{ notices: { kind: string }[] }>(theo, "/v1/me/notices")).notices.map((n) => n.kind)).toEqual(["reportUpheld", "reportUpheld", "reportUpheld"]);
    // Banned: nothing new goes public.
    expect((await review(jade, venueId, "Encore un avis")).json()).toEqual({ error: "posting_banned" });

    // DSA appeal: the operator reverses the last decision, the strike goes and the ban with it.
    const last = (await get<{ notices: { id: string }[] }>(jade, "/v1/me/notices")).notices[0]!.id;
    expect((await app.inject({ method: "POST", url: `/v1/me/notices/${last}/appeal`, headers: jade.auth, payload: { text: "C'était mon avis sur le lieu." } })).statusCode).toBe(200);
    const appeals = await get<{ appeals: { id: string }[] }>(operator, "/v1/operator/reports");
    await app.inject({ method: "POST", url: `/v1/operator/appeals/${appeals.appeals[0]!.id}`, headers: operator.auth, payload: { outcome: "reversed" } });
    const after = await get<{ strikes: number; bannedUntil: number | null }>(jade, "/v1/me/notices");
    expect(after).toMatchObject({ strikes: 2, bannedUntil: null });
    expect((await review(jade, venueId, "Encore un avis")).statusCode).toBe(200);
  });

  it("sends a quote and a party to the crew admins, who take content down without a strike", async () => {
    const [admin, jade, malik] = [await account("admin"), await account("jade"), await account("malik")];
    const crewId = await crewOf(admin, jade, malik);
    const partyId = randomUUID();
    await app.inject({ method: "POST", url: "/v1/parties", headers: jade.auth, payload: { id: partyId, crewId, name: "Soirée", mood: "chill", kind: "party", startsAt: clock - 60 * MIN, endsAt: clock + 300 * MIN } });
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/response`, headers: malik.auth, payload: { response: "going" } });
    const quoteId = randomUUID();
    expect((await app.inject({ method: "POST", url: `/v1/parties/${partyId}/quotes`, headers: jade.auth, payload: { id: quoteId, text: "Malik est un abruti", saidBy: null } })).json()).toEqual({
      error: "text_abusive",
    });
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/quotes`, headers: jade.auth, payload: { id: quoteId, text: "Malik a dansé sur la table", saidBy: null } });
    const sent = await app.inject({ method: "POST", url: "/v1/reports", headers: malik.auth, payload: { targetKind: "quote", targetId: quoteId, reason: "harassment" } });
    expect(sent.json()).toMatchObject({ to: "crew" });
    expect((await app.inject({ method: "POST", url: "/v1/reports", headers: malik.auth, payload: { targetKind: "party", targetId: partyId, reason: "other" } })).statusCode).toBe(201);
    // Not visible to an outsider: their report is refused like the content does not exist.
    const outsider = await account("outsider");
    expect((await app.inject({ method: "POST", url: "/v1/reports", headers: outsider.auth, payload: { targetKind: "quote", targetId: quoteId, reason: "other" } })).statusCode).toBe(404);

    const list = await get<{ reports: { id: string; targetKind: string; content: { text: string; authorName: string } }[] }>(admin, `/v1/crews/${crewId}/reports`);
    const quote = list.reports.find((r) => r.targetKind === "quote")!;
    expect(quote.content).toMatchObject({ text: "Malik a dansé sur la table", authorName: "jade" });
    await app.inject({ method: "POST", url: `/v1/crews/${crewId}/reports/${quote.id}/decision`, headers: admin.auth, payload: { decision: "upheld", ground: "harassment" } });
    expect(await db.query("select 1 from party_quotes")).toHaveLength(0);
    const jadeNotices = await get<{ strikes: number; notices: { kind: string; decidedBy: string; canAppeal: boolean }[] }>(jade, "/v1/me/notices");
    expect(jadeNotices.strikes).toBe(0);
    expect(jadeNotices.notices[0]).toMatchObject({ kind: "removed", decidedBy: "crew", canAppeal: false });
    const party = list.reports.find((r) => r.targetKind === "party")!;
    await app.inject({ method: "POST", url: `/v1/crews/${crewId}/reports/${party.id}/decision`, headers: admin.auth, payload: { decision: "dismissed" } });
    expect((await get<{ notices: { kind: string }[] }>(malik, "/v1/me/notices")).notices.map((n) => n.kind).sort()).toEqual(["reportDismissed", "reportUpheld"]);
  });
});

describe("staff claims (TER-11)", () => {
  it("keeps 'I work here' pending until a crew admin approves, and keeps staff out of the regulars", async () => {
    const [admin, jade] = [await account("admin"), await account("jade")];
    const crewId = await crewOf(admin, jade);
    const venueId = await venueIn(crewId, admin);
    const ask = await app.inject({ method: "POST", url: `/v1/venues/${venueId}/workplace`, headers: jade.auth, payload: {} });
    expect(ask.json()).toEqual({ status: "pending" });
    expect((await db.query<{ status: string }>("select status from workplace_exclusions"))[0]!.status).toBe("pending");
    expect((await get<{ pending: unknown[]; canDecide: boolean }>(jade, `/v1/venues/${venueId}/workplace`)).canDecide).toBe(false);
    expect((await app.inject({ method: "POST", url: `/v1/venues/${venueId}/workplace/${jade.id}`, headers: jade.auth, payload: { decision: "approved" } })).statusCode).toBe(403);
    const waiting = await get<{ requests: { userId: string; venue: string }[] }>(admin, `/v1/crews/${crewId}/workplace-requests`);
    expect(waiting.requests).toMatchObject([{ userId: jade.id, venue: "Le Zinc" }]);
    await app.inject({ method: "POST", url: `/v1/venues/${venueId}/workplace/${jade.id}`, headers: admin.auth, payload: { decision: "approved" } });
    expect(await get<{ mine: string; staff: { userId: string }[] }>(jade, `/v1/venues/${venueId}/workplace`)).toMatchObject({ mine: "approved", staff: [{ userId: jade.id }] });

    // An approved member is never among the place's regulars, even with everything public.
    await app.inject({ method: "PUT", url: "/v1/me/profile", headers: jade.auth, payload: { regularOptIn: true, audiences: { venues: "everyone" } } });
    await checkIn(jade, venueId);
    clock += 25 * 60 * MIN;
    expect((await get<{ regulars: unknown[] }>(jade, `/v1/places/${venueId}`)).regulars).toEqual([]);
    // The admin's own claim needs nobody else.
    expect((await app.inject({ method: "POST", url: `/v1/venues/${venueId}/workplace`, headers: admin.auth, payload: {} })).json()).toEqual({ status: "approved" });
  });
});

describe("profile reviews, games, hidden items (PROF-02, PROF-03, PROF-04)", () => {
  it("starts a review with the profile's audience and shows each review only to its own audience", async () => {
    const [jade, friend, stranger] = [await account("jade"), await account("friend"), await account("stranger")];
    const venueId = await venueIn(await crewOf(jade), jade);
    await app.inject({ method: "POST", url: `/v1/users/${friend.id}/friend`, headers: jade.auth });
    await app.inject({ method: "POST", url: `/v1/users/${jade.id}/friend`, headers: friend.auth });
    await app.inject({ method: "PUT", url: "/v1/me/profile", headers: jade.auth, payload: { audiences: { reviews: "everyone" } } });
    await checkIn(jade, venueId);
    expect((await get<{ reviewAudience: string }>(jade, `/v1/places/${venueId}`)).reviewAudience).toBe("public");
    expect((await review(jade, venueId, "Très bon accueil")).json()).toMatchObject({ audience: "public" });
    const reviewsOf = async (viewer: User) => (await get<{ sections: { reviews?: { id: string; text: string }[] } }>(viewer, `/v1/users/${jade.id}/profile`)).sections.reviews;
    expect(await reviewsOf(stranger)).toHaveLength(1);
    const reviewId = (await reviewsOf(stranger))![0]!.id;
    // Friends only: the stranger loses it on the profile and on the place page at once.
    await app.inject({ method: "PATCH", url: `/v1/reviews/${reviewId}`, headers: jade.auth, payload: { audience: "friends" } });
    expect(await reviewsOf(stranger)).toHaveLength(0);
    expect(await reviewsOf(friend)).toHaveLength(1);
    // Anonymous counts in the rating but never shows on the profile, which would name it.
    await app.inject({ method: "PATCH", url: `/v1/reviews/${reviewId}`, headers: jade.auth, payload: { audience: "anonymous" } });
    expect(await reviewsOf(friend)).toHaveLength(0);
    expect((await get<{ ratingCount: number }>(stranger, `/v1/places/${venueId}`)).ratingCount).toBe(1);
    // PROF-03: one review hidden from everyone but me.
    await app.inject({ method: "PATCH", url: `/v1/reviews/${reviewId}`, headers: jade.auth, payload: { audience: "public" } });
    await app.inject({ method: "PUT", url: "/v1/me/profile", headers: jade.auth, payload: { hiddenReviews: [reviewId] } });
    expect(await reviewsOf(stranger)).toHaveLength(0);
    expect((await reviewsOf(jade))![0]).toMatchObject({ id: reviewId, hidden: true });
  });

  it("records game wins between crew mates and hides single figures", async () => {
    const [jade, malik, stranger] = [await account("jade"), await account("malik"), await account("stranger")];
    await crewOf(jade, malik);
    const win = (by: User, winner: User, accounts: User[]) =>
      app.inject({ method: "POST", url: "/v1/games/wins", headers: by.auth, payload: { id: randomUUID(), gameId: "pyramid", winnerId: winner.id, accountIds: accounts.map((a) => a.id), players: 4 } });
    expect((await win(jade, malik, [jade, malik])).statusCode).toBe(201);
    expect((await win(jade, stranger, [jade, stranger])).statusCode).toBe(403);
    await app.inject({ method: "PUT", url: "/v1/me/profile", headers: malik.auth, payload: { preset: "public" } });
    const games = async (viewer: User) => (await get<{ sections: { games?: { wins?: number }; drinks?: Record<string, unknown> } }>(viewer, `/v1/users/${malik.id}/profile`)).sections;
    expect((await games(stranger)).games).toMatchObject({ wins: 1, byGame: [{ gameId: "pyramid", wins: 1 }] });
    await app.inject({ method: "PUT", url: "/v1/me/profile", headers: malik.auth, payload: { hiddenStats: ["gameWins", "drinksTotal"] } });
    const hidden = await games(stranger);
    expect(hidden.games).toEqual({});
    expect(hidden.drinks).not.toHaveProperty("total");
    expect((await games(malik)).games).toMatchObject({ wins: 1 });
    expect((await get<{ hiddenStats: string[] }>(malik, "/v1/users/me/profile")).hiddenStats.sort()).toEqual(["drinksTotal", "gameWins"]);
  });
});

describe("friends (O-43)", () => {
  it("turns a referral link into a friend request and tells both lists live", async () => {
    const [jade, theo] = [await account("jade"), await account("theo")];
    const heard: string[] = [];
    const socket: LiveSocket = { send: (data) => heard.push((JSON.parse(data) as { type: string }).type) };
    live.add(jade.id, socket);
    const { code, url } = await get<{ code: string; url: string }>(jade, "/v1/me/referral");
    expect(url).toBe(`https://crew.test/f/${code}`);
    expect((await get<{ code: string }>(jade, "/v1/me/referral")).code).toBe(code);
    const pageHtml = await app.inject({ method: "GET", url: `/f/${code}`, headers: { "accept-language": "fr" } });
    expect(pageHtml.body).toContain("soireecrew://befriend?code=");
    expect(pageHtml.body).toContain("jade");
    // Jade said nobody may send requests: her own link still works.
    await app.inject({ method: "PUT", url: "/v1/me/profile", headers: jade.auth, payload: { requestsFrom: "nobody" } });
    expect((await app.inject({ method: "POST", url: `/v1/referrals/${code}`, headers: jade.auth })).statusCode).toBe(400);
    const used = await app.inject({ method: "POST", url: `/v1/referrals/${code}`, headers: theo.auth });
    expect(used.json()).toMatchObject({ userId: jade.id, friendship: "requested" });
    expect(heard).toContain("friends.changed");
    expect((await get<{ incoming: { userId: string }[] }>(jade, "/v1/friends")).incoming).toEqual([{ userId: theo.id, name: "theo" }]);
  });

  it("shows a friend's night history when the nights section allows it, never to strangers", async () => {
    const [jade, malik, stranger] = [await account("jade"), await account("malik"), await account("stranger")];
    const crewId = await crewOf(jade);
    await app.inject({ method: "POST", url: `/v1/users/${malik.id}/friend`, headers: jade.auth });
    await app.inject({ method: "POST", url: `/v1/users/${jade.id}/friend`, headers: malik.auth });
    await app.inject({ method: "POST", url: "/v1/parties", headers: jade.auth, payload: { id: randomUUID(), crewId, name: "Anniv", mood: "chill", kind: "party", startsAt: clock - 60 * MIN, endsAt: clock + 300 * MIN } });
    await app.inject({ method: "PUT", url: "/v1/me/profile", headers: jade.auth, payload: { audiences: { nights: "everyone" } } });
    const nights = async (viewer: User) => (await get<{ sections: { nights?: { total: number; history?: { at: number; name: string | null }[] } } }>(viewer, `/v1/users/${jade.id}/profile`)).sections.nights;
    // A friend outside the crew gets the dates, not the crew's party name.
    expect((await nights(malik))!.history).toEqual([{ at: clock - 60 * MIN, name: null, venues: [] }]);
    expect((await nights(jade))!.history![0]!.name).toBe("Anniv");
    expect(await nights(stranger)).toEqual({ total: 1, last30Days: 1 });
  });
});
