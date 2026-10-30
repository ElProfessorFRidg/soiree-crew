import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { bearer, HttpError, requireUser, type Context } from "../context";
import { hashToken } from "../crypto";
import { RateLimiter } from "../ratelimit";
import { offsetMinutes } from "../time";
import { CHANNELS, isKind, KIND_NAMES, KINDS } from "./kinds";

const PAGE = 50;
const MORNING_HOUR = 9;

const timeZone = z
  .string()
  .min(3)
  .max(60)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  });

interface InboxRow {
  id: string;
  kind: string;
  party_id: string | null;
  crew_id: string | null;
  actor_id: string | null;
  ref_id: string | null;
  params: string;
  count: number;
  created_at: number;
  read_at: number | null;
}

function itemView(row: InboxRow) {
  return {
    id: row.id,
    kind: row.kind,
    partyId: row.party_id,
    crewId: row.crew_id,
    actorId: row.actor_id,
    refId: row.ref_id,
    params: JSON.parse(row.params) as Record<string, string | number | boolean>,
    count: row.count,
    at: row.created_at,
    readAt: row.read_at,
  };
}

async function unread(ctx: Context, userId: string): Promise<number> {
  return (await ctx.db.query<{ n: number }>("select count(*)::int as n from notifications where user_id = $1 and read_at is null", [userId]))[0]?.n ?? 0;
}

async function storedTimeZone(ctx: Context, userId: string): Promise<string> {
  return (await ctx.db.query<{ time_zone: string | null }>("select time_zone from notification_settings where user_id = $1", [userId]))[0]?.time_zone ?? "Europe/Paris";
}

/** The next 9 am, local: "until morning" (QOL-30). */
export function nextMorning(now: number, zone: string): number {
  const offset = offsetMinutes(now, zone) * 60_000;
  const local = new Date(now + offset);
  const morning = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), MORNING_HOUR) - offset;
  return morning > now ? morning : morning + 24 * 3_600_000;
}

