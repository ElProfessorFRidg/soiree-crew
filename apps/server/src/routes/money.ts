import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { balances, nextRoundPayer, settle, shares, SplitError, type Expense, type Split } from "@crew/money";
import { assertCrewMember, HttpError, requireUser, type Context } from "../context";
import { newId } from "../crypto";

const uuid = z.string().uuid();
const currency = z.string().regex(/^[A-Z]{3}$/);
const splitSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("equal"), members: z.array(uuid).min(1) }),
  z.object({ kind: z.literal("shares"), shares: z.record(uuid, z.number().positive().max(1000)) }),
  z.object({ kind: z.literal("amounts"), amounts: z.record(uuid, z.number().int().nonnegative()) }),
  z.object({ kind: z.literal("percent"), percent: z.record(uuid, z.number().min(0).max(100)) }),
]);

interface ExpenseRow {
  id: string;
  payer_id: string;
  amount: number;
  currency: string;
  description: string;
  split: string;
  created_at: number;
  created_by: string;
}

/**
 * A pool, for one of its own members who is still in the crew. Being in the crew is not enough:
 * the pool shows its members' payment details (N-19, red team AC-10).
 */
async function poolForMember(ctx: Context, poolId: string, userId: string) {
  const rows = await ctx.db.query<{ id: string; crew_id: string; party_id: string | null; name: string; currency: string; created_by: string }>(
    `select p.id, p.crew_id, p.party_id, p.name, p.currency, p.created_by from pools p
     join crew_members m on m.crew_id = p.crew_id and m.user_id = $2
     join pool_members pm on pm.pool_id = p.id and pm.user_id = $2
     where p.id = $1`,
    [poolId, userId],
  );
  if (!rows[0]) throw new HttpError(404, "not_found");
  return rows[0];
}

async function poolState(ctx: Context, poolId: string) {
  const pool = (await ctx.db.query<{ currency: string }>("select currency from pools where id = $1", [poolId]))[0]!;
  const members = await ctx.db.query<{ user_id: string; display_name: string }>(
    "select pm.user_id, u.display_name from pool_members pm join users u on u.id = pm.user_id where pm.pool_id = $1 order by u.display_name",
    [poolId],
  );
  const expenseRows = await ctx.db.query<ExpenseRow>(
    "select id, payer_id, amount, currency, description, split, created_at, created_by from expenses where pool_id = $1 and deleted_at is null order by created_at desc",
    [poolId],
  );
  const repaymentRows = await ctx.db.query<{ id: string; from_id: string; to_id: string; amount: number; currency: string; created_at: number }>(
    "select id, from_id, to_id, amount, currency, created_at from repayments where pool_id = $1 order by created_at desc",
    [poolId],
  );
  const expenses: Expense[] = expenseRows.map((e) => ({ id: e.id, payerId: e.payer_id, amount: e.amount, currency: e.currency, split: JSON.parse(e.split) as Split }));
  const repayments = repaymentRows.map((r) => ({ fromId: r.from_id, toId: r.to_id, amount: r.amount, currency: r.currency }));
  const currencies = [...new Set([pool.currency, ...expenses.map((e) => e.currency)])];
  const perCurrency = currencies.map((c) => {
    const balance = balances(expenses, repayments, c);
    return { currency: c, balance, transfers: settle(balance) };
  });
  return { members, expenseRows, repaymentRows, perCurrency };
}

