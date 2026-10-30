import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertCrewMember, HttpError, requireUser, type Context } from "../context";
import { RateLimiter } from "../ratelimit";
import { placeOf } from "./community";
import { loadPartyForMember, partyAudience } from "./parties";

const uuid = z.string().uuid();

const pair = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x]);

async function blockedBetween(ctx: Context, a: string, b: string): Promise<boolean> {
  const rows = await ctx.db.query("select 1 from blocks where (blocker = $1 and blocked = $2) or (blocker = $2 and blocked = $1)", [a, b]);
  return rows.length > 0;
}

/**
 * COM-05: may `from` reach `to` with an invitation? The same rule as friend requests: a block hides
 * both sides, friends and crew mates always can, otherwise the target's "who can send requests" decides.
 */
async function mayInvite(ctx: Context, from: string, to: string): Promise<"ok" | "hidden" | "closed"> {
  if (await blockedBetween(ctx, from, to)) return "hidden";
  const [a, b] = pair(from, to);
  const friends = await ctx.db.query("select 1 from friendships where user_a = $1 and user_b = $2 and status = 'accepted'", [a, b]);
  if (friends.length) return "ok";
  const crewMates = await ctx.db.query("select 1 from crew_members x join crew_members y on y.crew_id = x.crew_id where x.user_id = $1 and y.user_id = $2 limit 1", [from, to]);
  if (crewMates.length) return "ok";
  const setting = (await ctx.db.query<{ requests_from: string }>("select requests_from from profiles where user_id = $1", [to]))[0]?.requests_from ?? "everyone";
  if (setting === "everyone") return "ok";
  if (setting === "nobody") return "closed";
  const mutual = await ctx.db.query<{ n: number }>(
    `with fa as (select case when user_a = $1 then user_b else user_a end as f from friendships where (user_a = $1 or user_b = $1) and status = 'accepted'),
          fb as (select case when user_a = $2 then user_b else user_a end as f from friendships where (user_a = $2 or user_b = $2) and status = 'accepted')
     select count(*)::int as n from fa join fb on fa.f = fb.f`,
    [from, to],
  );
  return mutual[0]!.n > 0 ? "ok" : "closed";
}

/** The people who decide for a party: whoever created it and the crew's admins. */
async function hostsOf(ctx: Context, party: { crew_id: string; created_by: string }): Promise<string[]> {
  const admins = await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1 and role = 'admin'", [party.crew_id]);
  return [...new Set([party.created_by, ...admins.map((a) => a.user_id)])];
}

async function assertHost(ctx: Context, party: { crew_id: string; created_by: string }, userId: string): Promise<void> {
  if (!(await hostsOf(ctx, party)).includes(userId)) throw new HttpError(403, "forbidden");
}

const notOver = (party: { closed_at: number | null; ends_at: number }, now: number) => party.closed_at === null && party.ends_at > now;

