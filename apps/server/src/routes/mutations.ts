import type { FastifyInstance } from "fastify";
import type { ZodError } from "zod";
import { requireUser, type Context } from "../context";
import type { Db } from "../db";
import { mutationBatchSchema, mutationSchema, type MutationInput } from "../schemas";

/** Tolerance for clock skew between the phone and the server. */
const FUTURE_TOLERANCE_MS = 60_000;

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
  await db.query("update party_members set last_activity_at = greatest(coalesce(last_activity_at, 0), $3) where party_id = $1 and user_id = $2", [
    partyId,
    userId,
    at,
  ]);
  changed.add(partyId);
}

async function apply(ctx: Context, db: Db, userId: string, mutation: MutationInput, changedParties: Set<string>): Promise<void> {
  const now = ctx.now();
  switch (mutation.kind) {
    case "drink.add": {
      const d = mutation.drink;
      if (d.consumedAt > now + FUTURE_TOLERANCE_MS) throw new Rejection("future_drink");
      const owner = await db.query<{ user_id: string }>("select user_id from drinks where id = $1", [d.id]);
      if (owner[0] && owner[0].user_id !== userId) throw new Rejection("invalid");
      const partyId = await partyAt(db, userId, d.consumedAt);
      const sealed = ctx.sealer.seal({ volumeMl: d.volumeMl, abv: d.abv, withFood: d.withFood, name: d.name ?? null });
      await db.query(
        `insert into drinks (id, user_id, party_id, kind, preset_id, sealed, consumed_at, logged_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (id) do update set kind = $4, preset_id = $5, sealed = $6, consumed_at = $7, deleted_at = null, updated_at = $9`,
        [d.id, userId, partyId, d.kind, d.presetId, sealed, d.consumedAt, d.loggedAt, now],
      );
      await touchParty(ctx, db, partyId, userId, now, changedParties);
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

    for (const { key, mutation } of batch.mutations) {
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
          await ctx.db.transaction((tx) => apply(ctx, tx, user.id, parsed.data, changedParties));
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
    }
    ctx.live.notify([user.id], { type: "sync", reason: "own_write" });
    return { results };
  });
}
