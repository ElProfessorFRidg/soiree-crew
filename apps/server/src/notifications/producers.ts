import { AC_CONFIG } from "../anticheat";
import type { Context } from "../context";
import { computeBoard, drinkingLeaderboardEnabled } from "../routes/leaderboards";
import { crewTimeZone, type Takeover } from "../territory";
import { claimMark, notifyLater, releaseHeld } from "./notify";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
/** N-29: same threshold as the "quiet" tag on the live dashboard. */
const QUIET_AFTER_MS = 45 * MINUTE_MS;
/** N-25: the crew hears who is not home this long after the night ended. */
const NOT_HOME_AFTER_MS = 60 * MINUTE_MS;
/** Nights older than this get no home check: the sweeper never wakes up old parties. */
const HOME_WINDOW_MS = 6 * HOUR_MS;
/** RANK-02: at most one "X just overtook you" per pair per hour. */
const OVERTAKE_GAP_MS = HOUR_MS;

async function nameOf(ctx: Context, userId: string): Promise<string> {
  return (await ctx.db.query<{ display_name: string }>("select display_name from users where id = $1", [userId]))[0]?.display_name ?? "";
}

async function crewMembers(ctx: Context, crewId: string): Promise<string[]> {
  return (await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1", [crewId])).map((m) => m.user_id);
}

async function goingMembers(ctx: Context, partyId: string): Promise<string[]> {
  return (await ctx.db.query<{ user_id: string }>("select user_id from party_members where party_id = $1 and response = 'going'", [partyId])).map((m) => m.user_id);
}

/** N-03: the crew hears about a "who's in?" call; the reply buttons answer it (QOL-03). */
export async function notifyOutCall(ctx: Context, crewId: string, callId: string, userId: string): Promise<void> {
  await notifyLater(ctx, await crewMembers(ctx, crewId), { kind: "outCall", actorId: userId, crewId, refId: callId, params: { name: await nameOf(ctx, userId) } });
}

/** N-28: every member of the crew, at once, whatever their settings. */
export async function notifySos(ctx: Context, crewId: string, partyId: string | null, alertId: string, userId: string): Promise<void> {
  await notifyLater(ctx, await crewMembers(ctx, crewId), { kind: "sos", actorId: userId, crewId, partyId, refId: alertId, params: { name: await nameOf(ctx, userId) } });
}

/** N-36: the others at the party, quietly. */
export async function notifyUnwell(ctx: Context, partyId: string, userId: string): Promise<void> {
  await notifyLater(ctx, await goingMembers(ctx, partyId), { kind: "unwell", actorId: userId, partyId, params: { name: await nameOf(ctx, userId) } });
}

/** SEC-07: the phones already signed in hear about a new one. */
export async function notifyNewDevice(ctx: Context, userId: string): Promise<void> {
  await notifyLater(ctx, [userId], { kind: "newDevice" });
}

/** MSG-04: content-free, one unread row per conversation however many messages come in. */
export async function notifyChatMessage(ctx: Context, conversation: { id: string; party_id: string | null; crew_id: string | null }, members: string[], senderId: string): Promise<void> {
  await notifyLater(ctx, members, {
    kind: "chatMessage",
    actorId: senderId,
    partyId: conversation.party_id,
    crewId: conversation.crew_id,
    refId: conversation.id,
    collapseKey: `chat:${conversation.id}`,
  });
}

/** N-18: someone logged a round for you; "Got it" confirms it from the notification (QOL-03). */
export async function notifyRound(ctx: Context, partyId: string, roundId: string, memberIds: string[], actorId: string): Promise<void> {
  await notifyLater(ctx, memberIds, { kind: "round", actorId, partyId, refId: roundId, params: { name: await nameOf(ctx, actorId) } });
}

/** TER-04: "X just took Bar Y from you" to the dethroned boss; the rest of the crew hears who rules it now. */
export async function notifyTakeover(ctx: Context, crewId: string, takeover: Takeover): Promise<void> {
  if (!takeover.bossId) return;
  const venue = (await ctx.db.query<{ name: string }>("select name from venues where id = $1", [takeover.venueId]))[0]?.name ?? "";
  const params = { name: await nameOf(ctx, takeover.bossId), venue };
  const members = await crewMembers(ctx, crewId);
  if (takeover.takenFrom) await notifyLater(ctx, [takeover.takenFrom], { kind: "takeover", actorId: takeover.bossId, crewId, refId: takeover.venueId, params: { ...params, mine: true } });
  await notifyLater(
    ctx,
    members.filter((id) => id !== takeover.takenFrom),
    { kind: "takeover", actorId: takeover.bossId, crewId, refId: takeover.venueId, params: { ...params, mine: false } },
  );
}

/** AC-09: a rejected check-in is a cheat attempt the crew sees; it opens the venue page, where an admin can overturn it. */
export async function notifyCheatAttempt(ctx: Context, crewId: string, venueId: string, userId: string, checkInId: string): Promise<void> {
  const venue = (await ctx.db.query<{ name: string }>("select name from venues where id = $1", [venueId]))[0]?.name ?? "";
  await notifyLater(ctx, await crewMembers(ctx, crewId), {
    kind: "cheatAttempt",
    actorId: userId,
    crewId,
    refId: venueId,
    params: { name: await nameOf(ctx, userId), venue, checkInId },
  });
}

/** O-41: once per person per party, to the people who were really there. */
export async function notifyRecapReady(ctx: Context, partyId: string): Promise<void> {
  const party = (await ctx.db.query<{ name: string; crew_id: string }>("select name, crew_id from parties where id = $1", [partyId]))[0];
  if (!party) return;
  const present = await ctx.db.query<{ user_id: string }>(
    "select user_id from party_members where party_id = $1 and response = 'going' and last_activity_at is not null",
    [partyId],
  );
  const recipients: string[] = [];
  for (const { user_id: userId } of present) if (await claimMark(ctx, userId, `recap:${partyId}`)) recipients.push(userId);
  await notifyLater(ctx, recipients, { kind: "recapReady", partyId, crewId: party.crew_id, refId: partyId, params: { party: party.name } });
}

/**
 * RANK-02: after drinks change, compare the party's live board with the last one seen. Whoever
 * moved above someone tells them, at most once an hour per pair. The board is the verified one
 * (RANK-06, RANK-07), and only while the crew plays it.
 */
export async function checkOvertakes(ctx: Context, partyId: string): Promise<void> {
  try {
    const party = (
      await ctx.db.query<{ crew_id: string; starts_at: number; ends_at: number; closed_at: number | null; created_by: string; leaderboard_enabled: boolean }>(
        "select p.crew_id, p.starts_at, p.ends_at, p.closed_at, p.created_by, c.leaderboard_enabled from parties p join crews c on c.id = p.crew_id where p.id = $1",
        [partyId],
      )
    )[0];
    const now = ctx.now();
    if (!party || !party.leaderboard_enabled || !drinkingLeaderboardEnabled() || party.closed_at !== null || party.starts_at > now || party.ends_at < now) return;
    const going = new Set(await goingMembers(ctx, partyId));
    const board = (
      await computeBoard(ctx, party.crew_id, party.starts_at - AC_CONFIG.drinks.partyPreMinutes * MINUTE_MS, party.ends_at, await crewTimeZone(ctx.db, party.crew_id), "drinks", party.created_by)
    ).filter((row) => going.has(row.userId));
    const previous = new Map(
      (await ctx.db.query<{ user_id: string; rank: number }>("select user_id, rank from party_board_ranks where party_id = $1", [partyId])).map((r) => [r.user_id, r.rank]),
    );
    for (const row of board) {
      await ctx.db.query(
        `insert into party_board_ranks (party_id, user_id, rank) values ($1, $2, $3)
         on conflict (party_id, user_id) do update set rank = excluded.rank`,
        [partyId, row.userId, row.rank],
      );
    }
    if (!previous.size) return;
    for (const climber of board) {
      const before = previous.get(climber.userId);
      if (climber.value <= 0 || before === undefined) continue;
      for (const other of board) {
        const otherBefore = previous.get(other.userId);
        // Level or ahead before, strictly behind now. Being passed while still at zero is no news.
        if (other.userId === climber.userId || otherBefore === undefined || other.value <= 0) continue;
        if (otherBefore <= before && other.rank > climber.rank && (await claimMark(ctx, other.userId, `overtake:${partyId}:${climber.userId}`, OVERTAKE_GAP_MS))) {
          await notifyLater(ctx, [other.userId], { kind: "overtaken", actorId: climber.userId, partyId, crewId: party.crew_id, params: { name: climber.name } });
        }
      }
    }
  } catch {
    // The board is a game: a failure here never touches the drink that was just logged.
  }
}

/**
 * Events nobody's request causes: a member gone quiet (N-29), the end-of-night home check and
 * who is still not home (N-25), recaps of parties that closed on their own (O-41), and what
 * waited for the end of quiet hours (QOL-20). Runs every minute.
 */
export async function sweepNotifications(ctx: Context): Promise<void> {
  const now = ctx.now();

  const quiet = await ctx.db.query<{ party_id: string; user_id: string; display_name: string; last_activity_at: number }>(
    `select m.party_id, m.user_id, u.display_name, m.last_activity_at from party_members m
     join parties p on p.id = m.party_id join users u on u.id = m.user_id
     where p.closed_at is null and p.starts_at <= $1 and p.ends_at >= $1 and m.response = 'going'
       and m.home_safe_at is null and m.last_activity_at is not null and m.last_activity_at < $2`,
    [now, now - QUIET_AFTER_MS],
  );
  for (const member of quiet) {
    // Once per silence: a sign of life starts a new stretch.
    if (!(await claimMark(ctx, member.user_id, `quiet:${member.party_id}:${member.last_activity_at}`))) continue;
    const others = await goingMembers(ctx, member.party_id);
    await notifyLater(ctx, others, { kind: "quietMember", actorId: member.user_id, partyId: member.party_id, refId: member.user_id, params: { name: member.display_name } });
  }

  const ended = await ctx.db.query<{ id: string; ended_at: number }>(
    "select id, coalesce(closed_at, ends_at) as ended_at from parties where coalesce(closed_at, ends_at) <= $1 and coalesce(closed_at, ends_at) > $2",
    [now, now - 24 * HOUR_MS],
  );
  for (const party of ended) {
    await notifyRecapReady(ctx, party.id);
    if (party.ended_at < now - HOME_WINDOW_MS) continue;
    const out = await ctx.db.query<{ user_id: string; display_name: string }>(
      `select m.user_id, u.display_name from party_members m join users u on u.id = m.user_id
       where m.party_id = $1 and m.response = 'going' and m.home_safe_at is null and m.last_activity_at is not null`,
      [party.id],
    );
    for (const member of out) {
      if (await claimMark(ctx, member.user_id, `homecheck:${party.id}`)) {
        await notifyLater(ctx, [member.user_id], { kind: "homeCheck", partyId: party.id, refId: party.id });
      }
      if (party.ended_at < now - NOT_HOME_AFTER_MS && (await claimMark(ctx, member.user_id, `nothome:${party.id}`))) {
        await notifyLater(ctx, await goingMembers(ctx, party.id), { kind: "notHome", actorId: member.user_id, partyId: party.id, refId: member.user_id, params: { name: member.display_name } });
      }
    }
  }

  await releaseHeld(ctx);
  await ctx.db.query("delete from notification_party_mutes where until < $1", [now]);
  await ctx.db.query("delete from notification_marks where at < $1", [now - 3 * 24 * HOUR_MS]);
}

/** Starts the minute-by-minute sweep; returns a stop function. */
export function startNotificationSweeper(ctx: Context, log: (error: unknown) => void): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    void sweepNotifications(ctx)
      .catch(log)
      .finally(() => (running = false));
  }, MINUTE_MS);
  timer.unref();
  return () => clearInterval(timer);
}
