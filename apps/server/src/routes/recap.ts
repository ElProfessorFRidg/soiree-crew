import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BacSimulation, distributionVolume, type BodyProfile, type DrinkIntake } from "@crew/bac";
import { HttpError, requireUser, type Context } from "../context";
import { RateLimiter } from "../ratelimit";

const HOUR_MS = 3_600_000;
const PRE_PARTY_MS = 12 * HOUR_MS;
const CURVE_STEP_MS = 10 * 60_000;
/** The few reactions the recap offers: a short fixed set reads better than a keyboard at 11 am. */
export const RECAP_EMOJIS = ["🔥", "😂", "🥴", "👑", "💧", "❤️"] as const;

type BadgeKind = "camel" | "goldenDriver" | "newBoss" | "firstIn" | "nightOwl";
type TimelineKind = "start" | "arrival" | "checkIn" | "takeover" | "round" | "homeSafe" | "end";

interface PartyRow {
  id: string;
  crew_id: string;
  name: string;
  mood: string;
  kind: string;
  starts_at: number;
  ends_at: number;
  closed_at: number | null;
}

async function partyForMember(ctx: Context, partyId: string, userId: string): Promise<PartyRow> {
  const rows = await ctx.db.query<PartyRow>(
    "select p.* from parties p join crew_members c on c.crew_id = p.crew_id and c.user_id = $2 where p.id = $1",
    [partyId, userId],
  );
  if (!rows[0]) throw new HttpError(404, "not_found");
  return rows[0];
}

