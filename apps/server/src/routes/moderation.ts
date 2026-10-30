import { unlink } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertCrewMember, HttpError, requireUser, type Context } from "../context";
import { newId } from "../crypto";
import type { Db } from "../db";
import { RateLimiter } from "../ratelimit";
import { isOperator } from "./claims";
import { photoPath, signedPhotoUrl } from "./photos";

const uuid = z.string().uuid();
const DAY_MS = 86_400_000;

export const REPORT_KINDS = ["profile", "party", "venue", "review", "photo", "quote", "card"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];
export const REPORT_REASONS = ["harassment", "fake", "inappropriate", "personalData", "other"] as const;

/** COM-08 strikes: three upheld reports within this window stop posting for BAN_MS; each further one renews it. */
export const STRIKE_WINDOW_MS = 180 * DAY_MS;
export const STRIKES_FOR_BAN = 3;
export const BAN_MS = 30 * DAY_MS;
const EXCERPT_LENGTH = 140;

interface Target {
  authorId: string | null;
  /** Crews whose admins handle it; empty means the server operator does (public content). */
  crewIds: string[];
}

/**
 * Who posted the content and who moderates it. Each lookup also checks that the reporter can see
 * the content at all: an id from elsewhere answers 404, like the rest of the API.
 */
async function resolveTarget(ctx: Context, kind: ReportKind, id: string, reporterId: string): Promise<Target> {
  const one = async (sql: string): Promise<{ author: string | null; crew_id: string | null }> => {
    const row = (await ctx.db.query<{ author: string | null; crew_id: string | null }>(sql, [id, reporterId]))[0];
    if (!row) throw new HttpError(404, "not_found");
    return row;
  };
  const crewOnly = (row: { author: string | null; crew_id: string | null }): Target => ({ authorId: row.author, crewIds: row.crew_id ? [row.crew_id] : [] });
  switch (kind) {
    case "profile": {
      if (!(await ctx.db.query("select 1 from users where id = $1", [id])).length) throw new HttpError(404, "not_found");
      const crews = await ctx.db.query<{ crew_id: string }>(
        "select x.crew_id from crew_members x join crew_members y on y.crew_id = x.crew_id where x.user_id = $1 and y.user_id = $2",
        [reporterId, id],
      );
      return { authorId: id, crewIds: crews.map((c) => c.crew_id) };
    }
    case "party":
      return crewOnly(await one("select p.created_by as author, p.crew_id from parties p join crew_members m on m.crew_id = p.crew_id and m.user_id = $2 where p.id = $1"));
    case "venue":
      return crewOnly(await one("select v.created_by as author, v.crew_id from venues v join crew_members m on m.crew_id = v.crew_id and m.user_id = $2 where v.id = $1"));
    case "quote":
      return crewOnly(
        await one(
          "select q.added_by as author, p.crew_id from party_quotes q join parties p on p.id = q.party_id join crew_members m on m.crew_id = p.crew_id and m.user_id = $2 where q.id = $1",
        ),
      );
    case "card":
      return crewOnly(await one("select c.author_id as author, c.crew_id from crew_cards c join crew_members m on m.crew_id = c.crew_id and m.user_id = $2 where c.id = $1"));
    case "review":
      // Public reviews are public content: the operator handles them, not a crew.
      return { authorId: (await one(`select r.user_id as author, null as crew_id from place_reviews r where r.id = $1 and ${reviewVisibleTo("r", "$2")}`)).author, crewIds: [] };
    case "photo": {
      const album = (
        await ctx.db.query<{ author: string; crew_id: string }>(
          "select ph.user_id as author, p.crew_id from photos ph join parties p on p.id = ph.party_id join crew_members m on m.crew_id = p.crew_id and m.user_id = $2 where ph.id = $1",
          [id, reporterId],
        )
      )[0];
      if (album) return { authorId: album.author, crewIds: [album.crew_id] };
      return {
        authorId: (await one(`select ph.user_id as author, null as crew_id from review_photos ph join place_reviews r on r.id = ph.review_id where ph.id = $1 and ${reviewVisibleTo("r", "$2")}`)).author,
        crewIds: [],
      };
    }
  }
}

/** PROF-04: the same audience rule as the place page, as SQL. */
function reviewVisibleTo(alias: string, viewer: string): string {
  return `(${alias}.user_id = ${viewer} or ${alias}.audience in ('public', 'anonymous') or (${alias}.audience = 'friends' and exists (
    select 1 from friendships f where f.status = 'accepted' and ((f.user_a = ${alias}.user_id and f.user_b = ${viewer}) or (f.user_b = ${alias}.user_id and f.user_a = ${viewer})))))`;
}