export function moneyRoutes(app: FastifyInstance, ctx: Context): void {
  app.post<{ Params: { id: string } }>("/v1/crews/:id/pools", async (request, reply) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const input = z.object({ id: uuid, name: z.string().trim().min(1).max(60), currency, partyId: uuid.optional(), memberIds: z.array(uuid).min(1).max(50) }).parse(request.body);
    const valid = await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1 and user_id = any($2::uuid[])", [
      request.params.id,
      [...new Set([...input.memberIds, user.id])],
    ]);
    const created = await ctx.db.transaction(async (tx) => {
      const inserted = await tx.query(
        "insert into pools (id, crew_id, party_id, name, currency, created_by, created_at) values ($1, $2, $3, $4, $5, $6, $7) on conflict (id) do nothing returning id",
        [input.id, request.params.id, input.partyId ?? null, input.name, input.currency, user.id, ctx.now()],
      );
      // An existing id is a replay of my own request (the id is the idempotency key) or a refusal:
      // members are only added by the call that created the pool.
      if (!inserted.length) {
        const existing = await tx.query<{ crew_id: string; created_by: string }>("select crew_id, created_by from pools where id = $1", [input.id]);
        return existing[0]?.created_by === user.id && existing[0].crew_id === request.params.id;
      }
      for (const member of valid) await tx.query("insert into pool_members (pool_id, user_id) values ($1, $2) on conflict do nothing", [input.id, member.user_id]);
      return true;
    });
    if (!created) throw new HttpError(409, "exists");
    return reply.status(201).send({ id: input.id });
  });

  /** "Owed to you / you owe" at a glance, per pool (O-70). */
  app.get<{ Params: { id: string } }>("/v1/crews/:id/pools", async (request) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const pools = await ctx.db.query<{ id: string; name: string; currency: string; party_id: string | null; created_at: number }>(
      "select p.id, p.name, p.currency, p.party_id, p.created_at from pools p join pool_members m on m.pool_id = p.id and m.user_id = $2 where p.crew_id = $1 order by p.created_at desc",
      [request.params.id, user.id],
    );
    const result = [];
    for (const pool of pools) {
      const state = await poolState(ctx, pool.id);
      const main = state.perCurrency.find((c) => c.currency === pool.currency)!;
      result.push({ id: pool.id, name: pool.name, currency: pool.currency, partyId: pool.party_id, myBalance: main.balance[user.id] ?? 0, members: state.members.length });
    }
    return { pools: result };
  });

  app.get<{ Params: { id: string } }>("/v1/pools/:id", async (request) => {
    const user = requireUser(request);
    const pool = await poolForMember(ctx, request.params.id, user.id);
    const state = await poolState(ctx, pool.id);
    const details = await ctx.db.query<{ user_id: string; sealed: string }>(
      "select user_id, sealed from payment_details where user_id = any($1::uuid[])",
      [state.members.map((m) => m.user_id)],
    );
    return {
      pool: { id: pool.id, name: pool.name, currency: pool.currency, partyId: pool.party_id },
      members: state.members.map((m) => {
        const sealed = details.find((d) => d.user_id === m.user_id)?.sealed;
        return { userId: m.user_id, name: m.display_name, payment: sealed ? ctx.sealer.open<{ iban?: string; link?: string }>(sealed) : null };
      }),
      expenses: state.expenseRows.map((e) => ({ id: e.id, payerId: e.payer_id, amount: e.amount, currency: e.currency, description: e.description, split: JSON.parse(e.split), at: e.created_at })),
      repayments: state.repaymentRows.map((r) => ({ id: r.id, fromId: r.from_id, toId: r.to_id, amount: r.amount, currency: r.currency, at: r.created_at })),
      settlement: state.perCurrency,
    };
  });

  app.post<{ Params: { id: string } }>("/v1/pools/:id/expenses", async (request, reply) => {
    const user = requireUser(request);
    const pool = await poolForMember(ctx, request.params.id, user.id);
    const input = z
      .object({ id: uuid, payerId: uuid, amount: z.number().int().positive().max(100_000_000), currency, description: z.string().trim().min(1).max(80), split: splitSchema })
      .parse(request.body);
    const members = new Set((await ctx.db.query<{ user_id: string }>("select user_id from pool_members where pool_id = $1", [pool.id])).map((m) => m.user_id));
    const involved = input.split.kind === "equal" ? input.split.members : Object.keys(input.split.kind === "shares" ? input.split.shares : input.split.kind === "amounts" ? input.split.amounts : input.split.percent);
    if (!members.has(input.payerId) || involved.some((id) => !members.has(id))) throw new HttpError(400, "not_in_pool");
    try {
      shares({ id: input.id, payerId: input.payerId, amount: input.amount, currency: input.currency, split: input.split as Split });
    } catch (error) {
      if (error instanceof SplitError) throw new HttpError(400, error.message);
      throw error;
    }
    await ctx.db.query(
      `insert into expenses (id, pool_id, payer_id, amount, currency, description, split, created_by, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) on conflict (id) do nothing`,
      [input.id, pool.id, input.payerId, input.amount, input.currency, input.description, JSON.stringify(input.split), user.id, ctx.now()],
    );
    ctx.live.notify(members, { type: "crew.changed", crewId: pool.crew_id });
    return reply.status(201).send({ id: input.id });
  });

  app.delete<{ Params: { id: string; expenseId: string } }>("/v1/pools/:id/expenses/:expenseId", async (request, reply) => {
    const user = requireUser(request);
    const pool = await poolForMember(ctx, request.params.id, user.id);
    const rows = await ctx.db.query(
      "update expenses set deleted_at = $3 where id = $1 and pool_id = $2 and (created_by = $4 or payer_id = $4) and deleted_at is null returning id",
      [request.params.expenseId, pool.id, ctx.now(), user.id],
    );
    if (!rows.length) throw new HttpError(404, "not_found");
    return reply.status(204).send();
  });

  /** Marks a repayment as made (O-70): either side can record it. */
  app.post<{ Params: { id: string } }>("/v1/pools/:id/repayments", async (request, reply) => {
    const user = requireUser(request);
    const pool = await poolForMember(ctx, request.params.id, user.id);
    const input = z.object({ id: uuid, fromId: uuid, toId: uuid, amount: z.number().int().positive(), currency }).parse(request.body);
    if (input.fromId !== user.id && input.toId !== user.id) throw new HttpError(403, "forbidden");
    await ctx.db.query(
      "insert into repayments (id, pool_id, from_id, to_id, amount, currency, created_by, created_at) values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict (id) do nothing",
      [input.id, pool.id, input.fromId, input.toId, input.amount, input.currency, user.id, ctx.now()],
    );
    const members = await ctx.db.query<{ user_id: string }>("select user_id from pool_members where pool_id = $1", [pool.id]);
    ctx.live.notify(members.map((m) => m.user_id), { type: "crew.changed", crewId: pool.crew_id });
    return reply.status(201).send({ id: input.id });
  });

  /** N-19 payment shortcuts: my IBAN or payment link, sealed, shown to my pools only. */
  app.put("/v1/me/payment", async (request) => {
    const user = requireUser(request);
    const input = z.object({ iban: z.string().trim().max(40).optional(), link: z.string().trim().url().max(200).refine((value) => value.startsWith("https://"), "https only").optional() }).parse(request.body);
    await ctx.db.query(
      "insert into payment_details (user_id, sealed, updated_at) values ($1, $2, $3) on conflict (user_id) do update set sealed = $2, updated_at = $3",
      [user.id, ctx.sealer.seal(input), ctx.now()],
    );
    return { ok: true };
  });

  /** N-18: rounds of a party and who should pay the next one. */
  app.get<{ Params: { id: string } }>("/v1/parties/:id/rounds", async (request) => {
    const user = requireUser(request);
    const party = (
      await ctx.db.query<{ crew_id: string }>("select p.crew_id from parties p join crew_members m on m.crew_id = p.crew_id and m.user_id = $2 where p.id = $1", [
        request.params.id,
        user.id,
      ])
    )[0];
    if (!party) throw new HttpError(404, "not_found");
    const rounds = await ctx.db.query<{ id: string; payer_id: string; amount: number; currency: string; member_ids: string; created_at: number }>(
      "select id, payer_id, amount, currency, member_ids, created_at from rounds where party_id = $1 order by created_at desc",
      [request.params.id],
    );
    const present = await ctx.db.query<{ user_id: string; display_name: string }>(
      "select m.user_id, u.display_name from party_members m join users u on u.id = m.user_id where m.party_id = $1 and m.response = 'going' and m.home_safe_at is null",
      [request.params.id],
    );
    const next = nextRoundPayer(
      present.map((p) => p.user_id),
      rounds.map((r) => ({ payerId: r.payer_id, amount: r.amount, at: r.created_at })),
    );
    return {
      rounds: rounds.map((r) => ({ id: r.id, payerId: r.payer_id, amount: r.amount, currency: r.currency, memberIds: JSON.parse(r.member_ids) as string[], at: r.created_at })),
      present: present.map((p) => ({ userId: p.user_id, name: p.display_name })),
      nextPayerId: next,
    };
  });

  /**
   * N-18: one tap logs a drink for every member of the round AND the expense in the party pool.
   * Drinks created for others are theirs: they see them in their history and can remove them.
   */
  app.post<{ Params: { id: string } }>("/v1/parties/:id/rounds", async (request, reply) => {
    const user = requireUser(request);
    const input = z
      .object({
        id: uuid,
        payerId: uuid,
        memberIds: z.array(uuid).min(1).max(30),
        drink: z.object({ presetId: z.string().min(1).max(80), kind: z.string().min(1).max(30), volumeMl: z.number().positive().max(3000), abv: z.number().min(0).max(1), name: z.string().max(40).optional() }),
        amount: z.number().int().nonnegative().max(10_000_000),
        currency,
        /** Already in the payer's language: the server never writes user-facing copy. */
        description: z.string().trim().min(1).max(80).optional(),
      })
      .parse(request.body);
    const party = (
      await ctx.db.query<{ crew_id: string; name: string; closed_at: number | null }>(
        "select p.crew_id, p.name, p.closed_at from parties p join party_members m on m.party_id = p.id and m.user_id = $2 and m.response = 'going' where p.id = $1",
        [request.params.id, user.id],
      )
    )[0];
    if (!party) throw new HttpError(404, "not_found");
    if (party.closed_at !== null) throw new HttpError(400, "party_closed");
    const going = new Set(
      (await ctx.db.query<{ user_id: string }>("select user_id from party_members where party_id = $1 and response = 'going'", [request.params.id])).map((m) => m.user_id),
    );
    if (!going.has(input.payerId) || input.memberIds.some((m) => !going.has(m))) throw new HttpError(400, "not_in_party");
    const existing = await ctx.db.query("select 1 from rounds where id = $1", [input.id]);
    if (existing.length) return reply.status(200).send({ id: input.id });

    const now = ctx.now();
    await ctx.db.transaction(async (tx) => {
      for (const memberId of input.memberIds) {
        const sealed = ctx.sealer.seal({ volumeMl: input.drink.volumeMl, abv: input.drink.abv, withFood: false, name: input.drink.name ?? null });
        await tx.query(
          `insert into drinks (id, user_id, party_id, kind, preset_id, sealed, consumed_at, logged_at, updated_at) values ($1, $2, $3, $4, $5, $6, $7, $7, $7)`,
          [newId(), memberId, request.params.id, input.drink.kind, input.drink.presetId, sealed, now],
        );
        await tx.query("update party_members set last_activity_at = $3 where party_id = $1 and user_id = $2", [request.params.id, memberId, now]);
      }
      let expenseId: string | null = null;
      if (input.amount > 0) {
        let pool = (await tx.query<{ id: string }>("select id from pools where party_id = $1 and closed_at is null limit 1", [request.params.id]))[0];
        if (!pool) {
          pool = { id: newId() };
          await tx.query("insert into pools (id, crew_id, party_id, name, currency, created_by, created_at) values ($1, $2, $3, $4, $5, $6, $7)", [
            pool.id,
            party.crew_id,
            request.params.id,
            party.name || (input.description ?? input.drink.kind),
            input.currency,
            user.id,
            now,
          ]);
        }
        for (const memberId of new Set([...going])) await tx.query("insert into pool_members (pool_id, user_id) values ($1, $2) on conflict do nothing", [pool.id, memberId]);
        expenseId = newId();
        await tx.query(
          `insert into expenses (id, pool_id, payer_id, amount, currency, description, split, created_by, created_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [expenseId, pool.id, input.payerId, input.amount, input.currency, input.description ?? input.drink.name ?? input.drink.kind, JSON.stringify({ kind: "equal", members: input.memberIds }), user.id, now],
        );
      }
      await tx.query("insert into rounds (id, party_id, payer_id, amount, currency, member_ids, expense_id, created_at) values ($1, $2, $3, $4, $5, $6, $7, $8)", [
        input.id,
        request.params.id,
        input.payerId,
        input.amount,
        input.currency,
        JSON.stringify(input.memberIds),
        expenseId,
        now,
      ]);
    });
    ctx.live.notify(going, { type: "party.changed", partyId: request.params.id });
    ctx.live.notify(going, { type: "sync", reason: "own_write" });
    return reply.status(201).send({ id: input.id });
  });
}
