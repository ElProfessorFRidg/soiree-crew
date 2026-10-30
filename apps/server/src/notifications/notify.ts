import type { Context } from "../context";
import { newId } from "../crypto";
import { offsetMinutes } from "../time";
import { pushCopy, pushLanguage, summaryCopy } from "./copy";
import { KINDS, type NotificationKind } from "./kinds";
import type { Platform, PushMessage } from "./push";

export interface NotificationEvent {
  kind: NotificationKind;
  /** Who caused it. Never notified of their own action (QOL-03). */
  actorId?: string | null;
  partyId?: string | null;
  crewId?: string | null;
  refId?: string | null;
  /** Names the inbox shows once the app is open; never sent in a push. */
  params?: Record<string, string | number | boolean>;
  /** Merges a burst into the unread row with the same key (QOL-30). */
  collapseKey?: string;
}

export type Delivery = "sent" | "passive" | "held" | "silent";

const DEFAULT_TIME_ZONE = "Europe/Paris";
const DEFAULT_QUIET = { from: 22, to: 9 };

interface Recipient {
  types: Record<string, boolean>;
  timeZone: string;
  quiet: { from: number; to: number };
  language: string;
  partyMutedUntil: number | null;
}

export function inQuietHours(now: number, timeZone: string, from: number, to: number): boolean {
  if (from === to) return false;
  let hour: number;
  try {
    hour = new Date(now + offsetMinutes(now, timeZone) * 60_000).getUTCHours();
  } catch {
    hour = new Date(now + offsetMinutes(now, DEFAULT_TIME_ZONE) * 60_000).getUTCHours();
  }
  return from > to ? hour >= from || hour < to : hour >= from && hour < to;
}

/** N-35, QOL-20, QOL-30: what the phone does with one event. The inbox keeps it whatever the answer. */
export function decideDelivery(kind: NotificationKind, recipient: Recipient, now: number): Delivery {
  const spec = KINDS[kind];
  if (spec.safety) return "sent";
  if (recipient.types[kind] === false) return "silent";
  if (recipient.partyMutedUntil !== null && recipient.partyMutedUntil > now) return "silent";
  if (inQuietHours(now, recipient.timeZone, recipient.quiet.from, recipient.quiet.to)) return spec.canWait ? "held" : "passive";
  return "sent";
}

async function loadRecipients(ctx: Context, userIds: string[], partyId: string | null): Promise<Map<string, Recipient>> {
  const settings = await ctx.db.query<{ user_id: string; types: string; time_zone: string | null }>(
    "select user_id, types, time_zone from notification_settings where user_id = any($1::uuid[])",
    [userIds],
  );
  const preferences = await ctx.db.query<{ user_id: string; data: string }>("select user_id, data from user_preferences where user_id = any($1::uuid[])", [userIds]);
  const mutes = partyId
    ? await ctx.db.query<{ user_id: string; until: number }>("select user_id, until from notification_party_mutes where party_id = $1 and user_id = any($2::uuid[])", [
        partyId,
        userIds,
      ])
    : [];
  const out = new Map<string, Recipient>();
  for (const id of userIds) {
    const row = settings.find((s) => s.user_id === id);
    let prefs: { quietFromHour?: unknown; quietToHour?: unknown; language?: unknown; notifyRecap?: unknown } = {};
    try {
      prefs = JSON.parse(preferences.find((p) => p.user_id === id)?.data ?? "{}") as typeof prefs;
    } catch {
      prefs = {};
    }
    let types: Record<string, boolean> = {};
    try {
      types = JSON.parse(row?.types ?? "{}") as Record<string, boolean>;
    } catch {
      types = {};
    }
    // The older "recap ready" switch (O-41) still counts until the type has its own setting.
    if (types.recapReady === undefined && prefs.notifyRecap === false) types.recapReady = false;
    const hour = (value: unknown, fallback: number) => (typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 24 ? value : fallback);
    out.set(id, {
      types,
      timeZone: row?.time_zone ?? DEFAULT_TIME_ZONE,
      quiet: { from: hour(prefs.quietFromHour, DEFAULT_QUIET.from), to: hour(prefs.quietToHour, DEFAULT_QUIET.to) },
      language: typeof prefs.language === "string" ? prefs.language : "en",
      partyMutedUntil: mutes.find((m) => m.user_id === id)?.until ?? null,
    });
  }
  return out;
}

/** People who muted or blocked the actor, or were blocked by them, hear nothing from them (safety aside). */
async function silencedBy(ctx: Context, actorId: string, userIds: string[]): Promise<Set<string>> {
  const rows = await ctx.db.query<{ user_id: string }>(
    `select muter as user_id from mutes where muted = $1 and muter = any($2::uuid[])
     union select blocker from blocks where blocked = $1 and blocker = any($2::uuid[])
     union select blocked from blocks where blocker = $1 and blocked = any($2::uuid[])`,
    [actorId, userIds],
  );
  return new Set(rows.map((r) => r.user_id));
}

/**
 * O-38: the one way the server tells people something happened. Each recipient gets an inbox row
 * (N-35), a hint on the live socket, and a push on their registered phones when the delivery
 * allows it. Returns the inbox ids per recipient.
 */
