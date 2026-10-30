import type { Context } from "./context";
import { reviewOnProfile, seesDates, STATS, type Relation, type ReviewAudience, type Section, type Stat } from "./profileRules";
import { signedPhotoUrl } from "./routes/photos";

const HOUR_MS = 3_600_000;
/** O-43: how far back a friend's night history goes on their profile. */
const HISTORY_NIGHTS = 30;

export interface Hidden {
  venues: Set<string>;
  reviews: Set<string>;
  stats: Set<Stat>;
}

/** PROF-03: what the owner hid one by one. Stored as JSON arrays next to the audiences. */
export async function hiddenItems(ctx: Context, ownerId: string): Promise<Hidden> {
  const row = (
    await ctx.db.query<{ hidden_venues: string; hidden_reviews: string; hidden_stats: string }>(
      "select hidden_venues, hidden_reviews, hidden_stats from profiles where user_id = $1",
      [ownerId],
    )
  )[0];
  const parse = (text: string | undefined) => (text ? (JSON.parse(text) as string[]) : []);
  return {
    venues: new Set(parse(row?.hidden_venues)),
    reviews: new Set(parse(row?.hidden_reviews)),
    stats: new Set(parse(row?.hidden_stats).filter((s): s is Stat => (STATS as readonly string[]).includes(s))),
  };
}

/**
 * PROF-02 reviews (COM-02): the owner's reviews, each filtered by its own audience as well as the
 * section's (PROF-04), minus the ones hidden one by one (PROF-03). Visit dates follow PROF-05.
 */
async function reviewsSection(ctx: Context, ownerId: string, relation: Relation, hidden: Hidden) {
  const rows = await ctx.db.query<{ id: string; venue_id: string; name: string; ratings: string; text: string; audience: ReviewAudience; visited_at: number }>(
    `select r.id, r.venue_id, v.name, r.ratings, r.text, r.audience, r.visited_at from place_reviews r join venues v on v.id = r.venue_id
     where r.user_id = $1 order by r.updated_at desc limit 50`,
    [ownerId],
  );
  const shown = rows.filter((r) => reviewOnProfile(r.audience, relation) && (relation.me || !hidden.reviews.has(r.id)));
  const photos = shown.length
    ? await ctx.db.query<{ id: string; review_id: string }>("select id, review_id from review_photos where review_id = any($1::uuid[]) order by created_at", [shown.map((r) => r.id)])
    : [];
  const dates = seesDates(relation);
  return shown.map((r) => ({
    id: r.id,
    venueId: r.venue_id,
    place: r.name,
    ratings: JSON.parse(r.ratings) as Record<string, number>,
    text: r.text,
    photos: photos.filter((p) => p.review_id === r.id).map((p) => ({ id: p.id, url: signedPhotoUrl(ctx, p.id) })),
    ...(dates ? { visitedAt: r.visited_at } : {}),
    ...(relation.me ? { audience: r.audience, hidden: hidden.reviews.has(r.id) } : {}),
  }));
}

/** PROF-02 games (N-24): wins the server recorded, per game. */
async function gamesSection(ctx: Context, ownerId: string) {
  const rows = await ctx.db.query<{ game_id: string; n: number }>("select game_id, count(*)::int as n from game_wins where winner_id = $1 group by game_id order by n desc", [ownerId]);
  return { wins: rows.reduce((s, r) => s + r.n, 0), byGame: rows.map((r) => ({ gameId: r.game_id, wins: r.n })) };
}

/**
 * O-43: the nights out, newest first. Dated, so never to strangers (PROF-05). A party's name only
 * shows to members of its crew; the bars come with it when the venues section is visible too.
 */
async function nightHistory(ctx: Context, ownerId: string, viewerId: string, relation: Relation, venuesVisible: boolean, hidden: Hidden, now: number) {
  const parties = await ctx.db.query<{ id: string; name: string; starts_at: number; ends_at: number; closed_at: number | null; shared: boolean }>(
    `select p.id, p.name, p.starts_at, p.ends_at, p.closed_at,
            exists (select 1 from crew_members c where c.crew_id = p.crew_id and c.user_id = $3) as shared
     from party_members m join parties p on p.id = m.party_id
     where m.user_id = $1 and m.response = 'going' and p.starts_at <= $2 order by p.starts_at desc limit ${HISTORY_NIGHTS}`,
    [ownerId, now, viewerId],
  );
  const visits =
    venuesVisible && parties.length
      ? await ctx.db.query<{ venue_id: string; name: string; at: number }>(
          `select c.venue_id, v.name, c.at from check_ins c join venues v on v.id = c.venue_id and v.kind <> 'home'
           where c.user_id = $1 and c.verdict = 'accepted' and c.private = false and c.at >= $2 and c.at <= $3`,
          [ownerId, parties[parties.length - 1]!.starts_at - 2 * HOUR_MS, now],
        )
      : [];
  return parties.map((p) => {
    const end = p.closed_at ?? Math.min(now, p.ends_at);
    const bars = [
      ...new Set(visits.filter((v) => v.at >= p.starts_at - 2 * HOUR_MS && v.at <= end && (relation.me || !hidden.venues.has(v.venue_id))).map((v) => v.name)),
    ];
    return { at: p.starts_at, name: relation.me || p.shared ? p.name || null : null, venues: bars };
  });
}

/** PROF-03: where each hideable figure lives in the sections. */
const STAT_PATHS: Record<Stat, [Section, string]> = {
  drinksTotal: ["drinks", "total"],
  favourites: ["drinks", "favourites"],
  usualFirstDrink: ["drinks", "usualFirstDrink"],
  usualPace: ["drinks", "usualPacePerHour"],
  usualLeaving: ["drinks", "usualLeaving"],
  highestBac: ["records", "highestBac"],
  biggestNight: ["records", "biggestNight"],
  nightsTotal: ["nights", "total"],
  nightsRecent: ["nights", "last30Days"],
  nightHistory: ["nights", "history"],
  gameWins: ["games", "wins"],
};

/**
 * Adds the sections PROF-02 and O-43 brought (reviews, games, night history) and removes the
 * figures hidden one by one (PROF-03) for anyone but the owner. Runs after the base sections.
 */
export async function addExtraSections(
  ctx: Context,
  out: Partial<Record<Section, unknown>>,
  args: { ownerId: string; viewerId: string; relation: Relation; visible: (section: Section) => boolean; now: number },
): Promise<void> {
  const { ownerId, viewerId, relation, visible, now } = args;
  const hidden = await hiddenItems(ctx, ownerId);
  if (visible("reviews")) out.reviews = await reviewsSection(ctx, ownerId, relation, hidden);
  if (visible("games")) out.games = await gamesSection(ctx, ownerId);
  if (out.nights && seesDates(relation)) {
    (out.nights as Record<string, unknown>).history = await nightHistory(ctx, ownerId, viewerId, relation, visible("venues"), hidden, now);
  }
  if (relation.me) return;
  for (const stat of hidden.stats) {
    const [section, key] = STAT_PATHS[stat];
    const value = out[section] as Record<string, unknown> | undefined;
    if (!value) continue;
    delete value[key];
    if (stat === "gameWins") delete value.byGame;
  }
}
