import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertCrewMember, HttpError, requireUser, type Context } from "../context";
import { newId } from "../crypto";
import { RateLimiter } from "../ratelimit";
import { crewTimeZone } from "../territory";
import { nightOf } from "../time";

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 14;
const MAX_ITEMS = 40;
/** N-31: this many lines of the same kind in a row fold into one digest line. */
const DIGEST_RUN = 3;
const COMMENTS_PER_ITEM = 20;
export const FEED_REACTIONS = ["laugh", "fire", "love", "cheers", "wow"] as const;

type BaseItem =
  | { kind: "checkins"; at: number; venueName: string; userIds: string[] }
  | { kind: "photos"; at: number; partyName: string; partyId: string; userIds: string[]; count: number }
  | { kind: "party"; at: number; partyId: string; name: string; by: string }
  | { kind: "poll"; at: number; title: string; by: string }
  | { kind: "takeover"; at: number; venueName: string; userId: string }
  /** AC-09: a cheat attempt the crew admin has not overturned. */
  | { kind: "cheat"; at: number; venueName: string; userId: string }
  | { kind: "joined"; at: number; userIds: string[] }
  | { kind: "quote"; at: number; partyName: string; text: string; saidBy: string | null }
  | { kind: "reactions"; at: number; partyName: string; partyId: string; count: number };

/** Every line carries a key that stays the same from one fetch to the next, so reactions and comments stick to it. */
type KeyedItem = BaseItem & { key: string };
type DigestItem = { kind: "digest"; key: string; at: number; of: BaseItem["kind"]; count: number; userIds: string[]; items: KeyedItem[] };

/** Groups rows by a key, keeping the latest time and every distinct person. */
function grouped<T extends { at: number; user_id: string }>(rows: T[], key: (r: T) => string) {
  const groups = new Map<string, { key: string; at: number; userIds: string[]; count: number; first: T }>();
  for (const r of rows) {
    const k = key(r);
    const g = groups.get(k) ?? { key: k, at: 0, userIds: [], count: 0, first: r };
    g.at = Math.max(g.at, r.at);
    g.count += 1;
    if (!g.userIds.includes(r.user_id)) g.userIds.push(r.user_id);
    groups.set(k, g);
  }
  return [...groups.values()];
}

function peopleOf(item: KeyedItem): string[] {
  switch (item.kind) {
    case "checkins":
    case "photos":
    case "joined":
      return item.userIds;
    case "party":
    case "poll":
      return [item.by];
    case "takeover":
    case "cheat":
      return [item.userId];
    case "quote":
      return item.saidBy ? [item.saidBy] : [];
    case "reactions":
      return [];
  }
}

/** N-31: runs of the same kind (three bars in one night, a wave of polls) read as one line instead of spam. */
export function digest(items: KeyedItem[]): (KeyedItem | DigestItem)[] {
  const out: (KeyedItem | DigestItem)[] = [];
  let i = 0;
  while (i < items.length) {
    let j = i + 1;
    while (j < items.length && items[j]!.kind === items[i]!.kind) j += 1;
    const run = items.slice(i, j);
    if (run.length >= DIGEST_RUN && run[0]!.kind !== "joined") {
      const userIds = [...new Set(run.flatMap(peopleOf))];
      // Keyed by the oldest line of the run: newer lines join the run, the oldest one stays.
      out.push({ kind: "digest", key: `digest:${run[run.length - 1]!.key}`, at: run[0]!.at, of: run[0]!.kind, count: run.length, userIds, items: run });
    } else {
      out.push(...run);
    }
    i = j;
  }
  return out;
}

