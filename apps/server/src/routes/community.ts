import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { distanceMeters } from "../anticheat";
import { assertCrewMember, HttpError, requireUser, type Context } from "../context";
import { RateLimiter } from "../ratelimit";
import { currentSeason } from "../territory";
import { nightOf, offsetMinutes } from "../time";
import { newId } from "../crypto";
import { seasonBounds } from "@crew/territory";
import { placeOwner } from "./claims";

const uuid = z.string().uuid();
const DAY_MS = 86_400_000;
/** Venues of different crews closer than this are one place (TER-07). */
const SAME_PLACE_M = 40;
/** Places the discovery searches around a point. */
const NEARBY_M = 3000;
/** Without a crew time zone, the place's patterns are read in Paris time. */
const PLACE_TZ = "Europe/Paris";

export const VIBE_TAGS = ["dance", "terrace", "student", "live", "quiet", "sport", "karaoke", "rock", "electro", "hiphop", "cheap"] as const;
const CRITERIA = ["prices", "vibe", "music", "service", "queue", "safe"] as const;

interface VenueRow {
  id: string;
  crew_id: string;
  name: string;
  kind: string;
  lat: number;
  lng: number;
  address: string | null;
}

/** Every crew's venue at the same spot as this one, homes never included. */
export async function placeOf(ctx: Context, venueId: string): Promise<{ venue: VenueRow; ids: string[] }> {
  const venue = (await ctx.db.query<VenueRow>("select id, crew_id, name, kind, lat, lng, address from venues where id = $1", [uuid.parse(venueId)]))[0];
  if (!venue || venue.kind === "home") throw new HttpError(404, "not_found");
  const box = SAME_PLACE_M / 111_000;
  const near = await ctx.db.query<{ id: string; lat: number; lng: number }>(
    "select id, lat, lng from venues where kind <> 'home' and lat between $1 and $2 and lng between $3 and $4",
    [venue.lat - box, venue.lat + box, venue.lng - box * 2, venue.lng + box * 2],
  );
  return { venue, ids: near.filter((v) => distanceMeters(v, venue) <= SAME_PLACE_M).map((v) => v.id) };
}

async function hasVerifiedVisit(ctx: Context, ids: string[], userId: string): Promise<number | null> {
  const row = (
    await ctx.db.query<{ at: number }>(
      "select max(at)::bigint as at from check_ins where venue_id = any($1::uuid[]) and user_id = $2 and verdict = 'accepted'",
      [ids, userId],
    )
  )[0];
  return row?.at ? Number(row.at) : null;
}

async function friendIds(ctx: Context, userId: string): Promise<Set<string>> {
  const rows = await ctx.db.query<{ other: string }>(
    "select case when user_a = $1 then user_b else user_a end as other from friendships where (user_a = $1 or user_b = $1) and status = 'accepted'",
    [userId],
  );
  return new Set(rows.map((r) => r.other));
}

