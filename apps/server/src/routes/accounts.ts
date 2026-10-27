import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser, HttpError, type Context } from "../context";
import { hashToken, newCode, newId, newToken } from "../crypto";
import { accountSchema } from "../schemas";

const TRANSFER_TTL_MS = 10 * 60_000;

async function createSession(ctx: Context, userId: string, deviceLabel: string): Promise<string> {
  const token = newToken();
  const now = ctx.now();
  await ctx.db.query(
    "insert into sessions (token_hash, user_id, device_label, created_at, last_seen_at) values ($1, $2, $3, $4, $4)",
    [hashToken(token), userId, deviceLabel, now],
  );
  return token;
}

export function accountRoutes(app: FastifyInstance, ctx: Context): void {
  app.post("/v1/accounts", async (request, reply) => {
    const input = accountSchema.parse(request.body);
    const taken = await ctx.db.query("select 1 from users where username = $1", [input.username]);
    if (taken.length) throw new HttpError(409, "username_taken");
    const id = newId();
    await ctx.db.query("insert into users (id, username, display_name, created_at) values ($1, $2, $3, $4)", [
      id,
      input.username,
      input.displayName,
      ctx.now(),
    ]);
    const token = await createSession(ctx, id, input.deviceLabel ?? "");
    return reply.status(201).send({ user: { id, username: input.username, displayName: input.displayName }, token });
  });

  app.get("/v1/me", async (request) => {
    const user = requireUser(request);
    return { user };
  });

  app.patch("/v1/me", async (request) => {
    const user = requireUser(request);
    const input = z.object({ displayName: z.string().trim().min(1).max(40) }).parse(request.body);
    await ctx.db.query("update users set display_name = $1 where id = $2", [input.displayName, user.id]);
    return { user: { ...user, displayName: input.displayName } };
  });

  /** One-time code shown on the first phone to sign in on another one. */
  app.post("/v1/sessions/transfer-code", async (request) => {
    const user = requireUser(request);
    const code = newCode();
    const expiresAt = ctx.now() + TRANSFER_TTL_MS;
    await ctx.db.query("delete from transfer_codes where user_id = $1", [user.id]);
    await ctx.db.query("insert into transfer_codes (code_hash, user_id, expires_at) values ($1, $2, $3)", [hashToken(code), user.id, expiresAt]);
    return { code, expiresAt };
  });

  app.post("/v1/sessions/claim", async (request, reply) => {
    const input = z.object({ code: z.string().trim().toUpperCase().length(10), deviceLabel: z.string().max(60).optional() }).parse(request.body);
    const rows = await ctx.db.query<{ user_id: string; expires_at: number }>(
      "delete from transfer_codes where code_hash = $1 returning user_id, expires_at",
      [hashToken(input.code)],
    );
    const row = rows[0];
    if (!row || row.expires_at < ctx.now()) throw new HttpError(400, "code_invalid");
    const users = await ctx.db.query<{ id: string; username: string; display_name: string }>(
      "select id, username, display_name from users where id = $1",
      [row.user_id],
    );
    const user = users[0]!;
    const token = await createSession(ctx, user.id, input.deviceLabel ?? "");
    return reply.status(201).send({ user: { id: user.id, username: user.username, displayName: user.display_name }, token });
  });

  app.get("/v1/sessions", async (request) => {
    const user = requireUser(request);
    const rows = await ctx.db.query<{ token_hash: string; device_label: string; created_at: number; last_seen_at: number }>(
      "select token_hash, device_label, created_at, last_seen_at from sessions where user_id = $1 order by last_seen_at desc",
      [user.id],
    );
    // The hash prefix identifies a session for sign-out without exposing the token.
    return { sessions: rows.map((r) => ({ id: r.token_hash.slice(0, 16), deviceLabel: r.device_label, createdAt: r.created_at, lastSeenAt: r.last_seen_at })) };
  });

  app.delete<{ Params: { id: string } }>("/v1/sessions/:id", async (request, reply) => {
    const user = requireUser(request);
    await ctx.db.query("delete from sessions where user_id = $1 and token_hash like $2", [user.id, `${request.params.id}%`]);
    return reply.status(204).send();
  });

  /** O-07: erases everything about the account. Crews it created stay for the others. */
  app.delete("/v1/me", async (request, reply) => {
    const user = requireUser(request);
    await ctx.db.transaction(async (tx) => {
      // Crews and parties nobody else is in go with the account; the others get a new owner.
      await tx.query(
        "delete from crews where created_by = $1 and not exists (select 1 from crew_members m where m.crew_id = crews.id and m.user_id <> $1)",
        [user.id],
      );
      await tx.query(
        "update crews set created_by = (select m.user_id from crew_members m where m.crew_id = crews.id and m.user_id <> $1 order by m.joined_at limit 1) where created_by = $1",
        [user.id],
      );
      await tx.query(
        "delete from parties where created_by = $1 and not exists (select 1 from party_members m where m.party_id = parties.id and m.user_id <> $1)",
        [user.id],
      );
      await tx.query(
        "update parties set created_by = (select m.user_id from party_members m where m.party_id = parties.id and m.user_id <> $1 limit 1) where created_by = $1",
        [user.id],
      );
      await tx.query("delete from crew_invites where created_by = $1", [user.id]);
      await tx.query("delete from users where id = $1", [user.id]);
    });
    return reply.status(204).send();
  });
}
