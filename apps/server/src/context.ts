import type { AiProvider } from "./ai";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Sealer } from "./crypto";
import { hashToken } from "./crypto";
import type { Db } from "./db";
import type { LiveHub } from "./live";
import type { PushService } from "./notifications/push";

export interface Context {
  db: Db;
  sealer: Sealer;
  live: LiveHub;
  /** Injected so tests control time. */
  now: () => number;
  /** Public base URL for invite links, e.g. https://crew.example.com */
  publicUrl: string;
  /** Key for hashing location fixes; derived from DATA_KEY, never stored. */
  hashSecret: string;
  /** Where album photos are kept (N-21). Defaults to ./data/uploads. */
  uploadDir?: string;
  /** Where the APK built on this machine lands (DOWNLOADS_DIR, deploy/android). */
  downloadsDir?: string;
  /** Shown by GET /v1/info: SERVER_NAME, SERVER_DESCRIPTION, PUBLIC_SERVER. */
  serverInfo?: { name: string; description: string; public: boolean };
  /** COM-11: account ids (OPERATOR_IDS, preferred) or usernames (OPERATOR_USERNAMES) of the operators, who check venue claims. */
  operators?: string[];
  /** <ai_features>: the language model, when the server is configured for one. */
  ai?: AiProvider | null;
  /** O-38: APNs and FCM senders, when the server is configured for them; the inbox works without. */
  push?: PushService | null;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export interface AuthedUser {
  id: string;
  username: string;
  displayName: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthedUser;
  }
}

/** SEC-07: a session unused this long is gone; the phone signs in again. */
export const SESSION_IDLE_MS = 90 * 24 * 3_600_000;
/** last_seen_at only needs to be roughly right, so it is not written on every request. */
const SEEN_GRANULARITY_MS = 3_600_000;

export async function userFromToken(ctx: Context, token: string | undefined): Promise<AuthedUser | null> {
  if (!token) return null;
  const hash = hashToken(token);
  const rows = await ctx.db.query<{ id: string; username: string; display_name: string; last_seen_at: number }>(
    `select u.id, u.username, u.display_name, s.last_seen_at from sessions s join users u on u.id = s.user_id where s.token_hash = $1`,
    [hash],
  );
  const row = rows[0];
  if (!row) return null;
  const now = ctx.now();
  if (now - row.last_seen_at > SESSION_IDLE_MS) {
    await ctx.db.query("delete from sessions where token_hash = $1", [hash]);
    return null;
  }
  if (now - row.last_seen_at > SEEN_GRANULARITY_MS) await ctx.db.query("update sessions set last_seen_at = $1 where token_hash = $2", [now, hash]);
  return { id: row.id, username: row.username, displayName: row.display_name };
}

export function bearer(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : undefined;
}

export function requireUser(request: FastifyRequest): AuthedUser {
  if (!request.user) throw new HttpError(401, "unauthenticated");
  return request.user;
}

export function sendError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof HttpError) return reply.status(error.status).send({ error: error.code });
  // Fastify's own refusals (empty or oversized body, bad JSON) keep their 4xx instead of turning into a 500.
  const status = (error as { statusCode?: number }).statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) return reply.status(status).send({ error: status === 413 ? "too_large" : "invalid" });
  // A malformed id in a path reaches Postgres as an invalid uuid: for the caller it is simply not found.
  if ((error as { code?: string }).code === "22P02") return reply.status(404).send({ error: "not_found" });
  // Never leak internals (SEC-01): stack traces stay in the server log.
  reply.log.error(error);
  return reply.status(500).send({ error: "internal" });
}

/** Members of a crew the caller belongs to; throws 404 otherwise, so ids of other crews leak nothing. */
export async function assertCrewMember(ctx: Context, crewId: string, userId: string): Promise<{ role: string }> {
  const rows = await ctx.db.query<{ role: string }>("select role from crew_members where crew_id = $1 and user_id = $2", [crewId, userId]);
  if (!rows[0]) throw new HttpError(404, "not_found");
  return rows[0];
}
