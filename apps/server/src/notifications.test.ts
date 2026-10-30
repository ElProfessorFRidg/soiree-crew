import { generateKeyPairSync, randomBytes, randomUUID, verify } from "node:crypto";
import { createServer, type Http2Server, type IncomingHttpHeaders, type ServerHttp2Stream } from "node:http2";
import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { en } from "../../mobile/src/i18n/en";
import { buildApp } from "./app";
import type { Context } from "./context";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";
import { apnsJwt, ApnsTransport } from "./notifications/apns";
import { FcmTransport } from "./notifications/fcm";
import { sweepLiveParties } from "./nightWatch";
import { sweepNotifications } from "./notifications/producers";
import { PushService, type PushMessage, type PushResult, type PushTransport } from "./notifications/push";

const MIN = 60_000;
// 20:00 in Paris (UTC+1 in November): outside the default quiet hours, 22:00 to 9:00.
let clock = Date.UTC(2026, 10, 7, 19, 0);
let db: Db;
let app: FastifyInstance;
let ios: FakeTransport;
let push: PushService;
let ctx: Context;

class FakeTransport implements PushTransport {
  readonly platform = "ios" as const;
  sent: { token: string; message: PushMessage }[] = [];
  async send(token: string, message: PushMessage): Promise<PushResult> {
    this.sent.push({ token, message });
    return token.startsWith("dead") ? "gone" : "ok";
  }
  close(): void {}
}

beforeEach(async () => {
  clock = Date.UTC(2026, 10, 7, 19, 0);
  db = await connectPglite();
  await migrate(db);
  ios = new FakeTransport();
  push = new PushService({ ios });
  ctx = { db, sealer: new Sealer(randomBytes(32).toString("base64")), live: new LiveHub(), now: () => clock, publicUrl: "https://crew.test", hashSecret: "s", push };
  app = await buildApp(ctx);
});
afterEach(async () => {
  await app.close();
  await db.close();
});

type User = { id: string; name: string; auth: { authorization: string } };

async function account(name: string): Promise<User> {
  const body = (await app.inject({ method: "POST", url: "/v1/accounts", payload: { username: name, displayName: name } })).json() as { user: { id: string }; token: string };
  return { id: body.user.id, name, auth: { authorization: `Bearer ${body.token}` } };
}

