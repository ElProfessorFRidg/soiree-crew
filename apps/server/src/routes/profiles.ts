import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { RateLimiter } from "../ratelimit";
import { BacSimulation, distributionVolume, type BodyProfile, type DrinkIntake } from "@crew/bac";
import { territoryTitles } from "@crew/territory";
import { HttpError, requireUser, type Context } from "../context";
import { addExtraSections, hiddenItems } from "../profileExtras";
import { AUDIENCES, audiencesOf, canSee, PRESETS, SECTIONS, seesDates, STATS, STRANGER, type Relation, type Section } from "../profileRules";
import { assertPublishable } from "../posting";
import { dayBoundaryOf, nightOf, offsetMinutes } from "../time";
import { personalClock, personalHabits } from "../habits";

const HOUR_MS = 3_600_000;
const uuid = z.string().uuid();

/** RANK-09: records follow the drinking-leaderboard flag for anyone but the owner. */
const recordsPublic = () => (process.env.DRINKING_LEADERBOARD ?? "on") !== "off";

const pair = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x]);

async function relationBetween(ctx: Context, viewer: string, owner: string): Promise<Relation & { blocked: boolean }> {
  if (viewer === owner) return { me: true, friend: false, crewMate: false, blocked: false };
  const blocked = await ctx.db.query("select 1 from blocks where (blocker = $1 and blocked = $2) or (blocker = $2 and blocked = $1)", [viewer, owner]);
  const [a, b] = pair(viewer, owner);
  const friend = await ctx.db.query("select 1 from friendships where user_a = $1 and user_b = $2 and status = 'accepted'", [a, b]);
  const crew = await ctx.db.query(
    "select 1 from crew_members x join crew_members y on y.crew_id = x.crew_id where x.user_id = $1 and y.user_id = $2 limit 1",
    [viewer, owner],
  );
  return { me: false, friend: friend.length > 0, crewMate: crew.length > 0, blocked: blocked.length > 0 };
}

/** COM-05: friends we both have. */
async function mutualFriends(ctx: Context, a: string, b: string): Promise<number> {
  const rows = await ctx.db.query<{ n: number }>(
    `with fa as (select case when user_a = $1 then user_b else user_a end as f from friendships where (user_a = $1 or user_b = $1) and status = 'accepted'),
          fb as (select case when user_a = $2 then user_b else user_a end as f from friendships where (user_a = $2 or user_b = $2) and status = 'accepted')
     select count(*)::int as n from fa join fb on fa.f = fb.f`,
    [a, b],
  );
  return rows[0]!.n;
}

async function friendshipState(ctx: Context, viewer: string, owner: string): Promise<"none" | "friends" | "requested" | "incoming"> {
  if (viewer === owner) return "none";
  const [a, b] = pair(viewer, owner);
  const row = (await ctx.db.query<{ status: string; requested_by: string }>("select status, requested_by from friendships where user_a = $1 and user_b = $2", [a, b]))[0];
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  return row.requested_by === viewer ? "requested" : "incoming";
}

