import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HttpError, requireUser, type Context } from "../context";
import { newCode } from "../crypto";
import { pickLanguage, referralPage } from "../invitePage";
import { RateLimiter } from "../ratelimit";

const pair = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x]);
const codeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6,16}$/);

async function ownerOf(ctx: Context, code: string): Promise<{ user_id: string; display_name: string } | null> {
  return (
    (
      await ctx.db.query<{ user_id: string; display_name: string }>(
        "select r.user_id, u.display_name from referral_codes r join users u on u.id = r.user_id where r.code = $1",
        [code],
      )
    )[0] ?? null
  );
}

/**
 * O-43: a personal link. Opened on a phone with the app, it sends a friend request to its owner.
 * Sharing the link is the owner's consent, so "who can send me requests" (COM-05) does not apply.
 */
export function referralRoutes(app: FastifyInstance, ctx: Context): void {
  const lookups = new RateLimiter(30, 10 * 60_000, ctx.now);
  const uses = new RateLimiter(20, 60 * 60_000, ctx.now);

  app.get("/v1/me/referral", async (request) => {
    const user = requireUser(request);
    let code = (await ctx.db.query<{ code: string }>("select code from referral_codes where user_id = $1", [user.id]))[0]?.code;
    if (!code) {
      code = newCode(10).toUpperCase();
      await ctx.db.query("insert into referral_codes (user_id, code, created_at) values ($1, $2, $3) on conflict (user_id) do nothing", [user.id, code, ctx.now()]);
      code = (await ctx.db.query<{ code: string }>("select code from referral_codes where user_id = $1", [user.id]))[0]!.code;
    }
    return { code, url: `${ctx.publicUrl}/f/${code}` };
  });

  /** The page the link opens in a browser: the owner's display name and a button into the app. */
  app.get<{ Params: { code: string } }>("/f/:code", async (request, reply) => {
    lookups.check(request.ip);
    const parsed = codeSchema.safeParse(request.params.code);
    const owner = parsed.success ? await ownerOf(ctx, parsed.data) : null;
    return reply
      .status(owner ? 200 : 404)
      .header("content-type", "text/html; charset=utf-8")
      .header("cache-control", "no-store")
      .send(referralPage(pickLanguage(request.headers["accept-language"]), owner && parsed.success ? { code: parsed.data, name: owner.display_name, serverUrl: ctx.publicUrl } : null));
  });

  /** The app opened the link: a request to the owner, or the answer when the owner already asked. */
  app.post<{ Params: { code: string } }>("/v1/referrals/:code", async (request) => {
    const user = requireUser(request);
    uses.check(user.id);
    const owner = await ownerOf(ctx, codeSchema.parse(request.params.code));
    if (!owner) throw new HttpError(404, "not_found");
    if (owner.user_id === user.id) throw new HttpError(400, "own_link");
    const blocked = await ctx.db.query("select 1 from blocks where (blocker = $1 and blocked = $2) or (blocker = $2 and blocked = $1)", [user.id, owner.user_id]);
    if (blocked.length) throw new HttpError(404, "not_found");
    const [a, b] = pair(user.id, owner.user_id);
    const row = (await ctx.db.query<{ status: string; requested_by: string }>("select status, requested_by from friendships where user_a = $1 and user_b = $2", [a, b]))[0];
    if (!row) await ctx.db.query("insert into friendships (user_a, user_b, requested_by, status, at) values ($1, $2, $3, 'pending', $4)", [a, b, user.id, ctx.now()]);
    else if (row.status === "pending" && row.requested_by === owner.user_id) {
      await ctx.db.query("update friendships set status = 'accepted', at = $3 where user_a = $1 and user_b = $2", [a, b, ctx.now()]);
    }
    const now = (await ctx.db.query<{ status: string; requested_by: string }>("select status, requested_by from friendships where user_a = $1 and user_b = $2", [a, b]))[0]!;
    // push: friends.request
    ctx.live.notify([user.id, owner.user_id], { type: "friends.changed" });
    return { userId: owner.user_id, name: owner.display_name, friendship: now.status === "accepted" ? "friends" : now.requested_by === user.id ? "requested" : "incoming" };
  });
}