export async function notifyUsers(ctx: Context, recipients: Iterable<string>, event: NotificationEvent): Promise<Map<string, string>> {
  const spec = KINDS[event.kind];
  let ids = [...new Set(recipients)].filter((id) => id !== event.actorId);
  if (event.actorId && !spec.safety && ids.length) {
    const silenced = await silencedBy(ctx, event.actorId, ids);
    ids = ids.filter((id) => !silenced.has(id));
  }
  const created = new Map<string, string>();
  if (!ids.length) return created;
  const now = ctx.now();
  const people = await loadRecipients(ctx, ids, event.partyId ?? null);
  const params = JSON.stringify(event.params ?? {});
  for (const userId of ids) {
    const recipient = people.get(userId)!;
    const delivery = decideDelivery(event.kind, recipient, now);
    const row = (
      await ctx.db.query<{ id: string }>(
        `insert into notifications (id, user_id, kind, party_id, crew_id, actor_id, ref_id, params, collapse_key, created_at, read_at, delivery)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         on conflict (user_id, collapse_key) where collapse_key is not null and read_at is null
         do update set count = notifications.count + 1, created_at = excluded.created_at, actor_id = excluded.actor_id,
                       params = excluded.params, delivery = excluded.delivery
         returning id`,
        [
          newId(),
          userId,
          event.kind,
          event.partyId ?? null,
          event.crewId ?? null,
          event.actorId ?? null,
          event.refId ?? null,
          params,
          event.collapseKey ?? null,
          now,
          // A type switched off or a muted party stays in the history without counting as unread.
          delivery === "silent" ? now : null,
          delivery,
        ],
      )
    )[0]!;
    created.set(userId, row.id);
    ctx.live.notify([userId], { type: "notification", id: row.id, kind: event.kind, alert: delivery === "sent" || delivery === "passive" });
    if (delivery === "sent" || delivery === "passive") await pushTo(ctx, userId, recipient.language, row.id, event, delivery === "passive");
  }
  return created;
}

async function unreadCount(ctx: Context, userId: string): Promise<number> {
  return (await ctx.db.query<{ n: number }>("select count(*)::int as n from notifications where user_id = $1 and read_at is null", [userId]))[0]?.n ?? 0;
}

async function devicesOf(ctx: Context, userId: string): Promise<{ token: string; platform: Platform }[]> {
  if (!ctx.push) return [];
  const rows = await ctx.db.query<{ token: string; platform: Platform }>("select token, platform from push_devices where user_id = $1", [userId]);
  return rows.filter((d) => ctx.push!.enabled(d.platform));
}

function deliver(ctx: Context, devices: { token: string; platform: Platform }[], message: PushMessage): void {
  for (const device of devices) {
    void ctx.push!.send(device.platform, device.token, message).then(async (result) => {
      // A token Apple or Google says is dead goes, so nothing is sent to it again.
      if (result === "gone") await ctx.db.query("delete from push_devices where token = $1", [device.token]).catch(() => undefined);
    });
  }
}

async function pushTo(ctx: Context, userId: string, language: string, inboxId: string, event: NotificationEvent, passive: boolean): Promise<void> {
  const devices = await devicesOf(ctx, userId);
  if (!devices.length) return;
  const spec = KINDS[event.kind];
  const copy = pushCopy(pushLanguage(language), event.kind);
  const data: Record<string, string> = { n: inboxId, k: event.kind };
  if (event.partyId) data.p = event.partyId;
  if (event.crewId) data.c = event.crewId;
  if (event.refId) data.r = event.refId;
  deliver(ctx, devices, {
    title: copy.title,
    body: copy.body,
    data,
    ...(spec.category ? { category: spec.category } : {}),
    threadId: event.partyId ?? event.crewId ?? spec.channel,
    // A merged burst replaces its earlier banner instead of stacking a new one.
    ...(event.collapseKey ? { collapseId: inboxId } : {}),
    channel: spec.channel,
    badge: await unreadCount(ctx, userId),
    passive,
    timeSensitive: spec.safety,
  });
}

/**
 * QOL-20: once someone's quiet hours are over, everything that waited goes out as one push.
 * Called by the sweeper.
 */
export async function releaseHeld(ctx: Context): Promise<void> {
  const held = await ctx.db.query<{ user_id: string; n: number }>(
    "select user_id, count(*)::int as n from notifications where delivery = 'held' and read_at is null group by user_id",
  );
  if (!held.length) return;
  const now = ctx.now();
  const people = await loadRecipients(
    ctx,
    held.map((h) => h.user_id),
    null,
  );
  for (const { user_id: userId, n } of held) {
    const recipient = people.get(userId)!;
    if (inQuietHours(now, recipient.timeZone, recipient.quiet.from, recipient.quiet.to)) continue;
    await ctx.db.query("update notifications set delivery = 'sent' where user_id = $1 and delivery = 'held'", [userId]);
    const devices = await devicesOf(ctx, userId);
    if (!devices.length) continue;
    const copy = summaryCopy(pushLanguage(recipient.language), n);
    deliver(ctx, devices, { title: copy.title, body: copy.body, data: { k: "summary" }, channel: "party", threadId: "summary", collapseId: "summary", badge: await unreadCount(ctx, userId) });
  }
  // Read before the morning: nothing to announce.
  await ctx.db.query("update notifications set delivery = 'sent' where delivery = 'held' and read_at is not null");
}

/** One-shot events and throttles: true the first time a key is seen within `withinMs` (forever when omitted). */
export async function claimMark(ctx: Context, userId: string, key: string, withinMs?: number): Promise<boolean> {
  const now = ctx.now();
  const rows = await ctx.db.query<{ at: number }>(
    `insert into notification_marks (user_id, key, at) values ($1, $2, $3)
     on conflict (user_id, key) do update set at = excluded.at where notification_marks.at < $4
     returning at`,
    [userId, key, now, withinMs === undefined ? Number.MIN_SAFE_INTEGER : now - withinMs],
  );
  return rows.length > 0;
}

/** Fire-and-forget for routes: a notification failing never fails the request that caused it. */
export function notifyLater(ctx: Context, recipients: Iterable<string>, event: NotificationEvent): Promise<void> {
  return notifyUsers(ctx, recipients, event).then(
    () => undefined,
    () => undefined,
  );
}
