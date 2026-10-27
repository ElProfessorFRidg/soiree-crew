import type { FastifyReply, FastifyRequest } from "fastify";
import type { Sealer } from "./crypto";
import { hashToken } from "./crypto";
import type { Db } from "./db";
import type { LiveHub } from "./live";

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

export async function userFromToken(ctx: Context, token: string | undefined): Promise<AuthedUser | null> {
  if (!token) return null;
  const rows = await ctx.db.query<{ id: string; username: string; display_name: string }>(
    `select u.id, u.username, u.display_name from sessions s join users u on u.id = s.user_id where s.token_hash = $1`,
    [hashToken(token)],
  );
  const row = rows[0];
  if (!row) return null;
  await ctx.db.query("update sessions set last_seen_at = $1 where token_hash = $2", [ctx.now(), hashToken(token)]);
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