export function partyGuestRoutes(app: FastifyInstance, ctx: Context): void {
  const invites = new RateLimiter(30, 60 * 60_000, ctx.now);
  const requests = new RateLimiter(20, 60 * 60_000, ctx.now);

  /**
   * COM-05: invite someone met at a place (a regular, a profile) to one of my crew's parties.
   * `withCrew` lets them bring their own crew once they answer.
   */
  app.post<{ Params: { id: string } }>("/v1/parties/:id/guests", async (request, reply) => {
    const user = requireUser(request);
    invites.check(user.id);
    const party = await loadPartyForMember(ctx, uuid.parse(request.params.id), user.id);
    // Guests do not invite further guests: only the crew whose party it is.
    await assertCrewMember(ctx, party.crew_id, user.id);
    if (!notOver(party, ctx.now())) throw new HttpError(409, "party_closed");
    const input = z.object({ userId: uuid, withCrew: z.boolean().default(false) }).parse(request.body);
    if (input.userId === user.id) throw new HttpError(400, "invalid");
    const exists = await ctx.db.query("select 1 from users where id = $1", [input.userId]);
    if (!exists.length) throw new HttpError(404, "not_found");
    const rule = await mayInvite(ctx, user.id, input.userId);
    if (rule === "hidden") throw new HttpError(404, "not_found");
    if (rule === "closed") throw new HttpError(403, "requests_closed");
    // Blocked by the host: the party stays out of their sight too.
    if (party.created_by !== user.id && (await blockedBetween(ctx, party.created_by, input.userId))) throw new HttpError(404, "not_found");
    const already = (await ctx.db.query<{ guest: boolean }>("select guest from party_members where party_id = $1 and user_id = $2", [party.id, input.userId]))[0];
    if (already && !already.guest) throw new HttpError(409, "already_member");
    await ctx.db.query(
      `insert into party_members (party_id, user_id, response, guest, invited_by, may_bring_crew) values ($1, $2, 'invited', true, $3, $4)
       on conflict (party_id, user_id) do update set may_bring_crew = party_members.may_bring_crew or excluded.may_bring_crew`,
      [party.id, input.userId, user.id, input.withCrew],
    );
    await ctx.db.query("delete from party_join_requests where party_id = $1 and user_id = $2", [party.id, input.userId]);
    // push: party.guestInvite
    ctx.live.notify([input.userId], { type: "invites.changed" });
    return reply.status(201).send({ ok: true });
  });

  /** COM-05: a guest invited "with their crew" brings one of their crews; everyone in it is invited. */
  app.post<{ Params: { id: string } }>("/v1/parties/:id/bring-crew", async (request) => {
    const user = requireUser(request);
    invites.check(user.id);
    const party = await loadPartyForMember(ctx, uuid.parse(request.params.id), user.id);
    if (!notOver(party, ctx.now())) throw new HttpError(409, "party_closed");
    const me = (await ctx.db.query<{ guest: boolean; may_bring_crew: boolean }>("select guest, may_bring_crew from party_members where party_id = $1 and user_id = $2", [party.id, user.id]))[0];
    if (!me?.guest || !me.may_bring_crew) throw new HttpError(403, "forbidden");
    const { crewId } = z.object({ crewId: uuid }).parse(request.body);
    await assertCrewMember(ctx, crewId, user.id);
    if (crewId === party.crew_id) throw new HttpError(400, "invalid");
    const members = await ctx.db.query<{ user_id: string }>(
      `select m.user_id from crew_members m where m.crew_id = $1 and m.user_id <> $2
         and not exists (select 1 from blocks b where (b.blocker = $3 and b.blocked = m.user_id) or (b.blocker = m.user_id and b.blocked = $3))`,
      [crewId, user.id, party.created_by],
    );
    for (const m of members) {
      await ctx.db.query(
        "insert into party_members (party_id, user_id, response, guest, invited_by) values ($1, $2, 'invited', true, $3) on conflict (party_id, user_id) do nothing",
        [party.id, m.user_id, user.id],
      );
    }
    // One crew per invitation: the offer is used.
    await ctx.db.query("update party_members set may_bring_crew = false where party_id = $1 and user_id = $2", [party.id, user.id]);
    // push: party.guestInvite
    ctx.live.notify(
      members.map((m) => m.user_id),
      { type: "invites.changed" },
    );
    ctx.live.notify(await partyAudience(ctx, party), { type: "party.changed", partyId: party.id });
    return { invited: members.length };
  });

  /** COM-05: the hosts open the party at one of the crew's venues (null closes it again). */
  app.put<{ Params: { id: string } }>("/v1/parties/:id/open", async (request) => {
    const user = requireUser(request);
    const party = await loadPartyForMember(ctx, uuid.parse(request.params.id), user.id);
    await assertHost(ctx, party, user.id);
    const { venueId } = z.object({ venueId: uuid.nullable() }).parse(request.body);
    if (venueId !== null) {
      if (!notOver(party, ctx.now())) throw new HttpError(409, "party_closed");
      // A home is never public (TER-07): only a real venue of this crew.
      const venue = await ctx.db.query("select 1 from venues where id = $1 and crew_id = $2 and kind <> 'home'", [venueId, party.crew_id]);
      if (!venue.length) throw new HttpError(404, "not_found");
    }
    await ctx.db.query("update parties set open_venue_id = $2 where id = $1", [party.id, venueId]);
    ctx.live.notify(await partyAudience(ctx, party), { type: "party.changed", partyId: party.id });
    return { openVenueId: venueId };
  });

  /** COM-05: open parties at a place, on its public page. What I see of each and where my request stands. */
  app.get<{ Params: { id: string } }>("/v1/places/:id/open-parties", async (request) => {
    const user = requireUser(request);
    const { ids } = await placeOf(ctx, request.params.id);
    const now = ctx.now();
    const rows = await ctx.db.query<{
      id: string;
      crew_id: string;
      name: string;
      mood: string;
      kind: string;
      starts_at: number;
      ends_at: number;
      host: string;
      going: number;
      member: boolean;
      request: string | null;
    }>(
      `select p.id, p.crew_id, p.name, p.mood, p.kind, p.starts_at, p.ends_at, u.display_name as host,
              (select count(*)::int from party_members g where g.party_id = p.id and g.response = 'going') as going,
              (exists (select 1 from crew_members c where c.crew_id = p.crew_id and c.user_id = $2)
                or exists (select 1 from party_members g where g.party_id = p.id and g.user_id = $2)) as member,
              (select r.status from party_join_requests r where r.party_id = p.id and r.user_id = $2) as request
       from parties p join users u on u.id = p.created_by
       where p.open_venue_id = any($1::uuid[]) and p.closed_at is null and p.ends_at > $3
         and not exists (select 1 from blocks b where (b.blocker = p.created_by and b.blocked = $2) or (b.blocker = $2 and b.blocked = p.created_by))
       order by p.starts_at limit 10`,
      [ids, user.id, now],
    );
    return {
      parties: rows.map((r) => ({
        id: r.id,
        name: r.name,
        mood: r.mood,
        kind: r.kind,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        host: r.host,
        going: r.going,
        mine: r.member ? "member" : (r.request as "pending" | "approved" | "refused" | null),
      })),
    };
  });

  /** COM-05: ask to join an open party. The hosts approve or refuse; a refusal is final for that party. */
  app.post<{ Params: { id: string } }>("/v1/parties/:id/join-requests", async (request, reply) => {
    const user = requireUser(request);
    requests.check(user.id);
    const party = (await ctx.db.query<{ id: string; crew_id: string; created_by: string; closed_at: number | null; ends_at: number; open_venue_id: string | null }>(
      "select id, crew_id, created_by, closed_at, ends_at, open_venue_id from parties where id = $1",
      [uuid.parse(request.params.id)],
    ))[0];
    if (!party?.open_venue_id || (await blockedBetween(ctx, party.created_by, user.id))) throw new HttpError(404, "not_found");
    if (!notOver(party, ctx.now())) throw new HttpError(409, "party_closed");
    const inCrew = await ctx.db.query("select 1 from crew_members where crew_id = $1 and user_id = $2", [party.crew_id, user.id]);
    const inParty = await ctx.db.query("select 1 from party_members where party_id = $1 and user_id = $2", [party.id, user.id]);
    if (inCrew.length || inParty.length) throw new HttpError(409, "already_member");
    const previous = (await ctx.db.query<{ status: string }>("select status from party_join_requests where party_id = $1 and user_id = $2", [party.id, user.id]))[0];
    if (previous?.status === "refused") throw new HttpError(409, "refused");
    await ctx.db.query(
      "insert into party_join_requests (party_id, user_id, status, at) values ($1, $2, 'pending', $3) on conflict (party_id, user_id) do update set status = 'pending', at = $3",
      [party.id, user.id, ctx.now()],
    );
    // push: party.joinRequest
    ctx.live.notify(await hostsOf(ctx, party), { type: "invites.changed" });
    return reply.status(201).send({ status: "pending" });
  });

  app.delete<{ Params: { id: string } }>("/v1/parties/:id/join-requests/me", async (request, reply) => {
    const user = requireUser(request);
    const party = (await ctx.db.query<{ crew_id: string; created_by: string }>("select crew_id, created_by from parties where id = $1", [uuid.parse(request.params.id)]))[0];
    await ctx.db.query("delete from party_join_requests where party_id = $1 and user_id = $2 and status = 'pending'", [request.params.id, user.id]);
    if (party) ctx.live.notify(await hostsOf(ctx, party), { type: "invites.changed" });
    return reply.status(204).send();
  });

  /** The hosts' queue of requests for one party. */
  app.get<{ Params: { id: string } }>("/v1/parties/:id/join-requests", async (request) => {
    const user = requireUser(request);
    const party = await loadPartyForMember(ctx, uuid.parse(request.params.id), user.id);
    await assertHost(ctx, party, user.id);
    const rows = await ctx.db.query<{ user_id: string; display_name: string; at: number }>(
      "select r.user_id, u.display_name, r.at from party_join_requests r join users u on u.id = r.user_id where r.party_id = $1 and r.status = 'pending' order by r.at",
      [party.id],
    );
    return { requests: rows.map((r) => ({ userId: r.user_id, name: r.display_name, at: r.at })) };
  });

  /** COM-05: approved people become party members, going; refused ones cannot ask again. */
  app.post<{ Params: { id: string; userId: string } }>("/v1/parties/:id/join-requests/:userId", async (request) => {
    const user = requireUser(request);
    const party = await loadPartyForMember(ctx, uuid.parse(request.params.id), user.id);
    await assertHost(ctx, party, user.id);
    const requester = uuid.parse(request.params.userId);
    const { approve } = z.object({ approve: z.boolean() }).parse(request.body);
    const pending = await ctx.db.query("select 1 from party_join_requests where party_id = $1 and user_id = $2 and status = 'pending'", [party.id, requester]);
    if (!pending.length) throw new HttpError(404, "not_found");
    if (approve && !notOver(party, ctx.now())) throw new HttpError(409, "party_closed");
    await ctx.db.transaction(async (tx) => {
      await tx.query("update party_join_requests set status = $3, decided_by = $4, at = $5 where party_id = $1 and user_id = $2", [
        party.id,
        requester,
        approve ? "approved" : "refused",
        user.id,
        ctx.now(),
      ]);
      if (approve) {
        await tx.query(
          `insert into party_members (party_id, user_id, response, guest, invited_by) values ($1, $2, 'going', true, $3)
           on conflict (party_id, user_id) do update set response = 'going'`,
          [party.id, requester, user.id],
        );
      }
    });
    // push: party.joinDecision
    ctx.live.notify([requester], { type: "invites.changed" });
    ctx.live.notify(await hostsOf(ctx, party), { type: "invites.changed" });
    if (approve) ctx.live.notify(await partyAudience(ctx, party), { type: "party.changed", partyId: party.id });
    return { status: approve ? "approved" : "refused" };
  });

  /**
   * O-36: everything waiting for my answer, for the Crew tab badge: party invitations, friend
   * requests and join requests on parties I host. Feed mentions come along for the feed marker (N-31).
   */
  app.get("/v1/invitations", async (request) => {
    const user = requireUser(request);
    const now = ctx.now();
    const partyInvites = (
      await ctx.db.query<{ n: number }>(
        `select count(*)::int as n from party_members m join parties p on p.id = m.party_id
         where m.user_id = $1 and m.response = 'invited' and p.closed_at is null and p.ends_at > $2`,
        [user.id, now],
      )
    )[0]!.n;
    const friendRequests = (
      await ctx.db.query<{ n: number }>(
        "select count(*)::int as n from friendships where (user_a = $1 or user_b = $1) and status = 'pending' and requested_by <> $1",
        [user.id],
      )
    )[0]!.n;
    const joinRequests = await ctx.db.query<{ party_id: string; party_name: string; mood: string; user_id: string; display_name: string; at: number }>(
      `select r.party_id, p.name as party_name, p.mood, r.user_id, u.display_name, r.at
       from party_join_requests r join parties p on p.id = r.party_id join users u on u.id = r.user_id
       where r.status = 'pending' and p.closed_at is null and p.ends_at > $2
         and (p.created_by = $1 or exists (select 1 from crew_members c where c.crew_id = p.crew_id and c.user_id = $1 and c.role = 'admin'))
       order by r.at`,
      [user.id, now],
    );
    const mentions = await ctx.db.query<{ crew_id: string; n: number }>(
      `select c.crew_id, count(*)::int as n from feed_mentions m join feed_comments c on c.id = m.comment_id
       join crew_members cm on cm.crew_id = c.crew_id and cm.user_id = m.user_id
       where m.user_id = $1 and m.seen_at is null group by c.crew_id`,
      [user.id],
    );
    return {
      partyInvites,
      friendRequests,
      joinRequests: joinRequests.map((r) => ({ partyId: r.party_id, partyName: r.party_name, mood: r.mood, userId: r.user_id, name: r.display_name, at: r.at })),
      mentions: Object.fromEntries(mentions.map((m) => [m.crew_id, m.n])),
      total: partyInvites + friendRequests + joinRequests.length,
    };
  });
}
