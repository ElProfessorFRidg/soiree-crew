import type { FastifyInstance } from "fastify";
import { assertCrewMember, HttpError, requireUser, type Context } from "../context";
import { newCode, newId } from "../crypto";
import { crewSchema } from "../schemas";
import { invitePage, pickLanguage } from "../invitePage";

const INVITE_TTL_MS = 7 * 24 * 3_600_000;

export function crewRoutes(app: FastifyInstance, ctx: Context): void {
  app.post("/v1/crews", async (request, reply) => {
    const user = requireUser(request);
    const input = crewSchema.parse(request.body);
    const id = newId();
    const now = ctx.now();
    await ctx.db.transaction(async (tx) => {
      await tx.query("insert into crews (id, name, created_by, created_at) values ($1, $2, $3, $4)", [id, input.name, user.id, now]);
      await tx.query("insert into crew_members (crew_id, user_id, role, joined_at) values ($1, $2, 'admin', $3)", [id, user.id, now]);
    });
    return reply.status(201).send({ crew: { id, name: input.name, role: "admin" } });
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
      leaderboard_opt_out: boolean;
      territory_opt_out: boolean;
    }>(
      `select c.id, c.name, m.role, c.leaderboard_enabled, c.ai_enabled, m.leaderboard_opt_out, m.territory_opt_out
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

  app.post<{ Params: { code: string } }>("/v1/invites/:code/accept", async (request) => {
    const user = requireUser(request);
    const rows = await ctx.db.query<{ crew_id: string; expires_at: number }>("select crew_id, expires_at from crew_invites where code = $1", [
      request.params.code.toUpperCase(),
    ]);
    const invite = rows[0];
    if (!invite || invite.expires_at < ctx.now()) throw new HttpError(404, "not_found");
    await ctx.db.query(
      "insert into crew_members (crew_id, user_id, role, joined_at) values ($1, $2, 'member', $3) on conflict do nothing",
      [invite.crew_id, user.id, ctx.now()],
    );
    await ctx.db.query("update crew_invites set uses = uses + 1 where code = $1", [request.params.code.toUpperCase()]);
    const members = await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1", [invite.crew_id]);
    ctx.live.notify(members.map((m) => m.user_id), { type: "crew.changed", crewId: invite.crew_id });
    return { crewId: invite.crew_id };
  });

  app.delete<{ Params: { id: string } }>("/v1/crews/:id/members/me", async (request, reply) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    await ctx.db.query("delete from crew_members where crew_id = $1 and user_id = $2", [request.params.id, user.id]);
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
