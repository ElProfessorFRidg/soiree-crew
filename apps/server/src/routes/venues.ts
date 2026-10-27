import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { challengers } from "@crew/territory";
import { AC_CONFIG, evaluateCheckIn, fixHash } from "../anticheat";
import { assertCrewMember, HttpError, requireUser, type Context } from "../context";
import { crewStandings, crewTimeZone, currentSeason, updateBoss } from "../territory";

const venueSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
  kind: z.enum(["bar", "club", "spot", "home"]),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().trim().max(120).optional(),
});

const fixSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(10_000),
  mocked: z.boolean(),
  deviceNow: z.number().int().nonnegative(),
});

const checkInSchema = fixSchema.extend({ id: z.string().uuid(), venueId: z.string().uuid(), private: z.boolean().default(false) });

const REJECTED_VISIBLE_MS = 7 * 24 * 3_600_000;

async function venueForMember(ctx: Context, venueId: string, userId: string) {
  const rows = await ctx.db.query<{ id: string; crew_id: string; name: string; kind: string; lat: number; lng: number; radius_m: number; address: string; is_hq: boolean }>(
    `select v.* from venues v join crew_members m on m.crew_id = v.crew_id and m.user_id = $2 where v.id = $1`,
    [venueId, userId],
  );
  if (!rows[0]) throw new HttpError(404, "not_found");
  return rows[0];
}

async function notifyCrew(ctx: Context, crewId: string): Promise<void> {
  const members = await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1", [crewId]);
  ctx.live.notify(members.map((m) => m.user_id), { type: "crew.changed", crewId });
}

