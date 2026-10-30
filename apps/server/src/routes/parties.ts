import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { estimateBac, type BodyProfile, type DrinkIntake } from "@crew/bac";
import { assertCrewMember, HttpError, requireUser, type Context } from "../context";
import { assertPublishable } from "../posting";
import { intakeOf, PRE_PARTY_MS, sweepParty, tellUnwell } from "../nightWatch";
import { notifyRecapReady } from "../notifications/producers";
import { partySchema, responseSchema } from "../schemas";

const HOUR_MS = 3_600_000;
/** QOL-10: the last known position shown with a low battery stays this long. */
const LAST_KNOWN_MAX_AGE_MS = 2 * HOUR_MS;
/** A party never stays open for days (O-40). */
const MAX_PARTY_MS = 18 * HOUR_MS;
const MAX_TRIP_MS = 10 * 24 * HOUR_MS;

interface PartyRow {
  id: string;
  crew_id: string;
  name: string;
  mood: string;
  kind: "party" | "trip";
  starts_at: number;
  ends_at: number;
  closed_at: number | null;
  created_by: string;
  open_venue_id: string | null;
  quiet_after_minutes: number;
}

function partyView(row: PartyRow, now: number) {
  return {
    id: row.id,
    crewId: row.crew_id,
    name: row.name,
    mood: row.mood,
    kind: row.kind,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    closedAt: row.closed_at,
    quietAfterMinutes: row.quiet_after_minutes,
    createdBy: row.created_by,
    live: row.closed_at === null && row.starts_at <= now && row.ends_at >= now,
    // COM-05: the place where the hosts opened the party to join requests, if they did.
    openVenueId: row.open_venue_id ?? null,
  };
}

/** A shared position older than this is dropped (N-07 auto-expiry). */
const LOCATION_TTL_MS = 15 * 60_000;

/** Closes every party past its end, so nothing stays open for days. Positions go with it (SEC-06). */
async function closeEnded(ctx: Context): Promise<void> {
  await ctx.db.query("update parties set closed_at = ends_at where closed_at is null and ends_at < $1", [ctx.now()]);
  await ctx.db.query(
    "delete from party_locations where at < $1 or party_id in (select id from parties where closed_at is not null)",
    [ctx.now() - LOCATION_TTL_MS],
  );
  await ctx.db.query(
    "update party_members set last_known_sealed = null, last_known_at = null where last_known_sealed is not null and party_id in (select id from parties where closed_at is not null)",
  );
}

/** The party's crew, or a guest invited from outside it (COM-05). Anyone else gets a 404. */
export async function loadPartyForMember(ctx: Context, partyId: string, userId: string): Promise<PartyRow> {
  const rows = await ctx.db.query<PartyRow>(
    `select p.* from parties p where p.id = $1 and (
       exists (select 1 from crew_members c where c.crew_id = p.crew_id and c.user_id = $2)
       or exists (select 1 from party_members g where g.party_id = p.id and g.user_id = $2 and g.guest))`,
    [partyId, userId],
  );
  if (!rows[0]) throw new HttpError(404, "not_found");
  return rows[0];
}

/** Who hears about a party: its crew and its guests from outside the crew (COM-05). */
export async function partyAudience(ctx: Context, party: { id: string; crew_id: string }): Promise<string[]> {
  const rows = await ctx.db.query<{ user_id: string }>(
    "select user_id from crew_members where crew_id = $1 union select user_id from party_members where party_id = $2 and guest",
    [party.crew_id, party.id],
  );
  return rows.map((r) => r.user_id);
}

