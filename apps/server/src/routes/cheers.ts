import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AC_CONFIG } from "../anticheat";
import { assertCrewMember, requireUser, type Context } from "../context";
import { RateLimiter } from "../ratelimit";
import { updateBoss } from "../territory";

/** Two knocks closer than this, by the server's clock, are one cheers. */
const MATCH_MS = 1_500;
/** A check-in this recent and still open is "where you are" for the proximity proof. */
const OPEN_CHECK_IN_MS = 6 * 3_600_000;

/**
 * JOY-01: phones knocked together. The server pairs two knocks from the same crew; both phones then
 * play the clink. When both people are checked in at the same bar, the cheers confirms each other's
 * check-in, like a one-tap confirmation from someone who is there (AC-04).
 */
export function cheersRoutes(app: FastifyInstance, ctx: Context): void {
  const knocks = new RateLimiter(30, 60 * 60_000, ctx.now);

  app.post("/v1/cheers", async (request) => {
    const user = requireUser(request);
    knocks.check(user.id);
    const { crewId } = z.object({ crewId: z.string().uuid() }).parse(request.body);
    await assertCrewMember(ctx, crewId, user.id);
    const now = ctx.now();
    const outcome = await ctx.db.transaction(async (tx) => {
      const other = (
        await tx.query<{ id: string; user_id: string }>(
          `select id, user_id from cheer_bumps where crew_id = $1 and user_id <> $2 and not matched and at between $3 and $4
           order by abs(at - $5) limit 1 for update`,
          [crewId, user.id, now - MATCH_MS, now + MATCH_MS, now],
        )
      )[0];
      if (!other) {
        await tx.query("insert into cheer_bumps (id, user_id, crew_id, at) values ($1, $2, $3, $4)", [randomUUID(), user.id, crewId, now]);
        return null;
      }
      await tx.query("update cheer_bumps set matched = true where id = $1", [other.id]);
      // Same bar, both still there. A cheers vouches like a one-tap confirmation (AC-04), with the same
      // rules: only someone whose own check-in stood on its own signals can vouch, the nightly cap
      // applies, and two unverified check-ins can never lift each other.
      const open = await tx.query<{ id: string; user_id: string; venue_id: string; private: boolean; verdict: string; corroborated: boolean }>(
        `select distinct on (user_id) id, user_id, venue_id, private, verdict, corroborated from check_ins
         where user_id = any($1::uuid[]) and ended_at is null and at > $2 and verdict in ('accepted', 'unverified')
         order by user_id, at desc`,
        [[user.id, other.user_id], now - OPEN_CHECK_IN_MS],
      );
      const mine = open.find((c) => c.user_id === user.id);
      const theirs = open.find((c) => c.user_id === other.user_id);
      const venueId = mine && theirs && mine.venue_id === theirs.venue_id ? mine.venue_id : null;
      let lifted = false;
      if (venueId) {
        for (const [checkIn, voucher] of [
          [mine!, theirs!],
          [theirs!, mine!],
        ] as const) {
          if (checkIn.verdict !== "unverified" || voucher.verdict !== "accepted" || voucher.corroborated) continue;
          const recent = await tx.query<{ n: number }>("select count(*)::int as n from checkin_confirmations where confirmer_id = $1 and at > $2", [
            voucher.user_id,
            now - 12 * 3_600_000,
          ]);
          if (recent[0]!.n >= AC_CONFIG.peers.confirmsPerNight) continue;
          await tx.query("insert into checkin_confirmations (check_in_id, confirmer_id, at) values ($1, $2, $3) on conflict do nothing", [checkIn.id, voucher.user_id, now]);
          await tx.query("update check_ins set verdict = 'accepted', corroborated = true where id = $1 and verdict = 'unverified'", [checkIn.id]);
          lifted = true;
        }
      }
      await tx.query("insert into cheers (id, crew_id, user_a, user_b, venue_id, at) values ($1, $2, $3, $4, $5, $6)", [randomUUID(), crewId, other.user_id, user.id, venueId, now]);
      return { with: other.user_id, venueId, lifted, private: Boolean(mine?.private || theirs?.private) };
    });
    if (!outcome) return { matched: false };
    if (outcome.lifted && outcome.venueId && !outcome.private) await updateBoss(ctx, crewId, outcome.venueId);
    const names = await ctx.db.query<{ id: string; display_name: string }>("select id, display_name from users where id = any($1::uuid[])", [[user.id, outcome.with]]);
    const nameOf = (id: string) => names.find((n) => n.id === id)?.display_name ?? "";
    ctx.live.notify([outcome.with], { type: "cheers", withUserId: user.id, withName: nameOf(user.id), proof: outcome.venueId !== null });
    return { matched: true, withUserId: outcome.with, withName: nameOf(outcome.with), proof: outcome.venueId !== null };
  });

  /** How many cheers each member gave this crew: a small stat for the recap and the crew. */
  app.get<{ Params: { id: string } }>("/v1/crews/:id/cheers", async (request) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const rows = await ctx.db.query<{ user_id: string; n: number }>(
      `select user_id, count(*)::int as n from (select user_a as user_id from cheers where crew_id = $1 union all select user_b from cheers where crew_id = $1) x
       group by user_id order by n desc`,
      [request.params.id],
    );
    return { counts: rows.map((r) => ({ userId: r.user_id, cheers: r.n })) };
  });
}
