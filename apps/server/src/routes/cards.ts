import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertCrewMember, HttpError, requireUser, type Context } from "../context";
import { RateLimiter } from "../ratelimit";

const uuid = z.string().uuid();
const KINDS = ["neverEver", "pointBlank", "verdict", "truth", "dare", "bigDare"] as const;
const LEVELS = ["normal", "hard", "extreme"] as const;
/** A crew keeps its cards readable: no more than this many waiting for the admin at once. */
const MAX_PENDING = 50;

interface CardRow {
  id: string;
  crew_id: string;
  author_id: string;
  kind: string;
  level: string;
  text: string;
  status: string;
  created_at: number;
}

const view = (c: CardRow) => ({ id: c.id, authorId: c.author_id, kind: c.kind, level: c.level, text: c.text, status: c.status, createdAt: c.created_at });

export function cardRoutes(app: FastifyInstance, ctx: Context): void {
  const writes = new RateLimiter(30, 60 * 60_000, ctx.now);

  /** N-33: a member writes a card; it waits for the admin unless the admin wrote it. */
  app.post<{ Params: { id: string } }>("/v1/crews/:id/cards", async (request, reply) => {
    const user = requireUser(request);
    const { role } = await assertCrewMember(ctx, request.params.id, user.id);
    writes.check(user.id);
    const input = z
      .object({ id: uuid, kind: z.enum(KINDS), level: z.enum(LEVELS), text: z.string().trim().min(4).max(220) })
      .parse(request.body);
    const pending = await ctx.db.query<{ n: number }>("select count(*)::int as n from crew_cards where crew_id = $1 and status = 'pending'", [request.params.id]);
    if (role !== "admin" && pending[0]!.n >= MAX_PENDING) throw new HttpError(429, "too_many");
    // Only the engines' placeholders survive; anything else in braces would print as is.
    const text = input.text.replace(/\{(?!player\}|other\})[^}]*\}/g, "");
    await ctx.db.query(
      "insert into crew_cards (id, crew_id, author_id, kind, level, text, status, created_at, reviewed_by) values ($1, $2, $3, $4, $5, $6, $7, $8, $9) on conflict (id) do nothing",
      [input.id, request.params.id, user.id, input.kind, input.level, text, role === "admin" ? "approved" : "pending", ctx.now(), role === "admin" ? user.id : null],
    );
    return reply.status(201).send({ status: role === "admin" ? "approved" : "pending" });
  });

  /** Approved cards for everyone; the admin also sees what waits, an author sees their own. */
  app.get<{ Params: { id: string } }>("/v1/crews/:id/cards", async (request) => {
    const user = requireUser(request);
    const { role } = await assertCrewMember(ctx, request.params.id, user.id);
    const rows = await ctx.db.query<CardRow>(
      `select * from crew_cards where crew_id = $1 and (status = 'approved' or ($2 and status = 'pending') or author_id = $3) order by created_at desc`,
      [request.params.id, role === "admin", user.id],
    );
    return { cards: rows.map(view) };
  });

  /**
   * AI-03: the admin describes a few inside jokes, the model suggests cards; nothing is saved here,
   * the admin keeps the ones worth it through the usual route, approved straight away.
   */
  const generations = new RateLimiter(10, 60 * 60_000, ctx.now);
  app.post<{ Params: { id: string } }>("/v1/crews/:id/cards/suggest", async (request) => {
    const user = requireUser(request);
    const { role } = await assertCrewMember(ctx, request.params.id, user.id);
    if (role !== "admin") throw new HttpError(403, "forbidden");
    if (!ctx.ai) throw new HttpError(503, "ai_unavailable");
    const crew = (await ctx.db.query<{ ai_enabled: boolean }>("select ai_enabled from crews where id = $1", [request.params.id]))[0];
    if (!crew?.ai_enabled) throw new HttpError(403, "ai_off");
    generations.check(user.id);
    const input = z
      .object({ kind: z.enum(KINDS), level: z.enum(LEVELS), language: z.enum(["fr", "en"]), jokes: z.string().trim().min(10).max(600) })
      .parse(request.body);
    const kindHint: Record<(typeof KINDS)[number], string> = {
      neverEver: 'endings of "Never have I ever..." (no prefix)',
      pointBlank: "questions where everyone points at someone",
      verdict: 'endings of "Which of the two..." (no prefix)',
      truth: "truth questions for the player",
      dare: "dares for the player",
      bigDare: "short party dares",
    };
    const system = [
      `You write party game cards for one group of friends, in "${input.language}". Write 5 ${kindHint[input.kind]}, level ${input.level}.`,
      "Build on their inside jokes; vary sentence shapes and lengths; real punchlines, no stock quips.",
      "Nothing hateful, no real names of people outside the group, nothing illegal or dangerous, no pressure to drink.",
      "No em dashes or en dashes, no emojis. In French: tutoiement, never « vous ».",
      'Reply with JSON only: {"cards":[string,string,string,string,string]}.',
    ].join(" ");
    let raw: string;
    try {
      raw = await ctx.ai.complete(system, input.jokes, 500);
    } catch {
      throw new HttpError(502, "ai_failed");
    }
    try {
      const parsed = z.object({ cards: z.array(z.string().min(4).max(220)).max(8) }).parse(JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)));
      return { cards: parsed.cards.map((c) => c.replace(/[\u2013\u2014]/g, ",").trim()) };
    } catch {
      throw new HttpError(502, "ai_failed");
    }
  });

  app.post<{ Params: { id: string } }>("/v1/cards/:id/review", async (request) => {
    const user = requireUser(request);
    const card = (await ctx.db.query<CardRow>("select * from crew_cards where id = $1", [uuid.parse(request.params.id)]))[0];
    if (!card) throw new HttpError(404, "not_found");
    const { role } = await assertCrewMember(ctx, card.crew_id, user.id);
    if (role !== "admin") throw new HttpError(403, "forbidden");
    const { approve } = z.object({ approve: z.boolean() }).parse(request.body);
    await ctx.db.query("update crew_cards set status = $2, reviewed_by = $3 where id = $1", [card.id, approve ? "approved" : "rejected", user.id]);
    return { status: approve ? "approved" : "rejected" };
  });

  app.delete<{ Params: { id: string } }>("/v1/cards/:id", async (request, reply) => {
    const user = requireUser(request);
    const card = (await ctx.db.query<CardRow>("select * from crew_cards where id = $1", [uuid.parse(request.params.id)]))[0];
    if (!card) throw new HttpError(404, "not_found");
    const { role } = await assertCrewMember(ctx, card.crew_id, user.id);
    if (card.author_id !== user.id && role !== "admin") throw new HttpError(403, "forbidden");
    await ctx.db.query("delete from crew_cards where id = $1", [card.id]);
    return reply.status(204).send();
  });
}
