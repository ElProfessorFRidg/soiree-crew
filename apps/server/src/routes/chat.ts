import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { bearer, HttpError, requireUser, type Context } from "../context";
import { RateLimiter } from "../ratelimit";
import { hashToken } from "../crypto";
import type { Db } from "../db";

// MSG-01, MSG-02 (ADR 0005): the MLS delivery service. Everything that carries content is
// ciphertext made on a phone; the server orders it, routes it to devices and forgets it.

const uuid = z.string().uuid();
const b64 = (max: number) => z.string().min(4).max(max).regex(/^[A-Za-z0-9+/]+=*$/);
const DAY_MS = 86_400_000;
/** Without a disappearing timer, ciphertext waits this long for a device that was offline. */
const APPLICATION_TTL_MS = 30 * DAY_MS;
/** Commits are what a late device needs to catch up with the group: kept longer. */
const COMMIT_TTL_MS = 90 * DAY_MS;
/** Application messages may arrive from a recent epoch; ts-mls keeps the keys of the last four. */
const EPOCH_SLACK = 3;
/** Party chats close a day after the party ends, once the recap is out. */
const PARTY_OPEN_AFTER_END_MS = DAY_MS;
const MAX_BLOB = 6 * 1024 * 1024;
const MAX_BACKUP = 12 * 1024 * 1024;
export const DISAPPEAR_CHOICES = [0, 3600, 6 * 3600, 86_400, 7 * 86_400] as const;

interface ConversationRow {
  id: string;
  kind: "crew" | "party" | "direct";
  crew_id: string | null;
  party_id: string | null;
  user_a: string | null;
  user_b: string | null;
  epoch: number | null;
  init_device: string | null;
  init_at: number | null;
  disappear_seconds: number;
  created_at: number;
}

const CONVERSATION_COLUMNS = "id, kind, crew_id, party_id, user_a, user_b, epoch, init_device, init_at, disappear_seconds, created_at";

function chatDir(ctx: Context, sub: string): string {
  const dir = join(ctx.uploadDir ?? "./data/uploads", sub);
  mkdirSync(dir, { recursive: true });
  return dir;
}
const blobPath = (ctx: Context, id: string) => join(chatDir(ctx, "chat"), `${id}.bin`);
const backupPath = (ctx: Context, userId: string) => join(chatDir(ctx, "chat-backups"), `${userId}.bin`);

/** O-07: the sealed chat backup goes with the account. */
export async function deleteChatBackup(ctx: Context, userId: string): Promise<void> {
  await unlink(backupPath(ctx, userId)).catch(() => undefined);
}

/** The MLS client of the device making the request, found by its session. */
async function deviceOf(ctx: Context, request: FastifyRequest): Promise<{ id: string; userId: string } | null> {
  const token = bearer(request);
  if (!token) return null;
  const rows = await ctx.db.query<{ id: string; user_id: string }>("select id, user_id from chat_devices where session_hash = $1", [hashToken(token)]);
  return rows[0] ? { id: rows[0].id, userId: rows[0].user_id } : null;
}

async function requireDevice(ctx: Context, request: FastifyRequest) {
  const device = await deviceOf(ctx, request);
  if (!device) throw new HttpError(409, "no_device");
  return device;
}

async function partyClosed(db: Db, partyId: string, now: number): Promise<boolean> {
  const rows = await db.query<{ closed_at: number | null; ends_at: number }>("select closed_at, ends_at from parties where id = $1", [partyId]);
  const party = rows[0];
  return !party || party.closed_at !== null || party.ends_at + PARTY_OPEN_AFTER_END_MS < now;
}

