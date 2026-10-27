import { RULES_V1, timePoints, type TerritoryRules } from "./rules";

const MINUTE_MS = 60_000;

/** A check-in already judged by anti-cheat (AC-06). Only accepted, public, opted-in ones reach the engine. */
export interface CountedCheckIn {
  id: string;
  memberId: string;
  venueId: string;
  partyId: string | null;
  /** Server time the check-in was accepted. */
  at: number;
  /** Earliest of: next check-in elsewhere, heading home, end of party, geofence exit. Null while open. */
  endedAt: number | null;
  /** Last proof of presence (check-in, BLE handshake, game at the venue, "still here"). */
  lastProofAt: number;
  corroborated: boolean;
  /** Night key (06:00 to 06:00 local), computed by the caller with @crew/units nightKey. */
  night: string;
  /** ISO week key of the night, for the solo cap. */
  week: string;
}

export interface PartyInfo {
  id: string;
  organiserId: string;
}

export interface GameWin {
  memberId: string;
  venueId: string;
  night: string;
  /** Members who played and had a vested check-in at the venue. */
  participants: number;
}

export interface ScoreInput {
  checkIns: readonly CountedCheckIn[];
  parties: readonly PartyInfo[];
  games: readonly GameWin[];
  /** Venues that already had a counted check-in by this crew before the season: no discovery bonus. */
  discoveredBefore: ReadonlySet<string>;
  /** Members excluded at a venue (works there, TER-11): key `${venueId}:${memberId}`. */
  workplaceExclusions: ReadonlySet<string>;
  now: number;
  rules?: TerritoryRules;
}

export interface MemberVenueScore {
  memberId: string;
  venueId: string;
  points: number;
  nights: number;
  minutes: number;
  /** Server time at which the current total was reached, for the last tie-break. */
  reachedAt: number;
  vested: boolean;
}

export interface VenueStanding {
  venueId: string;
  scores: MemberVenueScore[];
  bossId: string | null;
}

function creditedMinutes(checkIn: CountedCheckIn, now: number, rules: TerritoryRules): number {
  const proofCeiling = checkIn.lastProofAt + rules.proofGraceMinutes * MINUTE_MS;
  const end = Math.min(checkIn.endedAt ?? now, proofCeiling, now);
  const minutes = Math.max(0, (end - checkIn.at) / MINUTE_MS);
  return Math.min(minutes, checkIn.corroborated ? rules.timeCapMinutes : rules.soloTimeCapMinutes);
}

/**
 * Applies the per-member limits of TER-03 in time order: one check-in per venue per night,
 * 20 min between counted check-ins, 6 a night, solo on at most 2 nights a week.
 */
export function countedCheckIns(checkIns: readonly CountedCheckIn[], rules: TerritoryRules = RULES_V1): CountedCheckIn[] {
  const sorted = [...checkIns].sort((a, b) => a.at - b.at);
  const kept: CountedCheckIn[] = [];
  const lastAtByMember = new Map<string, number>();
  const perNight = new Map<string, number>();
  const venueNight = new Set<string>();
  const soloNights = new Map<string, Set<string>>();

  for (const c of sorted) {
    const venueKey = `${c.memberId}:${c.venueId}:${c.night}`;
    if (venueNight.has(venueKey)) continue;
    const last = lastAtByMember.get(c.memberId);
    if (last !== undefined && c.at - last < rules.minMinutesBetweenCheckIns * MINUTE_MS) continue;
    const nightKey = `${c.memberId}:${c.night}`;
    if ((perNight.get(nightKey) ?? 0) >= rules.maxCheckInsPerNight) continue;
    if (!c.corroborated) {
      const weekKey = `${c.memberId}:${c.week}`;
      const nights = soloNights.get(weekKey) ?? new Set<string>();
      if (!nights.has(c.night) && nights.size >= rules.soloNightsPerWeek) continue;
      nights.add(c.night);
      soloNights.set(weekKey, nights);
    }
    venueNight.add(venueKey);
    perNight.set(nightKey, (perNight.get(nightKey) ?? 0) + 1);
    lastAtByMember.set(c.memberId, c.at);
    kept.push(c);
  }
  return kept;
}

