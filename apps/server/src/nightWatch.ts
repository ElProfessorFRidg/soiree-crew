import { estimateBac, POISONING_CARD_THRESHOLD, type BodyProfile, type DrinkIntake, type FoodLevel } from "@crew/bac";
import type { Context } from "./context";
import type { Db } from "./db";

// The server keeps an eye on the night: who went quiet (N-29), whose estimate went past 2.0 g/L
// (O-88), who should hear first that someone is unwell (N-36). Alerts travel as live-socket hints;
// every phone then reads the party through the normal endpoints, so access rules stay in one place.

const HOUR_MS = 3_600_000;
/** Drinks this long before a party starts still count in its live BACs. */
export const PRE_PARTY_MS = 12 * HOUR_MS;
/** N-29: default for a new party, in minutes. */
export const QUIET_AFTER_DEFAULT_MIN = 45;
/** O-88: told again only after the estimate came back this far under the threshold. */
const DANGER_RESET_BELOW = POISONING_CARD_THRESHOLD - 0.2;
/** N-36: this many of the nearest members hear first when positions are shared. */
export const UNWELL_NEAREST = 3;
/** N-36: then everyone else, if it still lasts. */
export const UNWELL_WIDEN_MS = 3 * 60_000;

export interface SealedDrink {
  volumeMl: number;
  abv: number;
  withFood: boolean;
  food?: FoodLevel;
  name?: string | null;
}

export function intakeOf(ctx: Context, row: { id: string; sealed: string; consumed_at: number }): DrinkIntake {
  const body = ctx.sealer.open<SealedDrink>(row.sealed);
  return { id: row.id, volumeMl: body.volumeMl, abv: body.abv, consumedAt: row.consumed_at, withFood: body.withFood, ...(body.food ? { food: body.food } : {}) };
}

async function goingIds(db: Db, partyId: string): Promise<string[]> {
  return (await db.query<{ user_id: string }>("select user_id from party_members where party_id = $1 and response = 'going'", [partyId])).map((m) => m.user_id);
}

/** One member's estimate at `at`, from their own drinks; null without a body profile. */
export async function memberBac(ctx: Context, userId: string, partyStartsAt: number, at: number): Promise<number | null> {
  const profile = (await ctx.db.query<{ sealed: string }>("select sealed from body_profiles where user_id = $1", [userId]))[0];
  if (!profile) return null;
  const rows = await ctx.db.query<{ id: string; sealed: string; consumed_at: number }>(
    "select id, sealed, consumed_at from drinks where user_id = $1 and deleted_at is null and consumed_at between $2 and $3",
    [userId, partyStartsAt - PRE_PARTY_MS, at],
  );
  return estimateBac(rows.map((r) => intakeOf(ctx, r)), ctx.sealer.open<BodyProfile>(profile.sealed), at).bac;
}

interface LivePartyRow {
  id: string;
  starts_at: number;
  ends_at: number;
  closed_at: number | null;
  quiet_after_minutes: number;
}

/** O-88: past 2.0 g/L the rest of the party is told once, with the way to the SOS on their card. */
export async function checkDanger(ctx: Context, party: Pick<LivePartyRow, "id" | "starts_at">, userId: string): Promise<boolean> {
  const now = ctx.now();
  const bac = await memberBac(ctx, userId, party.starts_at, now);
  if (bac === null) return false;
  const row = (await ctx.db.query<{ danger_alerted_at: number | null }>("select danger_alerted_at from party_members where party_id = $1 and user_id = $2", [party.id, userId]))[0];
  if (!row) return false;
  if (bac < DANGER_RESET_BELOW && row.danger_alerted_at !== null) {
    await ctx.db.query("update party_members set danger_alerted_at = null where party_id = $1 and user_id = $2", [party.id, userId]);
    return false;
  }
  if (bac < POISONING_CARD_THRESHOLD || row.danger_alerted_at !== null) return false;
  await ctx.db.query("update party_members set danger_alerted_at = $3 where party_id = $1 and user_id = $2", [party.id, userId, now]);
  const others = (await goingIds(ctx.db, party.id)).filter((id) => id !== userId);
  // push: party.danger
  ctx.live.notify(others, { type: "party.danger", partyId: party.id, userId });
  return true;
}

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/**
 * N-36: when the unwell member and others share their position, the nearest hear at once and the
 * rest a few minutes later if it still lasts (see sweepParty). Without positions, everyone at once.
 */
