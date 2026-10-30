import { territoryTitles } from "@crew/territory";
import type { Context } from "./context";
import { nightOf } from "./time";

/**
 * JOY-03: alternate app icons. Title icons follow the crew titles held right now (TER-06, N-34);
 * seasonal icons unlock for good with one night out together in that season. The phone only
 * offers what this list says: nothing is unlocked on the device.
 */
export const APP_ICONS = ["boss", "globetrotter", "nomad", "winter", "spring", "summer", "autumn"] as const;
export type AppIconId = (typeof APP_ICONS)[number];
export type Season = "winter" | "spring" | "summer" | "autumn";

const TITLE_ICONS = { mayor: "boss", explorer: "globetrotter", nomad: "nomad" } as const;

/** Meteorological seasons of the northern hemisphere, from the night's month. */
export function seasonOf(night: string): Season {
  const month = Number(night.slice(5, 7));
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "autumn";
}

export function unlockedIcons(titles: readonly string[], nightsTogether: readonly string[]): AppIconId[] {
  const out = new Set<AppIconId>();
  for (const title of titles) if (title in TITLE_ICONS) out.add(TITLE_ICONS[title as keyof typeof TITLE_ICONS]);
  for (const night of nightsTogether) out.add(seasonOf(night));
  return APP_ICONS.filter((id) => out.has(id));
}

export async function appIconsOf(ctx: Context, userId: string): Promise<AppIconId[]> {
  const now = ctx.now();
  const checkIns = await ctx.db.query<{ venue_id: string; at: number; time_zone: string }>(
    `select c.venue_id, c.at, cr.time_zone from check_ins c
     join venues v on v.id = c.venue_id and v.kind <> 'home' join crews cr on cr.id = v.crew_id
     where c.user_id = $1 and c.verdict = 'accepted' and c.private = false`,
    [userId],
  );
  const reigns = await ctx.db.query<{ venue_id: string }>("select venue_id from reigns where user_id = $1 and ended_at is null", [userId]);
  const [row] = territoryTitles([
    {
      memberId: userId,
      ruled: reigns.map((r) => r.venue_id),
      checkIns: checkIns.map((c) => ({ venueId: c.venue_id, night: nightOf(c.at, c.time_zone), thisSeason: now - c.at < 31 * 86_400_000 })),
    },
  ]);
  // A night out together: a party that started, this member and at least one other going.
  const nights = await ctx.db.query<{ starts_at: number; time_zone: string }>(
    `select p.starts_at, cr.time_zone from party_members m join parties p on p.id = m.party_id join crews cr on cr.id = p.crew_id
     where m.user_id = $1 and m.response = 'going' and p.starts_at <= $2
       and (select count(*) from party_members o where o.party_id = p.id and o.response = 'going') >= 2`,
    [userId, now],
  );
  return unlockedIcons(
    (row?.titles ?? []).map((t) => t.kind),
    nights.map((n) => nightOf(n.starts_at, n.time_zone)),
  );
}
