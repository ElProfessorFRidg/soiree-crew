/** MOT-10: which badges get the unlock moment, decided on what this phone has already shown. */

export interface HonourBadges {
  userId: string;
  badges: readonly string[];
}

export const badgeKey = (crewId: string, userId: string, badge: string): string => `${crewId}:${userId}:${badge}`;

/**
 * Keys of the badges to celebrate now. A badge is celebrated once per phone. The first time a
 * crew's honours are seen, only the viewer's own badges pop: nobody wants twenty bursts at once.
 */
export function badgesToCelebrate(seen: ReadonlySet<string>, crewId: string, viewerId: string | null, honours: readonly HonourBadges[]): string[] {
  const firstVisit = ![...seen].some((key) => key.startsWith(`${crewId}:`));
  const out: string[] = [];
  for (const honour of honours) {
    if (firstVisit && honour.userId !== viewerId) continue;
    for (const badge of honour.badges) {
      const key = badgeKey(crewId, honour.userId, badge);
      if (!seen.has(key)) out.push(key);
    }
  }
  return out;
}

/** Every badge on screen, to remember once shown. A crew marker keeps an empty first visit from counting as never seen. */
export function badgesShown(crewId: string, honours: readonly HonourBadges[]): string[] {
  return [`${crewId}:`, ...honours.flatMap((h) => h.badges.map((b) => badgeKey(crewId, h.userId, b)))];
}
