import { resolveBoss, scoreSeason, seasonBounds, seasonKey, weekKey, type CountedCheckIn, type VenueStanding } from "@crew/territory";
import type { Context } from "./context";
import { newId } from "./crypto";
import type { Db } from "./db";
import { nightOf, offsetMinutes } from "./time";

interface CheckInRow {
  id: string;
  user_id: string;
  venue_id: string;
  party_id: string | null;
  at: number;
  ended_at: number | null;
  last_proof_at: number;
  corroborated: boolean;
}

export async function crewTimeZone(db: Db, crewId: string): Promise<string> {
  const rows = await db.query<{ time_zone: string }>("select time_zone from crews where id = $1", [crewId]);
  return rows[0]?.time_zone ?? "Europe/Paris";
}

export function currentSeason(at: number, timeZone: string): string {
  return seasonKey(at, offsetMinutes(at, timeZone));
}

/**
 * Season standings of every territory venue of a crew, replayed from the stored events
 * (AC-01): accepted, public check-ins of members who play, never homes, never drinks.
 */
export async function crewStandings(ctx: Context, crewId: string, season: string): Promise<VenueStanding[]> {
  const timeZone = await crewTimeZone(ctx.db, crewId);
  const { start, end } = seasonBounds(season, offsetMinutes(Date.parse(`${season}-15T12:00:00Z`), timeZone));
  const rows = await ctx.db.query<CheckInRow>(
    `select c.id, c.user_id, c.venue_id, c.party_id, c.at, c.ended_at, c.last_proof_at, c.corroborated
     from check_ins c
     join venues v on v.id = c.venue_id and v.crew_id = $1 and v.kind <> 'home'
     join crew_members m on m.crew_id = $1 and m.user_id = c.user_id and m.territory_opt_out = false
     where c.verdict = 'accepted' and c.private = false and c.at >= $2 and c.at < $3`,
    [crewId, start, end],
  );
  const before = await ctx.db.query<{ venue_id: string }>(
    `select distinct c.venue_id from check_ins c join venues v on v.id = c.venue_id and v.crew_id = $1
     where c.verdict = 'accepted' and c.private = false and c.at < $2`,
    [crewId, start],
  );
  const parties = await ctx.db.query<{ id: string; created_by: string }>(
    "select id, created_by from parties where crew_id = $1 and starts_at < $3 and ends_at >= $2",
    [crewId, start, end],
  );
  const exclusions = await ctx.db.query<{ venue_id: string; user_id: string }>(
    "select e.venue_id, e.user_id from workplace_exclusions e join venues v on v.id = e.venue_id and v.crew_id = $1",
    [crewId],
  );
  const now = Math.min(ctx.now(), end);
  const checkIns: CountedCheckIn[] = rows.map((r) => {
    const night = nightOf(r.at, timeZone);
    return {
      id: r.id,
      memberId: r.user_id,
      venueId: r.venue_id,
      partyId: r.party_id,
      at: r.at,
      endedAt: r.ended_at,
      lastProofAt: r.last_proof_at,
      corroborated: r.corroborated,
      night,
      week: weekKey(night),
    };
  });
  return scoreSeason({
    checkIns,
    parties: parties.map((p) => ({ id: p.id, organiserId: p.created_by })),
    games: [],
    discoveredBefore: new Set(before.map((b) => b.venue_id)),
    workplaceExclusions: new Set(exclusions.map((e) => `${e.venue_id}:${e.user_id}`)),
    now,
  });
}

export interface Takeover {
  venueId: string;
  bossId: string | null;
  takenFrom: string | null;
}

/** Recomputes one venue's boss and records reigns (TER-04). Returns a takeover when the crown moved. */
export async function updateBoss(ctx: Context, crewId: string, venueId: string): Promise<Takeover | null> {
  const timeZone = await crewTimeZone(ctx.db, crewId);
  const now = ctx.now();
  const season = currentSeason(now, timeZone);
  const standing = (await crewStandings(ctx, crewId, season)).find((s) => s.venueId === venueId) ?? { venueId, scores: [], bossId: null };
  const open = await ctx.db.query<{ id: string; user_id: string }>(
    "select id, user_id from reigns where venue_id = $1 and season = $2 and ended_at is null",
    [venueId, season],
  );
  const previous = open[0]?.user_id ?? null;
  const { bossId, takenFrom } = resolveBoss(standing, previous);
  if (bossId === previous) return null;
  if (open[0]) await ctx.db.query("update reigns set ended_at = $2, ended_reason = 'taken' where id = $1", [open[0].id, now]);
  if (bossId) {
    await ctx.db.query("insert into reigns (id, venue_id, user_id, season, started_at) values ($1, $2, $3, $4, $5)", [
      newId(),
      venueId,
      bossId,
      season,
      now,
    ]);
  }
  return { venueId, bossId, takenFrom };
}
