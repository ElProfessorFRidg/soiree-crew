import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { bearer, requireUser, HttpError, type Context } from "../context";
import { DUMMY_PASSWORD_HASH, hashPassword, hashToken, newCode, newId, newToken, verifyPassword } from "../crypto";
import { RateLimiter } from "../ratelimit";
import { deletePhotoFiles } from "./photos";
import { accountSchema, passwordSchema } from "../schemas";

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
  // SEC-07: sign-up and sign-in are rate-limited per address. A transfer code has
  // 10 characters, so guessing one at 10 tries per 10 minutes goes nowhere.
  const signUps = new RateLimiter(10, 10 * 60_000, ctx.now);
  const claims = new RateLimiter(10, 10 * 60_000, ctx.now);
  // O-01: per address and per login, so spreading guesses over many addresses does not help either.
  const passwordTries = new RateLimiter(10, 10 * 60_000, ctx.now);
  const loginTries = new RateLimiter(5, 10 * 60_000, ctx.now);

  const saveCredentials = async (userId: string, email: string | null, password: string) => {
    if (email) {
      const owner = await ctx.db.query<{ user_id: string }>("select user_id from credentials where email_lookup = $1", [ctx.sealer.lookup(email)]);
      if (owner[0] && owner[0].user_id !== userId) throw new HttpError(409, "email_taken");
    }
    await ctx.db.query(
      `insert into credentials (user_id, email_lookup, email_sealed, password_hash, updated_at) values ($1, $2, $3, $4, $5)
       on conflict (user_id) do update set email_lookup = excluded.email_lookup, email_sealed = excluded.email_sealed,
         password_hash = excluded.password_hash, updated_at = excluded.updated_at`,
      [userId, email ? ctx.sealer.lookup(email) : null, email ? ctx.sealer.seal(email) : null, await hashPassword(password), ctx.now()],
    );
  };

  app.post("/v1/accounts", async (request, reply) => {
    signUps.check(request.ip);
    const input = accountSchema.parse(request.body);
    const taken = await ctx.db.query("select 1 from users where username = $1", [input.username]);
    if (taken.length) throw new HttpError(409, "username_taken");
    if (input.email) {
      const emailTaken = await ctx.db.query("select 1 from credentials where email_lookup = $1", [ctx.sealer.lookup(input.email)]);
      if (emailTaken.length) throw new HttpError(409, "email_taken");
    }
    const id = newId();
    await ctx.db.query("insert into users (id, username, display_name, created_at) values ($1, $2, $3, $4)", [
      id,
      input.username,
      input.displayName,
      ctx.now(),
    ]);
    if (input.email && input.password) await saveCredentials(id, input.email, input.password);
    const token = await createSession(ctx, id, input.deviceLabel ?? "");
    return reply.status(201).send({ user: { id, username: input.username, displayName: input.displayName }, token });
  });

  /** O-01: sign in with an email or a username and a password. Same answer for an unknown login and a wrong password. */
  app.post("/v1/sessions/password", async (request, reply) => {
    passwordTries.check(request.ip);
    const input = z
      .object({ login: z.string().trim().toLowerCase().min(3).max(254), password: z.string().min(1).max(200), deviceLabel: z.string().max(60).optional() })
      .parse(request.body);
    loginTries.check(input.login);
    const rows = await ctx.db.query<{ id: string; username: string; display_name: string; password_hash: string }>(
      `select u.id, u.username, u.display_name, c.password_hash from credentials c join users u on u.id = c.user_id
       where c.email_lookup = $1 or u.username = $2`,
      [ctx.sealer.lookup(input.login), input.login],
    );
    const user = rows[0];
    const ok = await verifyPassword(input.password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
    if (!user || !ok) throw new HttpError(401, "credentials_invalid");
    const token = await createSession(ctx, user.id, input.deviceLabel ?? "");
    ctx.live.notify([user.id], { type: "security.newDevice" });
    return reply.status(201).send({ user: { id: user.id, username: user.username, displayName: user.display_name }, token });
  });

  app.get("/v1/me/credentials", async (request) => {
    const user = requireUser(request);
    const row = (await ctx.db.query<{ email_sealed: string | null }>("select email_sealed from credentials where user_id = $1", [user.id]))[0];
    return { hasPassword: Boolean(row), email: row?.email_sealed ? ctx.sealer.open<string>(row.email_sealed) : null };
  });

  /** O-01: add or change the email and password. Changing them needs the current password. */
  app.put("/v1/me/credentials", async (request) => {
    const user = requireUser(request);
    const input = z
      .object({
        email: z.string().trim().toLowerCase().pipe(z.email().max(254)).nullable(),
        password: passwordSchema,
        currentPassword: z.string().max(200).optional(),
      })
      .parse(request.body);
    passwordTries.check(`me:${user.id}`);
    const existing = (await ctx.db.query<{ password_hash: string }>("select password_hash from credentials where user_id = $1", [user.id]))[0];
    if (existing && !(await verifyPassword(input.currentPassword ?? "", existing.password_hash))) throw new HttpError(403, "credentials_invalid");
    await saveCredentials(user.id, input.email, input.password);
    return { hasPassword: true, email: input.email };
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
    claims.check(request.ip);
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
    // SEC-07: the phones already signed in hear about the new one.
    ctx.live.notify([user.id], { type: "security.newDevice" });
    return reply.status(201).send({ user: { id: user.id, username: user.username, displayName: user.display_name }, token });
  });

  app.get("/v1/sessions", async (request) => {
    const user = requireUser(request);
    const rows = await ctx.db.query<{ token_hash: string; device_label: string; created_at: number; last_seen_at: number }>(
      "select token_hash, device_label, created_at, last_seen_at from sessions where user_id = $1 order by last_seen_at desc",
      [user.id],
    );
    const current = hashToken(bearer(request) ?? "");
    // The hash prefix identifies a session for sign-out without exposing the token.
    return {
      sessions: rows.map((r) => ({
        id: r.token_hash.slice(0, 16),
        deviceLabel: r.device_label,
        createdAt: r.created_at,
        lastSeenAt: r.last_seen_at,
        current: r.token_hash === current,
      })),
    };
  });

  /** Signing out ends the session on the server too, not only on the phone. */
  app.delete("/v1/sessions/current", async (request, reply) => {
    requireUser(request);
    await ctx.db.query("delete from sessions where token_hash = $1", [hashToken(bearer(request) ?? "")]);
    return reply.status(204).send();
  });

  /**
   * N-17, SEC-08: everything the server holds about me, decrypted, in one JSON
   * document. Other people's data only appears where it is part of mine (a crew name, a payer).
   */
  app.get("/v1/me/export", async (request) => {
    const user = requireUser(request);
    const one = async <T>(sql: string) => (await ctx.db.query<T>(sql, [user.id]))[0];
    const all = <T>(sql: string) => ctx.db.query<T>(sql, [user.id]);
    const open = <T>(sealed: string | null | undefined): T | null => (sealed ? ctx.sealer.open<T>(sealed) : null);

    const account = await one<{ id: string; username: string; display_name: string; created_at: number }>(
      "select id, username, display_name, created_at from users where id = $1",
    );
    const preferences = await one<{ data: string }>("select data from user_preferences where user_id = $1");
    const profile = await one<{ sealed: string }>("select sealed from body_profiles where user_id = $1");
    const payment = await one<{ sealed: string }>("select sealed from payment_details where user_id = $1");
    const drinks = await all<{ id: string; party_id: string | null; kind: string; preset_id: string; sealed: string; consumed_at: number; logged_at: number; verified: boolean; deleted_at: number | null }>(
      "select id, party_id, kind, preset_id, sealed, consumed_at, logged_at, verified, deleted_at from drinks where user_id = $1 order by consumed_at",
    );
    const water = await all("select id, party_id, at, deleted_at from water where user_id = $1 and at > 0 order by at");
    const customDrinks = await all<{ id: string; data: string; deleted_at: number | null }>("select id, data, deleted_at from custom_drinks where user_id = $1");
    const crews = await all("select c.id, c.name, m.role, m.nickname, m.joined_at, m.leaderboard_opt_out, m.territory_opt_out from crew_members m join crews c on c.id = m.crew_id where m.user_id = $1");
    const parties = await all(
      "select p.id, p.name, p.starts_at, p.ends_at, p.closed_at, m.response, m.designated_driver, m.home_safe_at from party_members m join parties p on p.id = m.party_id where m.user_id = $1 order by p.starts_at",
    );
    const checkIns = await all(
      "select c.id, v.name as venue, c.at, c.ended_at, c.verdict, c.private from check_ins c join venues v on v.id = c.venue_id where c.user_id = $1 order by c.at",
    );
    const statuses = await all("select night, status, from_minute, to_minute, place from night_statuses where user_id = $1 order by night");
    const sos = await all("select id, crew_id, party_id, created_at, resolved_at from sos_alerts where user_id = $1 order by created_at");
    const expenses = await all(
      "select id, pool_id, payer_id, amount, currency, description, split, created_at, deleted_at from expenses where payer_id = $1 or created_by = $1 order by created_at",
    );
    const repayments = await all("select id, pool_id, from_id, to_id, amount, currency, created_at from repayments where from_id = $1 or to_id = $1 order by created_at");
    const reactions = await all("select party_id, to_id, emoji, at from recap_reactions where from_id = $1");
    const sessions = await all("select device_label, created_at, last_seen_at from sessions where user_id = $1");
    const credentials = await one<{ email_sealed: string | null; updated_at: number }>("select email_sealed, updated_at from credentials where user_id = $1");
    const publicProfile = await one<{ bio: string; country: string; audiences: string; hidden_venues: string }>(
      "select bio, country, audiences, hidden_venues from profiles where user_id = $1",
    );
    const friendships = await all("select user_a, user_b, requested_by, status, at from friendships where user_a = $1 or user_b = $1");
    const blocks = await all("select blocked, at from blocks where blocker = $1");

    return {
      exportedAt: ctx.now(),
      account: account ? { ...account, email: open<string>(credentials?.email_sealed), passwordSetAt: credentials?.updated_at ?? null } : account,
      preferences: preferences ? JSON.parse(preferences.data) : null,
      bodyProfile: open(profile?.sealed),
      paymentDetails: open(payment?.sealed),
      // Erased drinks (consent withdrawn) are empty tombstones: there is nothing left to export.
      drinks: drinks.filter((d) => d.sealed !== "").map(({ sealed, ...d }) => ({ ...d, ...open<Record<string, unknown>>(sealed) })),
      water,
      customDrinks: customDrinks.map((d) => ({ id: d.id, deletedAt: d.deleted_at, ...JSON.parse(d.data) })),
      crews,
      parties,
      checkIns,
      nightStatuses: statuses,
      sosAlerts: sos,
      expenses,
      repayments,
      recapReactions: reactions,
      sessions,
      profile: publicProfile
        ? { bio: publicProfile.bio, country: publicProfile.country, audiences: JSON.parse(publicProfile.audiences), hiddenVenues: JSON.parse(publicProfile.hidden_venues) }
        : null,
      friendships,
      blocks,
    };
  });

  app.delete<{ Params: { id: string } }>("/v1/sessions/:id", async (request, reply) => {
    const user = requireUser(request);
    await ctx.db.query("delete from sessions where user_id = $1 and token_hash like $2", [user.id, `${request.params.id}%`]);
    return reply.status(204).send();
  });

  /**
   * SEC-08: withdrawing the health-data consent. The body profile goes; drinks and water stay only
   * as empty tombstones (no content, no times) so the other phones drop them on their next sync.
   */
  app.delete("/v1/me/health", async (request, reply) => {
    const user = requireUser(request);
    const now = ctx.now();
    await ctx.db.transaction(async (tx) => {
      await tx.query("delete from body_profiles where user_id = $1", [user.id]);
      await tx.query("delete from drink_confirmations where drink_id in (select id from drinks where user_id = $1)", [user.id]);
      await tx.query(
        "update drinks set kind = 'erased', preset_id = 'erased', sealed = '', consumed_at = 0, logged_at = 0, verified = false, deleted_at = $2, updated_at = $2 where user_id = $1",
        [user.id, now],
      );
      await tx.query("update water set at = 0, deleted_at = $2, updated_at = $2 where user_id = $1", [user.id, now]);
    });
    return reply.status(204).send();
  });

  /** O-07: erases everything about the account. Crews it created stay for the others. */
  app.delete("/v1/me", async (request, reply) => {
    const user = requireUser(request);
    await deletePhotoFiles(ctx, user.id);
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
