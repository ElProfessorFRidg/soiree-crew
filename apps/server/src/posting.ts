import { HttpError, type Context } from "./context";
import { assertCleanText } from "./textFilter";

/** COM-08: a banned account (three strikes) reads everything but publishes nothing others would see. */
export async function assertCanPost(ctx: Context, userId: string): Promise<void> {
  const row = (await ctx.db.query<{ until: number }>("select until from posting_bans where user_id = $1", [userId]))[0];
  if (row && row.until > ctx.now()) throw new HttpError(403, "posting_banned");
}

/** COM-08: the two checks every route storing visible text runs, ban first, then the filters. */
export async function assertPublishable(ctx: Context, userId: string, texts: (string | null | undefined)[], options: { names?: boolean } = {}): Promise<void> {
  await assertCanPost(ctx, userId);
  for (const text of texts) assertCleanText(text, options);
}
