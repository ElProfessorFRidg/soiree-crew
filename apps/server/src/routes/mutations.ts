import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z, type ZodError } from "zod";
import { requireUser, type Context } from "../context";
import type { Db } from "../db";
import { checkDanger } from "../nightWatch";
import { checkOvertakes } from "../notifications/producers";
import { mutationBatchSchema, mutationSchema, type MutationInput } from "../schemas";

/** Tolerance for clock skew between the phone and the server. */
const FUTURE_TOLERANCE_MS = 60_000;
/** AC-12: older than this when it reaches the server, an event counts for personal stats only. */
const MAX_OFFLINE_AGE_MS = 24 * 3_600_000;
const NONCE_TTL_MS = 24 * 3_600_000;
const NONCE_BOOK = 50;

const envelopeSchema = z.object({
  installId: z.string().min(8).max(64),
  seq: z.number().int().min(1),
  bootId: z.string().max(64),
  /** Monotonic time between creation and sending, when the app did not restart in between. */
  ageMs: z.number().int().min(0).nullable(),
  prevHash: z.string().max(64),
  hash: z.string().length(64),
  nonce: z.string().max(64).nullable(),
});
type Envelope = z.infer<typeof envelopeSchema>;
type Trust = "ok" | "stale" | "broken_chain" | "no_nonce" | "unknown_age";
type Proof = { trust: Trust; eventTime: number };

/** The chain link the phone computes too: SHA-256 over the previous link, the key and the mutation. */
export const eventHash = (prevHash: string, key: string, mutation: unknown) => createHash("sha256").update(`${prevHash}|${key}|${JSON.stringify(mutation)}`).digest("hex");

/**
 * AC-12: the sequence never goes back and a nonce is spent once (both refused as replays); a broken
 * hash chain, a missing nonce or an old event is recorded as weaker proof, not refused, so a phone
 * that lost part of its queue still keeps its history. Returns when the event really happened.
 */
async function checkEnvelope(db: Db, now: number, userId: string, key: string, mutation: unknown, envelope: Envelope): Promise<Proof> {
  const chain = (
    await db.query<{ user_id: string; last_seq: number; last_hash: string }>("select user_id, last_seq::int as last_seq, last_hash from install_chains where install_id = $1", [
      envelope.installId,
    ])
  )[0];
  if (chain && chain.user_id !== userId) throw new Rejection("invalid");
  if (chain && envelope.seq <= chain.last_seq) throw new Rejection("replay");
  let trust: Trust = "ok";
  if (envelope.nonce) {
    const nonce = (await db.query<{ user_id: string; expires_at: number; used_at: number | null }>("select user_id, expires_at, used_at from event_nonces where nonce = $1", [envelope.nonce]))[0];
    if (!nonce || nonce.user_id !== userId) throw new Rejection("invalid");
    if (nonce.used_at !== null) throw new Rejection("replay");
    await db.query("update event_nonces set used_at = $2 where nonce = $1", [envelope.nonce, now]);
    if (nonce.expires_at < now) trust = "no_nonce";
  } else trust = "no_nonce";
  if (envelope.hash !== eventHash(envelope.prevHash, key, mutation) || (chain && chain.last_hash !== envelope.prevHash)) trust = "broken_chain";
  if (envelope.ageMs === null && trust === "ok") trust = "unknown_age";
  if (envelope.ageMs !== null && envelope.ageMs > MAX_OFFLINE_AGE_MS) trust = "stale";
  await db.query(
    `insert into install_chains (install_id, user_id, last_seq, last_hash, updated_at) values ($1, $2, $3, $4, $5)
     on conflict (install_id) do update set last_seq = excluded.last_seq, last_hash = excluded.last_hash, updated_at = excluded.updated_at`,
    [envelope.installId, userId, envelope.seq, envelope.hash, now],
  );
  // Received time minus the monotonic age: right whatever the phone's wall clock says.
  return { trust, eventTime: envelope.ageMs === null ? now : now - Math.min(envelope.ageMs, MAX_OFFLINE_AGE_MS) };
}

