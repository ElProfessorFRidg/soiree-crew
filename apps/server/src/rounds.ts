import { roundRotation, type RoundRotation } from "@crew/money";
import type { Db } from "./db";

/** N-18: people at the party right now, the only ones a round can be for. */
export async function presentAt(db: Db, partyId: string): Promise<{ user_id: string; display_name: string }[]> {
  return db.query<{ user_id: string; display_name: string }>(
    "select m.user_id, u.display_name from party_members m join users u on u.id = m.user_id where m.party_id = $1 and m.response = 'going' and m.home_safe_at is null order by m.user_id",
    [partyId],
  );
}

/** N-18: the fair rotation for the people present tonight, from every round of the crew so far. */
export async function rotationFor(db: Db, crewId: string, partyId: string, present: readonly string[]): Promise<RoundRotation> {
  const history = await db.query<{ party_id: string; payer_id: string; member_ids: string; created_at: number }>(
    "select r.party_id, r.payer_id, r.member_ids, r.created_at from rounds r join parties p on p.id = r.party_id where p.crew_id = $1",
    [crewId],
  );
  return roundRotation(
    present,
    history.map((r) => ({ partyId: r.party_id, payerId: r.payer_id, memberIds: JSON.parse(r.member_ids) as string[], at: Number(r.created_at) })),
    partyId,
  );
}

/**
 * N-18: someone was not in a round after all. Their drink goes, their share of the expense goes
 * with it (the others split the same total), and a round left with nobody is removed with its
 * expense. Runs inside the caller's transaction. Returns the pool touched, null when there was
 * nothing to drop.
 */
export async function dropFromRound(db: Db, roundId: string, userId: string, now: number): Promise<{ partyId: string; poolId: string | null } | null> {
  const round = (
    await db.query<{ party_id: string; member_ids: string; expense_id: string | null }>("select party_id, member_ids, expense_id from rounds where id = $1 for update", [roundId])
  )[0];
  if (!round) return null;
  const members = JSON.parse(round.member_ids) as string[];
  if (!members.includes(userId)) return null;
  const left = members.filter((id) => id !== userId);
  await db.query("update drinks set deleted_at = $1, updated_at = $1 where round_id = $2 and user_id = $3 and deleted_at is null", [now, roundId, userId]);
  let poolId: string | null = null;
  if (round.expense_id) {
    // Only an expense still split equally among the round, with this person in it, loses their share.
    const expense = (await db.query<{ pool_id: string; split: string }>("select pool_id, split from expenses where id = $1 and deleted_at is null for update", [round.expense_id]))[0];
    if (expense) {
      const split = JSON.parse(expense.split) as { kind: string; members?: string[] };
      if (split.kind === "equal" && split.members?.includes(userId)) {
        const rest = split.members.filter((id) => id !== userId);
        if (rest.length) await db.query("update expenses set split = $2 where id = $1", [round.expense_id, JSON.stringify({ kind: "equal", members: rest })]);
        else await db.query("update expenses set deleted_at = $2 where id = $1", [round.expense_id, now]);
        poolId = expense.pool_id;
      }
    }
  }
  if (left.length) await db.query("update rounds set member_ids = $2 where id = $1", [roundId, JSON.stringify(left)]);
  else await db.query("delete from rounds where id = $1", [roundId]);
  return { partyId: round.party_id, poolId };
}