/** What happened in the crew lately, newest first, each line with its stable key. */
async function buildFeed(ctx: Context, crewId: string): Promise<KeyedItem[]> {
  const since = ctx.now() - WINDOW_DAYS * DAY_MS;
  const timeZone = await crewTimeZone(ctx.db, crewId);
  const night = (at: number) => nightOf(at, timeZone);

  const checkIns = await ctx.db.query<{ at: number; user_id: string; venue_id: string; name: string }>(
    `select c.at, c.user_id, c.venue_id, v.name from check_ins c join venues v on v.id = c.venue_id and v.crew_id = $1 and v.kind <> 'home'
     join crew_members m on m.crew_id = $1 and m.user_id = c.user_id
     where c.verdict = 'accepted' and c.private = false and c.at > $2`,
    [crewId, since],
  );
  const photos = await ctx.db.query<{ at: number; user_id: string; party_id: string; name: string }>(
    "select ph.created_at as at, ph.user_id, ph.party_id, p.name from photos ph join parties p on p.id = ph.party_id and p.crew_id = $1 where ph.created_at > $2",
    [crewId, since],
  );
  const parties = await ctx.db.query<{ id: string; name: string; created_by: string; created_at: number }>(
    "select id, name, created_by, created_at from parties where crew_id = $1 and created_at > $2",
    [crewId, since],
  );
  const polls = await ctx.db.query<{ id: string; title: string; created_by: string; created_at: number }>(
    "select id, title, created_by, created_at from polls where crew_id = $1 and created_at > $2",
    [crewId, since],
  );
  const reigns = await ctx.db.query<{ id: string; started_at: number; user_id: string; name: string }>(
    "select r.id, r.started_at, r.user_id, v.name from reigns r join venues v on v.id = r.venue_id and v.crew_id = $1 where r.started_at > $2",
    [crewId, since],
  );
  // AC-09: refused check-ins of current members, unless an admin overturned them.
  const cheats = await ctx.db.query<{ id: string; at: number; user_id: string; name: string }>(
    `select c.id, c.at, c.user_id, v.name from check_ins c join venues v on v.id = c.venue_id and v.crew_id = $1
     join crew_members m on m.crew_id = $1 and m.user_id = c.user_id
     where c.verdict = 'rejected' and c.overturned_by is null and c.at > $2`,
    [crewId, since],
  );
  const joined = await ctx.db.query<{ at: number; user_id: string }>("select joined_at as at, user_id from crew_members where crew_id = $1 and joined_at > $2", [
    crewId,
    since,
  ]);
  const quotes = await ctx.db.query<{ id: string; created_at: number; text: string; said_by: string | null; name: string }>(
    "select q.id, q.created_at, q.text, q.said_by, p.name from party_quotes q join parties p on p.id = q.party_id and p.crew_id = $1 where q.created_at > $2",
    [crewId, since],
  );
  const reactions = await ctx.db.query<{ at: number; user_id: string; party_id: string; name: string }>(
    "select r.at, r.from_id as user_id, r.party_id, p.name from recap_reactions r join parties p on p.id = r.party_id and p.crew_id = $1 where r.at > $2",
    [crewId, since],
  );

  const items: KeyedItem[] = [
    ...grouped(checkIns, (r) => `checkins:${r.venue_id}:${night(r.at)}`).map((g) => ({ kind: "checkins" as const, key: g.key, at: g.at, venueName: g.first.name, userIds: g.userIds })),
    ...grouped(photos, (r) => `photos:${r.party_id}:${night(r.at)}`).map((g) => ({
      kind: "photos" as const,
      key: g.key,
      at: g.at,
      partyName: g.first.name,
      partyId: g.first.party_id,
      userIds: g.userIds,
      count: g.count,
    })),
    ...parties.map((p) => ({ kind: "party" as const, key: `party:${p.id}`, at: p.created_at, partyId: p.id, name: p.name, by: p.created_by })),
    ...polls.map((p) => ({ kind: "poll" as const, key: `poll:${p.id}`, at: p.created_at, title: p.title, by: p.created_by })),
    ...reigns.map((r) => ({ kind: "takeover" as const, key: `takeover:${r.id}`, at: r.started_at, venueName: r.name, userId: r.user_id })),
    ...cheats.map((c) => ({ kind: "cheat" as const, key: `cheat:${c.id}`, at: c.at, venueName: c.name, userId: c.user_id })),
    ...grouped(joined, (r) => `joined:${night(r.at)}`).map((g) => ({ kind: "joined" as const, key: g.key, at: g.at, userIds: g.userIds })),
    ...quotes.map((q) => ({ kind: "quote" as const, key: `quote:${q.id}`, at: q.created_at, partyName: q.name, text: q.text, saidBy: q.said_by })),
    ...grouped(reactions, (r) => `reactions:${r.party_id}`).map((g) => ({
      kind: "reactions" as const,
      key: g.key,
      at: g.at,
      partyName: g.first.name,
      partyId: g.first.party_id,
      count: g.count,
    })),
  ];
  items.sort((a, b) => b.at - a.at || a.key.localeCompare(b.key));
  return items.slice(0, MAX_ITEMS);
}