export type MutationResult =
  | { key: string; status: "accepted"; serverTime: number }
  | { key: string; status: "rejected"; reason: string };

class Rejection extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

/** The party a write belongs to: the user's party that covers that moment and is not closed. */
async function partyAt(db: Db, userId: string, at: number): Promise<string | null> {
  const rows = await db.query<{ id: string }>(
    `select p.id from parties p join party_members m on m.party_id = p.id
     where m.user_id = $1 and m.response = 'going' and p.closed_at is null and p.starts_at <= $2 and p.ends_at >= $2
     order by p.starts_at desc limit 1`,
    [userId, at],
  );
  return rows[0]?.id ?? null;
}

async function touchParty(ctx: Context, db: Db, partyId: string | null, userId: string, at: number, changed: Set<string>) {
  if (!partyId) return;
  // O-37: the first sign of life is the arrival.
  await db.query(
    "update party_members set last_activity_at = greatest(coalesce(last_activity_at, 0), $3), arrived_at = coalesce(arrived_at, $3) where party_id = $1 and user_id = $2",
    [partyId, userId, at],
  );
  changed.add(partyId);
}

function sealDrink(ctx: Context, d: MutationInput & { kind: "drink.add" | "drink.edit" }): string {
  const { drink } = d;
  return ctx.sealer.seal({ volumeMl: drink.volumeMl, abv: drink.abv, withFood: drink.food ? drink.food !== "none" : drink.withFood, food: drink.food ?? null, name: drink.name ?? null });
}

/** RANK-06: a friend confirmed this drink as it was. Changing its volume, strength or time drops the confirmation. */
async function dropStaleConfirmations(ctx: Context, db: Db, before: { sealed: string; consumed_at: number }, after: { volumeMl: number; abv: number; consumedAt: number }, id: string) {
  if (!before.sealed) return;
  const old = ctx.sealer.open<{ volumeMl: number; abv: number }>(before.sealed);
  if (old.volumeMl !== after.volumeMl || old.abv !== after.abv || before.consumed_at !== after.consumedAt) {
    await db.query("delete from drink_confirmations where drink_id = $1", [id]);
  }
}

