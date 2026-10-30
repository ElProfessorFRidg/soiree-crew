import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { GameWin } from "@crew/territory";
import { assertCrewMember, HttpError, requireUser, type Context } from "../context";
import type { Db } from "../db";
import { RateLimiter } from "../ratelimit";
import { updateBoss } from "../territory";
import { nightOf } from "../time";

const HOUR_MS = 3_600_000;

/** The catalogue of packages/games (O-44); the server keeps its own copy of the ids it accepts. */
export const GAME_IDS = [
  "bigDeck",
  "tollRoad",
  "faceOff",
  "pointBlank",
  "fuse",
  "wheel",
  "neverEver",
  "verdict",
  "truthDare",
  "minefield",
  "fingerPick",
  "impostor",
  "doubleAgent",
  "quickDraw",
  "crash",
] as const;

/** A win counts on boards, badges and the hall of fame once at least two members played (RANK-05). */
export const COUNTED_MEMBERS = 2;
/** N-34: a member with this many counted wins in the crew earns the badge. */
export const GAME_WINNER_BADGE = 5;

const resultSchema = z.object({
  id: z.string().uuid(),
  crewId: z.string().uuid(),
  partyId: z.string().uuid().nullable().optional(),
  gameId: z.enum(GAME_IDS),
  playedAt: z.number().int(),
  /** Members who played, with their penalties. */
  members: z
    .array(z.object({ userId: z.string().uuid(), penalties: z.number().int().min(0).max(10_000) }))
    .max(16),
  /** Penalties of players without an account, unnamed. */
  guests: z.array(z.number().int().min(0).max(10_000)).max(16),
  record: z.object({ key: z.string().regex(/^[a-zA-Z.]{1,60}$/), userId: z.string().uuid(), count: z.number().int().min(1).max(10_000) }).nullable().optional(),
});

/**
 * The winner is computed here, not trusted from the phone: strictly the fewest penalties,
 * a tie names nobody, and a guest winning names nobody either.
 */
export function winnerOf(members: readonly { userId: string; penalties: number }[], guests: readonly number[]): string | null {
  const all = [...members.map((m) => ({ id: m.userId as string | null, penalties: m.penalties })), ...guests.map((penalties) => ({ id: null, penalties }))];
  if (all.length < 2) return null;
  const sorted = [...all].sort((a, b) => a.penalties - b.penalties);
  if (sorted[0]!.penalties === sorted[1]!.penalties) return null;
  return sorted[0]!.id;
}

/** Counted wins per member of a crew over [from, to). */
export async function gameWins(db: Db, crewId: string, from = 0, to = Number.MAX_SAFE_INTEGER): Promise<Map<string, number>> {
  const rows = await db.query<{ winner_id: string; n: number }>(
    `select winner_id, count(*)::int as n from game_results
     where crew_id = $1 and winner_id is not null and members >= $2 and played_at >= $3 and played_at < $4 group by winner_id`,
    [crewId, COUNTED_MEMBERS, from, to],
  );
  return new Map(rows.map((r) => [r.winner_id, r.n]));
}

/**
 * TER-02: wins at a venue in a season, for the territory engine. `participants` counts the members
 * of the game who had an accepted, public check-in at that venue covering the moment of the game;
 * the engine then checks the winner's check-in vested and applies the caps.
 */
export async function territoryGames(db: Db, crewId: string, start: number, end: number, timeZone: string): Promise<GameWin[]> {
  const rows = await db.query<{ winner_id: string; venue_id: string; played_at: number; present: number }>(
    `select r.winner_id, r.venue_id, r.played_at,
            (select count(distinct gm.user_id)::int from game_result_members gm
               join check_ins c on c.user_id = gm.user_id and c.venue_id = r.venue_id and c.verdict = 'accepted' and c.private = false
                and c.at between r.played_at - $4::bigint and r.played_at and (c.ended_at is null or c.ended_at >= r.played_at)
             where gm.result_id = r.id) as present
     from game_results r where r.crew_id = $1 and r.venue_id is not null and r.winner_id is not null and r.played_at >= $2 and r.played_at < $3
     order by r.played_at`,
    [crewId, start, end, 12 * HOUR_MS],
  );
  return rows.map((r) => ({ memberId: r.winner_id, venueId: r.venue_id, night: nightOf(r.played_at, timeZone), participants: r.present }));
}

