import type { FastifyInstance } from "fastify";
import { assertCrewMember, requireUser, type Context } from "../context";
import { crewTimeZone } from "../territory";
import { nightOf } from "../time";

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 14;
const MAX_ITEMS = 40;

type FeedItem =
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

/** Groups rows by a key, keeping the latest time and every distinct person. */
function grouped<T extends { at: number; user_id: string }>(rows: T[], key: (r: T) => string) {
  const groups = new Map<string, { at: number; userIds: string[]; count: number; first: T }>();
  for (const r of rows) {
    const k = key(r);
    const g = groups.get(k) ?? { at: 0, userIds: [], count: 0, first: r };
    g.at = Math.max(g.at, r.at);
    g.count += 1;
    if (!g.userIds.includes(r.user_id)) g.userIds.push(r.user_id);
    groups.set(k, g);
  }
  return [...groups.values()];
}

export function feedRoutes(app: FastifyInstance, ctx: Context): void {
  /**
   * N-31: what happened in the crew lately, grouped so a night out reads as a few lines and not
   * as forty notifications: check-ins per bar and night, photos per party and day, arrivals per day.
   */
  app.get<{ Params: { id: string } }>("/v1/crews/:id/feed", async (request) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const crewId = request.params.id;
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
    const polls = await ctx.db.query<{ title: string; created_by: string; created_at: number }>(
      "select title, created_by, created_at from polls where crew_id = $1 and created_at > $2",
      [crewId, since],
    );
    const reigns = await ctx.db.query<{ started_at: number; user_id: string; name: string }>(
      "select r.started_at, r.user_id, v.name from reigns r join venues v on v.id = r.venue_id and v.crew_id = $1 where r.started_at > $2",
      [crewId, since],
    );
    const cheats = await ctx.db.query<{ at: number; user_id: string; name: string }>(
      `select c.at, c.user_id, v.name from check_ins c join venues v on v.id = c.venue_id and v.crew_id = $1
       join crew_members m on m.crew_id = $1 and m.user_id = c.user_id
       where c.verdict = 'rejected' and c.overturned_by is null and c.at > $2`,
      [crewId, since],
    );
    const joined = await ctx.db.query<{ at: number; user_id: string }>("select joined_at as at, user_id from crew_members where crew_id = $1 and joined_at > $2", [
      crewId,
      since,
    ]);
    const quotes = await ctx.db.query<{ created_at: number; text: string; said_by: string | null; name: string }>(
      "select q.created_at, q.text, q.said_by, p.name from party_quotes q join parties p on p.id = q.party_id and p.crew_id = $1 where q.created_at > $2",
      [crewId, since],
    );
    const reactions = await ctx.db.query<{ at: number; user_id: string; party_id: string; name: string }>(
      "select r.at, r.from_id as user_id, r.party_id, p.name from recap_reactions r join parties p on p.id = r.party_id and p.crew_id = $1 where r.at > $2",
      [crewId, since],
    );

    const items: FeedItem[] = [
      ...grouped(checkIns, (r) => `${r.venue_id}|${night(r.at)}`).map((g) => ({ kind: "checkins" as const, at: g.at, venueName: g.first.name, userIds: g.userIds })),
      ...grouped(photos, (r) => `${r.party_id}|${night(r.at)}`).map((g) => ({
        kind: "photos" as const,
        at: g.at,
        partyName: g.first.name,
        partyId: g.first.party_id,
        userIds: g.userIds,
        count: g.count,
      })),
      ...parties.map((p) => ({ kind: "party" as const, at: p.created_at, partyId: p.id, name: p.name, by: p.created_by })),
      ...polls.map((p) => ({ kind: "poll" as const, at: p.created_at, title: p.title, by: p.created_by })),
      ...reigns.map((r) => ({ kind: "takeover" as const, at: r.started_at, venueName: r.name, userId: r.user_id })),
      ...cheats.map((c) => ({ kind: "cheat" as const, at: c.at, venueName: c.name, userId: c.user_id })),
      ...grouped(joined, (r) => night(r.at)).map((g) => ({ kind: "joined" as const, at: g.at, userIds: g.userIds })),
      ...quotes.map((q) => ({ kind: "quote" as const, at: q.created_at, partyName: q.name, text: q.text, saidBy: q.said_by })),
      ...grouped(reactions, (r) => r.party_id).map((g) => ({ kind: "reactions" as const, at: g.at, partyName: g.first.name, partyId: g.first.party_id, count: g.count })),
    ];
    items.sort((a, b) => b.at - a.at);
    return { items: items.slice(0, MAX_ITEMS) };
  });
}
