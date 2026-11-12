import { distanceMeters } from "./anticheat";
import type { Context } from "./context";
import { closesAt, samePlaceIds, venueFacts } from "./hours";
import { claimMark, notifyUsers } from "./notifications/notify";
import { WHEREABOUTS_TTL_MS } from "./outing";
import { crewTimeZone } from "./territory";

// QOL-17: suggestions that save taps. Three of the crew at one venue with no party running get
// "start one together?"; a party launched now tells the rest of the crew; a venue about to close
// tells the people checked in there. The server decides each one from what it already knows:
// check-ins, the coarse positions of "Me détecter avec mon crew", the hours of the place.

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** This many members at one venue make a gathering. */
export const GATHERING = 3;
/** An open check-in older than this no longer says someone is there (as hereNow on the map). */
const CHECK_IN_FRESH_MS = 6 * HOUR_MS;
/** A coarse position (about 100 m) this far past a venue's radius still counts as there. */
const POSITION_SLACK_M = 100;
/** One "start one together?" per person and crew in this time. */
const GATHERING_GAP_MS = 4 * HOUR_MS;
/** A party starting this soon counts as launched now. */
export const LAUNCH_WINDOW_MS = 30 * MINUTE_MS;
/** One "a crew mate launched a party" per person and crew in this time. */
const LAUNCH_GAP_MS = 2 * HOUR_MS;
/** The heads-up comes this long before closing time. */
export const CLOSING_AHEAD_MS = 30 * MINUTE_MS;
/** Written variants of each suggestion line (SLOP-11). */
export const SUGGESTION_VARIANTS = 4;

const variant = () => 1 + Math.floor(Math.random() * SUGGESTION_VARIANTS);

export interface VenueSpot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
}

export interface Gathering {
  venueId: string;
  venueName: string;
  /** Members checked in there: the crew already sees those check-ins. */
  checkedIn: string[];
  /** Members found there by their coarse position only: never shown to the rest of the crew. */
  detected: string[];
}

/**
 * Who is at which venue: an open check-in says so; otherwise a fresh coarse position within the
 * venue's radius (plus the rounding), at the nearest venue. Each member counts at one venue only.
 */
export function gatheringsOf(
  venues: readonly VenueSpot[],
  checkIns: readonly { user_id: string; venue_id: string }[],
  positions: readonly { user_id: string; lat: number; lng: number }[],
): Gathering[] {
  const byVenue = new Map<string, Gathering>(venues.map((v) => [v.id, { venueId: v.id, venueName: v.name, checkedIn: [], detected: [] }]));
  const placed = new Set<string>();
  for (const c of checkIns) {
    const spot = byVenue.get(c.venue_id);
    if (!spot || placed.has(c.user_id)) continue;
    spot.checkedIn.push(c.user_id);
    placed.add(c.user_id);
  }
  for (const p of positions) {
    if (placed.has(p.user_id)) continue;
    let best: { id: string; d: number } | null = null;
    for (const v of venues) {
      const d = distanceMeters(p, v);
      if (d <= v.radius_m + POSITION_SLACK_M && (!best || d < best.d)) best = { id: v.id, d };
    }
    if (!best) continue;
    byVenue.get(best.id)!.detected.push(p.user_id);
    placed.add(p.user_id);
  }
  return [...byVenue.values()]
    .filter((g) => g.checkedIn.length + g.detected.length > 0)
    .sort((a, b) => b.checkedIn.length + b.detected.length - (a.checkedIn.length + a.detected.length));
}

const sizeOf = (g: Gathering) => g.checkedIn.length + g.detected.length;

/** A party of the crew is live now or starts within the launch window: nothing to suggest. */
async function crewHasParty(ctx: Context, crewId: string, now: number): Promise<boolean> {
  const rows = await ctx.db.query("select 1 from parties where crew_id = $1 and closed_at is null and starts_at <= $2 and ends_at > $3 limit 1", [
    crewId,
    now + LAUNCH_WINDOW_MS,
    now,
  ]);
  return rows.length > 0;
}

async function crewGatherings(ctx: Context, crewId: string, now: number): Promise<Gathering[]> {
  // Homes never count: three friends at someone's flat are not at a bar.
  const venues = await ctx.db.query<VenueSpot>("select id, name, lat, lng, radius_m from venues where crew_id = $1 and kind <> 'home'", [crewId]);
  if (!venues.length) return [];
  // Private check-ins stay out: the person asked the crew not to see them.
  const checkIns = await ctx.db.query<{ user_id: string; venue_id: string }>(
    `select c.user_id, c.venue_id from check_ins c join venues v on v.id = c.venue_id and v.crew_id = $1
     join crew_members m on m.crew_id = $1 and m.user_id = c.user_id
     where c.verdict = 'accepted' and c.private = false and c.ended_at is null and c.at > $2 order by c.at desc`,
    [crewId, now - CHECK_IN_FRESH_MS],
  );
  const positions = await ctx.db.query<{ user_id: string; lat: number; lng: number }>(
    "select w.user_id, w.lat, w.lng from whereabouts w join crew_members m on m.user_id = w.user_id and m.crew_id = $1 where w.at > $2",
    [crewId, now - WHEREABOUTS_TTL_MS],
  );
  return gatheringsOf(venues, checkIns, positions);
}