async function crewOf(...users: User[]): Promise<string> {
  const crewId = ((await app.inject({ method: "POST", url: "/v1/crews", headers: users[0]!.auth, payload: { name: "Les Quais" } })).json() as { crew: { id: string } }).crew.id;
  const { code } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/invites`, headers: users[0]!.auth })).json() as { code: string };
  for (const u of users.slice(1)) await app.inject({ method: "POST", url: `/v1/invites/${code}/accept`, headers: u.auth });
  return crewId;
}

async function partyOf(crewId: string, users: User[], name = "Samedi au Zinc"): Promise<string> {
  const id = randomUUID();
  await app.inject({
    method: "POST",
    url: "/v1/parties",
    headers: users[0]!.auth,
    payload: { id, crewId, name, mood: "party", kind: "party", startsAt: clock - 30 * MIN, endsAt: clock + 6 * 60 * MIN },
  });
  for (const u of users.slice(1)) await app.inject({ method: "POST", url: `/v1/parties/${id}/response`, headers: u.auth, payload: { response: "going" } });
  return id;
}

async function registerPhone(user: User, token = `a${randomBytes(32).toString("hex")}`) {
  const res = await app.inject({ method: "POST", url: "/v1/push/devices", headers: user.auth, payload: { token, platform: "ios", timeZone: "Europe/Paris" } });
  expect(res.statusCode).toBe(201);
  return token;
}

type Inbox = { items: { id: string; kind: string; params: Record<string, unknown>; readAt: number | null; partyId: string | null; count: number }[]; unread: number };
async function inbox(user: User): Promise<Inbox> {
  return (await app.inject({ method: "GET", url: "/v1/notifications", headers: user.auth })).json() as Inbox;
}

describe("push devices (O-38)", () => {
  it("registers a token for the session and loses it on sign-out", async () => {
    const jade = await account("jade");
    const token = await registerPhone(jade);
    const rows = await db.query<{ user_id: string; session_hash: string }>("select user_id, session_hash from push_devices where token = $1", [token]);
    expect(rows[0]?.user_id).toBe(jade.id);
    // A token that is not one is refused.
    expect((await app.inject({ method: "POST", url: "/v1/push/devices", headers: jade.auth, payload: { token: "x y", platform: "ios" } })).statusCode).toBe(400);
    await db.query("delete from sessions where user_id = $1", [jade.id]);
    expect(await db.query("select 1 from push_devices where token = $1", [token])).toEqual([]);
  });

  it("removes a token on request, and only the owner's", async () => {
    const [jade, malik] = [await account("jade"), await account("malik")];
    const token = await registerPhone(jade);
    await app.inject({ method: "DELETE", url: `/v1/push/devices/${token}`, headers: malik.auth });
    expect((await db.query("select 1 from push_devices where token = $1", [token])).length).toBe(1);
    expect((await app.inject({ method: "DELETE", url: `/v1/push/devices/${token}`, headers: jade.auth })).statusCode).toBe(204);
    expect(await db.query("select 1 from push_devices where token = $1", [token])).toEqual([]);
  });

  it("forgets a token the push service calls dead", async () => {
    const [jade, malik] = [await account("jade"), await account("malik")];
    await crewOf(jade, malik);
    await registerPhone(malik, `dead${"0".repeat(40)}`);
    await app.inject({ method: "POST", url: "/v1/sos", headers: jade.auth, payload: {} });
    await push.idle();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await db.query("select 1 from push_devices where user_id = $1", [malik.id])).toEqual([]);
  });
});

describe("inbox (N-35)", () => {
  it("keeps every event, counts unread and marks read", async () => {
    const [jade, malik] = [await account("jade"), await account("malik")];
    await crewOf(jade, malik);
    await app.inject({ method: "POST", url: "/v1/sos", headers: jade.auth, payload: {} });
    const box = await inbox(malik);
    expect(box.unread).toBe(1);
    expect(box.items[0]).toMatchObject({ kind: "sos", params: { name: "jade" }, readAt: null });
    // Nobody is told about their own action.
    expect((await inbox(jade)).items).toEqual([]);
    const read = (await app.inject({ method: "POST", url: "/v1/notifications/read", headers: malik.auth, payload: { ids: [box.items[0]!.id] } })).json() as { unread: number };
    expect(read.unread).toBe(0);
    expect((await inbox(malik)).items[0]!.readAt).not.toBeNull();
  });

  it("merges a burst of chat notifications into one unread row", async () => {
    const [jade, malik] = [await account("jade"), await account("malik")];
    const { notifyChatMessage } = await import("./notifications/producers");
    const conversation = { id: randomUUID(), party_id: null, crew_id: null };
    for (let i = 0; i < 3; i++) await notifyChatMessage(testCtx(), conversation, [jade.id, malik.id], jade.id);
    const box = await inbox(malik);
    expect(box.items).toHaveLength(1);
    expect(box.items[0]!.count).toBe(3);
  });
});

describe("settings (N-35, QOL-20, QOL-30)", () => {
  it("lets a type go silent but never safety", async () => {
    const [jade, malik] = [await account("jade"), await account("malik")];
    const crewId = await crewOf(jade, malik);
    await registerPhone(malik);
    await app.inject({ method: "PUT", url: "/v1/notifications/settings", headers: malik.auth, payload: { types: { outCall: false, sos: false } } });
    const settings = (await app.inject({ method: "GET", url: "/v1/notifications/settings", headers: malik.auth })).json() as { kinds: { kind: string; on: boolean }[] };
    expect(settings.kinds.find((k) => k.kind === "outCall")?.on).toBe(false);
    expect(settings.kinds.find((k) => k.kind === "sos")?.on).toBe(true);

    await app.inject({ method: "POST", url: `/v1/crews/${crewId}/out-calls`, headers: jade.auth, payload: {} });
    await app.inject({ method: "POST", url: "/v1/sos", headers: jade.auth, payload: {} });
    await push.idle();
    const box = await inbox(malik);
    // Both are in the history; only the SOS counts as unread and rang the phone.
    expect(box.items.map((i) => i.kind).sort()).toEqual(["outCall", "sos"]);
    expect(box.unread).toBe(1);
    expect(ios.sent.map((s) => s.message.data.k)).toEqual(["sos"]);
  });

  it("holds what can wait during quiet hours and sends one summary after", async () => {
    const [jade, malik] = [await account("jade"), await account("malik")];
    const crewId = await crewOf(jade, malik);
    const partyId = await partyOf(crewId, [jade, malik]);
    await registerPhone(malik);
    // Home already: no end-of-night check for malik in this test.
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/status`, headers: malik.auth, payload: { homeSafe: true } });
    // 23:30 in Paris.
    clock = Date.UTC(2026, 10, 7, 22, 30);
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/close`, headers: jade.auth });
    // A "who's in?" cannot wait: it goes out, without sound.
    await app.inject({ method: "POST", url: `/v1/crews/${crewId}/out-calls`, headers: jade.auth, payload: {} });
    await push.idle();
    expect(ios.sent.map((s) => [s.message.data.k, s.message.passive])).toEqual([["outCall", true]]);
    expect((await inbox(malik)).items.find((i) => i.kind === "recapReady")).toBeTruthy();

    // 3:00: still quiet.
    clock = Date.UTC(2026, 10, 8, 2, 0);
    await sweepNotifications(testCtx());
    await push.idle();
    expect(ios.sent).toHaveLength(1);
    // 9:30: one push for what waited.
    clock = Date.UTC(2026, 10, 8, 8, 30);
    await sweepNotifications(testCtx());
    await sweepNotifications(testCtx());
    await push.idle();
    expect(ios.sent).toHaveLength(2);
    expect(ios.sent[1]!.message).toMatchObject({ title: en.notify.push.summary.title, body: "1 new notification", data: { k: "summary" } });
  });

  it("mutes a party until morning, and safety still comes through", async () => {
    const [jade, malik, lea] = [await account("jade"), await account("malik"), await account("lea")];
    const crewId = await crewOf(jade, malik, lea);
    const partyId = await partyOf(crewId, [jade, malik, lea]);
    await registerPhone(malik);
    const muted = (await app.inject({ method: "POST", url: `/v1/parties/${partyId}/mute`, headers: malik.auth, payload: {} })).json() as { until: number };
    // 9:00 the next morning in Paris.
    expect(muted.until).toBe(Date.UTC(2026, 10, 8, 8, 0));
    await app.inject({
      method: "POST",
      url: `/v1/parties/${partyId}/rounds`,
      headers: jade.auth,
      payload: { id: randomUUID(), payerId: jade.id, memberIds: [jade.id, malik.id, lea.id], drink: { presetId: "m-pint", kind: "pint", volumeMl: 500, abv: 0.05 }, amount: 0, currency: "EUR" },
    });
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/status`, headers: lea.auth, payload: { unwell: true } });
    await push.idle();
    expect(ios.sent.map((s) => s.message.data.k)).toEqual(["unwell"]);
    expect((await inbox(malik)).items.map((i) => i.kind).sort()).toEqual(["round", "unwell"]);
    // Outsiders cannot mute a party they are not in.
    const stranger = await account("stranger");
    expect((await app.inject({ method: "POST", url: `/v1/parties/${partyId}/mute`, headers: stranger.auth, payload: {} })).statusCode).toBe(404);
  });
});