export function partyRoutes(app: FastifyInstance, ctx: Context): void {
  app.post("/v1/parties", async (request, reply) => {
    const user = requireUser(request);
    const input = partySchema.parse(request.body);
    await assertCrewMember(ctx, input.crewId, user.id);
    // COM-08: the party name is read by the whole crew.
    await assertPublishable(ctx, user.id, [input.name]);
    const span = input.endsAt - input.startsAt;
    if (span <= 0 || span > (input.kind === "trip" ? MAX_TRIP_MS : MAX_PARTY_MS)) throw new HttpError(400, "invalid_dates");
    const now = ctx.now();
    const existing = await ctx.db.query("select 1 from parties where id = $1", [input.id]);
    if (existing.length) throw new HttpError(409, "exists");
    await ctx.db.transaction(async (tx) => {
      await tx.query(
        `insert into parties (id, crew_id, name, mood, kind, starts_at, ends_at, created_by, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [input.id, input.crewId, input.name, input.mood, input.kind, input.startsAt, input.endsAt, user.id, now],
      );
      // The whole crew is invited; the creator is going.
      await tx.query(
        `insert into party_members (party_id, user_id, response)
         select $1, m.user_id, case when m.user_id = $2 then 'going' else 'invited' end from crew_members m where m.crew_id = $3`,
        [input.id, user.id, input.crewId],
      );
    });
    const members = await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1", [input.crewId]);
    ctx.live.notify(members.map((m) => m.user_id), { type: "crew.changed", crewId: input.crewId });
    const rows = await ctx.db.query<PartyRow>("select * from parties where id = $1", [input.id]);
    return reply.status(201).send({ party: partyView(rows[0]!, now) });
  });

  /** Upcoming and live parties of my crews, plus my invitation state (O-36). */
  app.get("/v1/parties", async (request) => {
    const user = requireUser(request);
    await closeEnded(ctx);
    const now = ctx.now();
    const rows = await ctx.db.query<PartyRow & { response: string; guest: boolean; may_bring_crew: boolean; invited_by_name: string | null; crew_role: string | null }>(
      `select p.*, m.response, m.guest, m.may_bring_crew, u.display_name as invited_by_name, cm.role as crew_role
       from parties p join party_members m on m.party_id = p.id and m.user_id = $1
       left join users u on u.id = m.invited_by
       left join crew_members cm on cm.crew_id = p.crew_id and cm.user_id = $1
       where p.closed_at is null or p.closed_at > $2 order by p.starts_at`,
      [user.id, now - 24 * HOUR_MS],
    );
    return {
      parties: rows.map((row) => ({
        ...partyView(row, now),
        myResponse: row.response,
        // COM-05: the creator and the crew's admins decide on join requests and opening the party.
        host: row.created_by === user.id || row.crew_role === "admin",
        // COM-05: a party of another crew I was invited to, who asked me, and whether I may bring my crew.
        ...(row.guest ? { guest: { invitedBy: row.invited_by_name, mayBringCrew: row.may_bring_crew } } : {}),
      })),
    };
  });

  app.post<{ Params: { id: string } }>("/v1/parties/:id/response", async (request) => {
    const user = requireUser(request);
    const party = await loadPartyForMember(ctx, request.params.id, user.id);
    const { response } = responseSchema.parse(request.body);
    const now = ctx.now();
    // A finished night is history: nobody signs up to it afterwards (nights count, album, recap).
    if (party.closed_at !== null || party.ends_at < now) throw new HttpError(409, "party_closed");
    // Someone who walked into an open crew cannot jump into a night already under way: its live
    // positions and levels belong to the people who were there. An invite still works.
    if (party.starts_at <= now) {
      const joined = (await ctx.db.query<{ joined_at: number; via_open: boolean }>("select joined_at, via_open from crew_members where crew_id = $1 and user_id = $2", [party.crew_id, user.id]))[0];
      if (joined?.via_open && joined.joined_at > party.starts_at) throw new HttpError(403, "too_late");
    }
    await ctx.db.query(
      `insert into party_members (party_id, user_id, response) values ($1, $2, $3)
       on conflict (party_id, user_id) do update set response = $3`,
      [party.id, user.id, response],
    );
    ctx.live.notify(await partyAudience(ctx, party), { type: "party.changed", partyId: party.id });
    return { response };
  });

  /** Small status flags a member sets on themself: home safe (N-25, O-82), designated driver (N-26), low battery (QOL-10). */
  app.post<{ Params: { id: string } }>("/v1/parties/:id/status", async (request) => {
    const user = requireUser(request);
    const party = await loadPartyForMember(ctx, request.params.id, user.id);
    const input = z
      .object({ homeSafe: z.boolean().optional(), designatedDriver: z.boolean().optional(), batteryLow: z.boolean().optional(), unwell: z.boolean().optional() })
      .parse(request.body);
    const now = ctx.now();
    // Status is for people at the night; it also marks activity, which counts the night as theirs.
    const going = await ctx.db.query("select 1 from party_members where party_id = $1 and user_id = $2 and response = 'going'", [party.id, user.id]);
    if (!going.length) throw new HttpError(403, "not_going");
    // O-37: any status during the night is a sign of life, and the first one is the arrival.
    if (party.closed_at === null && party.starts_at <= now) {
      await ctx.db.query("update party_members set arrived_at = coalesce(arrived_at, $3) where party_id = $1 and user_id = $2", [party.id, user.id, now]);
    }
    if (input.homeSafe !== undefined) {
      // Home safe also means fine: it clears "not feeling well" (N-36).
      await ctx.db.query(
        "update party_members set home_safe_at = $3, last_activity_at = $4, unwell_at = case when $5 then null else unwell_at end where party_id = $1 and user_id = $2",
        [party.id, user.id, input.homeSafe ? now : null, now, input.homeSafe],
      );
    }
    if (input.unwell !== undefined) {
      await ctx.db.query("update party_members set unwell_at = $3, last_activity_at = $4, unwell_widened_at = null where party_id = $1 and user_id = $2", [
        party.id,
        user.id,
        input.unwell ? now : null,
        now,
      ]);
    }
    if (input.designatedDriver !== undefined) {
      await ctx.db.query("update party_members set designated_driver = $3 where party_id = $1 and user_id = $2", [party.id, user.id, input.designatedDriver]);
    }
    if (input.batteryLow !== undefined) {
      // QOL-10: with live location on, the last position stays for the crew after the phone dies.
      const position = input.batteryLow
        ? (await ctx.db.query<{ sealed: string; at: number }>("select sealed, at from party_locations where party_id = $1 and user_id = $2", [party.id, user.id]))[0]
        : undefined;
      await ctx.db.query(
        `update party_members set battery_low = $3, last_activity_at = $4, battery_low_at = case when $3 then $4::bigint else null end,
           last_known_sealed = $5, last_known_at = $6 where party_id = $1 and user_id = $2`,
        [party.id, user.id, input.batteryLow, now, position?.sealed ?? null, position?.at ?? null],
      );
    }
    const members = await ctx.db.query<{ user_id: string }>("select user_id from party_members where party_id = $1 and response = 'going'", [party.id]);
    ctx.live.notify(members.map((m) => m.user_id), { type: "party.changed", partyId: party.id });
    // N-36: told quietly, the nearest first when positions are shared; nobody outside the party.
    if (input.unwell) await tellUnwell(ctx, party.id, user.id);
    return { ok: true };
  });

  /** N-29: how long without a sign of life before the party is told. The creator or an admin sets it. */
  app.patch<{ Params: { id: string } }>("/v1/parties/:id/settings", async (request) => {
    const user = requireUser(request);
    const party = await loadPartyForMember(ctx, request.params.id, user.id);
    const { role } = await assertCrewMember(ctx, party.crew_id, user.id);
    if (party.created_by !== user.id && role !== "admin") throw new HttpError(403, "forbidden");
    const input = z.object({ quietAfterMinutes: z.number().int().min(15).max(240) }).parse(request.body);
    await ctx.db.query("update parties set quiet_after_minutes = $2 where id = $1", [party.id, input.quietAfterMinutes]);
    // A new threshold starts a new count: anyone already told may be told again under it.
    await ctx.db.query("update party_members set quiet_alerted_at = null where party_id = $1", [party.id]);
    const members = await ctx.db.query<{ user_id: string }>("select user_id from party_members where party_id = $1 and response <> 'declined'", [party.id]);
    ctx.live.notify(members.map((m) => m.user_id), { type: "party.changed", partyId: party.id });
    return { quietAfterMinutes: input.quietAfterMinutes };
  });

  /**
   * N-07: my position for the crew of this party, only while it is live and only
   * when I turn it on. The client sends it every minute or so; DELETE is ghost mode.
   */
  app.put<{ Params: { id: string } }>("/v1/parties/:id/location", async (request) => {
    const user = requireUser(request);
    await closeEnded(ctx);
    const party = await loadPartyForMember(ctx, request.params.id, user.id);
    const now = ctx.now();
    if (party.closed_at !== null || party.starts_at > now || party.ends_at < now) throw new HttpError(409, "party_not_live");
    const going = await ctx.db.query("select 1 from party_members where party_id = $1 and user_id = $2 and response = 'going'", [party.id, user.id]);
    if (!going.length) throw new HttpError(403, "not_going");
    const input = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracy: z.number().min(0).max(10_000) }).parse(request.body);
    await ctx.db.query(
      `insert into party_locations (party_id, user_id, sealed, at) values ($1, $2, $3, $4)
       on conflict (party_id, user_id) do update set sealed = excluded.sealed, at = excluded.at`,
      [party.id, user.id, ctx.sealer.seal(input), now],
    );
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/v1/parties/:id/location", async (request, reply) => {
    const user = requireUser(request);
    await ctx.db.query("delete from party_locations where party_id = $1 and user_id = $2", [request.params.id, user.id]);
    return reply.status(204).send();
  });

  /** Positions of the party's members who share theirs, for members going to it. Never anyone else. */
  app.get<{ Params: { id: string } }>("/v1/parties/:id/locations", async (request) => {
    const user = requireUser(request);
    await closeEnded(ctx);
    const party = await loadPartyForMember(ctx, request.params.id, user.id);
    const going = await ctx.db.query("select 1 from party_members where party_id = $1 and user_id = $2 and response = 'going'", [party.id, user.id]);
    if (!going.length) return { locations: [] };
    const rows = await ctx.db.query<{ user_id: string; display_name: string; sealed: string; at: number }>(
      `select l.user_id, u.display_name, l.sealed, l.at from party_locations l join users u on u.id = l.user_id
       join party_members m on m.party_id = l.party_id and m.user_id = l.user_id and m.response = 'going'
       where l.party_id = $1`,
      [party.id],
    );
    return {
      locations: rows.map((r) => ({ userId: r.user_id, name: r.display_name, at: r.at, ...ctx.sealer.open<{ lat: number; lng: number; accuracy: number }>(r.sealed) })),
    };
  });

  /** N-32: the party's shopping list, open to its crew. */
  app.get<{ Params: { id: string } }>("/v1/parties/:id/items", async (request) => {
    const user = requireUser(request);
    const party = await loadPartyForMember(ctx, request.params.id, user.id);
    const rows = await ctx.db.query<{ id: string; label: string; added_by: string; claimed_by: string | null; done: boolean }>(
      "select id, label, added_by, claimed_by, done from party_items where party_id = $1 order by created_at",
      [party.id],
    );
    return { items: rows.map((r) => ({ id: r.id, label: r.label, addedBy: r.added_by, claimedBy: r.claimed_by, done: r.done })) };
  });

  /** Add an item, or change one: take it ("I bring it"), let it go, tick it, or remove it. */
  app.post<{ Params: { id: string } }>("/v1/parties/:id/items", async (request, reply) => {
    const user = requireUser(request);
    const party = await loadPartyForMember(ctx, request.params.id, user.id);
    const input = z
      .object({
        id: z.string().uuid(),
        label: z.string().trim().min(1).max(60).optional(),
        claim: z.boolean().optional(),
        done: z.boolean().optional(),
        remove: z.boolean().optional(),
      })
      .parse(request.body);
    const existing = (await ctx.db.query<{ party_id: string; added_by: string }>("select party_id, added_by from party_items where id = $1", [input.id]))[0];
    if (existing && existing.party_id !== party.id) throw new HttpError(404, "not_found");
    if (!existing) {
      if (!input.label) throw new HttpError(400, "invalid");
      await ctx.db.query("insert into party_items (id, party_id, label, added_by, created_at) values ($1, $2, $3, $4, $5)", [input.id, party.id, input.label, user.id, ctx.now()]);
    } else if (input.remove) {
      await ctx.db.query("delete from party_items where id = $1", [input.id]);
    } else {
      if (input.claim !== undefined) await ctx.db.query("update party_items set claimed_by = $2 where id = $1", [input.id, input.claim ? user.id : null]);
      if (input.done !== undefined) await ctx.db.query("update party_items set done = $2 where id = $1", [input.id, input.done]);
    }
    const members = await ctx.db.query<{ user_id: string }>("select user_id from party_members where party_id = $1 and response <> 'declined'", [party.id]);
    ctx.live.notify(members.map((m) => m.user_id), { type: "party.changed", partyId: party.id });
    return reply.status(existing ? 200 : 201).send({ ok: true });
  });

  /** N-11: the crew votes on where to go next; everyone sees the tally. */
  app.get<{ Params: { id: string } }>("/v1/parties/:id/where-to", async (request) => {
    const user = requireUser(request);
    const party = await loadPartyForMember(ctx, request.params.id, user.id);
    const rows = await ctx.db.query<{ venue_id: string; user_id: string }>("select venue_id, user_id from venue_votes where party_id = $1", [party.id]);
    const tally = new Map<string, { venueId: string; count: number; mine: boolean; voters: string[] }>();
    for (const r of rows) {
      const entry = tally.get(r.venue_id) ?? { venueId: r.venue_id, count: 0, mine: false, voters: [] };
      entry.count += 1;
      entry.voters.push(r.user_id);
      if (r.user_id === user.id) entry.mine = true;
      tally.set(r.venue_id, entry);
    }
    return { votes: [...tally.values()].sort((a, b) => b.count - a.count) };
  });

  app.put<{ Params: { id: string } }>("/v1/parties/:id/where-to", async (request) => {
    const user = requireUser(request);
    const party = await loadPartyForMember(ctx, request.params.id, user.id);
    const input = z.object({ venueId: z.string().uuid().nullable() }).parse(request.body);
    if (input.venueId === null) {
      await ctx.db.query("delete from venue_votes where party_id = $1 and user_id = $2", [party.id, user.id]);
    } else {
      const venue = await ctx.db.query("select 1 from venues where id = $1 and crew_id = $2", [input.venueId, party.crew_id]);
      if (!venue.length) throw new HttpError(404, "not_found");
      await ctx.db.query(
        `insert into venue_votes (party_id, user_id, venue_id, at) values ($1, $2, $3, $4)
         on conflict (party_id, user_id) do update set venue_id = excluded.venue_id, at = excluded.at`,
        [party.id, user.id, input.venueId, ctx.now()],
      );
    }
    const members = await ctx.db.query<{ user_id: string }>("select user_id from party_members where party_id = $1 and response = 'going'", [party.id]);
    ctx.live.notify(members.map((m) => m.user_id), { type: "party.changed", partyId: party.id });
    return { ok: true };
  });

  /**
   * N-27: going home together. `withUserId` joins that person's group (their
   * leader's, so groups never chain); null leaves any group. Only going members.
   */
  app.post<{ Params: { id: string } }>("/v1/parties/:id/home", async (request) => {
    const user = requireUser(request);
    const party = await loadPartyForMember(ctx, request.params.id, user.id);
    const input = z
      .object({
        withUserId: z.string().uuid().nullable().optional(),
        mode: z.enum(["walk", "car", "ride", "transit"]).nullable().optional(),
        offerTo: z.string().uuid().optional(),
        answerOffer: z.boolean().optional(),
      })
      .parse(request.body);
    const going = await ctx.db.query<{ user_id: string; home_with: string | null; home_offer_from: string | null }>(
      "select user_id, home_with, home_offer_from from party_members where party_id = $1 and response = 'going'",
      [party.id],
    );
    const member = (id: string) => going.find((m) => m.user_id === id);
    const me = member(user.id);
    if (!me) throw new HttpError(403, "not_going");
    const set = (userId: string, column: "home_with" | "home_mode" | "home_offer_from", value: string | null) =>
      ctx.db.query(`update party_members set ${column} = $3 where party_id = $1 and user_id = $2`, [party.id, userId, value]);

    const join = async (userId: string, otherId: string) => {
      const other = member(otherId);
      if (!other || otherId === userId) throw new HttpError(404, "not_found");
      const leader = other.home_with ?? otherId;
      if (!other.home_with) await set(otherId, "home_with", otherId);
      await set(userId, "home_with", leader);
      // Whoever followed me now follows my new leader.
      await ctx.db.query("update party_members set home_with = $3 where party_id = $1 and home_with = $2 and user_id <> $2", [party.id, userId, leader]);
    };

    if (input.withUserId === null) {
      await set(user.id, "home_with", null);
      // Leaving a group I led: the next person leads it.
      const followers = going.filter((m) => m.home_with === user.id && m.user_id !== user.id);
      const next = followers[0];
      for (const f of followers) await set(f.user_id, "home_with", followers.length > 1 && next ? next.user_id : null);
    } else if (input.withUserId) {
      await join(user.id, input.withUserId);
    }
    if (input.mode !== undefined) await set(user.id, "home_mode", input.mode);
    if (input.offerTo) {
      if (!member(input.offerTo) || input.offerTo === user.id) throw new HttpError(404, "not_found");
      await set(input.offerTo, "home_offer_from", user.id);
    }
    if (input.answerOffer !== undefined) {
      const from = me.home_offer_from;
      await set(user.id, "home_offer_from", null);
      if (input.answerOffer && from) await join(user.id, from);
    }
    ctx.live.notify(going.map((m) => m.user_id), { type: "party.changed", partyId: party.id });
    return { ok: true };
  });

  /**
   * O-37 live dashboard. BACs are computed here with @crew/bac from each member's
   * own drinks, so every phone shows the same numbers. Only crew members reach it.
   */
  app.get<{ Params: { id: string } }>("/v1/parties/:id/live", async (request) => {
    const user = requireUser(request);
    await closeEnded(ctx);
    const party = await loadPartyForMember(ctx, request.params.id, user.id);
    await sweepParty(ctx, party);
    const now = ctx.now();
    const at = party.closed_at ?? now;

    const members = await ctx.db.query<{
      user_id: string;
      display_name: string;
      response: string;
      designated_driver: boolean;
      home_safe_at: number | null;
      last_activity_at: number | null;
      battery_low: boolean;
      unwell_at: number | null;
      home_with: string | null;
      home_mode: string | null;
      home_offer_from: string | null;
      arrived_at: number | null;
      battery_low_at: number | null;
      last_known_sealed: string | null;
      last_known_at: number | null;
      sealed: string | null;
    }>(
      `select m.user_id, u.display_name, m.response, m.designated_driver, m.home_safe_at, m.last_activity_at, m.battery_low, m.unwell_at,
              m.home_with, m.home_mode, m.home_offer_from, m.arrived_at, m.battery_low_at, m.last_known_sealed, m.last_known_at, b.sealed
       from party_members m join users u on u.id = m.user_id left join body_profiles b on b.user_id = m.user_id
       where m.party_id = $1 order by u.display_name`,
      [party.id],
    );
    const going = members.filter((m) => m.response === "going").map((m) => m.user_id);
    // The crew watches over the night from home too, but levels are not for someone who walked in
    // through an open crew and is not there.
    const viewer = (await ctx.db.query<{ via_open: boolean }>("select via_open from crew_members where crew_id = $1 and user_id = $2", [party.crew_id, user.id]))[0];
    // A guest from outside the crew (no crew row) sees levels only once going (COM-05).
    const seesLevels = going.includes(user.id) || (viewer !== undefined && !viewer.via_open);
    const drinkRows = going.length
      ? await ctx.db.query<{ id: string; user_id: string; sealed: string; consumed_at: number; party_id: string | null }>(
          `select id, user_id, sealed, consumed_at, party_id from drinks
           where user_id = any($1::uuid[]) and deleted_at is null and consumed_at between $2 and $3`,
          [going, party.starts_at - PRE_PARTY_MS, at],
        )
      : [];
    // HUB-01: where each member is checked in right now, unless the check-in is private.
    const venueRows = going.length
      ? await ctx.db.query<{ user_id: string; venue_id: string; name: string }>(
          `select distinct on (c.user_id) c.user_id, v.id as venue_id, v.name from check_ins c join venues v on v.id = c.venue_id and v.crew_id = $2
           where c.user_id = any($1::uuid[]) and c.ended_at is null and c.private = false and c.verdict in ('accepted', 'unverified') and c.at >= $3
           order by c.user_id, c.at desc`,
          [going, party.crew_id, party.starts_at - PRE_PARTY_MS],
        )
      : [];
    const iAmGoing = going.includes(user.id);
    const waterRows = going.length
      ? await ctx.db.query<{ user_id: string }>("select user_id from water where party_id = $1 and deleted_at is null", [party.id])
      : [];

    const view = members.map((m) => {
      const base = {
        userId: m.user_id,
        displayName: m.display_name,
        response: m.response,
        designatedDriver: m.designated_driver,
        homeSafeAt: m.home_safe_at,
        batteryLow: m.battery_low,
        unwellAt: m.unwell_at,
        homeWith: m.home_with,
        homeMode: m.home_mode,
        homeOfferFrom: m.home_offer_from,
        lastActivityAt: m.last_activity_at,
        arrivedAt: m.arrived_at,
        batteryLowAt: m.battery_low_at,
        // QOL-10: only for the people at the night, only while the battery is low, only for a while.
        lastKnown:
          iAmGoing && m.battery_low && m.last_known_sealed && m.last_known_at !== null && now - m.last_known_at < LAST_KNOWN_MAX_AGE_MS
            ? { ...ctx.sealer.open<{ lat: number; lng: number; accuracy: number }>(m.last_known_sealed), at: m.last_known_at }
            : null,
        venue: venueRows.filter((r) => r.user_id === m.user_id).map((r) => ({ id: r.venue_id, name: r.name }))[0] ?? null,
      };
      if (m.response !== "going") return { ...base, bac: null, trend: null, drinks: 0, water: 0, quiet: false, pace: null };
      const mine = drinkRows.filter((d) => d.user_id === m.user_id);
      const intakes: DrinkIntake[] = mine.map((d) => intakeOf(ctx, d));
      // O-37: drinks in the last hour against the hour before, to tell who speeds up and who slows down.
      const pace = {
        lastHour: mine.filter((d) => d.consumed_at > at - HOUR_MS).length,
        previousHour: mine.filter((d) => d.consumed_at > at - 2 * HOUR_MS && d.consumed_at <= at - HOUR_MS).length,
      };
      const profile = m.sealed ? ctx.sealer.open<BodyProfile>(m.sealed) : null;
      const estimate = profile && seesLevels ? estimateBac(intakes, profile, at) : null;
      const quiet =
        party.closed_at === null &&
        m.home_safe_at === null &&
        m.last_activity_at !== null &&
        now - m.last_activity_at > party.quiet_after_minutes * 60_000;
      return {
        ...base,
        bac: estimate ? Math.round(estimate.bac * 1000) / 1000 : null,
        trend: estimate?.trend ?? null,
        drinks: mine.filter((d) => d.party_id === party.id).length,
        water: waterRows.filter((w) => w.user_id === m.user_id).length,
        quiet,
        pace,
      };
    });

    return { party: partyView(party, now), members: view, serverTime: now };
  });

  /** O-40: the creator or an admin can close early; a closed party takes no new drinks. */
  app.post<{ Params: { id: string } }>("/v1/parties/:id/close", async (request) => {
    const user = requireUser(request);
    const party = await loadPartyForMember(ctx, request.params.id, user.id);
    const { role } = await assertCrewMember(ctx, party.crew_id, user.id);
    if (party.created_by !== user.id && role !== "admin") throw new HttpError(403, "forbidden");
    await ctx.db.query("update parties set closed_at = $2 where id = $1 and closed_at is null", [party.id, ctx.now()]);
    await ctx.db.query("delete from party_locations where party_id = $1", [party.id]);
    await ctx.db.query("update party_members set last_known_sealed = null, last_known_at = null where party_id = $1", [party.id]);
    const members = await ctx.db.query<{ user_id: string; response: string; home_safe_at: number | null }>(
      "select user_id, response, home_safe_at from party_members where party_id = $1",
      [party.id],
    );
    ctx.live.notify(members.map((m) => m.user_id), { type: "party.changed", partyId: party.id });
    // push: party.stripReady (JOY-09: the party is over, the photo strip is ready; after quiet hours, QOL-20)
    // N-25: the night is over; whoever went and is not home yet is asked.
    ctx.live.notify(
      members.filter((m) => m.response === "going" && m.home_safe_at === null).map((m) => m.user_id),
      { type: "party.homeCheck", partyId: party.id },
    );
    await notifyRecapReady(ctx, party.id);
    return { ok: true };
  });
}