/** Who belongs to a conversation right now: always derived from crews, parties and friendships. */
export async function conversationMembers(db: Db, conversation: ConversationRow): Promise<string[]> {
  if (conversation.kind === "crew") {
    return (await db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1", [conversation.crew_id])).map((r) => r.user_id);
  }
  if (conversation.kind === "party") {
    return (
      await db.query<{ user_id: string }>("select user_id from party_members where party_id = $1 and response <> 'declined'", [conversation.party_id])
    ).map((r) => r.user_id);
  }
  return [conversation.user_a!, conversation.user_b!];
}

async function loadConversation(db: Db, id: string): Promise<ConversationRow | undefined> {
  return (await db.query<ConversationRow>(`select ${CONVERSATION_COLUMNS} from conversations where id = $1`, [uuid.parse(id)]))[0];
}

/** 404 for anyone outside, so conversation ids leak nothing. */
async function conversationFor(ctx: Context, id: string, userId: string): Promise<{ conversation: ConversationRow; members: string[] }> {
  const conversation = await loadConversation(ctx.db, id);
  if (!conversation) throw new HttpError(404, "not_found");
  const members = await conversationMembers(ctx.db, conversation);
  if (!members.includes(userId)) throw new HttpError(404, "not_found");
  return { conversation, members };
}

async function blockedBetween(db: Db, a: string, b: string): Promise<boolean> {
  return (await db.query("select 1 from blocks where (blocker = $1 and blocked = $2) or (blocker = $2 and blocked = $1)", [a, b])).length > 0;
}

/** Read-only: a closed party, or a direct chat with someone blocked or no longer a friend. */
async function readOnly(ctx: Context, conversation: ConversationRow): Promise<boolean> {
  if (conversation.kind === "party") return partyClosed(ctx.db, conversation.party_id!, ctx.now());
  if (conversation.kind === "direct") {
    const [a, b] = [conversation.user_a!, conversation.user_b!];
    if (await blockedBetween(ctx.db, a, b)) return true;
    return !(await ctx.db.query("select 1 from friendships where user_a = $1 and user_b = $2 and status = 'accepted'", [a, b])).length;
  }
  return false;
}

/** The devices that should be leaves of the group: every active device of every member. */
async function expectedDevices(db: Db, members: string[]) {
  return db.query<{ id: string; user_id: string; signature_key: string; packages: number }>(
    `select d.id, d.user_id, d.signature_key, (select count(*)::int from chat_key_packages k where k.device_id = d.id) as packages
     from chat_devices d where d.user_id = any($1::uuid[]) and d.session_hash is not null order by d.created_at`,
    [members],
  );
}

/** Crew and party conversations exist as soon as someone asks; there is nothing to set up by hand. */
async function ensureConversations(ctx: Context, userId: string): Promise<void> {
  const now = ctx.now();
  await ctx.db.query(
    `insert into conversations (id, kind, crew_id, created_at)
     select gen_random_uuid(), 'crew', m.crew_id, $2 from crew_members m where m.user_id = $1
     on conflict do nothing`,
    [userId, now],
  );
  await ctx.db.query(
    `insert into conversations (id, kind, party_id, created_at)
     select gen_random_uuid(), 'party', p.id, $2 from party_members m join parties p on p.id = m.party_id
     where m.user_id = $1 and m.response <> 'declined' and p.ends_at > $3
     on conflict do nothing`,
    [userId, now, now - 14 * DAY_MS],
  );
}

let lastPurge = 0;
/** Disappearing messages and old ciphertext go for good, files included (MSG-06). */
async function purge(ctx: Context): Promise<void> {
  const now = ctx.now();
  if (now - lastPurge < 60_000 && now >= lastPurge) return;
  lastPurge = now;
  await ctx.db.query("delete from chat_messages where expires_at < $1", [now]);
  const blobs = await ctx.db.query<{ id: string }>("delete from chat_blobs where expires_at < $1 returning id", [now]);
  for (const blob of blobs) await unlink(blobPath(ctx, blob.id)).catch(() => undefined);
}

/** Everyone who may share a conversation with this person: crews and friends. */
async function sharingUsers(ctx: Context, userId: string): Promise<string[]> {
  const rows = await ctx.db.query<{ user_id: string }>(
    `select user_id from crew_members where crew_id in (select crew_id from crew_members where user_id = $1)
     union select case when user_a = $1 then user_b else user_a end from friendships where (user_a = $1 or user_b = $1) and status = 'accepted'`,
    [userId],
  );
  return rows.map((r) => r.user_id);
}

function notify(ctx: Context, userIds: string[], event: Parameters<Context["live"]["notify"]>[1]) {
  ctx.live.notify(userIds, event);
}

export function chatRoutes(app: FastifyInstance, ctx: Context): void {
  // A storage budget per account, so one account cannot fill the disk with encrypted files.
  const blobUploads = new RateLimiter(300, 24 * 3_600_000, ctx.now);
  /** Registers this device's MLS client. The signature key never changes for a device. */
  app.put("/v1/chat/device", async (request) => {
    const user = requireUser(request);
    const input = z.object({ signatureKey: b64(64), reset: z.boolean().optional() }).parse(request.body);
    if (Buffer.from(input.signatureKey, "base64").length !== 32) throw new HttpError(400, "invalid_key");
    const existing = await deviceOf(ctx, request);
    if (existing) {
      const row = (await ctx.db.query<{ signature_key: string }>("select signature_key from chat_devices where id = $1", [existing.id]))[0]!;
      if (row.signature_key !== input.signatureKey) {
        if (!input.reset) throw new HttpError(409, "key_mismatch");
        // The phone lost its chat keys (reinstalled, storage cleared): it starts over as a new leaf
        // everywhere. Its old key stays on record under a retired id, so old leaves still check.
        await ctx.db.transaction(async (tx) => {
          await tx.query("update chat_devices set session_hash = null where id = $1", [existing.id]);
          await tx.query("insert into chat_devices (id, user_id, session_hash, signature_key, created_at) values ($1, $2, $3, $4, $5)", [
            randomUUID(),
            user.id,
            hashToken(bearer(request)!),
            input.signatureKey,
            ctx.now(),
          ]);
        });
        notify(ctx, await sharingUsers(ctx, user.id), { type: "chat.roster" });
      }
    } else {
      const id = randomUUID();
      await ctx.db.query("insert into chat_devices (id, user_id, session_hash, signature_key, created_at) values ($1, $2, $3, $4, $5)", [
        id,
        user.id,
        hashToken(bearer(request)!),
        input.signatureKey,
        ctx.now(),
      ]);
      // Every conversation of this person now has a device to add.
      notify(ctx, await sharingUsers(ctx, user.id), { type: "chat.roster" });
    }
    const device = (await deviceOf(ctx, request))!;
    const packages = (await ctx.db.query<{ n: number }>("select count(*)::int as n from chat_key_packages where device_id = $1", [device.id]))[0]!.n;
    return { deviceId: device.id, keyPackages: packages };
  });

  app.post("/v1/chat/key-packages", async (request, reply) => {
    requireUser(request);
    const device = await requireDevice(ctx, request);
    const input = z.object({ packages: z.array(z.object({ ref: z.string().regex(/^[A-Za-z0-9_-]{20,100}$/), data: b64(4096) })).min(1).max(50) }).parse(request.body);
    const count = (await ctx.db.query<{ n: number }>("select count(*)::int as n from chat_key_packages where device_id = $1", [device.id]))[0]!.n;
    if (count + input.packages.length > 100) throw new HttpError(409, "too_many");
    for (const p of input.packages) {
      await ctx.db.query("insert into chat_key_packages (ref, device_id, data, created_at) values ($1, $2, $3, $4) on conflict do nothing", [p.ref, device.id, p.data, ctx.now()]);
    }
    return reply.status(201).send({ keyPackages: count + input.packages.length });
  });

  /** Signature keys of devices, for checking the leaves of a group (the MLS authentication service). */
  app.post("/v1/chat/directory", async (request) => {
    const user = requireUser(request);
    const input = z.object({ deviceIds: z.array(uuid).min(1).max(500) }).parse(request.body);
    // Only devices of people I could share a conversation with: a crew mate or a friend.
    const rows = await ctx.db.query<{ id: string; user_id: string; signature_key: string; session_hash: string | null }>(
      `select d.id, d.user_id, d.signature_key, d.session_hash from chat_devices d where d.id = any($1::uuid[]) and (
         d.user_id = $2
         or exists (select 1 from crew_members a join crew_members b on a.crew_id = b.crew_id where a.user_id = $2 and b.user_id = d.user_id)
         or exists (select 1 from friendships f where f.user_a = least($2::uuid, d.user_id) and f.user_b = greatest($2::uuid, d.user_id) and f.status = 'accepted'))`,
      [input.deviceIds, user.id],
    );
    return { devices: rows.map((r) => ({ deviceId: r.id, userId: r.user_id, signatureKey: r.signature_key, active: r.session_hash !== null })) };
  });

  /** MSG-05: the active devices of someone I share a conversation with, for safety numbers. */
  app.get<{ Params: { id: string } }>("/v1/chat/users/:id/devices", async (request) => {
    const user = requireUser(request);
    const other = uuid.parse(request.params.id);
    const shared = await ctx.db.query(
      `select 1 from crew_members a join crew_members b on a.crew_id = b.crew_id where a.user_id = $1 and b.user_id = $2
       union select 1 from friendships where user_a = least($1::uuid, $2::uuid) and user_b = greatest($1::uuid, $2::uuid) and status = 'accepted'`,
      [user.id, other],
    );
    if (!shared.length && other !== user.id) throw new HttpError(404, "not_found");
    const rows = await ctx.db.query<{ id: string; signature_key: string; created_at: number }>(
      "select id, signature_key, created_at from chat_devices where user_id = $1 and session_hash is not null order by created_at",
      [other],
    );
    return { devices: rows.map((r) => ({ deviceId: r.id, signatureKey: r.signature_key, since: r.created_at })) };
  });

  app.get("/v1/conversations", async (request) => {
    const user = requireUser(request);
    const device = await deviceOf(ctx, request);
    await ensureConversations(ctx, user.id);
    await purge(ctx);
    const rows = await ctx.db.query<
      ConversationRow & { crew_name: string | null; party_name: string | null; party_crew: string | null; starts_at: number | null; other_name: string | null; last_seq: number | null; last_at: number | null; in_group: boolean }
    >(
      `select c.id, c.kind, c.crew_id, c.party_id, c.user_a, c.user_b, c.epoch, c.init_device, c.init_at, c.disappear_seconds, c.created_at,
              cr.name as crew_name, p.name as party_name, p.crew_id as party_crew, p.starts_at,
              u.display_name as other_name,
              (select max(seq)::int from chat_messages x where x.conversation_id = c.id and x.kind = 'application') as last_seq,
              (select max(created_at) from chat_messages x where x.conversation_id = c.id and x.kind = 'application') as last_at,
              exists (select 1 from conversation_devices d where d.conversation_id = c.id and d.device_id = $2) as in_group
       from conversations c
       left join crews cr on cr.id = c.crew_id
       left join parties p on p.id = c.party_id
       left join users u on u.id = case when c.user_a = $1 then c.user_b else c.user_a end and c.kind = 'direct'
       where (c.kind = 'crew' and exists (select 1 from crew_members m where m.crew_id = c.crew_id and m.user_id = $1))
          or (c.kind = 'party' and exists (select 1 from party_members m where m.party_id = c.party_id and m.user_id = $1 and m.response <> 'declined') and p.ends_at > $3)
          or (c.kind = 'direct' and (c.user_a = $1 or c.user_b = $1))`,
      [user.id, device?.id ?? null, ctx.now() - 30 * DAY_MS],
    );
    const out = [];
    for (const r of rows) {
      out.push({
        id: r.id,
        kind: r.kind,
        crewId: r.crew_id ?? r.party_crew,
        partyId: r.party_id,
        otherUserId: r.kind === "direct" ? (r.user_a === user.id ? r.user_b : r.user_a) : null,
        title: r.crew_name ?? r.party_name ?? r.other_name ?? "",
        startsAt: r.starts_at,
        epoch: r.epoch,
        disappearSeconds: r.disappear_seconds,
        readOnly: await readOnly(ctx, r),
        inGroup: r.in_group,
        lastSeq: r.last_seq ?? 0,
        lastAt: r.last_at,
        members: await conversationMembers(ctx.db, r),
      });
    }
    return { deviceId: device?.id ?? null, conversations: out };
  });

  /** MSG-01: a direct chat, with a friend (a stranger becomes one once their request is accepted, COM-05). */
  app.post("/v1/conversations/direct", async (request, reply) => {
    const user = requireUser(request);
    const other = z.object({ userId: uuid }).parse(request.body).userId;
    if (other === user.id) throw new HttpError(400, "self");
    const [a, b] = user.id < other ? [user.id, other] : [other, user.id];
    const friends = await ctx.db.query("select 1 from friendships where user_a = $1 and user_b = $2 and status = 'accepted'", [a, b]);
    if (!friends.length || (await blockedBetween(ctx.db, a, b))) throw new HttpError(403, "not_friends");
    const id = randomUUID();
    await ctx.db.query("insert into conversations (id, kind, user_a, user_b, created_at) values ($1, 'direct', $2, $3, $4) on conflict (user_a, user_b) do nothing", [
      id,
      a,
      b,
      ctx.now(),
    ]);
    const row = (await ctx.db.query<{ id: string }>("select id from conversations where user_a = $1 and user_b = $2", [a, b]))[0]!;
    return reply.status(row.id === id ? 201 : 200).send({ id: row.id });
  });

  /** What a member device needs to keep the group right: who should be in it, and who is. */
  app.get<{ Params: { id: string } }>("/v1/conversations/:id/roster", async (request) => {
    const user = requireUser(request);
    const { conversation, members } = await conversationFor(ctx, request.params.id, user.id);
    const expected = await expectedDevices(ctx.db, members);
    const inGroup = await ctx.db.query<{ device_id: string; joined_seq: number }>(
      "select device_id, joined_seq::int as joined_seq from conversation_devices where conversation_id = $1",
      [conversation.id],
    );
    return {
      epoch: conversation.epoch,
      initDevice: conversation.init_device,
      members,
      expected: expected.map((d) => ({ deviceId: d.id, userId: d.user_id, signatureKey: d.signature_key, keyPackages: d.packages })),
      inGroup: inGroup.map((d) => d.device_id),
    };
  });

  /**
   * The first device to open a conversation creates its group; the others wait for a welcome. A group
   * starts over only when no active device is left in it (everyone signed out or lost their state).
   */
  app.post<{ Params: { id: string } }>("/v1/conversations/:id/init", async (request) => {
    const user = requireUser(request);
    const { conversation } = await conversationFor(ctx, request.params.id, user.id);
    const device = await requireDevice(ctx, request);
    const now = ctx.now();
    const orphan = `not exists (select 1 from conversation_devices cd join chat_devices d on d.id = cd.device_id where cd.conversation_id = conversations.id and d.session_hash is not null)`;
    await ctx.db.transaction(async (tx) => {
      const updated = await tx.query(`update conversations set epoch = 0, init_device = $2, init_at = $3 where id = $1 and (epoch is null or ${orphan}) returning id`, [
        conversation.id,
        device.id,
        now,
      ]);
      if (!updated.length) throw new HttpError(409, "initialised");
      await tx.query("delete from conversation_devices where conversation_id = $1", [conversation.id]);
      const last = (await tx.query<{ n: number }>("select coalesce(max(seq), 0)::int as n from chat_messages where conversation_id = $1", [conversation.id]))[0]!.n;
      await tx.query("insert into conversation_devices (conversation_id, device_id, joined_seq) values ($1, $2, $3)", [conversation.id, device.id, last]);
    });
    return { epoch: 0 };
  });

  /** One key package per device to add; each is used once. */
  app.post<{ Params: { id: string } }>("/v1/conversations/:id/claim", async (request) => {
    const user = requireUser(request);
    const { members } = await conversationFor(ctx, request.params.id, user.id);
    await requireDevice(ctx, request);
    const input = z.object({ deviceIds: z.array(uuid).min(1).max(200) }).parse(request.body);
    const allowed = new Set((await expectedDevices(ctx.db, members)).map((d) => d.id));
    const packages: { deviceId: string; ref: string; data: string }[] = [];
    for (const deviceId of input.deviceIds) {
      if (!allowed.has(deviceId)) continue;
      const row = (
        await ctx.db.query<{ ref: string; data: string }>(
          "delete from chat_key_packages where ref = (select ref from chat_key_packages where device_id = $1 order by created_at limit 1) returning ref, data",
          [deviceId],
        )
      )[0];
      if (row) packages.push({ deviceId, ref: row.ref, data: row.data });
    }
    return { packages };
  });

  /**
   * A commit or an application message. Commits are taken strictly in epoch order: the first one for
   * an epoch wins and the others get 409, fetch, and try again (RFC 9420 §14, the delivery service).
   */
  app.post<{ Params: { id: string } }>("/v1/conversations/:id/messages", async (request, reply) => {
    const user = requireUser(request);
    const { conversation, members } = await conversationFor(ctx, request.params.id, user.id);
    const device = await requireDevice(ctx, request);
    const input = z
      .object({
        kind: z.enum(["commit", "application"]),
        epoch: z.number().int().min(0),
        data: b64(200_000),
        adds: z.array(z.object({ deviceId: uuid, keyPackageRef: z.string().max(100) })).max(200).default([]),
        removes: z.array(uuid).max(200).default([]),
        welcome: b64(2_000_000).optional(),
      })
      .parse(request.body);
    const inGroup = await ctx.db.query("select 1 from conversation_devices where conversation_id = $1 and device_id = $2", [conversation.id, device.id]);
    if (!inGroup.length) throw new HttpError(409, "not_in_group");
    const now = ctx.now();
    if (input.kind === "application") {
      if (await readOnly(ctx, conversation)) throw new HttpError(403, "read_only");
      const current = conversation.epoch ?? 0;
      if (input.epoch > current || input.epoch < current - EPOCH_SLACK) throw new HttpError(409, "stale_epoch");
    } else {
      if (input.adds.length && !input.welcome) throw new HttpError(400, "welcome_required");
      const allowed = new Set((await expectedDevices(ctx.db, members)).map((d) => d.id));
      if (input.adds.some((a) => !allowed.has(a.deviceId))) throw new HttpError(400, "unknown_device");
    }
    const ttl = input.kind === "commit" ? COMMIT_TTL_MS : conversation.disappear_seconds ? conversation.disappear_seconds * 1000 : APPLICATION_TTL_MS;
    const seq = await ctx.db.transaction(async (tx) => {
      if (input.kind === "commit") {
        const locked = (await tx.query<{ epoch: number | null }>("select epoch::int as epoch from conversations where id = $1 for update", [conversation.id]))[0];
        if (locked?.epoch !== input.epoch) throw new HttpError(409, "stale_epoch");
        await tx.query("update conversations set epoch = epoch + 1 where id = $1", [conversation.id]);
      }
      const row = (
        await tx.query<{ seq: number }>(
          "insert into chat_messages (conversation_id, sender_device, kind, epoch, data, created_at, expires_at) values ($1, $2, $3, $4, $5, $6, $7) returning seq::int as seq",
          [conversation.id, device.id, input.kind, input.epoch, input.data, now, now + ttl],
        )
      )[0]!;
      if (input.kind === "commit") {
        if (input.removes.length) await tx.query("delete from conversation_devices where conversation_id = $1 and device_id = any($2::uuid[])", [conversation.id, input.removes]);
        for (const add of input.adds) {
          await tx.query(
            "insert into conversation_devices (conversation_id, device_id, joined_seq) values ($1, $2, $3) on conflict (conversation_id, device_id) do update set joined_seq = excluded.joined_seq",
            [conversation.id, add.deviceId, row.seq],
          );
          await tx.query(
            "insert into chat_welcomes (id, conversation_id, device_id, key_package_ref, data, after_seq, created_at) values ($1, $2, $3, $4, $5, $6, $7)",
            [randomUUID(), conversation.id, add.deviceId, add.keyPackageRef, input.welcome, row.seq, now],
          );
        }
      }
      return row.seq;
    });
    notify(ctx, members, { type: input.kind === "commit" ? "chat.roster" : "chat.message", conversationId: conversation.id });
    return reply.status(201).send({ seq });
  });

  /** Ciphertext after a point, from the moment this device joined. Own messages are flagged, not sent back. */
  app.get<{ Params: { id: string }; Querystring: { after?: string } }>("/v1/conversations/:id/messages", async (request) => {
    const user = requireUser(request);
    const { conversation } = await conversationFor(ctx, request.params.id, user.id);
    const device = await requireDevice(ctx, request);
    await purge(ctx);
    const joined = (
      await ctx.db.query<{ joined_seq: number }>("select joined_seq::int as joined_seq from conversation_devices where conversation_id = $1 and device_id = $2", [
        conversation.id,
        device.id,
      ])
    )[0];
    if (!joined) throw new HttpError(409, "not_in_group");
    const after = Math.max(Number(request.query.after ?? 0) || 0, joined.joined_seq);
    const rows = await ctx.db.query<{ seq: number; sender_device: string; kind: string; epoch: number; data: string; created_at: number; expires_at: number }>(
      `select seq::int as seq, sender_device, kind, epoch::int as epoch, data, created_at, expires_at from chat_messages
       where conversation_id = $1 and seq > $2 and expires_at >= $3 order by seq limit 200`,
      [conversation.id, after, ctx.now()],
    );
    return {
      messages: rows.map((r) => ({
        seq: r.seq,
        kind: r.kind,
        epoch: r.epoch,
        mine: r.sender_device === device.id,
        data: r.sender_device === device.id ? null : r.data,
        at: r.created_at,
        expiresAt: r.kind === "application" && conversation.disappear_seconds ? r.expires_at : null,
      })),
      more: rows.length === 200,
    };
  });

  app.get("/v1/chat/welcomes", async (request) => {
    requireUser(request);
    const device = await requireDevice(ctx, request);
    const rows = await ctx.db.query<{ id: string; conversation_id: string; key_package_ref: string; data: string; after_seq: number }>(
      "select id, conversation_id, key_package_ref, data, after_seq::int as after_seq from chat_welcomes where device_id = $1 order by created_at",
      [device.id],
    );
    return { welcomes: rows.map((r) => ({ id: r.id, conversationId: r.conversation_id, keyPackageRef: r.key_package_ref, data: r.data, afterSeq: r.after_seq })) };
  });

  app.delete<{ Params: { id: string } }>("/v1/chat/welcomes/:id", async (request, reply) => {
    requireUser(request);
    const device = await requireDevice(ctx, request);
    await ctx.db.query("delete from chat_welcomes where id = $1 and device_id = $2", [uuid.parse(request.params.id), device.id]);
    return reply.status(204).send();
  });

  /** A device that lost its group state asks to be added again; history before that stays gone. */
  app.post<{ Params: { id: string } }>("/v1/conversations/:id/rejoin", async (request, reply) => {
    const user = requireUser(request);
    const { conversation, members } = await conversationFor(ctx, request.params.id, user.id);
    const device = await requireDevice(ctx, request);
    await ctx.db.query("delete from conversation_devices where conversation_id = $1 and device_id = $2", [conversation.id, device.id]);
    await ctx.db.query("delete from chat_welcomes where conversation_id = $1 and device_id = $2", [conversation.id, device.id]);
    notify(ctx, members, { type: "chat.roster", conversationId: conversation.id });
    return reply.status(204).send();
  });

  /** MSG-06: the disappearing timer, for everyone in the conversation. */
  app.put<{ Params: { id: string } }>("/v1/conversations/:id/settings", async (request) => {
    const user = requireUser(request);
    const { conversation, members } = await conversationFor(ctx, request.params.id, user.id);
    const input = z.object({ disappearSeconds: z.number().int() }).parse(request.body);
    if (!(DISAPPEAR_CHOICES as readonly number[]).includes(input.disappearSeconds)) throw new HttpError(400, "invalid_timer");
    await ctx.db.query("update conversations set disappear_seconds = $2 where id = $1", [conversation.id, input.disappearSeconds]);
    notify(ctx, members, { type: "chat.roster", conversationId: conversation.id });
    return { disappearSeconds: input.disappearSeconds };
  });

  /** MSG-10: only "someone is typing", never what; each person can switch it off. */
  app.post<{ Params: { id: string } }>("/v1/conversations/:id/typing", async (request, reply) => {
    const user = requireUser(request);
    const { members } = await conversationFor(ctx, request.params.id, user.id);
    notify(
      ctx,
      members.filter((m) => m !== user.id),
      { type: "chat.typing", conversationId: request.params.id, userId: user.id },
    );
    return reply.status(204).send();
  });

  /** MSG-03: an encrypted file. The server cannot tell a photo from a voice note. */
  app.post<{ Params: { id: string } }>("/v1/conversations/:id/blobs", { bodyLimit: Math.ceil(MAX_BLOB * 1.4) }, async (request, reply) => {
    const user = requireUser(request);
    const { conversation } = await conversationFor(ctx, request.params.id, user.id);
    if (await readOnly(ctx, conversation)) throw new HttpError(403, "read_only");
    blobUploads.check(user.id);
    const input = z.object({ data: b64(Math.ceil(MAX_BLOB * 1.37)) }).parse(request.body);
    const bytes = Buffer.from(input.data, "base64");
    if (bytes.length > MAX_BLOB) throw new HttpError(413, "too_large");
    const id = randomUUID();
    const now = ctx.now();
    const ttl = conversation.disappear_seconds ? conversation.disappear_seconds * 1000 : APPLICATION_TTL_MS;
    await writeFile(blobPath(ctx, id), bytes);
    await ctx.db.query("insert into chat_blobs (id, conversation_id, uploader, bytes, created_at, expires_at) values ($1, $2, $3, $4, $5, $6)", [
      id,
      conversation.id,
      user.id,
      bytes.length,
      now,
      now + ttl,
    ]);
    return reply.status(201).send({ id });
  });

  app.get<{ Params: { id: string } }>("/v1/chat/blobs/:id", async (request) => {
    const user = requireUser(request);
    const blob = (await ctx.db.query<{ conversation_id: string; expires_at: number }>("select conversation_id, expires_at from chat_blobs where id = $1", [uuid.parse(request.params.id)]))[0];
    if (!blob || blob.expires_at < ctx.now()) throw new HttpError(404, "not_found");
    await conversationFor(ctx, blob.conversation_id, user.id);
    const data = await readFile(blobPath(ctx, request.params.id)).catch(() => null);
    if (!data) throw new HttpError(404, "not_found");
    return { data: data.toString("base64") };
  });

  /** MSG-08: the encrypted history backup. Opening it needs the recovery key, which only its owner has. */
  app.put("/v1/chat/backup", { bodyLimit: Math.ceil(MAX_BACKUP * 1.4) }, async (request) => {
    const user = requireUser(request);
    const input = z.object({ data: b64(Math.ceil(MAX_BACKUP * 1.37)) }).parse(request.body);
    const bytes = Buffer.from(input.data, "base64");
    if (bytes.length > MAX_BACKUP) throw new HttpError(413, "too_large");
    await writeFile(backupPath(ctx, user.id), bytes);
    await ctx.db.query(
      "insert into chat_backups (user_id, bytes, updated_at) values ($1, $2, $3) on conflict (user_id) do update set bytes = excluded.bytes, updated_at = excluded.updated_at",
      [user.id, bytes.length, ctx.now()],
    );
    return { updatedAt: ctx.now(), bytes: bytes.length };
  });

  app.get("/v1/chat/backup", async (request) => {
    const user = requireUser(request);
    const row = (await ctx.db.query<{ updated_at: number }>("select updated_at from chat_backups where user_id = $1", [user.id]))[0];
    const data = row ? await readFile(backupPath(ctx, user.id)).catch(() => null) : null;
    if (!row || !data) throw new HttpError(404, "not_found");
    return { updatedAt: row.updated_at, data: data.toString("base64") };
  });

  app.delete("/v1/chat/backup", async (request, reply) => {
    const user = requireUser(request);
    await ctx.db.query("delete from chat_backups where user_id = $1", [user.id]);
    await unlink(backupPath(ctx, user.id)).catch(() => undefined);
    return reply.status(204).send();
  });

  /**
   * MSG-07: the reporter's own device decrypted these messages and sends them, by their choice.
   * Sealed at rest; crew admins read them for crew and party chats.
   */
  app.post<{ Params: { id: string } }>("/v1/conversations/:id/report", async (request, reply) => {
    const user = requireUser(request);
    const { conversation, members } = await conversationFor(ctx, request.params.id, user.id);
    const input = z
      .object({
        reason: z.enum(["harassment", "fake", "inappropriate", "other"]),
        note: z.string().trim().max(300).optional(),
        messages: z
          .array(z.object({ id: z.string().max(64), userId: uuid, body: z.string().max(4000), at: z.number().int(), reported: z.boolean() }))
          .min(1)
          .max(10),
      })
      .parse(request.body);
    if (!input.messages.some((m) => m.reported) || input.messages.some((m) => !members.includes(m.userId))) throw new HttpError(400, "invalid");
    const crewId =
      conversation.kind === "crew"
        ? conversation.crew_id
        : conversation.kind === "party"
          ? ((await ctx.db.query<{ crew_id: string }>("select crew_id from parties where id = $1", [conversation.party_id]))[0]?.crew_id ?? null)
          : null;
    await ctx.db.query(
      "insert into reports (id, reporter, target_kind, target_id, crew_id, reason, note, at, evidence) values ($1, $2, 'message', $3, $4, $5, $6, $7, $8)",
      [randomUUID(), user.id, conversation.id, crewId, input.reason, input.note ?? "", ctx.now(), ctx.sealer.seal(input.messages)],
    );
    return reply.status(201).send({ ok: true });
  });
}
