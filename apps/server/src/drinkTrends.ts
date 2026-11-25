import type { Context } from "./context";

const TREND_WINDOW_MS = 30 * 24 * 60 * 60_000;

export function drinkTrends(ctx: Context, crewId: string, venueId: string | null) {
  return ctx.db.query<{ drinkId: string; votes: number }>(
    `select r.drink_id as "drinkId", count(distinct r.user_id)::int as votes
     from drink_recommendations r
     join venues v on v.id = r.venue_id
     join crew_members m on m.crew_id = v.crew_id and m.user_id = r.user_id
     where v.crew_id = $1 and ($2::uuid is null or v.id = $2)
       and v.kind in ('bar', 'club') and r.updated_at >= $3
     group by r.drink_id
     order by votes desc, max(r.updated_at) desc, r.drink_id limit 8`,
    [crewId, venueId, ctx.now() - TREND_WINDOW_MS],
  );
}

export function currentDrinkRecommendation(ctx: Context, venueId: string, userId: string) {
  return ctx.db.query<{ drink_id: string }>(
    "select drink_id from drink_recommendations where venue_id = $1 and user_id = $2 and updated_at >= $3",
    [venueId, userId, ctx.now() - TREND_WINDOW_MS],
  );
}
