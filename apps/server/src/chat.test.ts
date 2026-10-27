import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ChatGroup, fromBase64, newKeyPackages, newSignatureKeys, readPayload, toBase64, writePayload, type Directory, type KeyPackageBundle } from "@crew/mls";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";

let clock = Date.UTC(2026, 10, 4, 12, 0);
let db: Db;
let app: FastifyInstance;

beforeEach(async () => {
  clock = Date.UTC(2026, 10, 4, 12, 0);
  db = await connectPglite();
  await migrate(db);
  const uploadDir = mkdtempSync(join(tmpdir(), "chat-"));
  app = await buildApp({ db, sealer: new Sealer(randomBytes(32).toString("base64")), live: new LiveHub(), now: () => clock, publicUrl: "https://crew.test", hashSecret: "s", uploadDir });
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
async function crew(...names: string[]) {
  const users = await Promise.all(names.map(account));
  const crewId = ((await app.inject({ method: "POST", url: "/v1/crews", headers: users[0]!.auth, payload: { name: "Crew" } })).json() as { crew: { id: string } }).crew.id;
  const { code } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/invites`, headers: users[0]!.auth })).json() as { code: string };
  for (const u of users.slice(1)) await app.inject({ method: "POST", url: `/v1/invites/${code}/accept`, headers: u.auth });
  return { users, crewId };
}

const directory: Directory = async (device) => {
  const res = await app.inject({ method: "POST", url: "/v1/chat/directory", headers: {}, payload: { deviceIds: [device.deviceId] } });
  void res;
  const rows = await db.query<{ signature_key: string; user_id: string }>("select signature_key, user_id from chat_devices where id = $1", [device.deviceId]);
  return rows[0] && rows[0].user_id === device.userId ? fromBase64(rows[0].signature_key) : undefined;
};

/** A phone: registers its MLS client and uploads key packages, like the app does. */
async function phone(user: User) {
  const keys = await newSignatureKeys();
  const reg = (await app.inject({ method: "PUT", url: "/v1/chat/device", headers: user.auth, payload: { signatureKey: toBase64(keys.publicKey) } })).json() as { deviceId: string };
  const ref = { userId: user.id, deviceId: reg.deviceId };
  const bundles = await newKeyPackages(ref, keys, 3);
  const up = await app.inject({ method: "POST", url: "/v1/chat/key-packages", headers: user.auth, payload: { packages: bundles.map((b) => ({ ref: b.ref, data: b.publicData })) } });
  expect(up.statusCode).toBe(201);
  return { user, deviceId: reg.deviceId, bundles: new Map<string, KeyPackageBundle>(bundles.map((b) => [b.ref, b])) };
}

async function conversations(user: User) {
  return (await app.inject({ method: "GET", url: "/v1/conversations", headers: user.auth })).json() as {
    deviceId: string | null;
    conversations: { id: string; kind: string; title: string; epoch: number | null; inGroup: boolean; members: string[]; readOnly: boolean }[];
  };
}

const enc = (s: string) => new TextEncoder().encode(s);

describe("messaging delivery service (MSG-01, MSG-02)", () => {
  it("creates the crew group, welcomes a member and carries only ciphertext", async () => {
    const { users } = await crew("jade", "malik");
    const [jade, malik] = users as [User, User];
    const outsider = await account("eve");
    const pj = await phone(jade);
    const pm = await phone(malik);

    const list = await conversations(jade);
    const conv = list.conversations.find((c) => c.kind === "crew")!;
    expect(conv.title).toBe("Crew");
    expect(conv.epoch).toBeNull();

    // Jade's device creates the group, claims Malik's package and adds him.
    expect((await app.inject({ method: "POST", url: `/v1/conversations/${conv.id}/init`, headers: jade.auth })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: `/v1/conversations/${conv.id}/init`, headers: malik.auth })).statusCode).toBe(409);
    let gj = await ChatGroup.create(conv.id, [...pj.bundles.values()][0]!, directory);
    const roster = (await app.inject({ method: "GET", url: `/v1/conversations/${conv.id}/roster`, headers: jade.auth })).json() as { expected: { deviceId: string }[]; inGroup: string[] };
    expect(roster.inGroup).toEqual([pj.deviceId]);
    const missing = roster.expected.filter((d) => !roster.inGroup.includes(d.deviceId)).map((d) => d.deviceId);
    expect(missing).toEqual([pm.deviceId]);
    const claimed = (await app.inject({ method: "POST", url: `/v1/conversations/${conv.id}/claim`, headers: jade.auth, payload: { deviceIds: missing } })).json() as {
      packages: { deviceId: string; ref: string; data: string }[];
    };
    expect(claimed.packages).toHaveLength(1);
    const added = await gj.commit({ add: claimed.packages.map((p) => p.data) });
    const post = (epoch: number) =>
      app.inject({
        method: "POST",
        url: `/v1/conversations/${conv.id}/messages`,
        headers: jade.auth,
        payload: { kind: "commit", epoch, data: added.commit, welcome: added.welcome, adds: claimed.packages.map((p) => ({ deviceId: p.deviceId, keyPackageRef: p.ref })) },
      });
    expect((await post(0)).statusCode).toBe(201);
    // A second commit for the same epoch loses.
    expect((await post(0)).statusCode).toBe(409);
    gj = added.group;

    // Malik's device finds its welcome and joins.
    const welcomes = (await app.inject({ method: "GET", url: "/v1/chat/welcomes", headers: malik.auth })).json() as { welcomes: { id: string; keyPackageRef: string; data: string; afterSeq: number }[] };
    expect(welcomes.welcomes).toHaveLength(1);
    const w = welcomes.welcomes[0]!;
    let gm = await ChatGroup.join(w.data, pm.bundles.get(w.keyPackageRef)!, directory);
    await app.inject({ method: "DELETE", url: `/v1/chat/welcomes/${w.id}`, headers: malik.auth });

    // Jade writes; the server stores bytes it cannot read; Malik decrypts.
    const sent = await gj.encrypt(writePayload({ t: "text", id: "m1", body: "on se retrouve au Zinc" }));
    gj = sent.group;
    const res = await app.inject({ method: "POST", url: `/v1/conversations/${conv.id}/messages`, headers: jade.auth, payload: { kind: "application", epoch: gj.epoch, data: sent.message } });
    expect(res.statusCode).toBe(201);
    const stored = await db.query<{ data: string }>("select data from chat_messages where kind = 'application'");
    expect(Buffer.from(stored[0]!.data, "base64").toString("latin1")).not.toContain("Zinc");

    const fetched = (await app.inject({ method: "GET", url: `/v1/conversations/${conv.id}/messages?after=${w.afterSeq}`, headers: malik.auth })).json() as {
      messages: { seq: number; kind: string; data: string | null; mine: boolean }[];
    };
    expect(fetched.messages.map((m) => m.kind)).toEqual(["application"]);
    const incoming = await gm.process(fetched.messages[0]!.data!);
    expect(incoming.kind).toBe("application");
    if (incoming.kind === "application") {
      expect(incoming.sender.userId).toBe(jade.id);
      expect(readPayload(incoming.plaintext)).toEqual({ t: "text", id: "m1", body: "on se retrouve au Zinc" });
      gm = incoming.group;
    }
    // The sender gets its own message flagged, without the ciphertext it cannot decrypt anyway.
    const own = (await app.inject({ method: "GET", url: `/v1/conversations/${conv.id}/messages`, headers: jade.auth })).json() as { messages: { mine: boolean; data: string | null }[] };
    expect(own.messages.filter((m) => m.mine).every((m) => m.data === null)).toBe(true);

    // Outsiders see nothing, not even that the conversation exists.
    expect((await app.inject({ method: "GET", url: `/v1/conversations/${conv.id}/messages`, headers: outsider.auth })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: `/v1/conversations/${conv.id}/roster`, headers: outsider.auth })).statusCode).toBe(404);
    void gm;
  });

  it("refuses messages from a device outside the group and from a stale epoch", async () => {
    const { users } = await crew("jade", "malik");
    const [jade, malik] = users as [User, User];
    await phone(jade);
    await phone(malik);
    const conv = (await conversations(jade)).conversations[0]!;
    await app.inject({ method: "POST", url: `/v1/conversations/${conv.id}/init`, headers: jade.auth });
    const outside = await app.inject({ method: "POST", url: `/v1/conversations/${conv.id}/messages`, headers: malik.auth, payload: { kind: "application", epoch: 0, data: toBase64(enc("x")) } });
    expect(outside.json()).toEqual({ error: "not_in_group" });
    const future = await app.inject({ method: "POST", url: `/v1/conversations/${conv.id}/messages`, headers: jade.auth, payload: { kind: "application", epoch: 5, data: toBase64(enc("x")) } });
    expect(future.json()).toEqual({ error: "stale_epoch" });
  });

  it("keeps a group with its creator however long it waits alone, and frees it once nobody is left", async () => {
    const { users } = await crew("jade", "malik");
    const [jade, malik] = users as [User, User];
    await phone(jade);
    await phone(malik);
    const conv = (await conversations(jade)).conversations[0]!;
    await app.inject({ method: "POST", url: `/v1/conversations/${conv.id}/init`, headers: jade.auth });
    clock += 60 * 60_000;
    expect((await app.inject({ method: "POST", url: `/v1/conversations/${conv.id}/init`, headers: malik.auth })).statusCode).toBe(409);
    await app.inject({ method: "DELETE", url: "/v1/sessions/current", headers: jade.auth });
    expect((await app.inject({ method: "POST", url: `/v1/conversations/${conv.id}/init`, headers: malik.auth })).statusCode).toBe(200);
  });

  it("drops a signed-out device from the roster and lets disappearing messages go", async () => {
    const { users } = await crew("jade", "malik");
    const [jade, malik] = users as [User, User];
    const pj = await phone(jade);
    await phone(malik);
    const conv = (await conversations(jade)).conversations[0]!;
    await app.inject({ method: "POST", url: `/v1/conversations/${conv.id}/init`, headers: jade.auth });

    expect((await app.inject({ method: "PUT", url: `/v1/conversations/${conv.id}/settings`, headers: malik.auth, payload: { disappearSeconds: 999 } })).statusCode).toBe(400);
    expect((await app.inject({ method: "PUT", url: `/v1/conversations/${conv.id}/settings`, headers: malik.auth, payload: { disappearSeconds: 3600 } })).statusCode).toBe(200);
    await app.inject({ method: "POST", url: `/v1/conversations/${conv.id}/messages`, headers: jade.auth, payload: { kind: "application", epoch: 0, data: toBase64(enc("bientôt parti")) } });
    const before = (await app.inject({ method: "GET", url: `/v1/conversations/${conv.id}/messages`, headers: jade.auth })).json() as { messages: { expiresAt: number | null }[] };
    expect(before.messages[0]!.expiresAt).toBe(clock + 3_600_000);
    clock += 2 * 3_600_000;
    const after = (await app.inject({ method: "GET", url: `/v1/conversations/${conv.id}/messages`, headers: jade.auth })).json() as { messages: unknown[] };
    expect(after.messages).toHaveLength(0);
    expect((await db.query("select 1 from chat_messages where kind = 'application'")).length).toBe(0);

    await app.inject({ method: "DELETE", url: "/v1/sessions/current", headers: malik.auth });
    const roster = (await app.inject({ method: "GET", url: `/v1/conversations/${conv.id}/roster`, headers: jade.auth })).json() as { expected: { deviceId: string }[] };
    expect(roster.expected.map((d) => d.deviceId)).toEqual([pj.deviceId]);
  });

  it("stores encrypted media and backups for members only, and passes reports to admins", async () => {
    const { users, crewId } = await crew("jade", "malik");
    const [jade, malik] = users as [User, User];
    const outsider = await account("eve");
    const conv = (await conversations(jade)).conversations[0]!;
    const blob = (await app.inject({ method: "POST", url: `/v1/conversations/${conv.id}/blobs`, headers: malik.auth, payload: { data: toBase64(randomBytes(2000)) } })).json() as { id: string };
    expect((await app.inject({ method: "GET", url: `/v1/chat/blobs/${blob.id}`, headers: jade.auth })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: `/v1/chat/blobs/${blob.id}`, headers: outsider.auth })).statusCode).toBe(404);

    const backup = toBase64(randomBytes(500));
    expect((await app.inject({ method: "PUT", url: "/v1/chat/backup", headers: malik.auth, payload: { data: backup } })).statusCode).toBe(200);
    expect(((await app.inject({ method: "GET", url: "/v1/chat/backup", headers: malik.auth })).json() as { data: string }).data).toBe(backup);
    expect((await app.inject({ method: "GET", url: "/v1/chat/backup", headers: jade.auth })).statusCode).toBe(404);

    const report = await app.inject({
      method: "POST",
      url: `/v1/conversations/${conv.id}/report`,
      headers: malik.auth,
      payload: { reason: "harassment", messages: [{ id: "m1", userId: jade.id, body: "message signalé", at: clock, reported: true }] },
    });
    expect(report.statusCode).toBe(201);
    const seen = (await app.inject({ method: "GET", url: `/v1/crews/${crewId}/reports`, headers: jade.auth })).json() as { reports: { targetKind: string; messages?: { body: string }[] }[] };
    expect(seen.reports[0]!.targetKind).toBe("message");
    expect(seen.reports[0]!.messages![0]!.body).toBe("message signalé");
    const sealed = await db.query<{ evidence: string }>("select evidence from reports");
    expect(sealed[0]!.evidence).not.toContain("signalé");
  });

  it("opens a direct chat only between friends", async () => {
    const a = await account("jade");
    const b = await account("noor");
    expect((await app.inject({ method: "POST", url: "/v1/conversations/direct", headers: a.auth, payload: { userId: b.id } })).statusCode).toBe(403);
    const [ua, ub] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
    await db.query("insert into friendships (user_a, user_b, requested_by, status, at) values ($1, $2, $1, 'accepted', $3)", [ua, ub, clock]);
    const first = await app.inject({ method: "POST", url: "/v1/conversations/direct", headers: a.auth, payload: { userId: b.id } });
    expect(first.statusCode).toBe(201);
    const again = await app.inject({ method: "POST", url: "/v1/conversations/direct", headers: b.auth, payload: { userId: a.id } });
    expect((again.json() as { id: string }).id).toBe((first.json() as { id: string }).id);
    const list = await conversations(b);
    expect(list.conversations.find((c) => c.kind === "direct")?.title).toBe("jade");
  });
});