/** Every section, computed only when the viewer may see it (PROF-08: nothing else leaves the server). */
async function buildSections(ctx: Context, ownerId: string, relation: Relation, viewerId: string): Promise<Partial<Record<Section, unknown>>> {
  const stored = (await ctx.db.query<{ bio: string; country: string; audiences: string; hidden_venues: string }>(
    "select bio, country, audiences, hidden_venues from profiles where user_id = $1",
    [ownerId],
  ))[0];
  const audiences = audiencesOf(stored ? (JSON.parse(stored.audiences) as Record<string, unknown>) : {});
  const hidden = new Set<string>(stored ? (JSON.parse(stored.hidden_venues) as string[]) : []);
  const visible = (section: Section) => canSee(audiences[section], relation);
  const out: Partial<Record<Section, unknown>> = {};
  const now = ctx.now();

  if (visible("identity")) {
    const user = (await ctx.db.query<{ username: string; display_name: string }>("select username, display_name from users where id = $1", [ownerId]))[0]!;
    out.identity = { displayName: user.display_name, username: user.username, bio: stored?.bio ?? "", country: stored?.country ?? "" };
  }

  if (visible("crews")) {
    // COM-04: outside a crew, its name only shows if the crew agreed to it.
    out.crews = await ctx.db.query<{ name: string; members: number }>(
      `select c.name, (select count(*)::int from crew_members x where x.crew_id = c.id) as members
       from crew_members m join crews c on c.id = m.crew_id where m.user_id = $1
         and ($2 or c.public_name or exists (select 1 from crew_members v where v.crew_id = c.id and v.user_id = $3))
       order by m.joined_at`,
      [ownerId, relation.me, viewerId],
    );
  }

  const checkIns =
    visible("venues") || visible("titles")
      ? await ctx.db.query<{ venue_id: string; name: string; at: number; time_zone: string }>(
          `select c.venue_id, v.name, c.at, cr.time_zone from check_ins c
           join venues v on v.id = c.venue_id and v.kind <> 'home' join crews cr on cr.id = v.crew_id
           where c.user_id = $1 and c.verdict = 'accepted' and c.private = false order by c.at`,
          [ownerId],
        )
      : [];
  const shown = relation.me ? checkIns : checkIns.filter((c) => !hidden.has(c.venue_id));
  const reigns =
    visible("venues") || visible("titles")
      ? await ctx.db.query<{ venue_id: string; name: string }>(
          "select r.venue_id, v.name from reigns r join venues v on v.id = r.venue_id where r.user_id = $1 and r.ended_at is null",
          [ownerId],
        )
      : [];
  const ruled = relation.me ? reigns : reigns.filter((r) => !hidden.has(r.venue_id));

  if (visible("titles")) {
    // QOL-02: titles belong to the territory game, shared by all, so they keep the default boundary.
    const [row] = territoryTitles([
      {
        memberId: ownerId,
        ruled: ruled.map((r) => r.venue_id),
        checkIns: shown.map((c) => ({ venueId: c.venue_id, night: nightOf(c.at, c.time_zone), thisSeason: now - c.at < 31 * 24 * HOUR_MS })),
      },
    ]);
    const names = new Map(ruled.map((r) => [r.venue_id, r.name]));
    out.titles = row!.titles.map((t) => (t.venueId ? { kind: t.kind, venueName: names.get(t.venueId) ?? "" } : { kind: t.kind }));
  }

  if (visible("venues")) {
    // QOL-02: the owner's nights, cut at the owner's day boundary.
    const ownerBoundary = await dayBoundaryOf(ctx.db, ownerId);
    const byVenue = new Map<string, { venueId: string; name: string; visits: number; nights: Set<string>; lastAt: number; ruled: boolean }>();
    for (const c of shown) {
      const entry = byVenue.get(c.venue_id) ?? { venueId: c.venue_id, name: c.name, visits: 0, nights: new Set<string>(), lastAt: 0, ruled: false };
      entry.visits += 1;
      entry.nights.add(nightOf(c.at, c.time_zone, ownerBoundary));
      entry.lastAt = Math.max(entry.lastAt, c.at);
      byVenue.set(c.venue_id, entry);
    }
    for (const r of ruled) {
      const entry = byVenue.get(r.venue_id);
      if (entry) entry.ruled = true;
    }
    const dates = seesDates(relation);
    out.venues = [...byVenue.values()]
      .sort((a, b) => b.visits - a.visits)
      // PROF-05: strangers get venues and visit counts, never when.
      // TER-10: lifetime nights at the venue, for the loyalty tier the profile shows.
      .map((v) => ({ venueId: v.venueId, name: v.name, visits: v.visits, nights: v.nights.size, ruled: v.ruled, ...(dates ? { lastAt: v.lastAt } : {}), ...(relation.me ? { hidden: hidden.has(v.venueId) } : {}) }));
  }

  if (visible("drinks")) {
    const kinds = await ctx.db.query<{ kind: string; n: number }>(
      "select kind, count(*)::int as n from drinks where user_id = $1 and deleted_at is null group by kind order by n desc limit 3",
      [ownerId],
    );
    const total = (await ctx.db.query<{ n: number }>("select count(*)::int as n from drinks where user_id = $1 and deleted_at is null", [ownerId]))[0]!.n;
    // N-13: habits as plain figures: the usual time of the first drink and the usual pace.
    const nights = await ctx.db.query<{ party_id: string; consumed_at: number; time_zone: string }>(
      `select d.party_id, d.consumed_at, c.time_zone from drinks d join parties p on p.id = d.party_id join crews c on c.id = p.crew_id
       where d.user_id = $1 and d.deleted_at is null and d.kind <> 'soft' order by d.consumed_at`,
      [ownerId],
    );
    const byParty = new Map<string, { times: number[]; timeZone: string }>();
    for (const n of nights) {
      const entry = byParty.get(n.party_id) ?? { times: [], timeZone: n.time_zone };
      entry.times.push(n.consumed_at);
      byParty.set(n.party_id, entry);
    }
    const firsts: number[] = [];
    const paces: number[] = [];
    for (const { times, timeZone } of byParty.values()) {
      const first = times[0]!;
      const local = new Date(first + offsetMinutes(first, timeZone) * 60_000);
      firsts.push(((local.getUTCHours() - 12 + 24) % 24) * 60 + local.getUTCMinutes());
      const span = (times[times.length - 1]! - first) / HOUR_MS;
      if (times.length >= 2 && span >= 0.5) paces.push(times.length / span);
    }
    const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
    const firstMean = mean(firsts);
    const paceMean = mean(paces);
    out.drinks = {
      total,
      favourites: kinds.map((k) => ({ kind: k.kind, count: k.n })),
      usualFirstDrink: firstMean === null ? null : Math.round(firstMean),
      usualPacePerHour: paceMean === null ? null : Math.round(paceMean * 10) / 10,
      // N-13: when the night usually ends, on the owner's own night clock.
      usualLeaving: (await personalHabits(ctx, ownerId, await personalClock(ctx, ownerId))).usualLeaving,
    };
  }

  if (visible("records") && (relation.me || recordsPublic())) {
    // PROF-06: plain figures, nothing celebrated.
    const parties = await ctx.db.query<{ id: string; starts_at: number; ends_at: number; closed_at: number | null }>(
      "select p.id, p.starts_at, p.ends_at, p.closed_at from party_members m join parties p on p.id = m.party_id where m.user_id = $1 and m.response = 'going'",
      [ownerId],
    );
    const sealedProfile = (await ctx.db.query<{ sealed: string }>("select sealed from body_profiles where user_id = $1", [ownerId]))[0]?.sealed;
    const body = sealedProfile ? ctx.sealer.open<BodyProfile>(sealedProfile) : null;
    let highestBac: number | null = null;
    let biggestNight = 0;
    for (const p of parties) {
      const end = p.closed_at ?? Math.min(now, p.ends_at);
      const rows = await ctx.db.query<{ id: string; sealed: string; consumed_at: number; party_id: string | null }>(
        "select id, sealed, consumed_at, party_id from drinks where user_id = $1 and deleted_at is null and consumed_at between $2 and $3",
        [ownerId, p.starts_at - 12 * HOUR_MS, end],
      );
      biggestNight = Math.max(biggestNight, rows.filter((r) => r.party_id === p.id).length);
      if (!body || !rows.length) continue;
      const intakes: DrinkIntake[] = rows.map((r) => {
        const d = ctx.sealer.open<{ volumeMl: number; abv: number; withFood: boolean }>(r.sealed);
        return { id: r.id, volumeMl: d.volumeMl, abv: d.abv, consumedAt: r.consumed_at, withFood: d.withFood };
      });
      const sim = new BacSimulation(intakes, distributionVolume(body), end + 8 * HOUR_MS);
      for (const point of sim.sample(p.starts_at, end + 8 * HOUR_MS, 5 * 60_000)) highestBac = Math.max(highestBac ?? 0, point.bac);
    }
    out.records = { highestBac: highestBac === null ? null : Math.round(highestBac * 100) / 100, biggestNight };
  }

  if (visible("nights")) {
    const nights = await ctx.db.query<{ starts_at: number }>(
      "select p.starts_at from party_members m join parties p on p.id = m.party_id where m.user_id = $1 and m.response = 'going' and p.starts_at <= $2",
      [ownerId, now],
    );
    out.nights = { total: nights.length, last30Days: nights.filter((n) => now - n.starts_at < 30 * 24 * HOUR_MS).length };
  }

  if (visible("birthday")) {
    const row = (await ctx.db.query<{ birth_month: number | null; birth_day: number | null; birth_year: number | null }>(
      "select birth_month, birth_day, birth_year from profiles where user_id = $1",
      [ownerId],
    ))[0];
    // QOL-21: month and day for those allowed; the year stays with its owner.
    if (row?.birth_month && row.birth_day) {
      out.birthday = { month: row.birth_month, day: row.birth_day, ...(relation.me && row.birth_year ? { year: row.birth_year } : {}) };
    }
  }
  // PROF-02 reviews and games, O-43 night history, PROF-03 single figures hidden.
  await addExtraSections(ctx, out, { ownerId, viewerId, relation, visible, now });
  return out;
}

