import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BacSimulation, distributionVolume, type BodyProfile, type DrinkIntake } from "@crew/bac";
import { territoryTitles } from "@crew/territory";
import { HttpError, requireUser, type Context } from "../context";
import { AUDIENCES, audiencesOf, canSee, PRESETS, SECTIONS, seesDates, STRANGER, type Relation, type Section } from "../profileRules";
import { nightOf } from "../time";

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

async function friendshipState(ctx: Context, viewer: string, owner: string): Promise<"none" | "friends" | "requested" | "incoming"> {
  if (viewer === owner) return "none";
  const [a, b] = pair(viewer, owner);
  const row = (await ctx.db.query<{ status: string; requested_by: string }>("select status, requested_by from friendships where user_a = $1 and user_b = $2", [a, b]))[0];
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  return row.requested_by === viewer ? "requested" : "incoming";
}

/** Every section, computed only when the viewer may see it (PROF-08: nothing else leaves the server). */
async function buildSections(ctx: Context, ownerId: string, relation: Relation): Promise<Partial<Record<Section, unknown>>> {
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
    out.crews = await ctx.db.query<{ name: string; members: number }>(
      `select c.name, (select count(*)::int from crew_members x where x.crew_id = c.id) as members
       from crew_members m join crews c on c.id = m.crew_id where m.user_id = $1 order by m.joined_at`,
      [ownerId],
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
    const byVenue = new Map<string, { venueId: string; name: string; visits: number; lastAt: number; ruled: boolean }>();
    for (const c of shown) {
      const entry = byVenue.get(c.venue_id) ?? { venueId: c.venue_id, name: c.name, visits: 0, lastAt: 0, ruled: false };
      entry.visits += 1;
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
      .map((v) => ({ venueId: v.venueId, name: v.name, visits: v.visits, ruled: v.ruled, ...(dates ? { lastAt: v.lastAt } : {}), ...(relation.me ? { hidden: hidden.has(v.venueId) } : {}) }));
  }

  if (visible("drinks")) {
    const kinds = await ctx.db.query<{ kind: string; n: number }>(
      "select kind, count(*)::int as n from drinks where user_id = $1 and deleted_at is null group by kind order by n desc limit 3",
      [ownerId],
    );
    const total = (await ctx.db.query<{ n: number }>("select count(*)::int as n from drinks where user_id = $1 and deleted_at is null", [ownerId]))[0]!.n;
    out.drinks = { total, favourites: kinds.map((k) => ({ kind: k.kind, count: k.n })) };
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
  return out;
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
    const sections = await buildSections(ctx, ownerId, relation);
    const mine = ownerId === user.id && !as;
    const stored = mine
      ? (await ctx.db.query<{ audiences: string }>("select audiences from profiles where user_id = $1", [ownerId]))[0]
      : undefined;
    return {
      userId: ownerId,
      relation: { me: relation.me, friend: relation.friend, crewMate: relation.crewMate },
      friendship: await friendshipState(ctx, user.id, ownerId),
      sections,
      ...(mine ? { audiences: audiencesOf(stored ? (JSON.parse(stored.audiences) as Record<string, unknown>) : {}) } : {}),
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
        audiences: z.record(z.enum(SECTIONS), z.enum(AUDIENCES)).optional(),
        hiddenVenues: z.array(uuid).max(500).optional(),
      })
      .parse(request.body);
    const current = (await ctx.db.query<{ bio: string; country: string; audiences: string; hidden_venues: string }>(
      "select bio, country, audiences, hidden_venues from profiles where user_id = $1",
      [user.id],
    ))[0];
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
    return { audiences };
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
      await ctx.db.query("insert into friendships (user_a, user_b, requested_by, status, at) values ($1, $2, $3, 'pending', $4)", [a, b, user.id, ctx.now()]);
    } else if (row.status === "pending" && row.requested_by !== user.id) {
      await ctx.db.query("update friendships set status = 'accepted', at = $3 where user_a = $1 and user_b = $2", [a, b, ctx.now()]);
    }
    return { friendship: await friendshipState(ctx, user.id, other) };
  });

  app.delete<{ Params: { id: string } }>("/v1/users/:id/friend", async (request, reply) => {
    const user = requireUser(request);
    const [a, b] = pair(user.id, uuid.parse(request.params.id));
    await ctx.db.query("delete from friendships where user_a = $1 and user_b = $2", [a, b]);
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
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/v1/users/:id/block", async (request, reply) => {
    const user = requireUser(request);
    await ctx.db.query("delete from blocks where blocker = $1 and blocked = $2", [user.id, uuid.parse(request.params.id)]);
    return reply.status(204).send();
  });

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
    return {
      friends: rows.filter((r) => r.status === "accepted").map((r) => ({ userId: r.other, name: r.name })),
      incoming: rows.filter((r) => r.status === "pending" && r.requested_by !== user.id).map((r) => ({ userId: r.other, name: r.name })),
      outgoing: rows.filter((r) => r.status === "pending" && r.requested_by === user.id).map((r) => ({ userId: r.other, name: r.name })),
      blocked: blocked.map((b) => ({ userId: b.blocked, name: b.name })),
    };
  });
}