export function notificationRoutes(app: FastifyInstance, ctx: Context): void {
  const registrations = new RateLimiter(30, 3_600_000, ctx.now);

  /** N-35: the inbox, newest first, with the unread count for the badge. */
  app.get("/v1/notifications", async (request) => {
    const user = requireUser(request);
    const query = z.object({ before: z.coerce.number().int().positive().optional() }).parse(request.query);
    // Thirty days of history are plenty for a night-out app.
    await ctx.db.query("delete from notifications where user_id = $1 and created_at < $2", [user.id, ctx.now() - 30 * 24 * 3_600_000]);
    const rows = await ctx.db.query<InboxRow>(
      `select id, kind, party_id, crew_id, actor_id, ref_id, params, count, created_at, read_at from notifications
       where user_id = $1 and created_at < $2 order by created_at desc limit ${PAGE}`,
      [user.id, query.before ?? Number.MAX_SAFE_INTEGER],
    );
    return { items: rows.map(itemView), unread: await unread(ctx, user.id), push: { ios: ctx.push?.enabled("ios") ?? false, android: ctx.push?.enabled("android") ?? false } };
  });

  /** Mark some items, or everything, as read. Badges clear once seen (QOL-03). */
  app.post("/v1/notifications/read", async (request) => {
    const user = requireUser(request);
    const input = z.object({ ids: z.array(z.string().uuid()).max(200).optional(), all: z.boolean().optional() }).parse(request.body ?? {});
    if (input.all) await ctx.db.query("update notifications set read_at = $2 where user_id = $1 and read_at is null", [user.id, ctx.now()]);
    else if (input.ids?.length)
      await ctx.db.query("update notifications set read_at = $3 where user_id = $1 and id = any($2::uuid[]) and read_at is null", [user.id, input.ids, ctx.now()]);
    return { unread: await unread(ctx, user.id) };
  });

  /** N-35: per-type settings, the fixed channel list and the parties muted for now. */
  app.get("/v1/notifications/settings", async (request) => {
    const user = requireUser(request);
    const row = (await ctx.db.query<{ types: string; time_zone: string | null }>("select types, time_zone from notification_settings where user_id = $1", [user.id]))[0];
    const off = JSON.parse(row?.types ?? "{}") as Record<string, boolean>;
    const mutes = await ctx.db.query<{ party_id: string; name: string; until: number }>(
      `select m.party_id, p.name, m.until from notification_party_mutes m join parties p on p.id = m.party_id
       where m.user_id = $1 and m.until > $2 order by m.until`,
      [user.id, ctx.now()],
    );
    return {
      channels: CHANNELS,
      kinds: KIND_NAMES.map((kind) => ({ kind, channel: KINDS[kind].channel, safety: KINDS[kind].safety, on: KINDS[kind].safety || off[kind] !== false })),
      timeZone: row?.time_zone ?? null,
      mutedParties: mutes.map((m) => ({ partyId: m.party_id, name: m.name, until: m.until })),
    };
  });

  app.put("/v1/notifications/settings", async (request) => {
    const user = requireUser(request);
    const input = z.object({ types: z.record(z.string(), z.boolean()).optional(), timeZone: timeZone.optional() }).parse(request.body ?? {});
    const row = (await ctx.db.query<{ types: string }>("select types from notification_settings where user_id = $1", [user.id]))[0];
    const types = JSON.parse(row?.types ?? "{}") as Record<string, boolean>;
    for (const [kind, on] of Object.entries(input.types ?? {})) {
      // Safety cannot be switched off, and unknown names are not stored.
      if (!isKind(kind) || KINDS[kind].safety) continue;
      if (on) delete types[kind];
      else types[kind] = false;
    }
    await ctx.db.query(
      `insert into notification_settings (user_id, types, time_zone, updated_at) values ($1, $2, $3, $4)
       on conflict (user_id) do update set types = excluded.types, time_zone = coalesce(excluded.time_zone, notification_settings.time_zone), updated_at = excluded.updated_at`,
      [user.id, JSON.stringify(types), input.timeZone ?? null, ctx.now()],
    );
    return { ok: true };
  });

  /**
   * O-38: this phone's push token, tied to the session that sends it. Signing out (or the session
   * expiring) removes it with the session row.
   */
  app.post("/v1/push/devices", async (request, reply) => {
    const user = requireUser(request);
    registrations.check(user.id);
    const input = z
      .object({ token: z.string().min(16).max(512).regex(/^[A-Za-z0-9:_\-.]+$/), platform: z.enum(["ios", "android"]), timeZone: timeZone.optional() })
      .parse(request.body);
    const session = hashToken(bearer(request) ?? "");
    const now = ctx.now();
    // A token moves with the phone: whoever had it before (another account signed in on it) loses it.
    await ctx.db.query(
      `insert into push_devices (token, user_id, session_hash, platform, created_at, last_seen_at) values ($1, $2, $3, $4, $5, $5)
       on conflict (token) do update set user_id = excluded.user_id, session_hash = excluded.session_hash, platform = excluded.platform, last_seen_at = excluded.last_seen_at`,
      [input.token, user.id, session, input.platform, now],
    );
    if (input.timeZone) {
      await ctx.db.query(
        `insert into notification_settings (user_id, time_zone, updated_at) values ($1, $2, $3)
         on conflict (user_id) do update set time_zone = excluded.time_zone, updated_at = excluded.updated_at`,
        [user.id, input.timeZone, now],
      );
    }
    return reply.status(201).send({ ok: true, push: ctx.push?.enabled(input.platform) ?? false });
  });

  app.delete<{ Params: { token: string } }>("/v1/push/devices/:token", async (request, reply) => {
    const user = requireUser(request);
    await ctx.db.query("delete from push_devices where token = $1 and user_id = $2", [request.params.token, user.id]);
    return reply.status(204).send();
  });

  /** QOL-30: mute a party until the morning (or a given time, within two days). Safety still comes through. */
  app.post<{ Params: { id: string } }>("/v1/parties/:id/mute", async (request) => {
    const user = requireUser(request);
    const input = z.object({ until: z.number().int().positive().optional() }).parse(request.body ?? {});
    const member = await ctx.db.query("select 1 from party_members where party_id = $1 and user_id = $2", [request.params.id, user.id]);
    if (!member.length) throw new HttpError(404, "not_found");
    const now = ctx.now();
    const until = Math.min(input.until ?? nextMorning(now, await storedTimeZone(ctx, user.id)), now + 48 * 3_600_000);
    if (until <= now) throw new HttpError(400, "invalid");
    await ctx.db.query(
      `insert into notification_party_mutes (user_id, party_id, until) values ($1, $2, $3)
       on conflict (user_id, party_id) do update set until = excluded.until`,
      [user.id, request.params.id, until],
    );
    return { until };
  });

  app.delete<{ Params: { id: string } }>("/v1/parties/:id/mute", async (request, reply) => {
    const user = requireUser(request);
    await ctx.db.query("delete from notification_party_mutes where user_id = $1 and party_id = $2", [user.id, request.params.id]);
    return reply.status(204).send();
  });
}