export function communityRoutes(app: FastifyInstance, ctx: Context): void {
  const writes = new RateLimiter(60, 60 * 60_000, ctx.now);

  /**
   * COM-01: the public page of a place, for any signed-in user: crowd prices, vibe tags, busy days
   * and hours, users this month, ratings, reviews as their authors allow (PROF-04), the door
   * (COM-07), upcoming events (COM-09) and the season's regulars who opted in (COM-03).
   */
  app.get<{ Params: { id: string } }>("/v1/places/:id", async (request) => {
    const user = requireUser(request);
    const { venue, ids } = await placeOf(ctx, request.params.id);
    const now = ctx.now();
    const friends = await friendIds(ctx, user.id);

    const prices = await ctx.db.query<{ kind: string; amount: number; currency: string }>(
      "select kind, amount, currency from venue_prices where venue_id = any($1::uuid[]) and at > $2",
      [ids, now - 180 * DAY_MS],
    );
    const priceGroups = new Map<string, number[]>();
    for (const p of prices) priceGroups.set(`${p.kind}|${p.currency}`, [...(priceGroups.get(`${p.kind}|${p.currency}`) ?? []), p.amount]);
    const tags = await ctx.db.query<{ tag: string; n: number }>(
      "select tag, count(distinct user_id)::int as n from place_tags where venue_id = any($1::uuid[]) group by tag order by n desc",
      [ids],
    );
    const checkIns = await ctx.db.query<{ user_id: string; at: number }>(
      "select user_id, at from check_ins where venue_id = any($1::uuid[]) and verdict = 'accepted' and private = false and at > $2",
      [ids, now - 90 * DAY_MS],
    );
    const weekdays = [0, 0, 0, 0, 0, 0, 0];
    const hours = new Array<number>(24).fill(0);
    for (const c of checkIns) {
      weekdays[(new Date(`${nightOf(c.at, PLACE_TZ)}T12:00:00Z`).getUTCDay() + 6) % 7]! += 1;
      hours[Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: PLACE_TZ }).format(new Date(c.at)))]! += 1;
    }
    const usersThisMonth = new Set(checkIns.filter((c) => c.at > now - 30 * DAY_MS).map((c) => c.user_id)).size;

    const reviews = await ctx.db.query<{ id: string; user_id: string; display_name: string; ratings: string; text: string; audience: string; visited_at: number; useful: number; mine: number }>(
      `select r.id, r.user_id, u.display_name, r.ratings, r.text, r.audience, r.visited_at,
              (select count(*)::int from review_votes v where v.review_id = r.id) as useful,
              (select count(*)::int from review_votes v where v.review_id = r.id and v.user_id = $2) as mine
       from place_reviews r join users u on u.id = r.user_id where r.venue_id = any($1::uuid[]) order by r.updated_at desc`,
      [ids, user.id],
    );
    // Public and anonymous reviews count in the rating; friends-only and private ones never do.
    const rated = reviews.filter((r) => r.audience === "public" || r.audience === "anonymous");
    const ratings = Object.fromEntries(
      CRITERIA.map((c) => {
        const values = rated.map((r) => (JSON.parse(r.ratings) as Record<string, number>)[c]).filter((v): v is number => typeof v === "number");
        return [c, values.length ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10 : null];
      }),
    );
    const visible = reviews.filter(
      (r) => r.user_id === user.id || r.audience === "public" || r.audience === "anonymous" || (r.audience === "friends" && friends.has(r.user_id)),
    );

    const door = await ctx.db.query<{ id_check: string; age_policy: string | null; n: number }>(
      "select id_check, age_policy, count(*)::int as n from door_reports where venue_id = any($1::uuid[]) and at > $2 group by id_check, age_policy",
      [ids, now - 365 * DAY_MS],
    );
    const doorCount = (key: string) => door.filter((d) => d.id_check === key).reduce((s, d) => s + d.n, 0);
    const reports = door.reduce((s, d) => s + d.n, 0);

    const events = await ctx.db.query<{ id: string; title: string; kind: string; starts_at: number; going: number; mine: number; official: boolean }>(
      `select e.id, e.title, e.kind, e.starts_at, e.official, (select count(*)::int from event_rsvps r where r.event_id = e.id) as going,
              (select count(*)::int from event_rsvps r where r.event_id = e.id and r.user_id = $2) as mine
       from place_events e where e.venue_id = any($1::uuid[]) and e.starts_at > $3 order by e.starts_at limit 10`,
      [ids, user.id, now - 6 * 3_600_000],
    );
    const eventFriends = events.length
      ? await ctx.db.query<{ event_id: string; user_id: string }>("select event_id, user_id from event_rsvps where event_id = any($1::uuid[])", [events.map((e) => e.id)])
      : [];

    // COM-03: regulars by distinct nights there this season, among people who opted in.
    const season = currentSeason(now, PLACE_TZ);
    const { start } = seasonBounds(season, offsetMinutes(now, PLACE_TZ));
    const visits = await ctx.db.query<{ user_id: string; display_name: string; at: number; open: boolean | null }>(
      `select c.user_id, u.display_name, c.at, p.open_to_meet as open from check_ins c join users u on u.id = c.user_id
       join profiles p on p.user_id = c.user_id and p.regular_opt_in = true
       where c.venue_id = any($1::uuid[]) and c.verdict = 'accepted' and c.private = false and c.at >= $2`,
      [ids, start],
    );
    const nightsBy = new Map<string, { name: string; nights: Set<string>; open: boolean }>();
    for (const v of visits) {
      const entry = nightsBy.get(v.user_id) ?? { name: v.display_name, nights: new Set<string>(), open: Boolean(v.open) };
      entry.nights.add(nightOf(v.at, PLACE_TZ));
      nightsBy.set(v.user_id, entry);
    }
    const regulars = [...nightsBy.entries()]
      .map(([userId, e]) => ({ userId, name: e.name, nights: e.nights.size, openToMeet: e.open, friend: friends.has(userId) }))
      .sort((a, b) => b.nights - a.nights || a.name.localeCompare(b.name))
      .slice(0, 5);

    const lastVisit = await hasVerifiedVisit(ctx, ids, user.id);
    // COM-11: a claimed page says so; the owner's hours and replies come with it.
    const owner = await placeOwner(ctx, ids);
    const info = (await ctx.db.query<{ hours: string; happy_hours: string }>("select hours, happy_hours from place_info where venue_id = any($1::uuid[]) order by updated_at desc limit 1", [ids]))[0];
    const replies = new Map(
      (await ctx.db.query<{ review_id: string; text: string; at: number }>("select review_id, text, at from review_replies where review_id = any($1::uuid[])", [reviews.map((r) => r.id)])).map((r) => [
        r.review_id,
        { text: r.text, at: r.at },
      ]),
    );
    return {
      place: { venueId: venue.id, name: venue.name, address: venue.address, lat: venue.lat, lng: venue.lng },
      prices: [...priceGroups.entries()].map(([key, amounts]) => {
        const [kind, currency] = key.split("|") as [string, string];
        const sorted = [...amounts].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return { kind, currency, amount: sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2), reports: amounts.length };
      }),
      tags: tags.map((t) => ({ tag: t.tag, votes: t.n })),
      myTags: (await ctx.db.query<{ tag: string }>("select tag from place_tags where venue_id = $1 and user_id = $2", [venue.id, user.id])).map((t) => t.tag),
      weekdays,
      hours,
      usersThisMonth,
      ratings,
      ratingCount: rated.length,
      reviews: visible.map((r) => ({
        id: r.id,
        author: r.audience === "anonymous" && r.user_id !== user.id ? null : { userId: r.user_id, name: r.display_name },
        audience: r.audience,
        ratings: JSON.parse(r.ratings) as Record<string, number>,
        text: r.text,
        reply: replies.get(r.id) ?? null,
        visitedAt: r.visited_at,
        useful: r.useful,
        markedUseful: r.mine > 0,
        mine: r.user_id === user.id,
      })),
      canReview: lastVisit !== null,
      claimed: owner !== null,
      isOwner: owner === user.id,
      info: info && (info.hours || info.happy_hours) ? { hours: info.hours, happyHours: info.happy_hours } : null,
      door: { always: doorCount("always"), sometimes: doorCount("sometimes"), never: doorCount("never"), adultsOnly: door.filter((d) => d.age_policy === "adults").reduce((s, d) => s + d.n, 0), reports },
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        kind: e.kind,
        startsAt: e.starts_at,
        official: e.official,
        going: e.going,
        friendsGoing: eventFriends.filter((f) => f.event_id === e.id && friends.has(f.user_id)).length,
        mine: e.mine > 0,
      })),
      regulars: regulars.map((r, i) => ({ ...r, legend: i === 0 })),
    };
  });

  /** COM-02, PROF-04: one review per person and place, only after a verified check-in there. */
  app.put<{ Params: { id: string } }>("/v1/places/:id/review", async (request) => {
    const user = requireUser(request);
    writes.check(user.id);
    const { venue, ids } = await placeOf(ctx, request.params.id);
    const visited = await hasVerifiedVisit(ctx, ids, user.id);
    if (visited === null) throw new HttpError(403, "no_visit");
    const rating = z.number().int().min(1).max(5);
    const input = z
      .object({
        ratings: z.object({ prices: rating, vibe: rating, music: rating, service: rating, queue: rating, safe: rating }).partial(),
        text: z.string().trim().max(280).default(""),
        audience: z.enum(["public", "anonymous", "friends", "me"]),
      })
      .parse(request.body);
    const now = ctx.now();
    const existing = (await ctx.db.query<{ id: string }>("select id from place_reviews where venue_id = any($1::uuid[]) and user_id = $2", [ids, user.id]))[0];
    if (existing) {
      await ctx.db.query("update place_reviews set ratings = $2, text = $3, audience = $4, visited_at = $5, updated_at = $6 where id = $1", [
        existing.id,
        JSON.stringify(input.ratings),
        input.text,
        input.audience,
        visited,
        now,
      ]);
    } else {
      await ctx.db.query(
        "insert into place_reviews (id, venue_id, user_id, ratings, text, audience, visited_at, created_at, updated_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $8)",
        [newId(), venue.id, user.id, JSON.stringify(input.ratings), input.text, input.audience, visited, now],
      );
    }
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/v1/places/:id/review", async (request, reply) => {
    const user = requireUser(request);
    const { ids } = await placeOf(ctx, request.params.id);
    await ctx.db.query("delete from place_reviews where venue_id = any($1::uuid[]) and user_id = $2", [ids, user.id]);
    return reply.status(204).send();
  });

  app.post<{ Params: { id: string } }>("/v1/reviews/:id/useful", async (request) => {
    const user = requireUser(request);
    const review = (await ctx.db.query<{ user_id: string }>("select user_id from place_reviews where id = $1", [uuid.parse(request.params.id)]))[0];
    if (!review) throw new HttpError(404, "not_found");
    if (review.user_id === user.id) throw new HttpError(403, "forbidden");
    const { useful } = z.object({ useful: z.boolean() }).parse(request.body);
    if (useful) await ctx.db.query("insert into review_votes (review_id, user_id) values ($1, $2) on conflict do nothing", [request.params.id, user.id]);
    else await ctx.db.query("delete from review_votes where review_id = $1 and user_id = $2", [request.params.id, user.id]);
    return { ok: true };
  });

  /** COM-01: vibe tags anyone who has been there can add. */
  app.put<{ Params: { id: string } }>("/v1/places/:id/tags", async (request) => {
    const user = requireUser(request);
    writes.check(user.id);
    const { venue, ids } = await placeOf(ctx, request.params.id);
    if ((await hasVerifiedVisit(ctx, ids, user.id)) === null) throw new HttpError(403, "no_visit");
    const { tags } = z.object({ tags: z.array(z.enum(VIBE_TAGS)).max(VIBE_TAGS.length) }).parse(request.body);
    await ctx.db.transaction(async (tx) => {
      await tx.query("delete from place_tags where venue_id = $1 and user_id = $2", [venue.id, user.id]);
      for (const tag of new Set(tags)) await tx.query("insert into place_tags (venue_id, user_id, tag) values ($1, $2, $3)", [venue.id, user.id, tag]);
    });
    return { ok: true };
  });

  /** COM-07: what the door does. It describes the door policy, never who is inside. */
  app.put<{ Params: { id: string } }>("/v1/places/:id/door", async (request) => {
    const user = requireUser(request);
    writes.check(user.id);
    const { venue, ids } = await placeOf(ctx, request.params.id);
    if ((await hasVerifiedVisit(ctx, ids, user.id)) === null) throw new HttpError(403, "no_visit");
    const input = z.object({ idCheck: z.enum(["always", "sometimes", "never"]), agePolicy: z.enum(["adults", "allAgesEarly"]).nullable() }).parse(request.body);
    await ctx.db.query(
      `insert into door_reports (venue_id, user_id, id_check, age_policy, at) values ($1, $2, $3, $4, $5)
       on conflict (venue_id, user_id) do update set id_check = $3, age_policy = $4, at = $5`,
      [venue.id, user.id, input.idCheck, input.agePolicy, ctx.now()],
    );
    return { ok: true };
  });

  /** COM-09: an event at a place, by anyone signed in; RSVP in one tap. */
  app.post<{ Params: { id: string } }>("/v1/places/:id/events", async (request, reply) => {
    const user = requireUser(request);
    writes.check(user.id);
    const { venue, ids } = await placeOf(ctx, request.params.id);
    const now = ctx.now();
    const official = (await placeOwner(ctx, ids)) === user.id;
    const input = z
      .object({ id: uuid, title: z.string().trim().min(3).max(60), kind: z.enum(["dj", "student", "match", "concert", "quiz", "other"]), startsAt: z.number().int() })
      .parse(request.body);
    if (input.startsAt < now - 3_600_000 || input.startsAt > now + 120 * DAY_MS) throw new HttpError(400, "invalid_dates");
    await ctx.db.query(
      "insert into place_events (id, venue_id, created_by, title, kind, starts_at, created_at, official) values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict (id) do nothing",
      [input.id, venue.id, user.id, input.title, input.kind, input.startsAt, now, official],
    );
    await ctx.db.query("insert into event_rsvps (event_id, user_id) values ($1, $2) on conflict do nothing", [input.id, user.id]);
    return reply.status(201).send({ id: input.id });
  });

  app.post<{ Params: { id: string } }>("/v1/events/:id/rsvp", async (request) => {
    const user = requireUser(request);
    const event = (await ctx.db.query("select 1 from place_events where id = $1", [uuid.parse(request.params.id)]))[0];
    if (!event) throw new HttpError(404, "not_found");
    const { going } = z.object({ going: z.boolean() }).parse(request.body);
    if (going) await ctx.db.query("insert into event_rsvps (event_id, user_id) values ($1, $2) on conflict do nothing", [request.params.id, user.id]);
    else await ctx.db.query("delete from event_rsvps where event_id = $1 and user_id = $2", [request.params.id, user.id]);
    return { ok: true };
  });

  /**
   * COM-10: places around a point, one line per place, ranked by ratings and recent check-ins;
   * filters for a pint under a price (in cents), a strict door, a vibe tag.
   */
  app.get<{ Querystring: Record<string, string | undefined> }>("/v1/places", async (request) => {
    requireUser(request);
    const q = z
      .object({
        lat: z.coerce.number().min(-90).max(90),
        lng: z.coerce.number().min(-180).max(180),
        maxPint: z.coerce.number().int().positive().optional(),
        strict: z.enum(["1"]).optional(),
        tag: z.enum(VIBE_TAGS).optional(),
      })
      .parse(request.query);
    const box = NEARBY_M / 111_000;
    const venues = await ctx.db.query<VenueRow>(
      "select id, crew_id, name, kind, lat, lng, address from venues where kind <> 'home' and lat between $1 and $2 and lng between $3 and $4",
      [q.lat - box, q.lat + box, q.lng - box * 2, q.lng + box * 2],
    );
    const inRange = venues.filter((v) => distanceMeters(v, q) <= NEARBY_M).sort((a, b) => distanceMeters(a, q) - distanceMeters(b, q));
    // One entry per place: the first venue seen stands for the others within 40 m.
    const places: { lead: VenueRow; ids: string[] }[] = [];
    for (const v of inRange) {
      const place = places.find((p) => distanceMeters(p.lead, v) <= SAME_PLACE_M);
      if (place) place.ids.push(v.id);
      else places.push({ lead: v, ids: [v.id] });
    }
    const now = ctx.now();
    const out = [];
    for (const p of places.slice(0, 60)) {
      const checkIns = (await ctx.db.query<{ n: number }>("select count(*)::int as n from check_ins where venue_id = any($1::uuid[]) and verdict = 'accepted' and at > $2", [p.ids, now - 30 * DAY_MS]))[0]!.n;
      const rated = await ctx.db.query<{ ratings: string }>("select ratings from place_reviews where venue_id = any($1::uuid[]) and audience in ('public', 'anonymous')", [p.ids]);
      const scores = rated.flatMap((r) => Object.values(JSON.parse(r.ratings) as Record<string, number>));
      const rating = scores.length ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10 : null;
      const pints = (await ctx.db.query<{ amount: number }>("select amount from venue_prices where venue_id = any($1::uuid[]) and kind = 'pint' and at > $2", [p.ids, now - 180 * DAY_MS])).map((r) => r.amount).sort((a, b) => a - b);
      const pint = pints.length ? pints[Math.floor(pints.length / 2)]! : null;
      const door = await ctx.db.query<{ id_check: string; n: number }>("select id_check, count(*)::int as n from door_reports where venue_id = any($1::uuid[]) group by id_check", [p.ids]);
      const strict = (door.find((d) => d.id_check === "always")?.n ?? 0) > door.filter((d) => d.id_check !== "always").reduce((s, d) => s + d.n, 0);
      const tags = (await ctx.db.query<{ tag: string; n: number }>("select tag, count(*)::int as n from place_tags where venue_id = any($1::uuid[]) group by tag order by n desc", [p.ids])).map((t) => t.tag);
      if (q.maxPint && (pint === null || pint > q.maxPint)) continue;
      if (q.strict && !strict) continue;
      if (q.tag && !tags.includes(q.tag)) continue;
      out.push({
        venueId: p.lead.id,
        name: p.lead.name,
        distanceM: Math.round(distanceMeters(p.lead, q)),
        rating,
        checkIns,
        pint,
        strict,
        tags: tags.slice(0, 3),
        score: (rating ?? 3) * 10 + Math.min(checkIns, 50),
      });
    }
    out.sort((a, b) => b.score - a.score || a.distanceM - b.distanceM);
    return { places: out.slice(0, 30) };
  });

  /** COM-10: the crew's "want to go" list, which "Where to?" can read. */
  app.get<{ Params: { id: string } }>("/v1/crews/:id/want-to-go", async (request) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const rows = await ctx.db.query<{ venue_id: string; name: string; added_by: string }>(
      "select w.venue_id, v.name, w.added_by from want_to_go w join venues v on v.id = w.venue_id where w.crew_id = $1 order by w.at desc",
      [request.params.id],
    );
    return { places: rows.map((r) => ({ venueId: r.venue_id, name: r.name, addedBy: r.added_by })) };
  });

  app.put<{ Params: { id: string } }>("/v1/crews/:id/want-to-go", async (request) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const { venueId, want } = z.object({ venueId: uuid, want: z.boolean() }).parse(request.body);
    await placeOf(ctx, venueId);
    if (want) await ctx.db.query("insert into want_to_go (crew_id, venue_id, added_by, at) values ($1, $2, $3, $4) on conflict do nothing", [request.params.id, venueId, user.id, ctx.now()]);
    else await ctx.db.query("delete from want_to_go where crew_id = $1 and venue_id = $2", [request.params.id, venueId]);
    return { ok: true };
  });
}
