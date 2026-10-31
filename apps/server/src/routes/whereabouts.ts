import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser, type Context } from "../context";
import { coarse, matchCrews, outingState, recordNudge, REPORT_EVERY_MS } from "../outing";
import { RateLimiter } from "../ratelimit";

const position = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** The phone's "mute until morning". */
  mutedUntil: z.number().int().nonnegative().nullable().optional(),
});

/**
 * "Me détecter avec mon crew": the latest coarse position, for the crew match only (outing.ts).
 * The "go out?" nudges the phone sends itself are recorded here too, as times only, so both kinds
 * share one budget per night and teach the same habit.
 */
export function whereaboutsRoutes(app: FastifyInstance, ctx: Context): void {
  const reports = new RateLimiter(20, 60 * 60_000, ctx.now);

  app.post("/v1/me/whereabouts", async (request) => {
    const user = requireUser(request);
    reports.check(user.id);
    const body = position.parse(request.body);
    const now = ctx.now();
    const last = (await ctx.db.query<{ at: number }>("select at from whereabouts where user_id = $1", [user.id]))[0];
    // One every 10 min at most: an earlier one changes nothing.
    if (!last || Number(last.at) <= now - REPORT_EVERY_MS) {
      await ctx.db.query(
        `insert into whereabouts (user_id, lat, lng, at, muted_until) values ($1, $2, $3, $4, $5)
         on conflict (user_id) do update set lat = excluded.lat, lng = excluded.lng, at = excluded.at, muted_until = excluded.muted_until`,
        [user.id, coarse(body.lat), coarse(body.lng), now, body.mutedUntil ?? null],
      );
      await matchCrews(ctx, user.id);
    }
    return outingState(ctx, user.id);
  });

  app.delete("/v1/me/whereabouts", async (request, reply) => {
    const user = requireUser(request);
    await ctx.db.query("delete from whereabouts where user_id = $1", [user.id]);
    return reply.code(204).send();
  });

  app.post("/v1/me/outing-nudges", async (request) => {
    const user = requireUser(request);
    reports.check(user.id);
    const { at } = z.object({ at: z.number().int() }).parse(request.body);
    const now = ctx.now();
    if (at > now - 24 * 3_600_000 && at < now + 3 * 3_600_000) await recordNudge(ctx, user.id, at, "local");
    return outingState(ctx, user.id);
  });

  app.get("/v1/me/outing-habit", async (request) => outingState(ctx, requireUser(request).id));
}