/**
 * After a check-in or a position: when three or more of the crew are at one venue and no party
 * is running, each of them is asked once whether to start one there. Returns everyone at such a
 * gathering, asked now or earlier, so the "go out?" crew nudge does not say the same thing twice.
 */
export async function suggestGathering(ctx: Context, crewId: string): Promise<Set<string>> {
  const now = ctx.now();
  const present = new Set<string>();
  if (await crewHasParty(ctx, crewId, now)) return present;
  const gathering = (await crewGatherings(ctx, crewId, now)).find((g) => sizeOf(g) >= GATHERING);
  if (!gathering) return present;
  const members = [...gathering.checkedIn, ...gathering.detected];
  const recipients: string[] = [];
  for (const userId of members) {
    present.add(userId);
    if (await claimMark(ctx, userId, `gathering:${crewId}`, GATHERING_GAP_MS)) recipients.push(userId);
  }
  if (recipients.length) {
    await notifyUsers(ctx, recipients, {
      kind: "gathering",
      crewId,
      refId: gathering.venueId,
      params: { venue: gathering.venueName, count: members.length, v: variant() },
    });
  }
  return present;
}

/**
 * The banner on the crew card and the new party screen. Check-ins are seen by the whole crew;
 * people found by position only count for someone who is there with them.
 */
export async function gatheringFor(
  ctx: Context,
  crewId: string,
  userId: string,
): Promise<{ venueId: string; venueName: string; count: number; checkedIn: string[] } | null> {
  const now = ctx.now();
  if (await crewHasParty(ctx, crewId, now)) return null;
  const all = await crewGatherings(ctx, crewId, now);
  const mine = all.find((g) => g.checkedIn.includes(userId) || g.detected.includes(userId));
  if (mine && sizeOf(mine) >= GATHERING) {
    return { venueId: mine.venueId, venueName: mine.venueName, count: sizeOf(mine), checkedIn: mine.checkedIn.filter((id) => id !== userId) };
  }
  const seen = all.filter((g) => g.checkedIn.length >= GATHERING).sort((a, b) => b.checkedIn.length - a.checkedIn.length)[0];
  return seen ? { venueId: seen.venueId, venueName: seen.venueName, count: seen.checkedIn.length, checkedIn: seen.checkedIn.filter((id) => id !== userId) } : null;
}

/**
 * A party that starts now or within half an hour: the rest of the crew hears that a crew mate
 * launched it, at most once per person and crew every two hours. Each person's settings, mutes
 * and blocks apply (notifyUsers); the push never says where.
 */
export async function notifyPartyStarted(
  ctx: Context,
  party: { id: string; crew_id: string; name: string; starts_at: number; ends_at: number; created_by: string },
): Promise<void> {
  const now = ctx.now();
  // A party logged after the fact (already over) is not news.
  if (party.starts_at > now + LAUNCH_WINDOW_MS || party.ends_at <= now) return;
  const members = await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1 and user_id <> $2", [party.crew_id, party.created_by]);
  const recipients: string[] = [];
  for (const { user_id: userId } of members) {
    if (await claimMark(ctx, userId, `partyStarted:${party.crew_id}`, LAUNCH_GAP_MS)) recipients.push(userId);
  }
  if (!recipients.length) return;
  const name = (await ctx.db.query<{ display_name: string }>("select display_name from users where id = $1", [party.created_by]))[0]?.display_name ?? "";
  await notifyUsers(ctx, recipients, {
    kind: "partyStarted",
    actorId: party.created_by,
    partyId: party.id,
    crewId: party.crew_id,
    refId: party.id,
    params: { name, party: party.name, v: variant() },
  });
}

/**
 * The sweeper, every minute: someone checked in at a venue that closes within half an hour hears
 * it once for that check-in. Only venues with hours entered by the crew or the owner.
 */
export async function sweepClosingSoon(ctx: Context): Promise<void> {
  const now = ctx.now();
  const open = await ctx.db.query<{ id: string; user_id: string; venue_id: string; crew_id: string; name: string; kind: string; lat: number; lng: number }>(
    `select c.id, c.user_id, c.venue_id, v.crew_id, v.name, v.kind, v.lat, v.lng from check_ins c join venues v on v.id = c.venue_id
     where c.ended_at is null and c.verdict in ('accepted', 'unverified') and c.at > $1 and v.kind <> 'home'`,
    [now - CHECK_IN_FRESH_MS],
  );
  const closing = new Map<string, number | null>();
  for (const c of open) {
    if (!closing.has(c.venue_id)) {
      const timeZone = await crewTimeZone(ctx.db, c.crew_id);
      const facts = await venueFacts(ctx, await samePlaceIds(ctx, { id: c.venue_id, kind: c.kind, lat: c.lat, lng: c.lng }), timeZone, c.venue_id);
      closing.set(c.venue_id, facts.schedule?.open.length ? closesAt(facts.schedule.open, now, timeZone) : null);
    }
    const closes = closing.get(c.venue_id);
    if (closes === null || closes === undefined || closes - now > CLOSING_AHEAD_MS) continue;
    if (!(await claimMark(ctx, c.user_id, `closing:${c.id}`))) continue;
    await notifyUsers(ctx, [c.user_id], {
      kind: "closingSoon",
      crewId: c.crew_id,
      refId: c.venue_id,
      params: { venue: c.name, minutes: Math.max(1, Math.round((closes - now) / MINUTE_MS)), v: variant() },
    });
  }
}