async function apply(ctx: Context, db: Db, userId: string, mutation: MutationInput, changedParties: Set<string>, proof: Proof | null, dangerChecks: Set<string>): Promise<void> {
  const now = ctx.now();
  switch (mutation.kind) {
    case "drink.add": {
      const d = mutation.drink;
      if (d.consumedAt > now + FUTURE_TOLERANCE_MS) throw new Rejection("future_drink");
      const owner = await db.query<{ user_id: string; sealed: string; consumed_at: number }>("select user_id, sealed, consumed_at from drinks where id = $1", [d.id]);
      if (owner[0] && owner[0].user_id !== userId) throw new Rejection("invalid");
      if (owner[0]) await dropStaleConfirmations(ctx, db, owner[0], d, d.id);
      const partyId = await partyAt(db, userId, d.consumedAt);
      const sealed = sealDrink(ctx, mutation);
      await db.query(
        `insert into drinks (id, user_id, party_id, kind, preset_id, sealed, consumed_at, logged_at, updated_at, envelope_trust)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (id) do update set kind = $4, preset_id = $5, sealed = $6, consumed_at = $7, deleted_at = null, updated_at = $9`,
        // AC-07: "logged" is when the server heard of the drink, never the phone's wall clock. With an
        // AC-12 envelope it is the received time minus the monotonic age, so a drink queued offline keeps
        // its moment while a backdated batch still cannot pass for drinks logged on the spot.
        [d.id, userId, partyId, d.kind, d.presetId, sealed, d.consumedAt, proof?.eventTime ?? now, now, proof?.trust ?? null],
      );
      await touchParty(ctx, db, partyId, userId, now, changedParties);
      if (partyId && d.abv > 0) dangerChecks.add(partyId);
      return;
    }
    case "drink.edit": {
      const d = mutation.drink;
      if (d.consumedAt > now + FUTURE_TOLERANCE_MS) throw new Rejection("future_drink");
      const rows = await db.query<{ user_id: string; sealed: string; consumed_at: number; party_id: string | null; deleted_at: number | null }>(
        "select user_id, sealed, consumed_at, party_id, deleted_at from drinks where id = $1",
        [d.id],
      );
      const before = rows[0];
      if (!before || before.user_id !== userId || before.deleted_at !== null) throw new Rejection("invalid");
      await dropStaleConfirmations(ctx, db, before, d, d.id);
      // A new time can move the drink to another night.
      const partyId = await partyAt(db, userId, d.consumedAt);
      await db.query("update drinks set kind = $2, preset_id = $3, sealed = $4, consumed_at = $5, party_id = $6, updated_at = $7 where id = $1", [
        d.id,
        d.kind,
        d.presetId,
        sealDrink(ctx, mutation),
        d.consumedAt,
        partyId,
        now,
      ]);
      if (before.party_id) changedParties.add(before.party_id);
      if (partyId) {
        changedParties.add(partyId);
        dangerChecks.add(partyId);
      }
      return;
    }
    case "drink.remove": {
      const rows = await db.query<{ party_id: string | null }>(
        "update drinks set deleted_at = $1, updated_at = $1 where id = $2 and user_id = $3 returning party_id",
        [now, mutation.drink.id, userId],
      );
      if (rows[0]?.party_id) changedParties.add(rows[0].party_id);
      return;
    }
    case "water.add": {
      const w = mutation.water;
      if (w.at > now + FUTURE_TOLERANCE_MS) throw new Rejection("invalid");
      const partyId = await partyAt(db, userId, w.at);
      await db.query(
        `insert into water (id, user_id, party_id, at, updated_at) values ($1, $2, $3, $4, $5)
         on conflict (id) do update set deleted_at = null, updated_at = $5 where water.user_id = $2`,
        [w.id, userId, partyId, w.at, now],
      );
      await touchParty(ctx, db, partyId, userId, now, changedParties);
      return;
    }
    case "water.remove":
      await db.query("update water set deleted_at = $1, updated_at = $1 where id = $2 and user_id = $3", [now, mutation.water.id, userId]);
      return;
    case "profile.set":
      await db.query(
        `insert into body_profiles (user_id, sealed, updated_at) values ($1, $2, $3)
         on conflict (user_id) do update set sealed = $2, updated_at = $3`,
        [userId, ctx.sealer.seal(mutation.profile), now],
      );
      return;
    case "preferences.set": {
      const rows = await db.query<{ data: string }>("select data from user_preferences where user_id = $1", [userId]);
      const merged = { ...(rows[0] ? (JSON.parse(rows[0].data) as object) : {}), ...mutation.patch };
      await db.query(
        `insert into user_preferences (user_id, data, updated_at) values ($1, $2, $3)
         on conflict (user_id) do update set data = $2, updated_at = $3`,
        [userId, JSON.stringify(merged), now],
      );
      return;
    }
    case "uiLevel.set":
      // The screen level is a per-device choice; nothing to store.
      return;
    case "customDrink.set": {
      const owner = await db.query<{ user_id: string }>("select user_id from custom_drinks where id = $1", [mutation.drink.id]);
      if (owner[0] && owner[0].user_id !== userId) throw new Rejection("invalid");
      await db.query(
        `insert into custom_drinks (id, user_id, data, updated_at) values ($1, $2, $3, $4)
         on conflict (id) do update set data = $3, deleted_at = null, updated_at = $4`,
        [mutation.drink.id, userId, JSON.stringify(mutation.drink), now],
      );
      return;
    }
    case "customDrink.remove":
      await db.query("update custom_drinks set deleted_at = $1, updated_at = $1 where id = $2 and user_id = $3", [now, mutation.drink.id, userId]);
      return;
  }
}

