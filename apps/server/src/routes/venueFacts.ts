import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { distanceMeters } from "../anticheat";
import { assertCrewMember, HttpError, requireUser, type Context } from "../context";
import { placePrices, samePlaceIds, scheduleSchema, venueFacts } from "../hours";
import { crewTimeZone } from "../territory";
import { nightOf } from "../time";
import { picks, rank, type WhereToCandidate } from "../whereTo";
import { placeOwner } from "./claims";
import { signedPhotoUrl } from "./photos";

const uuid = z.string().uuid();

/**
 * N-08: one HQ per crew (a unique index backs it). Any member sets the first one; moving it
 * changes which venues count for territories (TER-11), so only an admin can once one exists.
 */
export async function canSetHq(ctx: Context, crewId: string, role: string): Promise<boolean> {
  if (role === "admin") return true;
  return (await ctx.db.query("select 1 from venues where crew_id = $1 and is_hq", [crewId])).length === 0;
}

export async function setHq(ctx: Context, crewId: string, venueId: string, on: boolean): Promise<void> {
  await ctx.db.transaction(async (tx) => {
    if (on) {
      await tx.query("update venues set is_hq = false where crew_id = $1 and is_hq and id <> $2", [crewId, venueId]);
      await tx.query("update venues set is_hq = true where id = $1 and crew_id = $2", [venueId, crewId]);
    } else {
      await tx.query("update venues set is_hq = false where id = $1 and crew_id = $2", [venueId, crewId]);
    }
  });
}

async function memberVenue(ctx: Context, venueId: string, userId: string) {
  const venue = (
    await ctx.db.query<{ id: string; crew_id: string; name: string; kind: string; lat: number; lng: number; is_hq: boolean }>(
      "select id, crew_id, name, kind, lat, lng, is_hq from venues where id = $1",
      [uuid.parse(venueId)],
    )
  )[0];
  if (!venue) throw new HttpError(404, "not_found");
  const { role } = await assertCrewMember(ctx, venue.crew_id, userId);
  return { venue, role };
}

/** House pint strength bounds, as a fraction. The table's check constraint holds the same range. */
export const HOUSE_PINT_ABV = { min: 0.02, max: 0.14 } as const;

export interface HousePint {
  abv: number;
  updatedAt: number;
  updatedBy: string | null;
}

/** The house pint of each venue that has one, keyed by venue id. */
export async function housePints(ctx: Context, venueIds: string[]): Promise<Map<string, HousePint>> {
  if (!venueIds.length) return new Map();
  const rows = await ctx.db.query<{ venue_id: string; abv: number; updated_by: string | null; updated_at: number }>(
    "select venue_id, abv, updated_by, updated_at from venue_house_pints where venue_id = any($1::uuid[])",
    [venueIds],
  );
  // `numeric` comes back as a string from the driver.
  return new Map(rows.map((r) => [r.venue_id, { abv: Math.round(Number(r.abv) * 1000) / 1000, updatedAt: Number(r.updated_at), updatedBy: r.updated_by }]));
}

async function notifyCrew(ctx: Context, crewId: string): Promise<void> {
  const members = await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1", [crewId]);
  ctx.live.notify(members.map((m) => m.user_id), { type: "crew.changed", crewId });
}