describe("push payloads (QOL-27, MSG-04)", () => {
  it("carry generic text and ids, never names, figures or content", async () => {
    const [jade, malik, lea] = [await account("jade"), await account("malik"), await account("lea")];
    const crewId = await crewOf(jade, malik, lea);
    const partyId = await partyOf(crewId, [jade, malik, lea], "Anniv de Lea 2026");
    await registerPhone(malik);
    await app.inject({ method: "POST", url: `/v1/crews/${crewId}/out-calls`, headers: jade.auth, payload: { note: "Le Zinc vers 22 h" } });
    await app.inject({ method: "POST", url: "/v1/sos", headers: jade.auth, payload: { partyId, location: { lat: 48.86, lng: 2.38, accuracy: 20 } } });
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/status`, headers: lea.auth, payload: { unwell: true } });
    await app.inject({
      method: "POST",
      url: `/v1/parties/${partyId}/rounds`,
      headers: jade.auth,
      payload: { id: randomUUID(), payerId: jade.id, memberIds: [jade.id, malik.id], drink: { presetId: "m-pint", kind: "pint", volumeMl: 500, abv: 0.05, name: "Pinte" }, amount: 1200, currency: "EUR" },
    });
    await push.idle();
    expect(ios.sent.map((s) => s.message.data.k).sort()).toEqual(["outCall", "round", "sos", "unwell"]);
    for (const { message } of ios.sent) {
      const kind = message.data.k as keyof typeof en.notify.push;
      expect(message.title).toBe(en.notify.push[kind].title);
      expect(message.body).toBe(en.notify.push[kind].body);
      const raw = JSON.stringify(message);
      for (const leak of ["jade", "lea", "Anniv", "Zinc", "Pinte"]) expect(raw).not.toContain(leak);
      // No figure of any kind in what the lock screen shows.
      expect(`${message.title} ${message.body}`).not.toMatch(/\d/);
      for (const key of Object.keys(message.data)) expect(["n", "k", "p", "c", "r"]).toContain(key);
      for (const value of Object.values(message.data)) expect(value).toMatch(/^([0-9a-f-]{36}|[a-zA-Z]+)$/);
    }
    // The out call is grouped with the crew, the party ones in the party's thread (QOL-30).
    expect(ios.sent.find((s) => s.message.data.k === "unwell")!.message).toMatchObject({ threadId: partyId, category: "party", timeSensitive: true });
    expect(ios.sent.find((s) => s.message.data.k === "outCall")!.message).toMatchObject({ threadId: crewId, category: "outCall" });
  });

  it("uses the recipient's language", async () => {
    const [jade, malik] = [await account("jade"), await account("malik")];
    await crewOf(jade, malik);
    await registerPhone(malik);
    await db.query("insert into user_preferences (user_id, data, updated_at) values ($1, $2, $3)", [malik.id, JSON.stringify({ language: "fr" }), clock]);
    await app.inject({ method: "POST", url: "/v1/sos", headers: jade.auth, payload: {} });
    await push.idle();
    expect(ios.sent[0]!.message.body).toContain("crew");
    expect(ios.sent[0]!.message.body).toContain("Ouvre");
  });
});

describe("producers", () => {
  async function drink(user: User) {
    const id = randomUUID();
    await app.inject({
      method: "POST",
      url: "/v1/mutations",
      headers: user.auth,
      payload: { mutations: [{ key: `k-${id}`, mutation: { kind: "drink.add", drink: { id, presetId: "m-half", kind: "half", volumeMl: 250, abv: 0.05, consumedAt: clock, loggedAt: clock, withFood: false } } }] },
    });
    // Spaced out, so no drink is dropped as part of a burst (AC-07).
    clock += 10 * MIN;
    return id;
  }

  it("tells someone they were overtaken, once an hour per pair (RANK-02)", async () => {
    const [jade, malik] = [await account("jade"), await account("malik")];
    const crewId = await crewOf(jade, malik);
    const partyId = await partyOf(crewId, [jade, malik]);
    const confirm = (id: string, by: User) => app.inject({ method: "POST", url: `/v1/drinks/${id}/confirm`, headers: by.auth });
    await confirm(await drink(malik), jade);
    // Passed while at zero: no news for jade.
    expect((await inbox(jade)).items).toEqual([]);
    await confirm(await drink(jade), malik);
    await confirm(await drink(jade), malik);
    const box = await inbox(malik);
    expect(box.items.map((i) => [i.kind, i.params.name, i.partyId])).toEqual([["overtaken", "jade", partyId]]);
    // Malik takes the lead back, then jade again within the hour: malik hears nothing new.
    await confirm(await drink(malik), jade);
    await confirm(await drink(malik), jade);
    await confirm(await drink(jade), malik);
    await confirm(await drink(jade), malik);
    expect((await inbox(malik)).items.filter((i) => i.kind === "overtaken")).toHaveLength(1);
    expect((await inbox(jade)).items.filter((i) => i.kind === "overtaken")).toHaveLength(1);
  });

  it("flags a quiet member, asks who is home and tells the crew who is not (N-29, N-25)", async () => {
    const [jade, malik] = [await account("jade"), await account("malik")];
    const crewId = await crewOf(jade, malik);
    const partyId = await partyOf(crewId, [jade, malik]);
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/status`, headers: malik.auth, payload: { batteryLow: false } });
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/status`, headers: jade.auth, payload: { batteryLow: false } });
    clock += 50 * MIN;
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/status`, headers: jade.auth, payload: { batteryLow: false } });
    // The night watch finds the quiet member with the party's own threshold (45 min by default).
    await sweepLiveParties(testCtx());
    await sweepLiveParties(testCtx());
    expect((await inbox(jade)).items.map((i) => [i.kind, i.params.name])).toEqual([["quietMember", "malik"]]);

    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/status`, headers: jade.auth, payload: { homeSafe: true } });
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/close`, headers: jade.auth });
    await sweepNotifications(testCtx());
    expect((await inbox(malik)).items.map((i) => i.kind).sort()).toEqual(["homeCheck", "recapReady"]);
    clock += 61 * MIN;
    await sweepNotifications(testCtx());
    await sweepNotifications(testCtx());
    const jadeBox = await inbox(jade);
    expect(jadeBox.items.filter((i) => i.kind === "notHome").map((i) => i.params.name)).toEqual(["malik"]);
    expect(jadeBox.items.filter((i) => i.kind === "recapReady")).toHaveLength(1);
    expect(jadeBox.items.filter((i) => i.kind === "homeCheck")).toEqual([]);
  });

  it("tells the dethroned boss and the crew about a takeover, and the crew about a cheat attempt (TER-04, AC-09)", async () => {
    const { notifyTakeover, notifyCheatAttempt } = await import("./notifications/producers");
    const [jade, malik, lea] = [await account("jade"), await account("malik"), await account("lea")];
    const crewId = await crewOf(jade, malik, lea);
    const venueId = randomUUID();
    await app.inject({ method: "POST", url: `/v1/crews/${crewId}/venues`, headers: jade.auth, payload: { id: venueId, name: "Le Zinc", kind: "bar", lat: 48.8566, lng: 2.3522 } });
    await notifyTakeover(testCtx(), crewId, { venueId, bossId: jade.id, takenFrom: malik.id });
    expect((await inbox(malik)).items[0]).toMatchObject({ kind: "takeover", params: { name: "jade", venue: "Le Zinc", mine: true } });
    expect((await inbox(lea)).items[0]).toMatchObject({ kind: "takeover", params: { mine: false } });
    expect((await inbox(jade)).items).toEqual([]);
    await notifyCheatAttempt(testCtx(), crewId, venueId, lea.id, randomUUID());
    expect((await inbox(jade)).items[0]).toMatchObject({ kind: "cheatAttempt", params: { name: "lea", venue: "Le Zinc" } });
  });
});