export async function tellUnwell(ctx: Context, partyId: string, userId: string): Promise<string[]> {
  const others = (await goingIds(ctx.db, partyId)).filter((id) => id !== userId);
  const positions = await ctx.db.query<{ user_id: string; sealed: string }>("select user_id, sealed from party_locations where party_id = $1", [partyId]);
  const at = new Map(positions.map((p) => [p.user_id, ctx.sealer.open<{ lat: number; lng: number }>(p.sealed)]));
  const mine = at.get(userId);
  const located = mine ? others.filter((id) => at.has(id)) : [];
  let first = others;
  if (mine && located.length > 0) {
    first = located.sort((a, b) => distanceM(mine, at.get(a)!) - distanceM(mine, at.get(b)!)).slice(0, UNWELL_NEAREST);
  }
  const everyone = first.length === others.length;
  await ctx.db.query("update party_members set unwell_widened_at = $3 where party_id = $1 and user_id = $2", [partyId, userId, everyone ? ctx.now() : null]);
  // push: party.unwell
  ctx.live.notify(first, { type: "party.unwell", partyId, userId, near: !everyone });
  return first;
}

/**
 * One pass over a live party: members gone quiet longer than the party's threshold (N-29), unwell
 * alerts to widen (N-36), estimates past 2.0 g/L (O-88). Run by the server every minute and when
 * someone opens the live view, so it works with or without a timer.
 */
export async function sweepParty(ctx: Context, party: LivePartyRow): Promise<void> {
  const now = ctx.now();
  if (party.closed_at !== null || party.starts_at > now || party.ends_at < now) return;
  const members = await ctx.db.query<{
    user_id: string;
    home_safe_at: number | null;
    last_activity_at: number | null;
    quiet_alerted_at: number | null;
    battery_low: boolean;
    unwell_at: number | null;
    unwell_widened_at: number | null;
  }>(
    `select user_id, home_safe_at, last_activity_at, quiet_alerted_at, battery_low, unwell_at, unwell_widened_at
     from party_members where party_id = $1 and response = 'going'`,
    [party.id],
  );
  const ids = members.map((m) => m.user_id);
  const quietAfter = party.quiet_after_minutes * 60_000;
  for (const m of members) {
    const others = ids.filter((id) => id !== m.user_id);
    if (
      m.home_safe_at === null &&
      m.last_activity_at !== null &&
      now - m.last_activity_at > quietAfter &&
      (m.quiet_alerted_at === null || m.quiet_alerted_at < m.last_activity_at)
    ) {
      await ctx.db.query("update party_members set quiet_alerted_at = $3 where party_id = $1 and user_id = $2", [party.id, m.user_id, now]);
      // QOL-10: a dead phone is not a missing person; the hint says the battery was low.
      // push: party.quiet
      ctx.live.notify(others, { type: "party.quiet", partyId: party.id, userId: m.user_id, batteryLow: m.battery_low });
    }
    if (m.unwell_at !== null && m.home_safe_at === null && m.unwell_widened_at === null && now - m.unwell_at >= UNWELL_WIDEN_MS) {
      await ctx.db.query("update party_members set unwell_widened_at = $3 where party_id = $1 and user_id = $2", [party.id, m.user_id, now]);
      // push: party.unwell
      ctx.live.notify(others, { type: "party.unwell", partyId: party.id, userId: m.user_id, near: false });
    }
    await checkDanger(ctx, party, m.user_id);
  }
}

/** Every party live right now. */
export async function sweepLiveParties(ctx: Context): Promise<void> {
  const now = ctx.now();
  const parties = await ctx.db.query<LivePartyRow>(
    "select id, starts_at, ends_at, closed_at, quiet_after_minutes from parties where closed_at is null and starts_at <= $1 and ends_at >= $1",
    [now],
  );
  for (const party of parties) await sweepParty(ctx, party);
}
