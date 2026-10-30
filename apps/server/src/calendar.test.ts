import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { buildCalendar, foldLine } from "./icalendar";
import { LiveHub } from "./live";
import { nextBirthday } from "./routes/calendar";
import { nightOf } from "./time";

let db: Db;
let app: FastifyInstance;
// Saturday 7 November 2026, 20:00 in Paris.
let clock = Date.UTC(2026, 10, 7, 19, 0);

beforeEach(async () => {
  clock = Date.UTC(2026, 10, 7, 19, 0);
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
async function crewOf(...users: User[]) {
  const crewId = ((await app.inject({ method: "POST", url: "/v1/crews", headers: users[0]!.auth, payload: { name: "Les Zincs" } })).json() as { crew: { id: string } }).crew.id;
  const { code } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/invites`, headers: users[0]!.auth })).json() as { code: string };
  for (const u of users.slice(1)) await app.inject({ method: "POST", url: `/v1/invites/${code}/accept`, headers: u.auth });
  return crewId;
}
async function setBoundary(user: User, dayBoundaryHour: number) {
  await db.query("insert into user_preferences (user_id, data, updated_at) values ($1, $2, 0)", [user.id, JSON.stringify({ dayBoundaryHour })]);
}

describe("day boundary (QOL-02)", () => {
  it("puts 2 am on Sunday in Saturday night with a 6 am boundary, in Sunday with a 1 am one", () => {
    const sundayTwoAm = Date.UTC(2026, 10, 8, 1, 0); // 02:00 in Paris
    expect(nightOf(sundayTwoAm, "Europe/Paris", 6)).toBe("2026-11-07");
    expect(nightOf(sundayTwoAm, "Europe/Paris", 1)).toBe("2026-11-08");
    expect(nightOf(sundayTwoAm, "Europe/Paris")).toBe("2026-11-07");
  });

  it("gives each person their own tonight on the crew board", async () => {
    const [jade, malik] = [await account("jade"), await account("malik")];
    const crewId = await crewOf(jade, malik);
    await setBoundary(malik, 1);
    clock = Date.UTC(2026, 10, 8, 1, 0);
    const forJade = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/radar`, headers: jade.auth })).json() as { tonight: string };
    const forMalik = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/radar`, headers: malik.auth })).json() as { tonight: string };
    expect(forJade.tonight).toBe("2026-11-07");
    expect(forMalik.tonight).toBe("2026-11-08");
  });

  it("stores the phone's time zone and refuses names it does not know", async () => {
    const jade = await account("jade");
    expect((await app.inject({ method: "PUT", url: "/v1/me/clock", headers: jade.auth, payload: { timeZone: "Mars/Olympus" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "PUT", url: "/v1/me/clock", headers: jade.auth, payload: { timeZone: "America/New_York" } })).statusCode).toBe(200);
    const [row] = await db.query<{ time_zone: string }>("select time_zone from users where id = $1", [jade.id]);
    expect(row!.time_zone).toBe("America/New_York");
  });
});

describe("radar for the week (N-01, N-02)", () => {
  it("takes another night of the week with a window and a place, and shows every kind of status", async () => {
    const [jade, malik] = [await account("jade"), await account("malik")];
    const crewId = await crewOf(jade, malik);
    const put = (user: User, payload: object) => app.inject({ method: "PUT", url: "/v1/status", headers: user.auth, payload });
    expect((await put(jade, { night: "2026-11-11", status: "going_out", fromMinute: 21 * 60, toMinute: 25 * 60, place: "Le Zinc" })).statusCode).toBe(200);
    expect((await put(malik, { night: "2026-11-11", status: "unavailable", fromMinute: 1200, place: "ignored" })).statusCode).toBe(200);
    expect((await put(malik, { night: "2026-11-12", status: "home" })).statusCode).toBe(200);
    const radar = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/radar`, headers: malik.auth })).json() as {
      statuses: { userId: string; night: string; status: string; fromMinute: number | null; toMinute: number | null; place: string }[];
    };
    expect(radar.statuses).toEqual(
      expect.arrayContaining([
        { userId: jade.id, night: "2026-11-11", status: "going_out", fromMinute: 1260, toMinute: 1500, place: "Le Zinc" },
        // Staying in carries no window or place.
        { userId: malik.id, night: "2026-11-11", status: "unavailable", fromMinute: null, toMinute: null, place: "" },
        expect.objectContaining({ userId: malik.id, night: "2026-11-12", status: "home" }),
      ]),
    );
  });

  it("refuses a window that ends before it starts and nights outside the week", async () => {
    const jade = await account("jade");
    await crewOf(jade);
    const put = (payload: object) => app.inject({ method: "PUT", url: "/v1/status", headers: jade.auth, payload });
    expect((await put({ night: "2026-11-08", status: "going_out", fromMinute: 1320, toMinute: 1200 })).statusCode).toBe(400);
    expect((await put({ night: "2026-11-20", status: "going_out" })).statusCode).toBe(400);
    expect((await put({ night: "2026-11-01", status: "going_out" })).statusCode).toBe(400);
  });

  it("lets a status expire with its night", async () => {
    const [jade, malik] = [await account("jade"), await account("malik")];
    const crewId = await crewOf(jade, malik);
    await app.inject({ method: "PUT", url: "/v1/status", headers: jade.auth, payload: { night: "2026-11-07", status: "going_out" } });
    clock = Date.UTC(2026, 10, 8, 6, 0); // Sunday 07:00 in Paris: Saturday night is over.
    const radar = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/radar`, headers: malik.auth })).json() as { tonight: string; statuses: unknown[] };
    expect(radar.tonight).toBe("2026-11-08");
    expect(radar.statuses).toEqual([]);
  });
});

describe("calendar feed (N-06)", () => {
  it("serves a valid feed of the crew's parties and my own plans, and nothing once the link is reset or revoked", async () => {
    const [jade, malik, stranger] = [await account("jade"), await account("malik"), await account("stranger")];
    const crewId = await crewOf(jade, malik);
    const partyId = randomUUID();
    await app.inject({ method: "POST", url: "/v1/parties", headers: jade.auth, payload: { id: partyId, crewId, name: "Samedi, enfin", mood: "party", kind: "party", startsAt: clock + 3_600_000, endsAt: clock + 6 * 3_600_000 } });
    await app.inject({ method: "PUT", url: "/v1/status", headers: jade.auth, payload: { night: "2026-11-11", status: "going_out", fromMinute: 1260, place: "Le Zinc" } });
    await app.inject({ method: "PUT", url: "/v1/status", headers: malik.auth, payload: { night: "2026-11-12", status: "going_out", place: "Chez Malik" } });

    expect((await app.inject({ method: "POST", url: `/v1/crews/${crewId}/calendar`, headers: stranger.auth })).statusCode).toBe(404);
    const { url } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/calendar`, headers: jade.auth })).json() as { url: string };
    expect(url).toMatch(/^https:\/\/crew\.test\/v1\/calendar\/[A-Za-z0-9_-]+\.ics$/);
    expect(((await app.inject({ method: "GET", url: `/v1/crews/${crewId}/calendar`, headers: jade.auth })).json() as { url: string }).url).toBe(url);
    const path = url.replace("https://crew.test", "");

    const feed = await app.inject({ method: "GET", url: path });
    expect(feed.statusCode).toBe(200);
    expect(feed.headers["content-type"]).toContain("text/calendar");
    const body = feed.body;
    expect(body.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(body.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(body).toContain(`UID:party-${partyId}@soiree-crew`);
    expect(body).toContain("SUMMARY:Samedi\\, enfin");
    expect(body).toContain("LOCATION:Le Zinc");
    expect(body).toContain("DTSTART:20261111T200000Z");
    // Another member's plans never travel in my feed.
    expect(body).not.toContain("Chez Malik");
    for (const line of body.split("\r\n")) expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);

    const { url: next } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/calendar`, headers: jade.auth })).json() as { url: string };
    expect(next).not.toBe(url);
    const gone = await app.inject({ method: "GET", url: path });
    expect(gone.statusCode).toBe(404);
    expect(gone.body).not.toContain("VCALENDAR");
    expect((await app.inject({ method: "GET", url: next.replace("https://crew.test", "") })).statusCode).toBe(200);
    await app.inject({ method: "DELETE", url: `/v1/crews/${crewId}/calendar`, headers: jade.auth });
    expect((await app.inject({ method: "GET", url: next.replace("https://crew.test", "") })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/v1/calendar/not-a-real-token-at-all-000000.ics" })).statusCode).toBe(404);
  });

  it("folds long lines and escapes text as RFC 5545 asks", () => {
    const long = `SUMMARY:${"é".repeat(60)}`;
    const folded = foldLine(long);
    for (const line of folded.split("\r\n")) expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(long);
    const ics = buildCalendar({ name: "A;B", now: 0, events: [{ uid: "x", date: "2026-12-31", summary: "a,b\nc", updatedAt: 0 }] });
    expect(ics).toContain("X-WR-CALNAME:A\\;B");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101");
    expect(ics).toContain("SUMMARY:a\\,b\\nc");
  });
});

describe("birthdays (QOL-21)", () => {
  it("reminds crew mates a few days before, without the year, and respects the audience", async () => {
    const [jade, malik, stranger] = [await account("jade"), await account("malik"), await account("stranger")];
    const crewId = await crewOf(jade, malik);
    await crewOf(stranger);
    expect((await app.inject({ method: "PUT", url: "/v1/me/profile", headers: jade.auth, payload: { birthday: { month: 2, day: 30 } } })).statusCode).toBe(400);
    await app.inject({ method: "PUT", url: "/v1/me/profile", headers: jade.auth, payload: { birthday: { month: 11, day: 10, year: 1999 } } });

    const mine = (await app.inject({ method: "GET", url: "/v1/users/me/profile", headers: jade.auth })).json() as { sections: { birthday?: object } };
    expect(mine.sections.birthday).toEqual({ month: 11, day: 10, year: 1999 });
    const seen = (await app.inject({ method: "GET", url: `/v1/users/${jade.id}/profile`, headers: malik.auth })).json() as { sections: { birthday?: object } };
    expect(seen.sections.birthday).toEqual({ month: 11, day: 10 });
    const outside = (await app.inject({ method: "GET", url: `/v1/users/${jade.id}/profile`, headers: stranger.auth })).json() as { sections: { birthday?: object } };
    expect(outside.sections.birthday).toBeUndefined();

    const list = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/birthdays`, headers: malik.auth })).json() as { birthdays: object[] };
    expect(list.birthdays).toEqual([{ userId: jade.id, name: "jade", month: 11, day: 10, date: "2026-11-10", inDays: 3 }]);
    expect(JSON.stringify(list)).not.toContain("1999");
    // Nobody is reminded of their own birthday.
    expect(((await app.inject({ method: "GET", url: `/v1/crews/${crewId}/birthdays`, headers: jade.auth })).json() as { birthdays: object[] }).birthdays).toEqual([]);

    await app.inject({ method: "PUT", url: "/v1/me/profile", headers: jade.auth, payload: { audiences: { birthday: "me" } } });
    expect(((await app.inject({ method: "GET", url: `/v1/crews/${crewId}/birthdays`, headers: malik.auth })).json() as { birthdays: object[] }).birthdays).toEqual([]);
  });

  it("finds the next birthday, 29 February included", () => {
    expect(nextBirthday("2026-11-07", 11, 7)).toBe("2026-11-07");
    expect(nextBirthday("2026-11-07", 11, 6)).toBe("2027-11-06");
    expect(nextBirthday("2027-01-01", 2, 29)).toBe("2027-02-28");
    expect(nextBirthday("2027-12-01", 2, 29)).toBe("2028-02-29");
  });
});
