import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertCrewMember, HttpError, requireUser, type Context } from "../context";
import { RateLimiter } from "../ratelimit";
import { updateBoss } from "../territory";
import { placeOwner } from "./claims";
import { placeOf } from "./community";

const uuid = z.string().uuid();

interface VenueRow {
  id: string;
  crew_id: string;
  kind: string;
}

async function venueOf(ctx: Context, venueId: string): Promise<VenueRow> {
  const venue = (await ctx.db.query<VenueRow>("select id, crew_id, kind from venues where id = $1", [uuid.parse(venueId)]))[0];
  if (!venue) throw new HttpError(404, "not_found");
  return venue;
}

/** COM-11: the approved owner of the place this venue belongs to, if any. Homes have none. */
async function ownerOfVenue(ctx: Context, venue: VenueRow): Promise<string | null> {
  if (venue.kind === "home") return null;
  return placeOwner(ctx, (await placeOf(ctx, venue.id)).ids);
}

/** Who may decide on a staff claim at this venue: the crew's admins, or the venue's owner when claimed. */
async function canDecide(ctx: Context, venue: VenueRow, userId: string): Promise<boolean> {
  const role = (await ctx.db.query<{ role: string }>("select role from crew_members where crew_id = $1 and user_id = $2", [venue.crew_id, userId]))[0]?.role;
  if (role === "admin") return true;
  return (await ownerOfVenue(ctx, venue)) === userId;
}

async function deciders(ctx: Context, venue: VenueRow): Promise<string[]> {
  const admins = await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1 and role = 'admin'", [venue.crew_id]);
  const owner = await ownerOfVenue(ctx, venue);
  return [...new Set([...admins.map((a) => a.user_id), ...(owner ? [owner] : [])])];
}

async function notifyCrew(ctx: Context, crewId: string): Promise<void> {
  const members = await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1", [crewId]);
  ctx.live.notify(members.map((m) => m.user_id), { type: "crew.changed", crewId });
}

interface RequestRow {
  venue_id: string;
  venue_name: string;
  user_id: string;
  name: string;
  requested_by: string | null;
  requester_name: string | null;
  requested_at: number | null;
}

const requestView = (r: RequestRow) => ({
  venueId: r.venue_id,
  venue: r.venue_name,
  userId: r.user_id,
  name: r.name,
  suggestedBy: r.requested_by && r.requested_by !== r.user_id ? r.requester_name : null,
  at: r.requested_at,
});

const PENDING_SELECT = `select e.venue_id, v.name as venue_name, e.user_id, u.display_name as name, e.requested_by, q.display_name as requester_name, e.requested_at
  from workplace_exclusions e join venues v on v.id = e.venue_id join users u on u.id = e.user_id left join users q on q.id = e.requested_by
  where e.status = 'pending'`;

/**
 * TER-11, territories.md case D: a member says "I work here" (or a crew mate suggests it); the
 * claim waits for a crew admin, or the venue's owner when the page is claimed. Only an approved
 * claim takes the member's territory points there to zero and keeps them out of its regulars.
 */