/** QOL-21: a real calendar day; 29 February is allowed, the year being optional. */
export const birthdaySchema = z
  .object({ month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31), year: z.number().int().min(1900).max(2100).optional() })
  .refine((b) => b.day <= new Date(Date.UTC(b.year ?? 2000, b.month, 0)).getUTCDate(), { message: "day" });

/** AC-09: the shame badge lasts a week, like the line on the venue page. */
const CHEAT_VISIBLE_MS = 7 * 24 * HOUR_MS;

/**
 * AC-09: rejected check-ins not overturned by an admin, at venues of crews the viewer belongs to.
 * Only crew mates (and the person) see it; strangers and friends outside the crew never do.
 */
async function cheatFlag(ctx: Context, ownerId: string, viewerId: string, now: number): Promise<{ at: number; venue: string; count: number } | null> {
  const rows = await ctx.db.query<{ at: number; name: string }>(
    `select c.at, v.name from check_ins c join venues v on v.id = c.venue_id
     where c.user_id = $1 and c.verdict = 'rejected' and c.overturned_by is null and c.at > $2
       and v.crew_id in (select crew_id from crew_members where user_id = $3)
     order by c.at desc`,
    [ownerId, now - CHEAT_VISIBLE_MS, viewerId],
  );
  const last = rows[0];
  return last ? { at: last.at, venue: last.name, count: rows.length } : null;
}