/** Season points per member and venue, and the boss of each venue (TER-02, §3.2). */
export function scoreSeason(input: ScoreInput): VenueStanding[] {
  const rules = input.rules ?? RULES_V1;
  const now = input.now;
  const counted = countedCheckIns(input.checkIns, rules).filter(
    (c) => !input.workplaceExclusions.has(`${c.venueId}:${c.memberId}`),
  );

  const scores = new Map<string, MemberVenueScore>();
  const entry = (memberId: string, venueId: string): MemberVenueScore => {
    const key = `${venueId}:${memberId}`;
    let score = scores.get(key);
    if (!score) {
      score = { memberId, venueId, points: 0, nights: 0, minutes: 0, reachedAt: 0, vested: false };
      scores.set(key, score);
    }
    return score;
  };
  const add = (score: MemberVenueScore, points: number, at: number) => {
    if (points <= 0) return;
    score.points += points;
    score.reachedAt = Math.max(score.reachedAt, at);
  };

  const vestedAt = (c: CountedCheckIn) => c.at + rules.vestingMinutes * MINUTE_MS;
  const isVested = (c: CountedCheckIn) => creditedMinutes(c, now, rules) >= rules.vestingMinutes;

  // Check-in and time points.
  for (const c of counted) {
    if (!isVested(c)) continue;
    const score = entry(c.memberId, c.venueId);
    const minutes = creditedMinutes(c, now, rules);
    score.vested = true;
    score.nights += 1;
    score.minutes += minutes;
    add(score, rules.checkInPoints + timePoints(minutes, rules), vestedAt(c));
  }

  // Organiser: quorum of 3 vested members of the party at the venue, 2 venues per party at most.
  for (const party of input.parties) {
    const atVenue = new Map<string, Set<string>>();
    for (const c of counted) {
      if (c.partyId !== party.id || !isVested(c)) continue;
      const members = atVenue.get(c.venueId) ?? new Set<string>();
      members.add(c.memberId);
      atVenue.set(c.venueId, members);
    }
    const eligible = [...atVenue.entries()]
      .filter(([, members]) => members.has(party.organiserId) && members.size >= rules.organiserQuorum)
      .slice(0, rules.organiserMaxVenuesPerParty);
    for (const [venueId] of eligible) {
      if (input.workplaceExclusions.has(`${venueId}:${party.organiserId}`)) continue;
      const checkIn = counted.find((c) => c.partyId === party.id && c.venueId === venueId && c.memberId === party.organiserId)!;
      add(entry(party.organiserId, venueId), rules.organiserPoints, vestedAt(checkIn));
    }
  }

  // Game wins, capped per night and per season.
  const winsNight = new Map<string, number>();
  const winsSeason = new Map<string, number>();
  for (const game of input.games) {
    if (game.participants < 3) continue;
    const vested = counted.some((c) => c.memberId === game.memberId && c.venueId === game.venueId && c.night === game.night && isVested(c));
    if (!vested || input.workplaceExclusions.has(`${game.venueId}:${game.memberId}`)) continue;
    const nightKey = `${game.memberId}:${game.venueId}:${game.night}`;
    const seasonKey = `${game.memberId}:${game.venueId}`;
    if ((winsNight.get(nightKey) ?? 0) >= rules.gameWinsPerNightCap) continue;
    if ((winsSeason.get(seasonKey) ?? 0) >= rules.gameWinsPerSeasonCap) continue;
    winsNight.set(nightKey, (winsNight.get(nightKey) ?? 0) + 1);
    winsSeason.set(seasonKey, (winsSeason.get(seasonKey) ?? 0) + 1);
    add(entry(game.memberId, game.venueId), rules.gameWinPoints, now);
  }

  // First discovery: the first counted check-in ever at a venue, shared within 15 min.
  const discoveries = new Map<string, number>();
  const byVenue = new Map<string, CountedCheckIn[]>();
  for (const c of counted) byVenue.set(c.venueId, [...(byVenue.get(c.venueId) ?? []), c]);
  for (const [venueId, list] of byVenue) {
    if (input.discoveredBefore.has(venueId)) continue;
    const first = list[0]!;
    for (const c of list) {
      if (c.at - first.at > rules.discoveryShareWindowMinutes * MINUTE_MS || !isVested(c)) continue;
      if ((discoveries.get(c.memberId) ?? 0) >= rules.discoveryPerSeasonCap) continue;
      discoveries.set(c.memberId, (discoveries.get(c.memberId) ?? 0) + 1);
      add(entry(c.memberId, venueId), rules.discoveryPoints, vestedAt(c));
    }
  }

  const standings = new Map<string, MemberVenueScore[]>();
  for (const score of scores.values()) standings.set(score.venueId, [...(standings.get(score.venueId) ?? []), score]);
  return [...standings.entries()].map(([venueId, list]) => {
    const sorted = list.sort(
      (a, b) => b.points - a.points || b.nights - a.nights || b.minutes - a.minutes || a.reachedAt - b.reachedAt,
    );
    const top = sorted[0];
    const bossId = top && top.points >= rules.bossMinimumPoints && top.vested ? top.memberId : null;
    return { venueId, scores: sorted, bossId };
  });
}

/**
 * Applies the "incumbent keeps the crown on a tie" rule (§3.2 tie-break 3) given the
 * previous boss, then returns the boss and whether the venue changed hands.
 */
export function resolveBoss(standing: VenueStanding, previousBossId: string | null): { bossId: string | null; takenFrom: string | null } {
  const top = standing.scores[0];
  if (!top || standing.bossId === null) return { bossId: null, takenFrom: null };
  const incumbent = standing.scores.find((s) => s.memberId === previousBossId);
  // Tie-breaks in order: points, nights, minutes, then the incumbent keeps the crown.
  if (incumbent && incumbent.points === top.points && incumbent.nights === top.nights && incumbent.minutes === top.minutes) {
    return { bossId: incumbent.memberId, takenFrom: null };
  }
  return { bossId: standing.bossId, takenFrom: previousBossId && previousBossId !== standing.bossId ? previousBossId : null };
}

/** Members within 10 points of the boss: the "about to be dethroned" banner (TER-04). */
export function challengers(standing: VenueStanding, rules: TerritoryRules = RULES_V1): MemberVenueScore[] {
  const boss = standing.scores.find((s) => s.memberId === standing.bossId);
  if (!boss) return [];
  return standing.scores.filter((s) => s.memberId !== boss.memberId && boss.points - s.points <= rules.alertGapPoints);
}