export function gameRoutes(app: FastifyInstance, ctx: Context): void {
  // A phone ends a few games an hour; more than this is a script.
  const posts = new RateLimiter(30, HOUR_MS, ctx.now);

  /** TER-02, N-24: a finished game. Idempotent on its id, so the phone may retry freely. */
  app.post("/v1/games/results", async (request, reply) => {
    const user = requireUser(request);
    const input = resultSchema.parse(request.body);
    const existing = await ctx.db.query<{ recorded_by: string | null; winner_id: string | null; venue_id: string | null }>(
      "select recorded_by, winner_id, venue_id from game_results where id = $1",
      [input.id],
    );
    if (existing[0]) {
      if (existing[0].recorded_by !== user.id) throw new HttpError(409, "conflict");
      return reply.status(200).send({ id: input.id, winnerId: existing[0].winner_id, venueId: existing[0].venue_id, takeover: null });
    }
    posts.check(user.id);
    await assertCrewMember(ctx, input.crewId, user.id);
    const now = ctx.now();
    if (input.playedAt > now + 5 * 60_000 || input.playedAt < now - 48 * HOUR_MS) throw new HttpError(400, "invalid");
    const playedAt = Math.min(input.playedAt, now);

    const ids = input.members.map((m) => m.userId);
    if (new Set(ids).size !== ids.length) throw new HttpError(400, "invalid");
    if (ids.length) {
      const inCrew = await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1 and user_id = any($2::uuid[])", [input.crewId, ids]);
      if (inCrew.length !== ids.length) throw new HttpError(403, "not_member");
    }
    if (input.members.length + input.guests.length < 2) throw new HttpError(400, "invalid");

    if (input.partyId) {
      const going = await ctx.db.query(
        "select 1 from parties p join party_members m on m.party_id = p.id and m.user_id = $2 and m.response = 'going' where p.id = $1 and p.crew_id = $3",
        [input.partyId, user.id, input.crewId],
      );
      if (!going.length) throw new HttpError(403, "not_going");
    }

    // The venue is where the reporting phone is checked in, never what the phone says.
    const venue = await ctx.db.query<{ venue_id: string }>(
      `select c.venue_id from check_ins c join venues v on v.id = c.venue_id and v.crew_id = $1 and v.kind <> 'home'
       where c.user_id = $2 and c.verdict = 'accepted' and c.private = false and c.at between $3 and $4 and (c.ended_at is null or c.ended_at >= $4)
       order by c.at desc limit 1`,
      [input.crewId, user.id, playedAt - 12 * HOUR_MS, playedAt],
    );
    const venueId = venue[0]?.venue_id ?? null;
    const winnerId = winnerOf(input.members, input.guests);
    // A record belongs to a member who played; the count is the phone's tally, shown, never scored.
    const record = input.record && ids.includes(input.record.userId) ? input.record : null;

    await ctx.db.transaction(async (tx) => {
      await tx.query(
        `insert into game_results (id, crew_id, party_id, venue_id, game_id, recorded_by, winner_id, players, members, guests, record_key, record_user_id, record_count, played_at, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          input.id,
          input.crewId,
          input.partyId ?? null,
          venueId,
          input.gameId,
          user.id,
          winnerId,
          input.members.length + input.guests.length,
          input.members.length,
          input.guests.length,
          record?.key ?? null,
          record?.userId ?? null,
          record?.count ?? null,
          playedAt,
          now,
        ],
      );
      for (const m of input.members) {
        await tx.query("insert into game_result_members (result_id, user_id, penalties) values ($1, $2, $3)", [input.id, m.userId, m.penalties]);
      }
    });

    const takeover = venueId && winnerId ? await updateBoss(ctx, input.crewId, venueId) : null;
    // push: game.won.takeover (the crown moved because of a game won at the venue)
    const members = await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1", [input.crewId]);
    ctx.live.notify(members.map((m) => m.user_id), { type: "crew.changed", crewId: input.crewId });
    if (input.partyId) ctx.live.notify(members.map((m) => m.user_id), { type: "party.changed", partyId: input.partyId });
    return reply.status(201).send({ id: input.id, winnerId, venueId, takeover: takeover ? { bossId: takeover.bossId, takenFrom: takeover.takenFrom } : null });
  });

  /**
   * N-24: the crew's hall of fame. Per game: games played, the members with the most counted wins,
   * and the best record. Overall: who wins most. Members who left the leaderboard stay off it.
   */
  app.get<{ Params: { id: string } }>("/v1/crews/:id/games/hall", async (request) => {
    const user = requireUser(request);
    const crewId = request.params.id;
    await assertCrewMember(ctx, crewId, user.id);
    const names = new Map(
      (
        await ctx.db.query<{ user_id: string; display_name: string; nickname: string | null; leaderboard_opt_out: boolean }>(
          "select m.user_id, u.display_name, m.nickname, m.leaderboard_opt_out from crew_members m join users u on u.id = m.user_id where m.crew_id = $1",
          [crewId],
        )
      )
        .filter((m) => !m.leaderboard_opt_out)
        .map((m) => [m.user_id, m.nickname ?? m.display_name]),
    );
    const played = await ctx.db.query<{ game_id: string; n: number }>("select game_id, count(*)::int as n from game_results where crew_id = $1 group by game_id", [crewId]);
    const wins = await ctx.db.query<{ game_id: string; winner_id: string; n: number }>(
      `select game_id, winner_id, count(*)::int as n from game_results
       where crew_id = $1 and winner_id is not null and members >= $2 group by game_id, winner_id`,
      [crewId, COUNTED_MEMBERS],
    );
    const records = await ctx.db.query<{ game_id: string; record_key: string; record_user_id: string; record_count: number; played_at: number }>(
      `select distinct on (game_id) game_id, record_key, record_user_id, record_count, played_at from game_results
       where crew_id = $1 and record_user_id is not null order by game_id, record_count desc, played_at`,
      [crewId],
    );
    const named = (id: string) => names.get(id);
    const games = played
      .map((p) => {
        const record = records.find((r) => r.game_id === p.game_id && named(r.record_user_id));
        return {
          gameId: p.game_id,
          played: p.n,
          wins: wins
            .filter((w) => w.game_id === p.game_id && named(w.winner_id))
            .sort((a, b) => b.n - a.n)
            .slice(0, 3)
            .map((w) => ({ userId: w.winner_id, name: named(w.winner_id)!, wins: w.n })),
          record: record ? { key: record.record_key, userId: record.record_user_id, name: named(record.record_user_id)!, count: record.record_count, at: record.played_at } : null,
        };
      })
      .sort((a, b) => b.played - a.played);
    const totals = new Map<string, number>();
    for (const w of wins) if (named(w.winner_id)) totals.set(w.winner_id, (totals.get(w.winner_id) ?? 0) + w.n);
    return {
      games,
      top: [...totals.entries()]
        .sort((a, b) => b[1] - a[1] || named(a[0])!.localeCompare(named(b[0])!))
        .slice(0, 5)
        .map(([userId, n]) => ({ userId, name: named(userId)!, wins: n })),
    };
  });
}