interface Content {
  text: string;
  photos: string[];
  authorName: string | null;
}

/** What moderators look at, read when they open the queue (the content may have changed or gone since). */
async function contentOf(ctx: Context, kind: string, id: string, authorId: string | null): Promise<Content | null> {
  const db = ctx.db;
  const first = async (sql: string) => (await db.query<{ text: string }>(sql, [id]))[0]?.text;
  let text: string | undefined;
  let photos: string[] = [];
  switch (kind) {
    case "profile":
      text = (await db.query<{ text: string }>("select coalesce(p.bio, '') as text from users u left join profiles p on p.user_id = u.id where u.id = $1", [id]))[0]?.text;
      break;
    case "party":
      text = await first("select name as text from parties where id = $1");
      break;
    case "venue":
      text = await first("select name as text from venues where id = $1");
      break;
    case "quote":
      text = await first("select text from party_quotes where id = $1");
      break;
    case "card":
      text = await first("select text from crew_cards where id = $1");
      break;
    case "review":
      text = await first("select text from place_reviews where id = $1");
      if (text !== undefined) photos = (await db.query<{ id: string }>("select id from review_photos where review_id = $1 order by created_at", [id])).map((p) => signedPhotoUrl(ctx, p.id));
      break;
    case "photo": {
      const exists = await db.query("select 1 from photos where id = $1 union all select 1 from review_photos where id = $1", [id]);
      if (exists.length) {
        text = "";
        photos = [signedPhotoUrl(ctx, id)];
      }
      break;
    }
    default:
      return null;
  }
  if (text === undefined) return null;
  const authorName = authorId ? ((await db.query<{ display_name: string }>("select display_name from users where id = $1", [authorId]))[0]?.display_name ?? null) : null;
  return { text, photos, authorName };
}

/** COM-08 "action": what an upheld report takes down. Photo files go with their rows. */
async function removeContent(ctx: Context, kind: string, id: string): Promise<void> {
  const db = ctx.db;
  switch (kind) {
    case "review": {
      const photos = await db.query<{ id: string }>("select id from review_photos where review_id = $1", [id]);
      await db.query("delete from place_reviews where id = $1", [id]);
      for (const p of photos) await unlink(photoPath(ctx, p.id)).catch(() => undefined);
      break;
    }
    case "photo": {
      const removed = await db.query("delete from photos where id = $1 returning id", [id]);
      if (!removed.length) await db.query("delete from review_photos where id = $1", [id]);
      await unlink(photoPath(ctx, id)).catch(() => undefined);
      break;
    }
    case "quote":
      await db.query("delete from party_quotes where id = $1", [id]);
      break;
    case "card":
      await db.query("update crew_cards set status = 'rejected' where id = $1", [id]);
      break;
    case "profile":
      await db.query("update profiles set bio = '' where user_id = $1", [id]);
      break;
    case "party":
      await db.query("update parties set name = '' where id = $1", [id]);
      break;
    default:
      // Venues are crew data and messages stay end-to-end encrypted: the notice is the action.
      break;
  }
}

/** Counts the strikes still in force and sets or lifts the posting ban to match. */
async function applyStrikes(db: Db, userId: string, now: number): Promise<{ strikes: number; bannedUntil: number | null }> {
  const strikes = (await db.query<{ n: number }>("select count(*)::int as n from strikes where user_id = $1 and at > $2", [userId, now - STRIKE_WINDOW_MS]))[0]!.n;
  if (strikes < STRIKES_FOR_BAN) {
    await db.query("delete from posting_bans where user_id = $1", [userId]);
    return { strikes, bannedUntil: null };
  }
  const until = now + BAN_MS;
  await db.query("insert into posting_bans (user_id, until) values ($1, $2) on conflict (user_id) do update set until = greatest(posting_bans.until, excluded.until)", [userId, until]);
  return { strikes, bannedUntil: until };
}

interface ReportRow {
  id: string;
  reporter: string;
  target_kind: string;
  target_id: string;
  crew_id: string | null;
  reason: string;
  author_id: string | null;
  decision: string | null;
}