/** POST /v1/mutations: the only write path of the sync engine (SYNC-01 to SYNC-04, AC-08). */
export function mutationRoutes(app: FastifyInstance, ctx: Context): void {
  app.post("/v1/mutations", async (request) => {
    const user = requireUser(request);
    const batch = mutationBatchSchema.parse(request.body);
    const results: MutationResult[] = [];
    const changedParties = new Set<string>();
    const dangerChecks = new Set<string>();

    for (const { key, mutation, envelope } of batch.mutations) {
      const stored = await ctx.db.query<{ result: string }>("select result from mutation_log where user_id = $1 and key = $2", [user.id, key]);
      if (stored[0]) {
        results.push(JSON.parse(stored[0].result) as MutationResult);
        continue;
      }
      let result: MutationResult;
      const parsed = mutationSchema.safeParse(mutation);
      if (!parsed.success) {
        request.log.warn({ issues: (parsed.error as ZodError).issues.length }, "mutation rejected by schema");
        result = { key, status: "rejected", reason: "invalid" };
      } else {
        try {
          const env = envelope === undefined ? null : envelopeSchema.safeParse(envelope);
          if (env && !env.success) throw new Rejection("invalid");
          // The chain moves on even if the write itself is then refused for its content (a future drink):
          // otherwise the next event would look like a gap.
          const proof = env?.success ? await ctx.db.transaction((tx) => checkEnvelope(tx, ctx.now(), user.id, key, mutation, env.data)) : null;
          await ctx.db.transaction((tx) => apply(ctx, tx, user.id, parsed.data, changedParties, proof, dangerChecks));
          result = { key, status: "accepted", serverTime: ctx.now() };
        } catch (error) {
          if (!(error instanceof Rejection)) throw error;
          result = { key, status: "rejected", reason: error.reason };
        }
      }
      await ctx.db.query("insert into mutation_log (key, user_id, result, created_at) values ($1, $2, $3, $4)", [
        key,
        user.id,
        JSON.stringify(result),
        ctx.now(),
      ]);
      results.push(result);
    }

    for (const partyId of changedParties) {
      const members = await ctx.db.query<{ user_id: string }>("select user_id from party_members where party_id = $1 and response = 'going'", [partyId]);
      ctx.live.notify(members.map((m) => m.user_id), { type: "party.changed", partyId });
      await checkOvertakes(ctx, partyId);
    }
    ctx.live.notify([user.id], { type: "sync", reason: "own_write" });
    // O-88: a drink can carry the estimate past 2.0 g/L; the minute sweep catches the rise that follows.
    for (const partyId of dangerChecks) {
      const party = (await ctx.db.query<{ id: string; starts_at: number }>("select id, starts_at from parties where id = $1", [partyId]))[0];
      if (party) await checkDanger(ctx, party, user.id);
    }
    return { results };
  });

  /** AC-12: tops the nonce book up to 50 unused, unexpired nonces, spent one per queued event. */
  app.post("/v1/nonces", async (request) => {
    const user = requireUser(request);
    const now = ctx.now();
    await ctx.db.query("delete from event_nonces where user_id = $1 and (expires_at < $2 or used_at < $3)", [user.id, now, now - 7 * 24 * 3_600_000]);
    const open = (await ctx.db.query<{ n: number }>("select count(*)::int as n from event_nonces where user_id = $1 and used_at is null", [user.id]))[0]!.n;
    const nonces: { nonce: string; expiresAt: number }[] = [];
    for (let i = open; i < NONCE_BOOK; i++) {
      const nonce = randomBytes(18).toString("base64url");
      await ctx.db.query("insert into event_nonces (nonce, user_id, expires_at) values ($1, $2, $3)", [nonce, user.id, now + NONCE_TTL_MS]);
      nonces.push({ nonce, expiresAt: now + NONCE_TTL_MS });
    }
    return { nonces };
  });
}