export function profileRoutes(app: FastifyInstance, ctx: Context): void {
  /**
   * O-39, PROF-02, PROF-07, PROF-08. `as` previews my own profile as someone else sees it.
   * A blocked pair sees nothing at all, as if the profile did not exist.
   */
  app.get<{ Params: { id: string }; Querystring: { as?: string } }>("/v1/users/:id/profile", async (request) => {
    const user = requireUser(request);
    const ownerId = request.params.id === "me" ? user.id : uuid.parse(request.params.id);
    const exists = await ctx.db.query("select 1 from users where id = $1", [ownerId]);
    if (!exists.length) throw new HttpError(404, "not_found");
    let relation: Relation = await relationBetween(ctx, user.id, ownerId);
    if ((relation as { blocked?: boolean }).blocked) throw new HttpError(404, "not_found");
    const as = z.enum(["stranger", "friend", "crew"]).optional().parse(request.query.as);
    if (as && ownerId === user.id) {
      relation = as === "stranger" ? STRANGER : as === "friend" ? { me: false, friend: true, crewMate: false } : { me: false, friend: false, crewMate: true };
    }
    const sections = await buildSections(ctx, ownerId, relation, user.id);
    const mine = ownerId === user.id && !as;
    const stored = mine
      ? (
          await ctx.db.query<{ audiences: string; findable: string; regular_opt_in: boolean; open_to_meet: boolean; requests_from: string; story_opt_out: boolean }>(
            "select audiences, findable, regular_opt_in, open_to_meet, requests_from, story_opt_out from profiles where user_id = $1",
            [ownerId],
          )
        )[0]
      : undefined;
    return {
      userId: ownerId,
      relation: { me: relation.me, friend: relation.friend, crewMate: relation.crewMate },
      friendship: await friendshipState(ctx, user.id, ownerId),
      muted: (await ctx.db.query("select 1 from mutes where muter = $1 and muted = $2", [user.id, ownerId])).length > 0,
      sections,
      ...(mine ? { audiences: audiencesOf(stored ? (JSON.parse(stored.audiences) as Record<string, unknown>) : {}), findable: stored?.findable ?? "username", regularOptIn: stored?.regular_opt_in ?? false, openToMeet: stored?.open_to_meet ?? false, requestsFrom: stored?.requests_from ?? "everyone", storyOptOut: stored?.story_opt_out ?? false } : {}),
      mutualFriends: ownerId === user.id ? 0 : await mutualFriends(ctx, user.id, ownerId),
      cheat: relation.me || relation.crewMate ? await cheatFlag(ctx, ownerId, as ? ownerId : user.id, ctx.now()) : null,
      // PROF-03: the figures I hid one by one, so the edit screen can show them.
      ...(mine ? { hiddenStats: [...(await hiddenItems(ctx, ownerId)).stats] } : {}),
    };
  });

  /** PROF-01, PROF-03: my profile fields, audiences (a preset or per section) and hidden venues. */
  app.put("/v1/me/profile", async (request) => {
    const user = requireUser(request);
    const input = z
      .object({
        bio: z.string().trim().max(160).optional(),
        country: z.string().trim().max(60).optional(),
        preset: z.enum(["private", "friends", "public"]).optional(),
        // One section or several at a time: a partial record, not an exhaustive one.
        audiences: z.partialRecord(z.enum(SECTIONS), z.enum(AUDIENCES)).optional(),
        birthday: birthdaySchema.nullable().optional(),
        hiddenVenues: z.array(uuid).max(500).optional(),
        hiddenReviews: z.array(uuid).max(500).optional(),
        hiddenStats: z.array(z.enum(STATS)).max(STATS.length).optional(),
        findable: z.enum(["search", "username", "nobody"]).optional(),
        regularOptIn: z.boolean().optional(),
        openToMeet: z.boolean().optional(),
        requestsFrom: z.enum(["nobody", "friendsOfFriends", "everyone"]).optional(),
        storyOptOut: z.boolean().optional(),
      })
      .parse(request.body);
    const current = (await ctx.db.query<{ bio: string; country: string; audiences: string; hidden_venues: string }>(
      "select bio, country, audiences, hidden_venues from profiles where user_id = $1",
      [user.id],
    ))[0];
    // COM-08: a changed bio or country is text others read, so it goes through the filters.
    const changed = [input.bio, input.country].filter((t, i) => t !== undefined && t !== (i === 0 ? current?.bio : current?.country));
    if (changed.length) await assertPublishable(ctx, user.id, changed);
    const audiences = {
      ...audiencesOf(current ? (JSON.parse(current.audiences) as Record<string, unknown>) : {}),
      ...(input.preset ? PRESETS[input.preset] : {}),
      ...(input.audiences ?? {}),
    };
    await ctx.db.query(
      `insert into profiles (user_id, bio, country, audiences, hidden_venues, updated_at) values ($1, $2, $3, $4, $5, $6)
       on conflict (user_id) do update set bio = $2, country = $3, audiences = $4, hidden_venues = $5, updated_at = $6`,
      [
        user.id,
        input.bio ?? current?.bio ?? "",
        input.country ?? current?.country ?? "",
        JSON.stringify(audiences),
        JSON.stringify(input.hiddenVenues ?? (current ? JSON.parse(current.hidden_venues) : [])),
        ctx.now(),
      ],
    );
    if (input.findable) await ctx.db.query("update profiles set findable = $2 where user_id = $1", [user.id, input.findable]);
    if (input.regularOptIn !== undefined) await ctx.db.query("update profiles set regular_opt_in = $2 where user_id = $1", [user.id, input.regularOptIn]);
    if (input.openToMeet !== undefined) await ctx.db.query("update profiles set open_to_meet = $2 where user_id = $1", [user.id, input.openToMeet]);
    if (input.requestsFrom) await ctx.db.query("update profiles set requests_from = $2 where user_id = $1", [user.id, input.requestsFrom]);
    if (input.storyOptOut !== undefined) await ctx.db.query("update profiles set story_opt_out = $2 where user_id = $1", [user.id, input.storyOptOut]);
    if (input.hiddenReviews) await ctx.db.query("update profiles set hidden_reviews = $2 where user_id = $1", [user.id, JSON.stringify(input.hiddenReviews)]);
    if (input.hiddenStats) await ctx.db.query("update profiles set hidden_stats = $2 where user_id = $1", [user.id, JSON.stringify([...new Set(input.hiddenStats)])]);
    if (input.birthday !== undefined) {
      const b = input.birthday;
      await ctx.db.query("update profiles set birth_month = $2, birth_day = $3, birth_year = $4 where user_id = $1", [user.id, b?.month ?? null, b?.day ?? null, b?.year ?? null]);
    }
    return { audiences };
  });

  /**
   * O-43, PROF-09: find people to add. Crew mates and friends always show; a stranger shows when
   * they allow search, or when the exact username was typed and they allow that. Blocks hide both ways.
   */
  const searches = new RateLimiter(30, 60_000, ctx.now);
  app.get<{ Querystring: { q?: string } }>("/v1/users/search", async (request) => {
    const user = requireUser(request);
    searches.check(user.id);
    const q = z.string().trim().toLowerCase().min(2).max(40).parse(request.query.q ?? "");
    // LIKE wildcards typed by the user are matched literally.
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const rows = await ctx.db.query<{ id: string; username: string; display_name: string; findable: string | null; known: boolean }>(
      `select u.id, u.username, u.display_name, p.findable,
              (exists (select 1 from crew_members a join crew_members b on a.crew_id = b.crew_id where a.user_id = $1 and b.user_id = u.id)
               or exists (select 1 from friendships f where (f.user_a = $1 and f.user_b = u.id) or (f.user_b = $1 and f.user_a = u.id))) as known
       from users u left join profiles p on p.user_id = u.id
       where u.id <> $1 and (u.username = $2 or lower(u.username) like $3 or lower(u.display_name) like $3)
         and not exists (select 1 from blocks b where (b.blocker = $1 and b.blocked = u.id) or (b.blocker = u.id and b.blocked = $1))
       order by (u.username = $2) desc, u.display_name limit 60`,
      [user.id, q, like],
    );
    const visible = rows.filter((r) => {
      const findable = r.findable ?? "username";
      if (r.known) return true;
      if (findable === "search") return true;
      return findable === "username" && r.username === q;
    });
    return {
      people: await Promise.all(
        visible.slice(0, 20).map(async (r) => ({ userId: r.id, username: r.username, name: r.display_name, friendship: await friendshipState(ctx, user.id, r.id) })),
      ),
    };
  });

  /** O-39: add as friend in one tap; the other side accepts with the same tap. */
  app.post<{ Params: { id: string } }>("/v1/users/:id/friend", async (request) => {
    const user = requireUser(request);
    const other = uuid.parse(request.params.id);
    if (other === user.id) throw new HttpError(400, "invalid");
    const relation = await relationBetween(ctx, user.id, other);
    if (relation.blocked) throw new HttpError(404, "not_found");
    const [a, b] = pair(user.id, other);
    const row = (await ctx.db.query<{ status: string; requested_by: string }>("select status, requested_by from friendships where user_a = $1 and user_b = $2", [a, b]))[0];
    if (!row) {
      // COM-05: each person picks who may send them a request; crew mates always can.
      const from = (await ctx.db.query<{ requests_from: string }>("select requests_from from profiles where user_id = $1", [other]))[0]?.requests_from ?? "everyone";
      if (from !== "everyone" && !relation.crewMate && !(from === "friendsOfFriends" && (await mutualFriends(ctx, user.id, other)) > 0)) {
        throw new HttpError(403, "requests_closed");
      }
      await ctx.db.query("insert into friendships (user_a, user_b, requested_by, status, at) values ($1, $2, $3, 'pending', $4)", [a, b, user.id, ctx.now()]);
    } else if (row.status === "pending" && row.requested_by !== user.id) {
      await ctx.db.query("update friendships set status = 'accepted', at = $3 where user_a = $1 and user_b = $2", [a, b, ctx.now()]);
    }
    // O-43: both lists update live. push: friends.request (new) or friends.accepted
    ctx.live.notify([user.id, other], { type: "friends.changed" });
    return { friendship: await friendshipState(ctx, user.id, other) };
  });

  app.delete<{ Params: { id: string } }>("/v1/users/:id/friend", async (request, reply) => {
    const user = requireUser(request);
    const other = uuid.parse(request.params.id);
    const [a, b] = pair(user.id, other);
    const removed = await ctx.db.query("delete from friendships where user_a = $1 and user_b = $2 returning user_a", [a, b]);
    if (removed.length) ctx.live.notify([user.id, other], { type: "friends.changed" });
    return reply.status(204).send();
  });

  /** COM-08: a block ends any friendship and hides both profiles from each other. */
  app.post<{ Params: { id: string } }>("/v1/users/:id/block", async (request) => {
    const user = requireUser(request);
    const other = uuid.parse(request.params.id);
    if (other === user.id) throw new HttpError(400, "invalid");
    const [a, b] = pair(user.id, other);
    await ctx.db.query("delete from friendships where user_a = $1 and user_b = $2", [a, b]);
    await ctx.db.query("insert into blocks (blocker, blocked, at) values ($1, $2, $3) on conflict do nothing", [user.id, other, ctx.now()]);
    ctx.live.notify([user.id, other], { type: "friends.changed" });
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/v1/users/:id/block", async (request, reply) => {
    const user = requireUser(request);
    await ctx.db.query("delete from blocks where blocker = $1 and blocked = $2", [user.id, uuid.parse(request.params.id)]);
    return reply.status(204).send();
  });

  /** COM-08: muting hides their crew calls and notes from me; nothing tells them. */
  app.post<{ Params: { id: string } }>("/v1/users/:id/mute", async (request) => {
    const user = requireUser(request);
    const other = uuid.parse(request.params.id);
    if (other === user.id) throw new HttpError(400, "invalid");
    await ctx.db.query("insert into mutes (muter, muted, at) values ($1, $2, $3) on conflict do nothing", [user.id, other, ctx.now()]);
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/v1/users/:id/mute", async (request, reply) => {
    const user = requireUser(request);
    await ctx.db.query("delete from mutes where muter = $1 and muted = $2", [user.id, uuid.parse(request.params.id)]);
    return reply.status(204).send();
  });

  // COM-08 reports moved to routes/moderation.ts with the decisions, strikes and notices.

  app.get("/v1/friends", async (request) => {
    const user = requireUser(request);
    const rows = await ctx.db.query<{ other: string; name: string; status: string; requested_by: string }>(
      `select case when f.user_a = $1 then f.user_b else f.user_a end as other, u.display_name as name, f.status, f.requested_by
       from friendships f join users u on u.id = case when f.user_a = $1 then f.user_b else f.user_a end
       where f.user_a = $1 or f.user_b = $1 order by u.display_name`,
      [user.id],
    );
    const blocked = await ctx.db.query<{ blocked: string; name: string }>(
      "select b.blocked, u.display_name as name from blocks b join users u on u.id = b.blocked where b.blocker = $1",
      [user.id],
    );
    const muted = await ctx.db.query<{ muted: string; name: string }>(
      "select m.muted, u.display_name as name from mutes m join users u on u.id = m.muted where m.muter = $1",
      [user.id],
    );
    return {
      muted: muted.map((m) => ({ userId: m.muted, name: m.name })),
      friends: rows.filter((r) => r.status === "accepted").map((r) => ({ userId: r.other, name: r.name })),
      incoming: rows.filter((r) => r.status === "pending" && r.requested_by !== user.id).map((r) => ({ userId: r.other, name: r.name })),
      outgoing: rows.filter((r) => r.status === "pending" && r.requested_by === user.id).map((r) => ({ userId: r.other, name: r.name })),
      blocked: blocked.map((b) => ({ userId: b.blocked, name: b.name })),
    };
  });
}