export function recapRoutes(app: FastifyInstance, ctx: Context): void {
  /** Closed parties of my crews, newest first: recaps are kept (O-41). */
  app.get("/v1/recaps", async (request) => {
    const user = requireUser(request);
    const rows = await ctx.db.query<PartyRow & { going: number; seen: number | null }>(
      `select p.*, (select count(*)::int from party_members g where g.party_id = p.id and g.response = 'going') as going, m.recap_seen_at as seen
       from parties p
       join crew_members c on c.crew_id = p.crew_id and c.user_id = $1
       left join party_members m on m.party_id = p.id and m.user_id = $1
       where p.closed_at is not null
       order by p.starts_at desc limit 60`,
      [user.id],
    );
    return {
      recaps: rows.map((p) => ({ id: p.id, crewId: p.crew_id, name: p.name, mood: p.mood, startsAt: p.starts_at, closedAt: p.closed_at, going: p.going, seenAt: p.seen })),
    };
  });

  /**
   * O-41, N-22: the recap of one party, computed from what the server already
   * keeps. Only people actually present show up: going and with some sign of
   * the night (a drink, a water, a check-in or a heartbeat).
   */
  app.get<{ Params: { id: string } }>("/v1/parties/:id/recap", async (request) => {
    const user = requireUser(request);
    const party = await partyForMember(ctx, request.params.id, user.id);
    const now = ctx.now();
    const to = party.closed_at ?? Math.min(now, party.ends_at);

    const members = await ctx.db.query<{
      user_id: string;
      display_name: string;
      designated_driver: boolean;
      home_safe_at: number | null;
      last_activity_at: number | null;
      sealed: string | null;
    }>(
      `select m.user_id, u.display_name, m.designated_driver, m.home_safe_at, m.last_activity_at, b.sealed
       from party_members m join users u on u.id = m.user_id left join body_profiles b on b.user_id = m.user_id
       where m.party_id = $1 and m.response = 'going' order by u.display_name`,
      [party.id],
    );
    const ids = members.map((m) => m.user_id);
    const drinkRows = ids.length
      ? await ctx.db.query<{ id: string; user_id: string; sealed: string; consumed_at: number; party_id: string | null }>(
          `select id, user_id, sealed, consumed_at, party_id from drinks
           where user_id = any($1::uuid[]) and deleted_at is null and consumed_at between $2 and $3 order by consumed_at`,
          [ids, party.starts_at - PRE_PARTY_MS, to],
        )
      : [];
    const waterRows = await ctx.db.query<{ user_id: string; at: number }>("select user_id, at from water where party_id = $1 and deleted_at is null", [party.id]);
    const checkIns = await ctx.db.query<{ user_id: string; at: number; venue_id: string; venue_name: string }>(
      `select c.user_id, c.at, c.venue_id, v.name as venue_name from check_ins c join venues v on v.id = c.venue_id
       where c.party_id = $1 and c.verdict = 'accepted' and c.private = false order by c.at`,
      [party.id],
    );
    const takeovers = ids.length
      ? await ctx.db.query<{ user_id: string; started_at: number; venue_name: string }>(
          `select r.user_id, r.started_at, v.name as venue_name from reigns r join venues v on v.id = r.venue_id
           where v.crew_id = $1 and r.user_id = any($2::uuid[]) and r.started_at between $3 and $4 order by r.started_at`,
          [party.crew_id, ids, party.starts_at, to],
        )
      : [];
    const rounds = await ctx.db.query<{ payer_id: string; member_ids: string; created_at: number }>(
      "select payer_id, member_ids, created_at from rounds where party_id = $1 order by created_at",
      [party.id],
    );
    const reactions = await ctx.db.query<{ from_id: string; to_id: string; emoji: string }>("select from_id, to_id, emoji from recap_reactions where party_id = $1", [party.id]);
    const quotes = await ctx.db.query<{ id: string; said_by: string | null; added_by: string; text: string; votes: number; mine: number }>(
      `select q.id, q.said_by, q.added_by, q.text,
              (select count(*)::int from party_quote_votes v where v.quote_id = q.id) as votes,
              (select count(*)::int from party_quote_votes v where v.quote_id = q.id and v.user_id = $2) as mine
       from party_quotes q where q.party_id = $1 order by votes desc, q.created_at`,
      [party.id, user.id],
    );

    const partyDrinks = drinkRows.filter((d) => d.party_id === party.id);
    const present = members.filter(
      (m) =>
        partyDrinks.some((d) => d.user_id === m.user_id) ||
        waterRows.some((w) => w.user_id === m.user_id) ||
        checkIns.some((c) => c.user_id === m.user_id) ||
        (m.last_activity_at !== null && m.last_activity_at >= party.starts_at),
    );

    const firstDrink = partyDrinks[0]?.consumed_at;
    const from = Math.min(party.starts_at, firstDrink ?? party.starts_at);
    // Curves run until everyone is back to zero, capped at 10 hours after the end.
    const curveEnd = to + 10 * HOUR_MS;

    const optedOut = new Set(
      (
        await ctx.db.query<{ user_id: string }>("select user_id from profiles where user_id = any($1::uuid[]) and story_opt_out = true", [present.map((m) => m.user_id)])
      ).map((r) => r.user_id),
    );
    const participants = present.map((m) => {
      const mine = drinkRows.filter((d) => d.user_id === m.user_id);
      const intakes: DrinkIntake[] = mine.map((d) => {
        const body = ctx.sealer.open<{ volumeMl: number; abv: number; withFood: boolean }>(d.sealed);
        return { id: d.id, volumeMl: body.volumeMl, abv: body.abv, consumedAt: d.consumed_at, withFood: body.withFood };
      });
      const profile = m.sealed ? ctx.sealer.open<BodyProfile>(m.sealed) : null;
      let curve: [number, number][] = [];
      let peak: number | null = null;
      if (profile && intakes.length) {
        const sim = new BacSimulation(intakes, distributionVolume(profile), Math.max(to, now));
        const samples = sim.sample(from, curveEnd, CURVE_STEP_MS);
        let last = samples.length - 1;
        while (last > 0 && samples[last]!.bac <= 0 && samples[last - 1]!.bac <= 0) last -= 1;
        curve = samples.slice(0, last + 1).map((p) => [p.at, Math.round(p.bac * 1000) / 1000]);
        peak = curve.reduce((best, [, bac]) => Math.max(best, bac), 0);
      }
      return {
        userId: m.user_id,
        name: m.display_name,
        drinks: mine.filter((d) => d.party_id === party.id).length,
        water: waterRows.filter((w) => w.user_id === m.user_id).length,
        peak,
        curve,
        designatedDriver: m.designated_driver,
        homeSafeAt: m.home_safe_at,
        storyOptOut: optedOut.has(m.user_id),
      };
    });

    const peaks = participants.map((p) => p.peak).filter((p): p is number => p !== null && p > 0);
    const figures = {
      participants: participants.length,
      drinks: participants.reduce((s, p) => s + p.drinks, 0),
      averagePeak: peaks.length ? Math.round((peaks.reduce((s, p) => s + p, 0) / peaks.length) * 100) / 100 : null,
    };

    // Badges are facts about the night, never about the highest BAC (PROF-06).
    const badges: { kind: BadgeKind; userId: string; value?: number; venueName?: string }[] = [];
    const camel = [...participants].sort((a, b) => b.water - a.water)[0];
    if (camel && camel.water >= 3) badges.push({ kind: "camel", userId: camel.userId, value: camel.water });
    for (const p of participants) if (p.designatedDriver && p.drinks === 0) badges.push({ kind: "goldenDriver", userId: p.userId });
    for (const t of takeovers) badges.push({ kind: "newBoss", userId: t.user_id, venueName: t.venue_name });
    if (checkIns[0]) badges.push({ kind: "firstIn", userId: checkIns[0].user_id, venueName: checkIns[0].venue_name });
    const lastHome = participants.filter((p) => p.homeSafeAt !== null).sort((a, b) => b.homeSafeAt! - a.homeSafeAt!)[0];
    if (lastHome && participants.length > 1) badges.push({ kind: "nightOwl", userId: lastHome.userId });

    const timeline: { at: number; kind: TimelineKind; userId?: string; venueName?: string; count?: number }[] = [{ at: party.starts_at, kind: "start" }];
    const presentIds = new Set(participants.map((p) => p.userId));
    const narration = (
      await ctx.db.query<{ text: string; tone: string; author_id: string; at: number }>("select text, tone, author_id, at from party_narrations where party_id = $1", [party.id])
    )[0];
    const crewAi = Boolean((await ctx.db.query<{ ai_enabled: boolean }>("select ai_enabled from crews where id = $1", [party.crew_id]))[0]?.ai_enabled);
    for (const p of participants) {
      const firstSign = [partyDrinks.find((d) => d.user_id === p.userId)?.consumed_at, checkIns.find((c) => c.user_id === p.userId)?.at]
        .filter((t): t is number => t !== undefined)
        .sort((a, b) => a - b)[0];
      if (firstSign !== undefined) timeline.push({ at: firstSign, kind: "arrival", userId: p.userId });
      if (p.homeSafeAt !== null) timeline.push({ at: p.homeSafeAt, kind: "homeSafe", userId: p.userId });
    }
    for (const c of checkIns) timeline.push({ at: c.at, kind: "checkIn", userId: c.user_id, venueName: c.venue_name });
    for (const t of takeovers) timeline.push({ at: t.started_at, kind: "takeover", userId: t.user_id, venueName: t.venue_name });
    for (const r of rounds) timeline.push({ at: r.created_at, kind: "round", userId: r.payer_id, count: (JSON.parse(r.member_ids) as string[]).length });
    if (party.closed_at !== null) timeline.push({ at: party.closed_at, kind: "end" });
    timeline.sort((a, b) => a.at - b.at);

    if (party.closed_at !== null) {
      await ctx.db.query("update party_members set recap_seen_at = $3 where party_id = $1 and user_id = $2 and recap_seen_at is null", [party.id, user.id, now]);
    }

    return {
      party: { id: party.id, crewId: party.crew_id, name: party.name, mood: party.mood, startsAt: party.starts_at, endsAt: party.ends_at, closedAt: party.closed_at },
      ready: party.closed_at !== null,
      window: { from, to },
      figures,
      participants,
      badges,
      timeline: timeline.filter((t) => !t.userId || presentIds.has(t.userId)),
      reactions: reactions.map((r) => ({ fromId: r.from_id, toId: r.to_id, emoji: r.emoji })),
      quotes: quotes.map((q) => ({ id: q.id, saidBy: q.said_by, addedBy: q.added_by, text: q.text, votes: q.votes, mine: q.mine > 0 })),
      narration: narration ? { text: narration.text, tone: narration.tone, authorId: narration.author_id, at: narration.at } : null,
      aiAvailable: Boolean(ctx.ai) && crewAi,
    };
  });

  /** AI-02: someone who was there publishes the night's story to the recap, after reading it. */
  app.post<{ Params: { id: string } }>("/v1/parties/:id/narration", async (request) => {
    const user = requireUser(request);
    const party = await partyForMember(ctx, request.params.id, user.id);
    const going = await ctx.db.query("select 1 from party_members where party_id = $1 and user_id = $2 and response = 'going'", [party.id, user.id]);
    if (!going.length) throw new HttpError(403, "not_going");
    const input = z.object({ text: z.string().trim().min(10).max(1200), tone: z.enum(["plain", "epic", "roast"]) }).parse(request.body);
    await ctx.db.query(
      `insert into party_narrations (party_id, text, tone, author_id, at) values ($1, $2, $3, $4, $5)
       on conflict (party_id) do update set text = $2, tone = $3, author_id = $4, at = $5`,
      [party.id, input.text, input.tone, user.id, ctx.now()],
    );
    return { ok: true };
  });

  /**
   * AI-02 with AI: a draft written by the model from the facts the phone already shows (first
   * names, places, times; never drinks), only when the server has a provider and the crew opted in.
   * Nothing is stored: the draft comes back to be read, edited and published by a person.
   */
  const drafts = new RateLimiter(10, 60 * 60_000, ctx.now);
  app.post<{ Params: { id: string } }>("/v1/parties/:id/narration/draft", async (request) => {
    const user = requireUser(request);
    const party = await partyForMember(ctx, request.params.id, user.id);
    if (!ctx.ai) throw new HttpError(503, "ai_unavailable");
    const crew = (await ctx.db.query<{ ai_enabled: boolean }>("select ai_enabled from crews where id = $1", [party.crew_id]))[0];
    if (!crew?.ai_enabled) throw new HttpError(403, "ai_off");
    drafts.check(user.id);
    const name = z.string().trim().max(40);
    const input = z
      .object({
        tone: z.enum(["plain", "epic", "roast"]),
        language: z.enum(["fr", "en", "es", "it", "de", "pt", "ru"]),
        facts: z.object({
          party: z.string().max(60),
          date: z.string().max(40),
          people: z.array(name).max(20),
          venues: z.array(z.string().max(60)).max(12),
          firstIn: name.nullable(),
          takeovers: z.array(z.object({ name, venue: z.string().max(60) })).max(5),
          rounds: z.number().int().min(0).max(100),
          lastHome: z.object({ name, time: z.string().max(12) }).nullable(),
          quote: z.string().max(200).nullable(),
        }),
      })
      .parse(request.body);
    const system = [
      `You write the story of a night out among friends, for their own app, in the language "${input.language}".`,
      `Tone: ${input.tone === "plain" ? "plain and warm" : input.tone === "epic" ? "mock-epic, like a saga" : "a friendly roast, teasing but never cruel"}.`,
      "Four to six short sentences, one paragraph. Use only the facts given; invent nothing.",
      "Never mention how much anyone drank, alcohol levels or health. No em dashes, no en dashes, no lists, no hashtags, no emojis, no rhetorical questions.",
      "In French: address nobody as « vous », use wording that does not depend on anyone's gender, and French spacing before : ; ! ?.",
      "Return only the story.",
    ].join(" ");
    try {
      const text = await ctx.ai.complete(system, JSON.stringify(input.facts), 400);
      // The house rule on dashes holds for model output too.
      return { text: text.replace(/[\u2013\u2014]/g, ",").slice(0, 1200) };
    } catch {
      throw new HttpError(502, "ai_failed");
    }
  });

  /** N-23: anyone who was there adds a line; it may name who said it, if that person was there too. */
  app.post<{ Params: { id: string } }>("/v1/parties/:id/quotes", async (request, reply) => {
    const user = requireUser(request);
    const party = await partyForMember(ctx, request.params.id, user.id);
    const input = z.object({ id: z.string().uuid(), text: z.string().trim().min(2).max(200), saidBy: z.string().uuid().nullable() }).parse(request.body);
    const going = await ctx.db.query<{ user_id: string }>("select user_id from party_members where party_id = $1 and response = 'going'", [party.id]);
    const ids = new Set(going.map((g) => g.user_id));
    if (!ids.has(user.id) || (input.saidBy && !ids.has(input.saidBy))) throw new HttpError(403, "not_going");
    await ctx.db.query(
      "insert into party_quotes (id, party_id, said_by, added_by, text, created_at) values ($1, $2, $3, $4, $5, $6) on conflict (id) do nothing",
      [input.id, party.id, input.saidBy, user.id, input.text, ctx.now()],
    );
    ctx.live.notify(ids, { type: "party.changed", partyId: party.id });
    return reply.status(201).send({ id: input.id });
  });

  /** N-23: one vote per person per line; voting again takes it back. */
  app.post<{ Params: { id: string } }>("/v1/quotes/:id/vote", async (request) => {
    const user = requireUser(request);
    const quote = (await ctx.db.query<{ party_id: string }>("select party_id from party_quotes where id = $1", [request.params.id]))[0];
    if (!quote) throw new HttpError(404, "not_found");
    await partyForMember(ctx, quote.party_id, user.id);
    const removed = await ctx.db.query("delete from party_quote_votes where quote_id = $1 and user_id = $2 returning user_id", [request.params.id, user.id]);
    if (!removed.length) await ctx.db.query("insert into party_quote_votes (quote_id, user_id) values ($1, $2)", [request.params.id, user.id]);
    return { voted: removed.length === 0 };
  });

  app.delete<{ Params: { id: string } }>("/v1/quotes/:id", async (request, reply) => {
    const user = requireUser(request);
    // The person who added it, or the person it is about, can take it down.
    const rows = await ctx.db.query("delete from party_quotes where id = $1 and (added_by = $2 or said_by = $2) returning id", [request.params.id, user.id]);
    if (!rows.length) throw new HttpError(404, "not_found");
    return reply.status(204).send();
  });

  /** O-41: one reaction per person per participant; null removes it. */
  app.put<{ Params: { id: string } }>("/v1/parties/:id/recap/reactions", async (request) => {
    const user = requireUser(request);
    const party = await partyForMember(ctx, request.params.id, user.id);
    const input = z.object({ toId: z.string().uuid(), emoji: z.enum(RECAP_EMOJIS).nullable() }).parse(request.body);
    const target = await ctx.db.query("select 1 from party_members where party_id = $1 and user_id = $2 and response = 'going'", [party.id, input.toId]);
    if (!target.length) throw new HttpError(404, "not_found");
    if (input.emoji === null) {
      await ctx.db.query("delete from recap_reactions where party_id = $1 and from_id = $2 and to_id = $3", [party.id, user.id, input.toId]);
    } else {
      await ctx.db.query(
        `insert into recap_reactions (party_id, from_id, to_id, emoji, at) values ($1, $2, $3, $4, $5)
         on conflict (party_id, from_id, to_id) do update set emoji = excluded.emoji, at = excluded.at`,
        [party.id, user.id, input.toId, input.emoji, ctx.now()],
      );
    }
    const members = await ctx.db.query<{ user_id: string }>("select user_id from party_members where party_id = $1 and response = 'going'", [party.id]);
    ctx.live.notify(members.map((m) => m.user_id), { type: "party.changed", partyId: party.id });
    return { ok: true };
  });
}