export function venueFactRoutes(app: FastifyInstance, ctx: Context): void {
  /** N-08: the address and the HQ of a crew venue, after it was added. */
  app.patch<{ Params: { id: string } }>("/v1/venues/:id", async (request) => {
    const user = requireUser(request);
    const { venue, role } = await memberVenue(ctx, request.params.id, user.id);
    const input = z.object({ address: z.string().trim().max(120).optional(), isHq: z.boolean().optional() }).parse(request.body);
    if (input.isHq !== undefined && input.isHq !== venue.is_hq) {
      if (input.isHq && venue.kind === "home") throw new HttpError(400, "invalid");
      // Removing the HQ moves it to nowhere: admins only, like moving it.
      const allowed = input.isHq ? await canSetHq(ctx, venue.crew_id, role) : role === "admin";
      if (!allowed) throw new HttpError(403, "hq_admin_only");
    }
    if (input.address !== undefined) await ctx.db.query("update venues set address = $2 where id = $1", [venue.id, input.address]);
    if (input.isHq !== undefined && input.isHq !== venue.is_hq) await setHq(ctx, venue.crew_id, venue.id, input.isHq);
    await notifyCrew(ctx, venue.crew_id);
    return { ok: true };
  });

  /**
   * N-08, COM-01: opening hours and happy hours from the crew, only while no owner has claimed
   * the place. Once claimed, the owner's hours win (COM-11).
   */
  app.put<{ Params: { id: string } }>("/v1/venues/:id/hours", async (request) => {
    const user = requireUser(request);
    const { venue } = await memberVenue(ctx, request.params.id, user.id);
    if (venue.kind === "home") throw new HttpError(400, "invalid");
    if (await placeOwner(ctx, await samePlaceIds(ctx, venue))) throw new HttpError(409, "claimed");
    const schedule = scheduleSchema.parse(request.body);
    if (!schedule.open.length && !schedule.happy.length) {
      await ctx.db.query("delete from venue_hours where venue_id = $1", [venue.id]);
    } else {
      await ctx.db.query(
        `insert into venue_hours (venue_id, schedule, updated_by, updated_at) values ($1, $2, $3, $4)
         on conflict (venue_id) do update set schedule = excluded.schedule, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
        [venue.id, JSON.stringify(schedule), user.id, ctx.now()],
      );
    }
    await notifyCrew(ctx, venue.crew_id);
    return { ok: true };
  });

  /**
   * House pint: "the pint here is 6 %", set by anyone of the crew while checked in at this bar, so
   * nobody sets a strength for a place they are not drinking at. Null clears it. Shared with the
   * whole crew, who then log the right strength there.
   */
  app.put<{ Params: { id: string } }>("/v1/venues/:id/house-pint", async (request) => {
    const user = requireUser(request);
    const { venue } = await memberVenue(ctx, request.params.id, user.id);
    if (venue.kind === "home") throw new HttpError(400, "invalid");
    const input = z.object({ abv: z.number().min(HOUSE_PINT_ABV.min).max(HOUSE_PINT_ABV.max).nullable() }).parse(request.body);
    const now = ctx.now();
    const here = await ctx.db.query(
      `select 1 from check_ins where venue_id = $1 and user_id = $2 and verdict in ('accepted', 'unverified')
         and ended_at is null and at > $3 limit 1`,
      [venue.id, user.id, now - 12 * 3_600_000],
    );
    if (!here.length) throw new HttpError(403, "not_checked_in");
    if (input.abv === null) {
      await ctx.db.query("delete from venue_house_pints where venue_id = $1", [venue.id]);
    } else {
      // Tenths of a percent: nobody reads a tap label more precisely than 6.5 %.
      const abv = Math.round(input.abv * 1000) / 1000;
      await ctx.db.query(
        `insert into venue_house_pints (venue_id, abv, updated_by, updated_at) values ($1, $2, $3, $4)
         on conflict (venue_id) do update set abv = excluded.abv, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
        [venue.id, abv, user.id, now],
      );
    }
    await notifyCrew(ctx, venue.crew_id);
    return { housePint: (await housePints(ctx, [venue.id])).get(venue.id) ?? null };
  });

  /**
   * TER-05: album photos from the crew's nights at this venue, taken while someone of that
   * night was checked in here. Only the members who were going to that night see them, like the album.
   */
  app.get<{ Params: { id: string } }>("/v1/venues/:id/photos", async (request) => {
    const user = requireUser(request);
    const { venue } = await memberVenue(ctx, request.params.id, user.id);
    const rows = await ctx.db.query<{ id: string; party_id: string; user_id: string; width: number; height: number; created_at: number }>(
      `select ph.id, ph.party_id, ph.user_id, ph.width, ph.height, ph.created_at from photos ph
       join party_members m on m.party_id = ph.party_id and m.user_id = $2 and m.response = 'going'
       join parties p on p.id = ph.party_id and p.crew_id = $3
       where exists (
         select 1 from check_ins c where c.party_id = ph.party_id and c.venue_id = $1 and c.verdict = 'accepted' and c.private = false
           and ph.created_at between c.at and coalesce(c.ended_at, c.last_proof_at + 3600000)
       )
       order by ph.created_at desc limit 24`,
      [venue.id, user.id, venue.crew_id],
    );
    return {
      photos: rows.map((r) => ({ id: r.id, partyId: r.party_id, userId: r.user_id, width: r.width, height: r.height, at: r.created_at, url: signedPhotoUrl(ctx, r.id) })),
    };
  });

  /**
   * N-11, TER-08, COM-10: "Where to?" for a crew, during a party or not: its venues and its
   * "want to go" list, filtered by open now, happy hour now and budget, ranked with the reasons
   * for the pick, plus a never-visited venue to conquer.
   */
  app.get<{ Params: { id: string }; Querystring: Record<string, string | undefined> }>("/v1/crews/:id/where-to", async (request) => {
    const user = requireUser(request);
    const crewId = request.params.id;
    await assertCrewMember(ctx, crewId, user.id);
    const q = z
      .object({
        lat: z.coerce.number().min(-90).max(90).optional(),
        lng: z.coerce.number().min(-180).max(180).optional(),
        open: z.enum(["1"]).optional(),
        happy: z.enum(["1"]).optional(),
        maxPrice: z.coerce.number().int().positive().max(100_000).optional(),
        currency: z.string().regex(/^[A-Z]{3}$/).optional(),
      })
      .parse(request.query);
    const timeZone = await crewTimeZone(ctx.db, crewId);
    const now = ctx.now();
    const here = q.lat !== undefined && q.lng !== undefined ? { lat: q.lat, lng: q.lng } : null;
    const own = await ctx.db.query<{ id: string; name: string; kind: string; lat: number; lng: number; address: string }>(
      "select id, name, kind, lat, lng, address from venues where crew_id = $1 and kind <> 'home'",
      [crewId],
    );
    const checkIns = await ctx.db.query<{ venue_id: string; user_id: string; at: number; ended_at: number | null }>(
      `select c.venue_id, c.user_id, c.at, c.ended_at from check_ins c join venues v on v.id = c.venue_id and v.crew_id = $1
       where c.verdict = 'accepted' and c.private = false`,
      [crewId],
    );
    const wanted = await ctx.db.query<{ id: string; name: string; kind: string; lat: number; lng: number; address: string }>(
      "select v.id, v.name, v.kind, v.lat, v.lng, v.address from want_to_go w join venues v on v.id = w.venue_id where w.crew_id = $1 and v.kind <> 'home'",
      [crewId],
    );

    type Option = { venueId: string; name: string; kind: string; lat: number; lng: number; address: string; crewVenue: boolean; ids: string[] };
    const options: Option[] = [];
    for (const v of own) options.push({ venueId: v.id, name: v.name, kind: v.kind, lat: v.lat, lng: v.lng, address: v.address, crewVenue: true, ids: await samePlaceIds(ctx, v) });
    // COM-10: a wanted place the crew already has is that venue, marked; else it joins as a new option.
    const wantedIds = new Set<string>();
    for (const w of wanted) {
      const ids = await samePlaceIds(ctx, w);
      const mine = options.find((o) => o.ids.some((id) => ids.includes(id)));
      if (mine) wantedIds.add(mine.venueId);
      else {
        options.push({ venueId: w.id, name: w.name, kind: w.kind, lat: w.lat, lng: w.lng, address: w.address, crewVenue: false, ids });
        wantedIds.add(w.id);
      }
    }

    const candidates: WhereToCandidate[] = [];
    const details = new Map<string, { openNow: boolean | null; happyNow: boolean; pint: number | null; average: number | null; currency: string | null }>();
    for (const o of options) {
      const facts = await venueFacts(ctx, o.ids, timeZone, o.crewVenue ? o.venueId : undefined);
      const prices = await placePrices(ctx, o.ids, q.currency);
      const visits = new Set(checkIns.filter((c) => c.venue_id === o.venueId).map((c) => nightOf(c.at, timeZone))).size;
      const hereNow = new Set(checkIns.filter((c) => c.venue_id === o.venueId && c.ended_at === null && c.at > now - 6 * 3_600_000).map((c) => c.user_id)).size;
      // A budget in one currency says nothing about prices noted in another.
      const comparable = !q.currency || prices.currency === q.currency;
      details.set(o.venueId, { openNow: facts.openNow, happyNow: facts.happyNow, ...prices });
      candidates.push({
        venueId: o.venueId,
        openNow: facts.openNow,
        happyNow: facts.happyNow,
        pint: comparable ? prices.pint : null,
        average: comparable ? prices.average : null,
        distanceM: here ? Math.round(distanceMeters(here, o)) : null,
        wanted: wantedIds.has(o.venueId),
        hereNow,
        visits,
        // TER-08: only the crew's own venues can be conquered; a wanted place has to be added first.
        explored: o.crewVenue ? visits > 0 : true,
      });
    }

    const ranked = rank(candidates, { openNow: q.open === "1", happyNow: q.happy === "1", ...(q.maxPrice ? { maxPrice: q.maxPrice } : {}) });
    const pick = picks(ranked, candidates);
    const candidateOf = new Map(candidates.map((c) => [c.venueId, c]));
    return {
      total: options.length,
      suggestion: pick.suggestion,
      conquest: pick.conquest,
      options: ranked.map((r) => {
        const o = options.find((x) => x.venueId === r.venueId)!;
        const c = candidateOf.get(r.venueId)!;
        const d = details.get(r.venueId)!;
        return {
          venueId: o.venueId,
          name: o.name,
          kind: o.kind,
          lat: o.lat,
          lng: o.lng,
          address: o.address,
          crewVenue: o.crewVenue,
          openNow: d.openNow,
          happyNow: d.happyNow,
          pint: d.pint,
          average: d.average,
          currency: d.currency,
          distanceM: c.distanceM,
          wanted: c.wanted,
          hereNow: c.hereNow,
          explored: c.explored,
          visits: c.visits,
          reasons: r.reasons,
        };
      }),
    };
  });
}