describe("APNs (O-38)", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  function decode(jwt: string) {
    const [header, claims, signature] = jwt.split(".") as [string, string, string];
    return {
      header: JSON.parse(Buffer.from(header, "base64url").toString()) as Record<string, unknown>,
      claims: JSON.parse(Buffer.from(claims, "base64url").toString()) as Record<string, unknown>,
      valid: verify("sha256", Buffer.from(`${header}.${claims}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64url")),
      signatureBytes: Buffer.from(signature, "base64url").length,
    };
  }

  it("signs the provider token ES256 with the .p8 key", () => {
    const jwt = apnsJwt(privateKey, "ABC123DEFG", "TEAM123456", Date.UTC(2026, 10, 7, 19, 0));
    const parsed = decode(jwt);
    expect(parsed.header).toEqual({ alg: "ES256", kid: "ABC123DEFG" });
    expect(parsed.claims).toEqual({ iss: "TEAM123456", iat: Date.UTC(2026, 10, 7, 19, 0) / 1000 });
    expect(parsed.signatureBytes).toBe(64);
    expect(parsed.valid).toBe(true);
  });

  it("posts over HTTP/2 with the token, topic and a generic alert, and spots dead tokens", async () => {
    const seen: { headers: IncomingHttpHeaders; body: string }[] = [];
    const server: Http2Server = createServer();
    server.on("stream", (stream: ServerHttp2Stream, headers: IncomingHttpHeaders) => {
      let body = "";
      stream.setEncoding("utf8");
      stream.on("data", (chunk: string) => (body += chunk));
      stream.on("end", () => {
        seen.push({ headers, body });
        const dead = String(headers[":path"]).includes("dead");
        stream.respond({ ":status": dead ? 410 : 200, "content-type": "application/json" });
        stream.end(dead ? JSON.stringify({ reason: "Unregistered" }) : "");
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    // Single-line PEM with literal \n, as env files often carry it.
    const transport = new ApnsTransport({ keyId: "ABC123DEFG", teamId: "TEAM123456", key: pem.replace(/\n/g, "\\n"), topic: "app.soireecrew.mobile", production: false, origin: `http://127.0.0.1:${port}`, now: () => clock });
    const message: PushMessage = { title: "SOS", body: "Someone in your crew needs help.", data: { n: randomUUID(), k: "sos" }, category: "party", threadId: "p1", channel: "safety", badge: 2, timeSensitive: true };
    const token = "ab".repeat(32);
    expect(await transport.send(token, message)).toBe("ok");
    expect(await transport.send("dead".padEnd(64, "0"), message)).toBe("gone");
    // Not a device token at all: never sent.
    expect(await transport.send("not-a-token", message)).toBe("gone");
    expect(seen).toHaveLength(2);
    transport.close();
    await new Promise((resolve) => server.close(resolve));

    const first = seen[0]!;
    expect(first.headers[":method"]).toBe("POST");
    expect(first.headers[":path"]).toBe(`/3/device/${token}`);
    expect(first.headers["apns-topic"]).toBe("app.soireecrew.mobile");
    expect(first.headers["apns-push-type"]).toBe("alert");
    const auth = String(first.headers.authorization);
    expect(auth.startsWith("bearer ")).toBe(true);
    const jwt = decode(auth.slice(7));
    expect(jwt.valid).toBe(true);
    expect(jwt.claims.iss).toBe("TEAM123456");
    const body = JSON.parse(first.body) as { aps: Record<string, unknown>; body: Record<string, string> };
    expect(body.aps).toMatchObject({ alert: { title: "SOS", body: "Someone in your crew needs help." }, sound: "default", badge: 2, "thread-id": "p1", category: "party", "interruption-level": "time-sensitive" });
    expect(body.body).toEqual(message.data);
  });
});

describe("FCM (O-38)", () => {
  it("gets an access token with an RS256 service-account JWT and sends data-only messages", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("oauth2")) return new Response(JSON.stringify({ access_token: "ya29.test", expires_in: 3600 }), { status: 200 });
      if (String(init.body).includes("gone-token")) return new Response(JSON.stringify({ error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } }), { status: 404 });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const transport = new FcmTransport({ projectId: "crew-test", clientEmail: "push@crew-test.iam.gserviceaccount.com", privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(), fetch: fakeFetch, now: () => clock });
    const message: PushMessage = { title: "Who's in?", body: "Someone in your crew is going out tonight.", data: { n: randomUUID(), k: "outCall" }, category: "outCall", channel: "plans" };
    expect(await transport.send("token-1", message)).toBe("ok");
    expect(await transport.send("gone-token", message)).toBe("gone");
    // The access token is reused.
    expect(calls.filter((c) => c.url.includes("oauth2"))).toHaveLength(1);
    const assertion = new URLSearchParams(String(calls[0]!.init.body)).get("assertion")!;
    const [h, c, s] = assertion.split(".") as [string, string, string];
    expect(verify("sha256", Buffer.from(`${h}.${c}`), publicKey, Buffer.from(s, "base64url"))).toBe(true);
    expect(JSON.parse(Buffer.from(c, "base64url").toString())).toMatchObject({ iss: "push@crew-test.iam.gserviceaccount.com", aud: "https://oauth2.googleapis.com/token" });
    const sent = JSON.parse(String(calls[1]!.init.body)) as { message: { token: string; notification?: unknown; data: Record<string, string> } };
    expect(calls[1]!.url).toBe("https://fcm.googleapis.com/v1/projects/crew-test/messages:send");
    expect(sent.message.notification).toBeUndefined();
    expect(sent.message.data).toMatchObject({ title: "Who's in?", categoryId: "outCall", channelId: "plans" });
    expect(JSON.parse(sent.message.data.body!)).toEqual(message.data);
  });
});

/** The context the app was built with, for calling producers and the sweeper directly. */
function testCtx(): Context {
  return ctx;
}