export function workplaceRoutes(app: FastifyInstance, ctx: Context): void {
  const asks = new RateLimiter(20, 24 * 3_600_000, ctx.now);

  app.get<{ Params: { id: string } }>("/v1/venues/:id/workplace", async (request) => {
    const user = requireUser(request);
    const venue = await venueOf(ctx, request.params.id);
    await assertCrewMember(ctx, venue.crew_id, user.id);
    const rows = await ctx.db.query<{ user_id: string; name: string; status: string }>(
      "select e.user_id, u.display_name as name, e.status from workplace_exclusions e join users u on u.id = e.user_id where e.venue_id = $1 and e.status <> 'rejected'",
      [venue.id],
    );
    const decide = await canDecide(ctx, venue, user.id);
    const mine = (await ctx.db.query<{ status: string }>("select status from workplace_exclusions where venue_id = $1 and user_id = $2", [venue.id, user.id]))[0];
    return {
      mine: mine?.status ?? null,
      staff: rows.filter((r) => r.status === "approved").map((r) => ({ userId: r.user_id, name: r.name })),
      pending: decide ? (await ctx.db.query<RequestRow>(`${PENDING_SELECT} and e.venue_id = $1 order by e.requested_at`, [venue.id])).map(requestView) : [],
      canDecide: decide,
    };
  });

  /** A claim for myself, or a suggestion about a crew mate. An admin's own claim needs nobody else. */
  app.post<{ Params: { id: string } }>("/v1/venues/:id/workplace", async (request, reply) => {
    const user = requireUser(request);
    asks.check(user.id);
    const venue = await venueOf(ctx, request.params.id);
    await assertCrewMember(ctx, venue.crew_id, user.id);
    const { userId } = z.object({ userId: uuid.optional() }).parse(request.body ?? {});
    const subject = userId ?? user.id;
    if (subject !== user.id) await assertCrewMember(ctx, venue.crew_id, subject);
    const existing = (await ctx.db.query<{ status: string }>("select status from workplace_exclusions where venue_id = $1 and user_id = $2", [venue.id, subject]))[0];
    if (existing?.status === "approved") return reply.status(200).send({ status: "approved" });
    // Taking one's own points to zero needs no second opinion when one already holds the decision.
    const status = subject === user.id && (await canDecide(ctx, venue, user.id)) ? "approved" : "pending";
    const now = ctx.now();
    await ctx.db.query(
      `insert into workplace_exclusions (venue_id, user_id, status, requested_by, requested_at) values ($1, $2, $3, $4, $5)
       on conflict (venue_id, user_id) do update set status = excluded.status, requested_by = excluded.requested_by, requested_at = excluded.requested_at, decided_by = null, decided_at = null`,
      [venue.id, subject, status, user.id, now],
    );
    if (status === "approved") {
      await updateBoss(ctx, venue.crew_id, venue.id);
      await notifyCrew(ctx, venue.crew_id);
    } else {
      // push: workplace.request
      ctx.live.notify(await deciders(ctx, venue), { type: "crew.changed", crewId: venue.crew_id });
    }
    return reply.status(201).send({ status });
  });

  /** The member takes back a claim still waiting. An approved one is undone by a decider only. */
  app.delete<{ Params: { id: string } }>("/v1/venues/:id/workplace", async (request, reply) => {
    const user = requireUser(request);
    const venue = await venueOf(ctx, request.params.id);
    await ctx.db.query("delete from workplace_exclusions where venue_id = $1 and user_id = $2 and status = 'pending'", [venue.id, user.id]);
    return reply.status(204).send();
  });

  app.post<{ Params: { id: string; userId: string } }>("/v1/venues/:id/workplace/:userId", async (request) => {
    const user = requireUser(request);
    const venue = await venueOf(ctx, request.params.id);
    if (!(await canDecide(ctx, venue, user.id))) throw new HttpError(403, "forbidden");
    const { decision } = z.object({ decision: z.enum(["approved", "rejected"]) }).parse(request.body);
    const rows = await ctx.db.query(
      "update workplace_exclusions set status = $3, decided_by = $4, decided_at = $5 where venue_id = $1 and user_id = $2 returning user_id",
      [venue.id, uuid.parse(request.params.userId), decision, user.id, ctx.now()],
    );
    if (!rows.length) throw new HttpError(404, "not_found");
    await updateBoss(ctx, venue.crew_id, venue.id);
    // push: workplace.decided
    await notifyCrew(ctx, venue.crew_id);
    return { ok: true };
  });

  /** For the crew admin's moderation screen: every staff claim waiting in the crew. */
  app.get<{ Params: { id: string } }>("/v1/crews/:id/workplace-requests", async (request) => {
    const user = requireUser(request);
    const { role } = await assertCrewMember(ctx, request.params.id, user.id);
    if (role !== "admin") throw new HttpError(403, "forbidden");
    const rows = await ctx.db.query<RequestRow>(`${PENDING_SELECT} and v.crew_id = $1 order by e.requested_at`, [request.params.id]);
    return { requests: rows.map(requestView) };
  });

  /** For the venue's owner (COM-11): claims waiting at this place, whichever crew pinned it. */
  app.get<{ Params: { id: string } }>("/v1/places/:id/workplace-requests", async (request) => {
    const user = requireUser(request);
    const { ids } = await placeOf(ctx, request.params.id);
    if ((await placeOwner(ctx, ids)) !== user.id) throw new HttpError(403, "not_owner");
    const rows = await ctx.db.query<RequestRow>(`${PENDING_SELECT} and e.venue_id = any($1::uuid[]) order by e.requested_at`, [ids]);
    return { requests: rows.map(requestView) };
  });
}
