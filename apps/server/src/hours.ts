import { z } from "zod";
import { distanceMeters } from "./anticheat";
import type { Context } from "./context";
import { offsetMinutes } from "./time";

/**
 * N-08, COM-01: a weekly schedule. Days are 0 (Monday) to 6 (Sunday), times are minutes after
 * midnight. A range whose end is not after its start runs past midnight into the next day.
 */
export interface HourRange {
  days: number[];
  from: number;
  to: number;
}
export interface WeekSchedule {
  open: HourRange[];
  happy: HourRange[];
}

const range = z.object({
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  from: z.number().int().min(0).max(1439),
  to: z.number().int().min(0).max(1439),
});
export const scheduleSchema = z.object({ open: z.array(range).max(7), happy: z.array(range).max(7) });

export function parseSchedule(text: string | null | undefined): WeekSchedule | null {
  if (!text) return null;
  try {
    const parsed = scheduleSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Local weekday (0 Monday) and minute of the day in that time zone. */
function localMoment(at: number, timeZone: string): { day: number; minute: number } {
  const local = new Date(at + offsetMinutes(at, timeZone) * 60_000);
  return { day: (local.getUTCDay() + 6) % 7, minute: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

export function inRanges(ranges: HourRange[], at: number, timeZone: string): boolean {
  const { day, minute } = localMoment(at, timeZone);
  const yesterday = (day + 6) % 7;
  return ranges.some((r) =>
    r.to > r.from
      ? r.days.includes(day) && minute >= r.from && minute < r.to
      : (r.days.includes(day) && minute >= r.from) || (r.days.includes(yesterday) && minute < r.to),
  );
}

export type FactsSource = "owner" | "crew";

export interface VenueFacts {
  /** Who the hours come from: the claimed owner wins over the crews (COM-11). */
  source: FactsSource | null;
  claimed: boolean;
  /** The owner's free text, if any. */
  hoursText: string;
  happyText: string;
  schedule: WeekSchedule | null;
  /** Null when nobody entered opening hours. */
  openNow: boolean | null;
  happyNow: boolean;
  updatedAt: number | null;
}

/**
 * The hours of a place. `placeIds` are every crew's venue at the same spot; `crewVenueId` narrows
 * crew-entered hours to one crew's own venue (the crew page), else the latest entry of any crew
 * counts (the public page).
 */
export async function venueFacts(ctx: Context, placeIds: string[], timeZone: string, crewVenueId?: string): Promise<VenueFacts> {
  const ids = placeIds.length ? placeIds : crewVenueId ? [crewVenueId] : [];
  const owner = (
    await ctx.db.query<{ user_id: string }>("select user_id from place_claims where venue_id = any($1::uuid[]) and status = 'approved' limit 1", [ids])
  )[0];
  const now = ctx.now();
  if (owner) {
    const info = (
      await ctx.db.query<{ hours: string; happy_hours: string; schedule: string | null; updated_at: number }>(
        "select hours, happy_hours, schedule, updated_at from place_info where venue_id = any($1::uuid[]) order by updated_at desc limit 1",
        [ids],
      )
    )[0];
    const schedule = parseSchedule(info?.schedule);
    if (info && (info.hours || info.happy_hours || schedule)) {
      return {
        source: "owner",
        claimed: true,
        hoursText: info.hours,
        happyText: info.happy_hours,
        schedule,
        openNow: schedule?.open.length ? inRanges(schedule.open, now, timeZone) : null,
        happyNow: schedule ? inRanges(schedule.happy, now, timeZone) : false,
        updatedAt: Number(info.updated_at),
      };
    }
  }
  const crew = (
    await ctx.db.query<{ schedule: string; updated_at: number }>(
      crewVenueId
        ? "select schedule, updated_at from venue_hours where venue_id = $1 limit 1"
        : "select schedule, updated_at from venue_hours where venue_id = any($1::uuid[]) order by updated_at desc limit 1",
      [crewVenueId ?? ids],
    )
  )[0];
  const schedule = parseSchedule(crew?.schedule);
  return {
    source: schedule ? "crew" : null,
    claimed: Boolean(owner),
    hoursText: "",
    happyText: "",
    schedule,
    openNow: schedule?.open.length ? inRanges(schedule.open, now, timeZone) : null,
    happyNow: schedule ? inRanges(schedule.happy, now, timeZone) : false,
    updatedAt: crew ? Number(crew.updated_at) : null,
  };
}

/** Venues of different crews closer than this are one place (TER-07). */
const SAME_PLACE_M = 40;

/** Every crew's venue at the same spot as this one, itself included; homes are never shared. */
export async function samePlaceIds(ctx: Context, venue: { id: string; kind: string; lat: number; lng: number }): Promise<string[]> {
  if (venue.kind === "home") return [venue.id];
  const box = SAME_PLACE_M / 111_000;
  const near = await ctx.db.query<{ id: string; lat: number; lng: number }>(
    "select id, lat, lng from venues where kind <> 'home' and lat between $1 and $2 and lng between $3 and $4",
    [venue.lat - box, venue.lat + box, venue.lng - box * 2, venue.lng + box * 2],
  );
  const ids = near.filter((v) => distanceMeters(v, venue) <= SAME_PLACE_M).map((v) => v.id);
  return ids.includes(venue.id) ? ids : [venue.id, ...ids];
}

/** N-11 budget: the median pint and the average of each drink's median, over the last 180 days. */
export async function placePrices(ctx: Context, ids: string[], currency?: string): Promise<{ pint: number | null; average: number | null; currency: string | null }> {
  const rows = await ctx.db.query<{ kind: string; amount: number; currency: string }>(
    "select kind, amount, currency from venue_prices where venue_id = any($1::uuid[]) and at > $2",
    [ids, ctx.now() - 180 * 86_400_000],
  );
  // One currency only: the asked one, else the most reported.
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.currency, (counts.get(r.currency) ?? 0) + 1);
  const chosen = currency && counts.has(currency) ? currency : ([...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null);
  if (!chosen) return { pint: null, average: null, currency: null };
  const byKind = new Map<string, number[]>();
  for (const r of rows.filter((r) => r.currency === chosen)) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r.amount]);
  const medians = [...byKind.values()].map((v) => median(v)!);
  return {
    pint: median(byKind.get("pint") ?? []),
    average: medians.length ? Math.round(medians.reduce((s, v) => s + v, 0) / medians.length) : null,
    currency: chosen,
  };
}

/** N-09: a price change is flagged for this long. */
export const RECENT_CHANGE_MS = 30 * 86_400_000;

/** The last time a noted price differed from the one before it, oldest first in `points`. */
export function priceChange(points: { amount: number; at: number }[], now: number): { from: number; to: number; at: number; recent: boolean } | null {
  for (let i = points.length - 1; i > 0; i--) {
    const before = points[i - 1]!;
    const after = points[i]!;
    if (after.amount !== before.amount) {
      const at = Number(after.at);
      return { from: before.amount, to: after.amount, at, recent: now - at < RECENT_CHANGE_MS };
    }
  }
  return null;
}

/**
 * N-12: average spend per visit. Each drink of a stay is priced at the crew's median for its kind
 * here, else at the average of the known drinks; prices in one currency only (the most noted).
 */
export function spendPerVisit(stays: string[][], prices: { kind: string; amount: number; currency: string }[]): { amount: number; currency: string } | null {
  if (!stays.length || !prices.length) return null;
  const counts = new Map<string, number>();
  for (const p of prices) counts.set(p.currency, (counts.get(p.currency) ?? 0) + 1);
  const currency = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  const byKind = new Map<string, number[]>();
  for (const p of prices.filter((p) => p.currency === currency)) byKind.set(p.kind, [...(byKind.get(p.kind) ?? []), p.amount]);
  const medians = new Map([...byKind.entries()].map(([kind, amounts]) => [kind, median(amounts)!]));
  const fallback = Math.round([...medians.values()].reduce((s, v) => s + v, 0) / medians.size);
  const total = stays.reduce((sum, kinds) => sum + kinds.reduce((s, kind) => s + (medians.get(kind) ?? fallback), 0), 0);
  return { amount: Math.round(total / stays.length), currency };
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}
