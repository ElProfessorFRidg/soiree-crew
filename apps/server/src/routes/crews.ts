import { unlink } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { crewTimeZone } from "../territory";
import { offsetMinutes } from "../time";
import { photoPath } from "./photos";
import { assertCrewMember, HttpError, requireUser, type Context } from "../context";
import { newCode, newId } from "../crypto";
import { crewSchema } from "../schemas";
import { invitePage, pickLanguage } from "../invitePage";
import { RateLimiter } from "../ratelimit";

const INVITE_TTL_MS = 7 * 24 * 3_600_000;
const DAY_MS = 86_400_000;
/** QOL-16: habits come from this many of the last nights, and need at least this many. */
const HABIT_NIGHTS = 10;
const HABIT_MIN_NIGHTS = 2;

export function crewRoutes(app: FastifyInstance, ctx: Context): void {
  const joins = new RateLimiter(20, 60 * 60_000, ctx.now);
  // An invite code is 8 characters: guessing needs volume, so every lookup counts per address.
  const inviteLookups = new RateLimiter(30, 10 * 60_000, ctx.now);
  app.post("/v1/crews", async (request, reply) => {
    const user = requireUser(request);
    const input = crewSchema.parse(request.body);
    const id = newId();
    const now = ctx.now();
    await ctx.db.transaction(async (tx) => {
      await tx.query("insert into crews (id, name, created_by, created_at, kind) values ($1, $2, $3, $4, $5)", [id, input.name, user.id, now, input.kind]);
      await tx.query("insert into crew_members (crew_id, user_id, role, joined_at) values ($1, $2, 'admin', $3)", [id, user.id, now]);
    });
    return reply.status(201).send({ crew: { id, name: input.name, role: "admin", kind: input.kind } });
  });

  /** My crews and their members. Members see each other's display name and username only (SEC-01). */
  app.get("/v1/crews", async (request) => {
    const user = requireUser(request);
    const crews = await ctx.db.query<{
      id: string;
      name: string;
      role: string;
      leaderboard_enabled: boolean;
      ai_enabled: boolean;
      public_name: boolean;
      kind: string;
      open: boolean;
      description: string;
      leaderboard_opt_out: boolean;
      territory_opt_out: boolean;
    }>(
      `select c.id, c.name, m.role, c.leaderboard_enabled, c.ai_enabled, c.public_name, c.kind, c.open, c.description, m.leaderboard_opt_out, m.territory_opt_out
       from crews c join crew_members m on m.crew_id = c.id where m.user_id = $1 order by c.created_at`,
      [user.id],
    );
    const members = crews.length
      ? await ctx.db.query<{ crew_id: string; user_id: string; username: string; display_name: string; role: string; nickname: string | null }>(
          `select m.crew_id, m.user_id, u.username, u.display_name, m.role, m.nickname
           from crew_members m join users u on u.id = m.user_id
           where m.crew_id = any($1::uuid[]) order by m.joined_at`,
          [crews.map((c) => c.id)],
        )
      : [];
    return {
      crews: crews.map((crew) => ({
        id: crew.id,
        name: crew.name,
        role: crew.role,
        leaderboardEnabled: crew.leaderboard_enabled,
        aiEnabled: crew.ai_enabled,
        aiAvailable: Boolean(ctx.ai) && crew.ai_enabled,
        publicName: crew.public_name,
        kind: crew.kind,
        open: crew.open,
        description: crew.description,
        // My own participation (RANK-08, TER-07): only ever sent to me.
        me: { leaderboardOptOut: crew.leaderboard_opt_out, territoryOptOut: crew.territory_opt_out },
        members: members
          .filter((m) => m.crew_id === crew.id)
          .map((m) => ({ id: m.user_id, username: m.username, displayName: m.display_name, nickname: m.nickname, role: m.role })),
      })),
    };
  });

  app.post<{ Params: { id: string } }>("/v1/crews/:id/invites", async (request, reply) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const code = newCode(8);
    const expiresAt = ctx.now() + INVITE_TTL_MS;
    await ctx.db.query("insert into crew_invites (code, crew_id, created_by, expires_at) values ($1, $2, $3, $4)", [
      code,
      request.params.id,
      user.id,
      expiresAt,
    ]);
    return reply.status(201).send({ code, expiresAt, url: `${ctx.publicUrl}/i/${code}` });
  });

  /** Public preview of an invite for the web page (N-30): crew name and member count, nothing else. */
  app.get<{ Params: { code: string } }>("/v1/invites/:code", async (request) => {
    inviteLookups.check(request.ip);
    const rows = await ctx.db.query<{ name: string; members: number; expires_at: number }>(
      `select c.name, (select count(*)::int from crew_members m where m.crew_id = c.id) as members, i.expires_at
       from crew_invites i join crews c on c.id = i.crew_id where i.code = $1`,
      [request.params.code.toUpperCase()],
    );
    const row = rows[0];
    if (!row || row.expires_at < ctx.now()) throw new HttpError(404, "not_found");
    return { crew: { name: row.name, members: row.members }, expiresAt: row.expires_at };
  });

  /** The link people share (N-30, QOL-05): a small page that opens the app on the invite. */
  app.get<{ Params: { code: string } }>("/i/:code", async (request, reply) => {
    inviteLookups.check(request.ip);
    const code = request.params.code.toUpperCase();
    const rows = await ctx.db.query<{ name: string; members: number; expires_at: number }>(
      `select c.name, (select count(*)::int from crew_members m where m.crew_id = c.id) as members, i.expires_at
       from crew_invites i join crews c on c.id = i.crew_id where i.code = $1`,
      [code],
    );
    const row = rows[0];
    const language = pickLanguage(request.headers["accept-language"]);
    const valid = row && row.expires_at >= ctx.now();
    return reply
      .status(valid ? 200 : 404)
      .header("content-type", "text/html; charset=utf-8")
      .header("cache-control", "no-store")
      .send(invitePage(language, valid ? { code, crewName: row.name, members: row.members, serverUrl: ctx.publicUrl } : null));
  });

  /** Open crews on this server that I am not in yet, by name. Members are not listed, only how many. */
  app.get<{ Querystring: { q?: string } }>("/v1/crews/open", async (request) => {
    const user = requireUser(request);
    const q = z.string().trim().max(40).parse(request.query.q ?? "");
    const rows = await ctx.db.query<{ id: string; name: string; kind: string; description: string; members: number }>(
      `select c.id, c.name, c.kind, c.description, (select count(*)::int from crew_members m where m.crew_id = c.id) as members
       from crews c where c.open and not exists (select 1 from crew_members m where m.crew_id = c.id and m.user_id = $1)
         and ($2 = '' or c.name ilike '%' || $2 || '%')
       order by members desc, c.created_at limit 30`,
      [user.id, q],
    );
    return { crews: rows };
  });

  /** Joining an open crew needs no invite; a closed one answers 404, like any id I may not see. */
  app.post<{ Params: { id: string } }>("/v1/crews/:id/join", async (request) => {
    const user = requireUser(request);
    joins.check(user.id);
    const crew = (await ctx.db.query<{ open: boolean }>("select open from crews where id = $1", [z.string().uuid().parse(request.params.id)]))[0];
    if (!crew?.open) throw new HttpError(404, "not_found");
    await ctx.db.query("insert into crew_members (crew_id, user_id, role, joined_at, via_open) values ($1, $2, 'member', $3, true) on conflict do nothing", [
      request.params.id,
      user.id,
      ctx.now(),
    ]);
    const members = await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1", [request.params.id]);
    ctx.live.notify(members.map((m) => m.user_id), { type: "crew.changed", crewId: request.params.id });
    return { crewId: request.params.id };
  });

  app.post<{ Params: { code: string } }>("/v1/invites/:code/accept", async (request) => {
    const user = requireUser(request);
    // Per account, not per address: a whole bar on one wifi joins with the same link.
    joins.check(user.id);
    const rows = await ctx.db.query<{ crew_id: string; expires_at: number }>("select crew_id, expires_at from crew_invites where code = $1", [
      request.params.code.toUpperCase(),
    ]);
    const invite = rows[0];
    if (!invite || invite.expires_at < ctx.now()) throw new HttpError(404, "not_found");
    await ctx.db.query(
      // An invite vouches for the person, even if they first walked in through the open crew.
      "insert into crew_members (crew_id, user_id, role, joined_at) values ($1, $2, 'member', $3) on conflict (crew_id, user_id) do update set via_open = false",
      [invite.crew_id, user.id, ctx.now()],
    );
    await ctx.db.query("update crew_invites set uses = uses + 1 where code = $1", [request.params.code.toUpperCase()]);
    const members = await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1", [invite.crew_id]);
    ctx.live.notify(members.map((m) => m.user_id), { type: "crew.changed", crewId: invite.crew_id });
    return { crewId: invite.crew_id };
  });

  /** ADP-06: an admin deletes the whole crew, its nights, albums and chats with it. */
  app.delete<{ Params: { id: string } }>("/v1/crews/:id", async (request, reply) => {
    const user = requireUser(request);
    const { role } = await assertCrewMember(ctx, request.params.id, user.id);
    if (role !== "admin") throw new HttpError(403, "forbidden");
    const members = await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1", [request.params.id]);
    const photos = await ctx.db.query<{ id: string }>("select ph.id from photos ph join parties p on p.id = ph.party_id where p.crew_id = $1", [request.params.id]);
    await ctx.db.query("delete from crews where id = $1", [request.params.id]);
    // The files sit next to the database: they go once the rows are gone.
    for (const photo of photos) await unlink(photoPath(ctx, photo.id)).catch(() => undefined);
    ctx.live.notify(members.map((m) => m.user_id), { type: "crew.changed", crewId: request.params.id });
    ctx.live.notify(members.map((m) => m.user_id), { type: "chat.roster" });
    return reply.status(204).send();
  });

  /**
   * QOL-16: what this crew's nights usually look like, to prefill a new one: when they end, where
   * they happen, who comes. From the last nights I went to, so nothing here is new to me.
   */
  app.get<{ Params: { id: string } }>("/v1/crews/:id/habits", async (request) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const timeZone = await crewTimeZone(ctx.db, request.params.id);
    const parties = await ctx.db.query<{ id: string; starts_at: number; ends_at: number; closed_at: number | null }>(
      `select p.id, p.starts_at, p.ends_at, p.closed_at from parties p join party_members m on m.party_id = p.id and m.user_id = $2 and m.response = 'going'
       where p.crew_id = $1 and p.kind = 'party' and p.closed_at is not null order by p.starts_at desc limit $3`,
      [request.params.id, user.id, HABIT_NIGHTS],
    );
    if (parties.length < HABIT_MIN_NIGHTS) return { nights: parties.length, endMinutes: null, venue: null, friends: [] };
    const ends = parties
      .map((p) => {
        const offset = offsetMinutes(p.starts_at, timeZone) * 60_000;
        const midnight = Math.floor((p.starts_at + offset) / DAY_MS) * DAY_MS - offset;
        return Math.round((Math.min(p.closed_at ?? p.ends_at, p.ends_at) - midnight) / 60_000);
      })
      .sort((a, b) => a - b);
    // The median, rounded to the half hour the new-party screen steps by.
    const median = ends[Math.floor(ends.length / 2)]!;
    const ids = parties.map((p) => p.id);
    const venue = (
      await ctx.db.query<{ id: string; name: string; n: number }>(
        `select v.id, v.name, count(distinct c.party_id)::int as n from check_ins c join venues v on v.id = c.venue_id and v.crew_id = $2
         where c.party_id = any($1::uuid[]) and c.verdict = 'accepted' and c.private = false and v.kind <> 'home'
         group by v.id, v.name order by n desc, v.name limit 1`,
        [ids, request.params.id],
      )
    )[0];
    const regulars = await ctx.db.query<{ user_id: string; display_name: string; n: number }>(
      `select m.user_id, u.display_name, count(*)::int as n from party_members m join users u on u.id = m.user_id
       join crew_members c on c.user_id = m.user_id and c.crew_id = $2
       where m.party_id = any($1::uuid[]) and m.response = 'going' and m.user_id <> $3 and m.last_activity_at is not null
       group by m.user_id, u.display_name order by n desc, u.display_name`,
      [ids, request.params.id, user.id],
    );
    return {
      nights: parties.length,
      endMinutes: Math.round(median / 30) * 30,
      // A venue counts as usual from half the nights on; so do friends.
      venue: venue && venue.n * 2 >= parties.length ? { id: venue.id, name: venue.name } : null,
      friends: regulars.filter((r) => r.n * 2 >= parties.length).map((r) => ({ userId: r.user_id, name: r.display_name })),
    };
  });

  app.delete<{ Params: { id: string } }>("/v1/crews/:id/members/me", async (request, reply) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    await ctx.db.query("delete from crew_members where crew_id = $1 and user_id = $2", [request.params.id, user.id]);
    // Leaving the crew also leaves its live and coming nights, so their chats drop me (MSG-07).
    await ctx.db.query(
      "delete from party_members where user_id = $2 and party_id in (select id from parties where crew_id = $1 and closed_at is null and ends_at > $3)",
      [request.params.id, user.id, ctx.now()],
    );
    const remaining = await ctx.db.query<{ user_id: string; role: string }>("select user_id, role from crew_members where crew_id = $1 order by joined_at", [
      request.params.id,
    ]);
    if (remaining.length === 0) {
      await ctx.db.query("delete from crews where id = $1", [request.params.id]);
    } else if (!remaining.some((m) => m.role === "admin")) {
      // A crew always keeps an admin: the longest-standing member takes over.
      await ctx.db.query("update crew_members set role = 'admin' where crew_id = $1 and user_id = $2", [request.params.id, remaining[0]!.user_id]);
    }
    ctx.live.notify(remaining.map((m) => m.user_id), { type: "crew.changed", crewId: request.params.id });
    return reply.status(204).send();
  });
}