/**
 * COM-08, DSA notice and action: one decision covers every open report on the same content in the
 * same queue. Upheld: the content comes down and its author gets a statement of reasons; an
 * operator decision also adds a strike. Every reporter hears the outcome.
 */
async function decide(ctx: Context, report: ReportRow, decision: "upheld" | "dismissed", ground: string, by: "crew" | "operator", deciderId: string): Promise<void> {
  const now = ctx.now();
  const scope = report.crew_id
    ? await ctx.db.query<ReportRow>("select * from reports where target_kind = $1 and target_id = $2 and crew_id = $3 and decision is null", [report.target_kind, report.target_id, report.crew_id])
    : await ctx.db.query<ReportRow>("select * from reports where target_kind = $1 and target_id = $2 and crew_id is null and decision is null", [report.target_kind, report.target_id]);
  const content = decision === "upheld" ? await contentOf(ctx, report.target_kind, report.target_id, report.author_id) : null;
  await ctx.db.query("update reports set decision = $2, ground = $3, decided_by = $4, handled_at = $5 where id = any($1::uuid[])", [
    scope.map((r) => r.id),
    decision,
    ground,
    deciderId,
    now,
  ]);
  const told = new Set<string>();
  const notice = (userId: string, kind: string, extra: { excerpt?: string; strikes?: number; bannedUntil?: number | null } = {}) =>
    ctx.db.query(
      "insert into moderation_notices (id, user_id, report_id, kind, target_kind, ground, excerpt, decided_by, strikes, banned_until, at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
      [newId(), userId, report.id, kind, report.target_kind, ground, extra.excerpt ?? "", by, extra.strikes ?? 0, extra.bannedUntil ?? null, now],
    );
  if (decision === "upheld") {
    await removeContent(ctx, report.target_kind, report.target_id);
    if (report.author_id) {
      let standing = { strikes: 0, bannedUntil: null as number | null };
      if (by === "operator") {
        await ctx.db.query("insert into strikes (id, user_id, report_id, ground, at) values ($1, $2, $3, $4, $5)", [newId(), report.author_id, report.id, ground, now]);
        standing = await applyStrikes(ctx.db, report.author_id, now);
      }
      await notice(report.author_id, "removed", { excerpt: (content?.text ?? "").slice(0, EXCERPT_LENGTH), ...standing });
      told.add(report.author_id);
    }
  }
  for (const reporter of new Set(scope.map((r) => r.reporter))) {
    await notice(reporter, decision === "upheld" ? "reportUpheld" : "reportDismissed");
    told.add(reporter);
  }
  // push: moderation.notice
  ctx.live.notify(told, { type: "moderation.notice" });
}

const reportView = async (ctx: Context, r: ReportRow & { note: string; at: number; handled_at: number | null; evidence: string | null; ground: string | null }) => ({
  id: r.id,
  targetKind: r.target_kind,
  targetId: r.target_id,
  reason: r.reason,
  note: r.note,
  at: r.at,
  handledAt: r.handled_at,
  decision: r.decision,
  ground: r.ground,
  // What was reported, as it is now (null once it is gone).
  content: r.decision ? null : await contentOf(ctx, r.target_kind, r.target_id, r.author_id),
  // MSG-07: the messages the reporter chose to send, decrypted on their phone.
  ...(r.evidence ? { messages: ctx.sealer.open<{ id: string; userId: string; body: string; at: number; reported: boolean }[]>(r.evidence) } : {}),
});

const decisionSchema = z.object({ decision: z.enum(["upheld", "dismissed"]), ground: z.enum(REPORT_REASONS).optional() });

