import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertCrewMember, HttpError, requireUser, type Context } from "../context";
import { RateLimiter } from "../ratelimit";

const resultSchema = z.object({
  items: z.array(z.object({ id: z.string(), quantity: z.number().int().min(1).max(12) })).max(12),
  minutesAgo: z.number().int().min(0).max(360).nullable(),
  venue: z.string().max(60).nullable(),
  iPay: z.boolean(),
});

/**
 * AI-01: free text such as "two pints and a shot at the Zinc an hour ago, I'm paying" turned into
 * drinks the phone already knows, a time, a bar and who pays, for one-tap confirmation. The model
 * only sees the sentence and the names of the user's drinks; nothing is logged here.
 */
export function aiOrderRoutes(app: FastifyInstance, ctx: Context): void {
  const orders = new RateLimiter(30, 60 * 60_000, ctx.now);
  app.post("/v1/ai/order", async (request) => {
    const user = requireUser(request);
    const input = z
      .object({
        crewId: z.string().uuid(),
        text: z.string().trim().min(2).max(200),
        drinks: z.array(z.object({ id: z.string().max(80), name: z.string().max(60) })).min(1).max(60),
      })
      .parse(request.body);
    await assertCrewMember(ctx, input.crewId, user.id);
    if (!ctx.ai) throw new HttpError(503, "ai_unavailable");
    const crew = (await ctx.db.query<{ ai_enabled: boolean }>("select ai_enabled from crews where id = $1", [input.crewId]))[0];
    if (!crew?.ai_enabled) throw new HttpError(403, "ai_off");
    orders.check(user.id);
    const system = [
      "You turn one sentence about drinks into JSON for a drinks-tracking app. Reply with JSON only, no prose.",
      'Shape: {"items":[{"id":string,"quantity":integer}],"minutesAgo":integer|null,"venue":string|null,"iPay":boolean}.',
      "Use only ids from the list of drinks given; skip anything that matches none. minutesAgo is how long ago the drinks were had, null if not said.",
      "venue is the bar named in the sentence, null if none. iPay is true only if the speaker says they pay or buy the round.",
    ].join(" ");
    const userMessage = JSON.stringify({ sentence: input.text, drinks: input.drinks });
    let raw: string;
    try {
      raw = await ctx.ai.complete(system, userMessage, 300);
    } catch {
      throw new HttpError(502, "ai_failed");
    }
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = resultSchema.safeParse((() => {
      try {
        return JSON.parse(json);
      } catch {
        return null;
      }
    })());
    if (!parsed.success) throw new HttpError(502, "ai_failed");
    const known = new Set(input.drinks.map((d) => d.id));
    return { ...parsed.data, items: parsed.data.items.filter((i) => known.has(i.id)) };
  });
}