/** Every key a client may react to or comment on: the lines and the digests that fold them. */
function keysOf(items: (KeyedItem | DigestItem)[]): Set<string> {
  const keys = new Set<string>();
  for (const item of items) {
    keys.add(item.key);
    if (item.kind === "digest") for (const inner of item.items) keys.add(inner.key);
  }
  return keys;
}

export function feedRoutes(app: FastifyInstance, ctx: Context): void {
  const writes = new RateLimiter(120, 60 * 60_000, ctx.now);
  const itemKey = z.string().min(3).max(140).regex(/^[a-z]+:[A-Za-z0-9:_-]+$/);

  const crewOf = async (crewId: string, userId: string) => {
    await assertCrewMember(ctx, z.string().uuid().parse(crewId), userId);
    return crewId;
  };
  /** A key must name a line the crew can see right now: nothing is attached to made-up keys. */
  const assertKey = async (crewId: string, key: string) => {
    if (!keysOf(digest(await buildFeed(ctx, crewId))).has(key)) throw new HttpError(404, "not_found");
  };
  const notifyCrew = async (crewId: string) => {
    const members = await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1", [crewId]);
    ctx.live.notify(members.map((m) => m.user_id), { type: "feed.changed", crewId });
  };

  /**
   * N-31: what happened in the crew lately, grouped so a night out reads as a few lines and not
   * as forty notifications: check-ins per bar and night, photos per party and day, arrivals per
   * day, then runs of the same kind folded into digests. Each line has reactions and comments.
   */
  app.get<{ Params: { id: string } }>("/v1/crews/:id/feed", async (request) => {
    const user = requireUser(request);
    const crewId = await crewOf(request.params.id, user.id);
    const items = digest(await buildFeed(ctx, crewId));
    const keys = [...keysOf(items)];

    const reactionRows = keys.length
      ? await ctx.db.query<{ item_key: string; reaction: string; n: number; mine: number }>(
          `select item_key, reaction, count(*)::int as n, count(*) filter (where user_id = $3)::int as mine
           from feed_reactions where crew_id = $1 and item_key = any($2::text[]) group by item_key, reaction`,
          [crewId, keys, user.id],
        )
      : [];
    const commentRows = keys.length
      ? await ctx.db.query<{ id: string; item_key: string; user_id: string; text: string; created_at: number }>(
          // Only people still in the crew speak in its feed.
          `select c.id, c.item_key, c.user_id, c.text, c.created_at from feed_comments c
           join crew_members m on m.crew_id = c.crew_id and m.user_id = c.user_id
           where c.crew_id = $1 and c.item_key = any($2::text[]) order by c.created_at`,
          [crewId, keys],
        )
      : [];
    const mentionRows = commentRows.length
      ? await ctx.db.query<{ comment_id: string; user_id: string; seen_at: number | null }>("select comment_id, user_id, seen_at from feed_mentions where comment_id = any($1::uuid[])", [
          commentRows.map((c) => c.id),
        ])
      : [];

    const social = (key: string) => {
      const comments = commentRows.filter((c) => c.item_key === key).slice(-COMMENTS_PER_ITEM);
      return {
        reactions: FEED_REACTIONS.map((reaction) => {
          const row = reactionRows.find((r) => r.item_key === key && r.reaction === reaction);
          return { reaction, count: row?.n ?? 0, mine: (row?.mine ?? 0) > 0 };
        }).filter((r) => r.count > 0),
        comments: comments.map((c) => ({
          id: c.id,
          userId: c.user_id,
          text: c.text,
          at: c.created_at,
          mentions: mentionRows.filter((m) => m.comment_id === c.id).map((m) => m.user_id),
        })),
        // The in-app marker: a mention of me not seen yet.
        mentionsMe: comments.some((c) => mentionRows.some((m) => m.comment_id === c.id && m.user_id === user.id && m.seen_at === null)),
      };
    };
    const unseenMentions = mentionRows.filter((m) => m.user_id === user.id && m.seen_at === null).length;
    return {
      items: items.map((item) =>
        item.kind === "digest" ? { ...item, ...social(item.key), items: item.items.map((inner) => ({ ...inner, ...social(inner.key) })) } : { ...item, ...social(item.key) },
      ),
      unseenMentions,
    };
  });

  /** N-31: one tap toggles a reaction from the small fixed set on a line. */
  app.put<{ Params: { id: string } }>("/v1/crews/:id/feed/reactions", async (request) => {
    const user = requireUser(request);
    writes.check(user.id);
    const crewId = await crewOf(request.params.id, user.id);
    const input = z.object({ key: itemKey, reaction: z.enum(FEED_REACTIONS), on: z.boolean() }).parse(request.body);
    if (input.on) {
      await assertKey(crewId, input.key);
      await ctx.db.query("insert into feed_reactions (crew_id, item_key, user_id, reaction, at) values ($1, $2, $3, $4, $5) on conflict do nothing", [
        crewId,
        input.key,
        user.id,
        input.reaction,
        ctx.now(),
      ]);
    } else {
      await ctx.db.query("delete from feed_reactions where crew_id = $1 and item_key = $2 and user_id = $3 and reaction = $4", [crewId, input.key, user.id, input.reaction]);
    }
    await notifyCrew(crewId);
    return { ok: true };
  });

  /**
   * N-31: a short comment on a line, with @mentions of crew mates. Mentioned people hear it at once
   * (unless they muted the author) and see a marker until they open the feed.
   */
  app.post<{ Params: { id: string } }>("/v1/crews/:id/feed/comments", async (request, reply) => {
    const user = requireUser(request);
    writes.check(user.id);
    const crewId = await crewOf(request.params.id, user.id);
    const input = z
      .object({ key: itemKey, text: z.string().trim().min(1).max(280), mentions: z.array(z.string().uuid()).max(10).default([]) })
      .parse(request.body);
    await assertKey(crewId, input.key);
    const members = await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1", [crewId]);
    const memberIds = new Set(members.map((m) => m.user_id));
    // Only crew mates can be mentioned, never myself, each once.
    const mentioned = [...new Set(input.mentions)].filter((id) => id !== user.id && memberIds.has(id));
    const id = newId();
    const now = ctx.now();
    await ctx.db.transaction(async (tx) => {
      await tx.query("insert into feed_comments (id, crew_id, item_key, user_id, text, created_at) values ($1, $2, $3, $4, $5, $6)", [id, crewId, input.key, user.id, input.text, now]);
      for (const userId of mentioned) await tx.query("insert into feed_mentions (comment_id, user_id) values ($1, $2)", [id, userId]);
    });
    const muting = mentioned.length
      ? new Set((await ctx.db.query<{ muter: string }>("select muter from mutes where muted = $1 and muter = any($2::uuid[])", [user.id, mentioned])).map((m) => m.muter))
      : new Set<string>();
    // push: feed.mention
    ctx.live.notify(
      mentioned.filter((m) => !muting.has(m)),
      { type: "feed.changed", crewId, mention: true },
    );
    ctx.live.notify(
      [...memberIds].filter((m) => !mentioned.includes(m)),
      { type: "feed.changed", crewId },
    );
    return reply.status(201).send({ id, mentions: mentioned });
  });

  /** The author takes a comment back; a crew admin can remove one too. */
  app.delete<{ Params: { id: string; commentId: string } }>("/v1/crews/:id/feed/comments/:commentId", async (request, reply) => {
    const user = requireUser(request);
    const crewId = z.string().uuid().parse(request.params.id);
    const { role } = await assertCrewMember(ctx, crewId, user.id);
    const comment = (await ctx.db.query<{ user_id: string }>("select user_id from feed_comments where id = $1 and crew_id = $2", [
      z.string().uuid().parse(request.params.commentId),
      crewId,
    ]))[0];
    if (!comment) throw new HttpError(404, "not_found");
    if (comment.user_id !== user.id && role !== "admin") throw new HttpError(403, "forbidden");
    await ctx.db.query("delete from feed_comments where id = $1", [request.params.commentId]);
    await notifyCrew(crewId);
    return reply.status(204).send();
  });

  /** Opening the feed clears my mention markers for this crew. */
  app.post<{ Params: { id: string } }>("/v1/crews/:id/feed/seen", async (request) => {
    const user = requireUser(request);
    const crewId = await crewOf(request.params.id, user.id);
    await ctx.db.query(
      "update feed_mentions set seen_at = $3 where user_id = $2 and seen_at is null and comment_id in (select id from feed_comments where crew_id = $1)",
      [crewId, user.id, ctx.now()],
    );
    return { ok: true };
  });
}