export function moderationRoutes(app: FastifyInstance, ctx: Context): void {
  const reports = new RateLimiter(20, 60 * 60_000, ctx.now);

  /**
   * COM-08, O-77: report a profile, a party, a venue, a review, a photo, a quote or a crew card.
   * Crew content goes to the crew's admins; public content (reviews, review photos, a stranger's
   * profile) to the server operator. The reporter stays anonymous to both.
   */
  app.post("/v1/reports", async (request, reply) => {
    const user = requireUser(request);
    reports.check(user.id);
    const input = z
      .object({ targetKind: z.enum(REPORT_KINDS), targetId: uuid, reason: z.enum(REPORT_REASONS), note: z.string().trim().max(300).optional() })
      .parse(request.body);
    const target = await resolveTarget(ctx, input.targetKind, input.targetId, user.id);
    if (target.authorId === user.id) throw new HttpError(400, "invalid");
    const open = await ctx.db.query("select 1 from reports where reporter = $1 and target_kind = $2 and target_id = $3 and decision is null and handled_at is null", [
      user.id,
      input.targetKind,
      input.targetId,
    ]);
    if (open.length) return reply.status(201).send({ ok: true });
    for (const crewId of target.crewIds.length ? target.crewIds : [null]) {
      await ctx.db.query(
        "insert into reports (id, reporter, target_kind, target_id, crew_id, reason, note, at, author_id) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        [newId(), user.id, input.targetKind, input.targetId, crewId, input.reason, input.note ?? "", ctx.now(), target.authorId],
      );
    }
    return reply.status(201).send({ ok: true, to: target.crewIds.length ? "crew" : "operator" });
  });

  /** Admins see the reports about their crew, with the content as it is now; the reporter stays anonymous. */
  app.get<{ Params: { id: string } }>("/v1/crews/:id/reports", async (request) => {
    const user = requireUser(request);
    const { role } = await assertCrewMember(ctx, request.params.id, user.id);
    if (role !== "admin") throw new HttpError(403, "forbidden");
    const rows = await ctx.db.query<ReportRow & { note: string; at: number; handled_at: number | null; evidence: string | null; ground: string | null }>(
      "select * from reports where crew_id = $1 order by (handled_at is null) desc, at desc limit 100",
      [request.params.id],
    );
    return { reports: await Promise.all(rows.map((r) => reportView(ctx, r))) };
  });

  /** Kept for older apps: "handled" without a decision. */
  app.post<{ Params: { id: string; reportId: string } }>("/v1/crews/:id/reports/:reportId/handled", async (request) => {
    const user = requireUser(request);
    const { role } = await assertCrewMember(ctx, request.params.id, user.id);
    if (role !== "admin") throw new HttpError(403, "forbidden");
    await ctx.db.query("update reports set handled_at = $3 where id = $1 and crew_id = $2", [request.params.reportId, request.params.id, ctx.now()]);
    return { ok: true };
  });

  /** COM-08: a crew admin takes the content down (with the reason sent to its author) or leaves it. */
  app.post<{ Params: { id: string; reportId: string } }>("/v1/crews/:id/reports/:reportId/decision", async (request) => {
    const user = requireUser(request);
    const { role } = await assertCrewMember(ctx, request.params.id, user.id);
    if (role !== "admin") throw new HttpError(403, "forbidden");
    const input = decisionSchema.parse(request.body);
    const report = (await ctx.db.query<ReportRow>("select * from reports where id = $1 and crew_id = $2", [uuid.parse(request.params.reportId), request.params.id]))[0];
    if (!report) throw new HttpError(404, "not_found");
    if (report.decision) throw new HttpError(409, "conflict");
    await decide(ctx, report, input.decision, input.ground ?? report.reason, "crew", user.id);
    return { ok: true };
  });

  /** COM-08: the operator's queue: public content, and appeals against the operator's own decisions. */
  app.get("/v1/operator/reports", async (request) => {
    const user = requireUser(request);
    if (!isOperator(ctx, user)) throw new HttpError(403, "forbidden");
    const rows = await ctx.db.query<ReportRow & { note: string; at: number; handled_at: number | null; evidence: string | null; ground: string | null }>(
      "select * from reports where crew_id is null and decision is null and handled_at is null order by at limit 100",
    );
    const appeals = await ctx.db.query<{ id: string; user_id: string; display_name: string; target_kind: string; ground: string; excerpt: string; appeal: string; appealed_at: number }>(
      `select n.id, n.user_id, u.display_name, n.target_kind, n.ground, n.excerpt, n.appeal, n.appealed_at from moderation_notices n join users u on u.id = n.user_id
       where n.appealed_at is not null and n.appeal_outcome is null and n.decided_by = 'operator' order by n.appealed_at limit 100`,
    );
    return {
      reports: await Promise.all(rows.map((r) => reportView(ctx, r))),
      appeals: appeals.map((a) => ({ id: a.id, userId: a.user_id, name: a.display_name, targetKind: a.target_kind, ground: a.ground, excerpt: a.excerpt, appeal: a.appeal, at: a.appealed_at })),
    };
  });

  app.post<{ Params: { id: string } }>("/v1/operator/reports/:id", async (request) => {
    const user = requireUser(request);
    if (!isOperator(ctx, user)) throw new HttpError(403, "forbidden");
    const input = decisionSchema.parse(request.body);
    const report = (await ctx.db.query<ReportRow>("select * from reports where id = $1 and crew_id is null", [uuid.parse(request.params.id)]))[0];
    if (!report) throw new HttpError(404, "not_found");
    if (report.decision) throw new HttpError(409, "conflict");
    await decide(ctx, report, input.decision, input.ground ?? report.reason, "operator", user.id);
    return { ok: true };
  });

  /**
   * DSA internal complaint: the operator looks again. Reversed takes the strike back (and the ban
   * with it if it falls under three); the content itself is gone and stays gone.
   */
  app.post<{ Params: { id: string } }>("/v1/operator/appeals/:id", async (request) => {
    const user = requireUser(request);
    if (!isOperator(ctx, user)) throw new HttpError(403, "forbidden");
    const { outcome } = z.object({ outcome: z.enum(["reversed", "confirmed"]) }).parse(request.body);
    const notice = (
      await ctx.db.query<{ user_id: string; report_id: string | null }>(
        "select user_id, report_id from moderation_notices where id = $1 and appealed_at is not null and appeal_outcome is null",
        [uuid.parse(request.params.id)],
      )
    )[0];
    if (!notice) throw new HttpError(404, "not_found");
    await ctx.db.query("update moderation_notices set appeal_outcome = $2, read_at = null where id = $1", [request.params.id, outcome]);
    if (outcome === "reversed" && notice.report_id) {
      await ctx.db.query("delete from strikes where report_id = $1 and user_id = $2", [notice.report_id, notice.user_id]);
      const standing = await applyStrikes(ctx.db, notice.user_id, ctx.now());
      await ctx.db.query("update moderation_notices set strikes = $2, banned_until = $3 where id = $1", [request.params.id, standing.strikes, standing.bannedUntil]);
    }
    // push: moderation.notice
    ctx.live.notify([notice.user_id], { type: "moderation.notice" });
    return { ok: true };
  });

  /** COM-08 statement of reasons: every decision about my content or my reports, with my standing. */
  app.get("/v1/me/notices", async (request) => {
    const user = requireUser(request);
    const now = ctx.now();
    const rows = await ctx.db.query<{
      id: string;
      kind: string;
      target_kind: string;
      ground: string;
      excerpt: string;
      decided_by: string;
      strikes: number;
      banned_until: number | null;
      at: number;
      read_at: number | null;
      appeal: string | null;
      appealed_at: number | null;
      appeal_outcome: string | null;
    }>("select * from moderation_notices where user_id = $1 order by at desc limit 100", [user.id]);
    const strikes = (await ctx.db.query<{ n: number }>("select count(*)::int as n from strikes where user_id = $1 and at > $2", [user.id, now - STRIKE_WINDOW_MS]))[0]!.n;
    const ban = (await ctx.db.query<{ until: number }>("select until from posting_bans where user_id = $1 and until > $2", [user.id, now]))[0];
    return {
      strikes,
      strikesForBan: STRIKES_FOR_BAN,
      bannedUntil: ban?.until ?? null,
      unread: rows.filter((r) => r.read_at === null).length,
      notices: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        targetKind: r.target_kind,
        ground: r.ground,
        excerpt: r.excerpt,
        decidedBy: r.decided_by,
        strikes: r.strikes,
        bannedUntil: r.banned_until,
        at: r.at,
        read: r.read_at !== null,
        appeal: r.appealed_at ? { text: r.appeal ?? "", at: r.appealed_at, outcome: r.appeal_outcome } : null,
        canAppeal: r.kind === "removed" && r.decided_by === "operator" && r.appealed_at === null,
      })),
    };
  });

  app.post("/v1/me/notices/read", async (request) => {
    const user = requireUser(request);
    await ctx.db.query("update moderation_notices set read_at = $2 where user_id = $1 and read_at is null", [user.id, ctx.now()]);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/v1/me/notices/:id/appeal", async (request) => {
    const user = requireUser(request);
    const { text } = z.object({ text: z.string().trim().min(2).max(500) }).parse(request.body);
    const rows = await ctx.db.query(
      "update moderation_notices set appeal = $3, appealed_at = $4 where id = $1 and user_id = $2 and kind = 'removed' and decided_by = 'operator' and appealed_at is null returning id",
      [uuid.parse(request.params.id), user.id, text, ctx.now()],
    );
    if (!rows.length) throw new HttpError(409, "conflict");
    return { ok: true };
  });
}
