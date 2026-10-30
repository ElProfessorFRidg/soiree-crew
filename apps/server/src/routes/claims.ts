import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HttpError, requireUser, type Context } from "../context";
import { scheduleSchema } from "../hours";
import { RateLimiter } from "../ratelimit";
import { assertCleanText } from "../textFilter";
import { placeOf } from "./community";

const uuid = z.string().uuid();

/** COM-11: the approved owner of a place (any venue at the same spot), if any. */
export async function placeOwner(ctx: Context, ids: string[]): Promise<string | null> {
  const row = (
    await ctx.db.query<{ user_id: string }>("select user_id from place_claims where venue_id = any($1::uuid[]) and status = 'approved' order by decided_at desc limit 1", [ids])
  )[0];
  return row?.user_id ?? null;
}

/** By account id (OPERATOR_IDS). A username is accepted too, but a name nobody holds yet could be registered by anyone. */
export function isOperator(ctx: Context, user: { id: string; username: string }): boolean {
  const operators = ctx.operators ?? [];
  return operators.includes(user.id) || operators.includes(user.username.toLowerCase());
}

export function claimRoutes(app: FastifyInstance, ctx: Context): void {
  const claims = new RateLimiter(3, 24 * 3_600_000, ctx.now);

  /** An owner asks for the page. The operator checks the proof outside the app (a call, the website). */
  app.post<{ Params: { id: string } }>("/v1/places/:id/claim", async (request, reply) => {
    const user = requireUser(request);
    claims.check(user.id);
    const { venue, ids } = await placeOf(ctx, request.params.id);
    const input = z.object({ role: z.string().trim().min(2).max(80), contact: z.string().trim().min(4).max(200) }).parse(request.body);
    if (await placeOwner(ctx, ids)) throw new HttpError(409, "already_claimed");
    const pending = await ctx.db.query("select 1 from place_claims where venue_id = $1 and user_id = $2 and status = 'pending'", [venue.id, user.id]);
    if (pending.length) throw new HttpError(409, "pending");
    await ctx.db.query("insert into place_claims (id, venue_id, user_id, status, proof, requested_at) values ($1, $2, $3, 'pending', $4, $5)", [
      randomUUID(),
      venue.id,
      user.id,
      ctx.sealer.seal(input),
      ctx.now(),
    ]);
    return reply.status(201).send({ status: "pending" });
  });

  app.get<{ Params: { id: string } }>("/v1/places/:id/claim", async (request) => {
    const user = requireUser(request);
    const { ids } = await placeOf(ctx, request.params.id);
    const mine = (
      await ctx.db.query<{ status: string }>("select status from place_claims where venue_id = any($1::uuid[]) and user_id = $2 order by requested_at desc limit 1", [ids, user.id])
    )[0];
    return { status: mine?.status ?? null, claimed: (await placeOwner(ctx, ids)) !== null };
  });

  /** Hours and happy hours, written by the owner only. */
  app.put<{ Params: { id: string } }>("/v1/places/:id/info", async (request) => {
    const user = requireUser(request);
    const { venue, ids } = await placeOf(ctx, request.params.id);
    if ((await placeOwner(ctx, ids)) !== user.id) throw new HttpError(403, "not_owner");
    // N-08, COM-01: the weekly schedule next to the free text is what "open now" reads.
    const input = z
      .object({ hours: z.string().trim().max(300), happyHours: z.string().trim().max(200), schedule: scheduleSchema.nullable().optional() })
      .parse(request.body);
    const schedule = input.schedule && (input.schedule.open.length || input.schedule.happy.length) ? JSON.stringify(input.schedule) : null;
    await ctx.db.query(
      `insert into place_info (venue_id, hours, happy_hours, schedule, updated_by, updated_at) values ($1, $2, $3, $4, $5, $6)
       on conflict (venue_id) do update set hours = excluded.hours, happy_hours = excluded.happy_hours,
         schedule = case when $7 then excluded.schedule else place_info.schedule end, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
      [venue.id, input.hours, input.happyHours, schedule, user.id, ctx.now(), input.schedule !== undefined],
    );
    return { ok: true };
  });

  /** The owner answers a review, once, in public. The review itself stays as its author wrote it. */
  app.put<{ Params: { id: string } }>("/v1/reviews/:id/reply", async (request) => {
    const user = requireUser(request);
    const review = (await ctx.db.query<{ venue_id: string; audience: string }>("select venue_id, audience from place_reviews where id = $1", [uuid.parse(request.params.id)]))[0];
    if (!review || (review.audience !== "public" && review.audience !== "anonymous")) throw new HttpError(404, "not_found");
    const { ids } = await placeOf(ctx, review.venue_id);
    if ((await placeOwner(ctx, ids)) !== user.id) throw new HttpError(403, "not_owner");
    const input = z.object({ text: z.string().trim().min(1).max(600) }).parse(request.body);
    // COM-08: the owner's public answer goes through the same filters as any public text.
    assertCleanText(input.text);
    await ctx.db.query(
      "insert into review_replies (review_id, user_id, text, at) values ($1, $2, $3, $4) on conflict (review_id) do update set text = excluded.text, at = excluded.at",
      [request.params.id, user.id, input.text, ctx.now()],
    );
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/v1/reviews/:id/reply", async (request, reply) => {
    const user = requireUser(request);
    await ctx.db.query("delete from review_replies where review_id = $1 and user_id = $2", [uuid.parse(request.params.id), user.id]);
    return reply.status(204).send();
  });

  /** The server operator (OPERATOR_USERNAMES) reviews claims. Everyone else gets 403. */
  app.get("/v1/operator/claims", async (request) => {
    const user = requireUser(request);
    if (!isOperator(ctx, user)) throw new HttpError(403, "forbidden");
    const rows = await ctx.db.query<{ id: string; venue_id: string; name: string; address: string | null; display_name: string; username: string; proof: string; requested_at: number }>(
      `select c.id, c.venue_id, v.name, v.address, u.display_name, u.username, c.proof, c.requested_at
       from place_claims c join venues v on v.id = c.venue_id join users u on u.id = c.user_id
       where c.status = 'pending' order by c.requested_at`,
    );
    return {
      claims: rows.map((r) => ({
        id: r.id,
        venueId: r.venue_id,
        place: r.name,
        address: r.address ?? "",
        by: r.display_name,
        username: r.username,
        ...ctx.sealer.open<{ role: string; contact: string }>(r.proof),
        requestedAt: r.requested_at,
      })),
    };
  });

  app.post<{ Params: { id: string } }>("/v1/operator/claims/:id", async (request) => {
    const user = requireUser(request);
    if (!isOperator(ctx, user)) throw new HttpError(403, "forbidden");
    const { decision } = z.object({ decision: z.enum(["approved", "rejected"]) }).parse(request.body);
    const claim = (await ctx.db.query<{ venue_id: string }>("select venue_id from place_claims where id = $1 and status = 'pending'", [uuid.parse(request.params.id)]))[0];
    if (!claim) throw new HttpError(404, "not_found");
    if (decision === "approved") {
      const { ids } = await placeOf(ctx, claim.venue_id);
      if (await placeOwner(ctx, ids)) throw new HttpError(409, "already_claimed");
    }
    await ctx.db.query("update place_claims set status = $2, decided_at = $3, decided_by = $4 where id = $1", [request.params.id, decision, ctx.now(), user.id]);
    return { ok: true };
  });
}