export function venueRoutes(app: FastifyInstance, ctx: Context, secret: string): void {
  app.post<{ Params: { id: string } }>("/v1/crews/:id/venues", async (request, reply) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const input = venueSchema.parse(request.body);
    await ctx.db.query(
      `insert into venues (id, crew_id, name, kind, lat, lng, address, created_by, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) on conflict (id) do nothing`,
      [input.id, request.params.id, input.name, input.kind, input.lat, input.lng, input.address ?? "", user.id, ctx.now()],
    );
    await notifyCrew(ctx, request.params.id);
    return reply.status(201).send({ id: input.id });
  });

  /**
   * TER-01 map data: venues with their boss, my points, whether the crew has ever been there
   * (fog of war, TER-08) and how many of us are there right now. Crew members only.
   */
  app.get<{ Params: { id: string } }>("/v1/crews/:id/venues", async (request) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const timeZone = await crewTimeZone(ctx.db, request.params.id);
    const now = ctx.now();
    const season = currentSeason(now, timeZone);
    const venues = await ctx.db.query<{ id: string; name: string; kind: string; lat: number; lng: number; address: string; is_hq: boolean }>(
      "select id, name, kind, lat, lng, address, is_hq from venues where crew_id = $1 order by name",
      [request.params.id],
    );
    const standings = await crewStandings(ctx, request.params.id, season);
    const visited = await ctx.db.query<{ venue_id: string }>(
      `select distinct c.venue_id from check_ins c join venues v on v.id = c.venue_id and v.crew_id = $1
       where c.verdict = 'accepted' and c.private = false`,
      [request.params.id],
    );
    const here = await ctx.db.query<{ venue_id: string; n: number }>(
      `select c.venue_id, count(distinct c.user_id)::int as n from check_ins c join venues v on v.id = c.venue_id and v.crew_id = $1
       where c.verdict = 'accepted' and c.private = false and c.ended_at is null and c.at > $2 group by c.venue_id`,
      [request.params.id, now - 6 * 3_600_000],
    );
    const names = await ctx.db.query<{ id: string; display_name: string }>(
      "select u.id, u.display_name from users u join crew_members m on m.user_id = u.id where m.crew_id = $1",
      [request.params.id],
    );
    const nameOf = new Map(names.map((n) => [n.id, n.display_name]));
    const visitedSet = new Set(visited.map((v) => v.venue_id));
    return {
      season,
      venues: venues.map((v) => {
        const standing = standings.find((s) => s.venueId === v.id);
        const boss = standing?.bossId ?? null;
        return {
          id: v.id,
          name: v.name,
          kind: v.kind,
          lat: v.lat,
          lng: v.lng,
          address: v.address,
          isHq: v.is_hq,
          bossId: boss,
          bossName: boss ? (nameOf.get(boss) ?? null) : null,
          myPoints: standing?.scores.find((s) => s.memberId === user.id)?.points ?? 0,
          bossPoints: standing?.scores[0]?.points ?? 0,
          explored: visitedSet.has(v.id),
          hereNow: here.find((h) => h.venue_id === v.id)?.n ?? 0,
        };
      }),
    };
  });

  /** TER-05 venue page for crew members: boss, season top 5, past mayors, latest nights, recent cheat attempts (AC-09). */
  app.get<{ Params: { id: string } }>("/v1/venues/:id", async (request) => {
    const user = requireUser(request);
    const venue = await venueForMember(ctx, request.params.id, user.id);
    const timeZone = await crewTimeZone(ctx.db, venue.crew_id);
    const now = ctx.now();
    const season = currentSeason(now, timeZone);
    const standing = (await crewStandings(ctx, venue.crew_id, season)).find((s) => s.venueId === venue.id);
    const names = await ctx.db.query<{ id: string; display_name: string }>(
      "select u.id, u.display_name from users u join crew_members m on m.user_id = u.id where m.crew_id = $1",
      [venue.crew_id],
    );
    const nameOf = new Map(names.map((n) => [n.id, n.display_name]));
    const mayors = await ctx.db.query<{ user_id: string; season: string }>(
      `select distinct on (season) user_id, season from reigns where venue_id = $1 and season <> $2 order by season desc, started_at desc`,
      [venue.id, season],
    );
    const rejected = await ctx.db.query<{ id: string; user_id: string; at: number; overturned_by: string | null }>(
      "select id, user_id, at, overturned_by from check_ins where venue_id = $1 and verdict = 'rejected' and at > $2 order by at desc",
      [venue.id, now - REJECTED_VISIBLE_MS],
    );
    const nights = await ctx.db.query<{ party_id: string; name: string; starts_at: number; n: number }>(
      `select c.party_id, p.name, p.starts_at, count(distinct c.user_id)::int as n from check_ins c join parties p on p.id = c.party_id
       where c.venue_id = $1 and c.verdict = 'accepted' and c.private = false group by c.party_id, p.name, p.starts_at order by p.starts_at desc limit 5`,
      [venue.id],
    );
    const mine = standing?.scores.find((s) => s.memberId === user.id);
    return {
      venue: { id: venue.id, crewId: venue.crew_id, name: venue.name, kind: venue.kind, lat: venue.lat, lng: venue.lng, address: venue.address },
      season,
      bossId: standing?.bossId ?? null,
      top: (standing?.scores ?? []).slice(0, 5).map((s) => ({ userId: s.memberId, name: nameOf.get(s.memberId) ?? "", points: s.points, nights: s.nights })),
      myPoints: mine?.points ?? 0,
      challengers: standing ? challengers(standing).map((s) => ({ userId: s.memberId, name: nameOf.get(s.memberId) ?? "", points: s.points })) : [],
      pastMayors: mayors.map((m) => ({ season: m.season, userId: m.user_id, name: nameOf.get(m.user_id) ?? "" })),
      latestNights: nights.map((n) => ({ partyId: n.party_id, name: n.name, startsAt: n.starts_at, members: n.n })),
      cheatAttempts: rejected.map((r) => ({ id: r.id, userId: r.user_id, name: nameOf.get(r.user_id) ?? "", at: r.at, overturned: r.overturned_by !== null })),
    };
  });

  /**
   * N-10 / TER-03 check-in. The verdict comes from the server (AC-06); the client only sends the
   * raw fix. Raw coordinates are dropped once the verdict is stored (SEC-06). The answer never
   * says which signal tripped, so a cheater learns nothing (design-b.md G-3).
   */
  app.post("/v1/checkins", async (request, reply) => {
    const user = requireUser(request);
    const input = checkInSchema.parse(request.body);
    const venue = await venueForMember(ctx, input.venueId, user.id);
    const now = ctx.now();
    const existing = await ctx.db.query<{ verdict: string }>("select verdict from check_ins where id = $1 and user_id = $2", [input.id, user.id]);
    if (existing[0]) return { id: input.id, verdict: existing[0].verdict, takeover: null };

    const previous = await ctx.db.query<{ venue_id: string; at: number; lat: number; lng: number; fix_hash: string }>(
      `select c.venue_id, c.at, v.lat, v.lng, c.fix_hash from check_ins c join venues v on v.id = c.venue_id
       where c.user_id = $1 and c.at > $2 order by c.at desc limit 10`,
      [user.id, now - 12 * 3_600_000],
    );
    const peers = await ctx.db.query<{ at: number }>(
      "select at from check_ins where venue_id = $1 and user_id <> $2 and verdict = 'accepted' and at > $3",
      [venue.id, user.id, now - 3_600_000],
    );
    const hash = fixHash(secret, input);
    const evaluation = evaluateCheckIn({
      fix: input,
      venue: { id: venue.id, lat: venue.lat, lng: venue.lng, radiusM: venue.radius_m },
      serverNow: now,
      deviceNow: input.deviceNow,
      previous: previous.map((p) => ({ venueId: p.venue_id, at: p.at, lat: p.lat, lng: p.lng, fixHash: p.fix_hash })),
      peersAtVenue: peers,
      fixHash: hash,
    });

    if (evaluation.verdict === "not_here") {
      return reply.status(200).send({ id: input.id, verdict: "not_here", takeover: null });
    }

    const party = await ctx.db.query<{ id: string }>(
      `select p.id from parties p join party_members m on m.party_id = p.id and m.user_id = $1 and m.response = 'going'
       where p.crew_id = $2 and p.closed_at is null and p.starts_at <= $3 and p.ends_at >= $3 limit 1`,
      [user.id, venue.crew_id, now],
    );
    await ctx.db.transaction(async (tx) => {
      // A check-in elsewhere ends the previous one (TER-02 time at venue).
      await tx.query("update check_ins set ended_at = $2 where user_id = $1 and ended_at is null", [user.id, now]);
      await tx.query(
        `insert into check_ins (id, user_id, venue_id, party_id, at, last_proof_at, verdict, risk, signals, config_version, corroborated, private, fix_hash, created_at)
         values ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, $11, $12, $5)`,
        [
          input.id,
          user.id,
          venue.id,
          party[0]?.id ?? null,
          now,
          evaluation.verdict,
          evaluation.risk,
          JSON.stringify(evaluation.signals.map((s) => ({ name: s.name, points: s.points }))),
          AC_CONFIG.version,
          evaluation.corroborated,
          input.private,
          hash,
        ],
      );
      // A new accepted check-in corroborates the ones already there (AC-04 passive peer).
      if (evaluation.verdict === "accepted" && !input.private) {
        await tx.query(
          "update check_ins set corroborated = true where venue_id = $1 and user_id <> $2 and verdict in ('accepted', 'unverified') and at > $3",
          [venue.id, user.id, now - AC_CONFIG.time.peerWindowMin * 60_000],
        );
        await tx.query(
          "update check_ins set verdict = 'accepted' where venue_id = $1 and user_id <> $2 and verdict = 'unverified' and risk < $3::int + $4::int and at > $5",
          [venue.id, user.id, AC_CONFIG.bands.acceptBelow, AC_CONFIG.credits.peerPassive, now - AC_CONFIG.time.peerWindowMin * 60_000],
        );
      }
    });

    const takeover = evaluation.verdict === "accepted" && !input.private ? await updateBoss(ctx, venue.crew_id, venue.id) : null;
    await notifyCrew(ctx, venue.crew_id);
    return reply.status(201).send({
      id: input.id,
      verdict: evaluation.verdict,
      reason: evaluation.reason ?? null,
      takeover: takeover ? { bossId: takeover.bossId, takenFrom: takeover.takenFrom } : null,
    });
  });

  /** "Still here" proof, without keeping the coordinates (TER-02 proof ceiling). */
  app.post<{ Params: { id: string } }>("/v1/checkins/:id/proof", async (request) => {
    const user = requireUser(request);
    const fix = fixSchema.parse(request.body);
    const rows = await ctx.db.query<{ venue_id: string; crew_id: string; lat: number; lng: number; radius_m: number }>(
      `select c.venue_id, v.crew_id, v.lat, v.lng, v.radius_m from check_ins c join venues v on v.id = c.venue_id
       where c.id = $1 and c.user_id = $2 and c.ended_at is null`,
      [request.params.id, user.id],
    );
    const row = rows[0];
    if (!row) throw new HttpError(404, "not_found");
    const evaluation = evaluateCheckIn({
      fix,
      venue: { id: row.venue_id, lat: row.lat, lng: row.lng, radiusM: row.radius_m },
      serverNow: ctx.now(),
      deviceNow: fix.deviceNow,
      previous: [],
      peersAtVenue: [],
      fixHash: "",
    });
    if (evaluation.verdict !== "accepted") return { ok: false };
    await ctx.db.query("update check_ins set last_proof_at = $2 where id = $1", [request.params.id, ctx.now()]);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/v1/checkins/:id/end", async (request) => {
    const user = requireUser(request);
    await ctx.db.query("update check_ins set ended_at = $3 where id = $1 and user_id = $2 and ended_at is null", [request.params.id, user.id, ctx.now()]);
    return { ok: true };
  });

  /** AC-09: the crew admin can overturn a false positive. */
  app.post<{ Params: { id: string } }>("/v1/checkins/:id/overturn", async (request) => {
    const user = requireUser(request);
    const rows = await ctx.db.query<{ crew_id: string; venue_id: string }>(
      "select v.crew_id, c.venue_id from check_ins c join venues v on v.id = c.venue_id where c.id = $1",
      [request.params.id],
    );
    const row = rows[0];
    if (!row) throw new HttpError(404, "not_found");
    const { role } = await assertCrewMember(ctx, row.crew_id, user.id);
    if (role !== "admin") throw new HttpError(403, "forbidden");
    await ctx.db.query("update check_ins set verdict = 'accepted', overturned_by = $2 where id = $1 and verdict = 'rejected'", [request.params.id, user.id]);
    await updateBoss(ctx, row.crew_id, row.venue_id);
    await notifyCrew(ctx, row.crew_id);
    return { ok: true };
  });

  /** TER-09 and RANK-08: each member can leave the territory game or the leaderboard. */
  app.patch<{ Params: { id: string } }>("/v1/crews/:id/me", async (request) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const input = z.object({ territoryOptOut: z.boolean().optional(), leaderboardOptOut: z.boolean().optional() }).parse(request.body);
    if (input.territoryOptOut !== undefined) {
      await ctx.db.query("update crew_members set territory_opt_out = $3 where crew_id = $1 and user_id = $2", [request.params.id, user.id, input.territoryOptOut]);
    }
    if (input.leaderboardOptOut !== undefined) {
      await ctx.db.query("update crew_members set leaderboard_opt_out = $3 where crew_id = $1 and user_id = $2", [request.params.id, user.id, input.leaderboardOptOut]);
    }
    await notifyCrew(ctx, request.params.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/v1/venues/:id/workplace", async (request) => {
    const user = requireUser(request);
    const venue = await venueForMember(ctx, request.params.id, user.id);
    await ctx.db.query("insert into workplace_exclusions (venue_id, user_id) values ($1, $2) on conflict do nothing", [venue.id, user.id]);
    await updateBoss(ctx, venue.crew_id, venue.id);
    return { ok: true };
  });

}
