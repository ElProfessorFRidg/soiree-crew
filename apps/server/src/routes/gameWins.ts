import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HttpError, requireUser, type Context } from "../context";
import { RateLimiter } from "../ratelimit";

const uuid = z.string().uuid();

/**
 * PROF-02 games, N-24: games run on one phone and the server used to know nothing of them. The
 * phone that hosted a finished game posts its winner when the winner has an account. It awards no
 * points, and the server only accepts it when the poster played and every account at the table
 * shares a crew with the poster, so nobody credits wins to strangers.
 */
export function gameWinRoutes(app: FastifyInstance, ctx: Context): void {
  const posts = new RateLimiter(40, 24 * 3_600_000, ctx.now);

  app.post("/v1/games/wins", async (request, reply) => {
    const user = requireUser(request);
    posts.check(user.id);
    const input = z
      .object({
        id: uuid,
        gameId: z.string().regex(/^[a-zA-Z]{2,40}$/),
        winnerId: uuid,
        accountIds: z.array(uuid).min(2).max(30),
        players: z.number().int().min(2).max(40),
      })
      .parse(request.body);
    const accounts = new Set(input.accountIds);
    if (!accounts.has(user.id) || !accounts.has(input.winnerId) || accounts.size > input.players) throw new HttpError(400, "invalid");
    const mates = await ctx.db.query<{ user_id: string }>(
      "select distinct y.user_id from crew_members x join crew_members y on y.crew_id = x.crew_id where x.user_id = $1 and y.user_id = any($2::uuid[])",
      [user.id, [...accounts]],
    );
    if (mates.length !== accounts.size) throw new HttpError(403, "forbidden");
    await ctx.db.query("insert into game_wins (id, game_id, winner_id, posted_by, players, at) values ($1, $2, $3, $4, $5, $6) on conflict (id) do nothing", [
      input.id,
      input.gameId,
      input.winnerId,
      user.id,
      input.players,
      ctx.now(),
    ]);
    return reply.status(201).send({ ok: true });
  });
}
