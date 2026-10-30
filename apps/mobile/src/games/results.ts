import type { GameId } from "@crew/games";
import type { GameResultPayload } from "@/server/gameData";
import type { TablePlayer } from "./store";

interface CrewLike {
  id: string;
  members: { id: string }[];
}

interface Input {
  id: string;
  gameId: GameId;
  playedAt: number;
  players: readonly TablePlayer[];
  penalties: ReadonlyMap<string, number>;
  record: { key: string; playerId: string; count: number } | null;
  crews: readonly CrewLike[];
  /** The party going on now, when the phone's owner is in it. */
  liveParty: { id: string; crewId: string } | null;
}

/**
 * TER-02, N-24: what the phone tells the server about a finished game. The crew is the live
 * party's, or else the one holding most of the table; players outside it are sent as guests,
 * without a name. Returns null when no crew member played.
 */
export function buildGameResult(input: Input): GameResultPayload | null {
  const linked = input.players.filter((p) => p.crewMemberId);
  const partyCrew = input.liveParty ? input.crews.find((c) => c.id === input.liveParty!.crewId) : undefined;
  const crew =
    partyCrew ??
    [...input.crews]
      .map((c) => ({ c, n: linked.filter((p) => c.members.some((m) => m.id === p.crewMemberId)).length }))
      .sort((a, b) => b.n - a.n)[0]?.c;
  if (!crew) return null;
  const inCrew = (p: TablePlayer) => p.crewMemberId !== null && crew.members.some((m) => m.id === p.crewMemberId);
  const members = input.players.filter(inCrew).map((p) => ({ userId: p.crewMemberId!, penalties: input.penalties.get(p.id) ?? 0 }));
  if (!members.length) return null;
  const guests = input.players.filter((p) => !inCrew(p)).map((p) => input.penalties.get(p.id) ?? 0);
  const holder = input.record ? input.players.find((p) => p.id === input.record!.playerId) : undefined;
  return {
    id: input.id,
    crewId: crew.id,
    partyId: partyCrew ? input.liveParty!.id : null,
    gameId: input.gameId,
    playedAt: input.playedAt,
    members,
    guests,
    record: input.record && holder && inCrew(holder) ? { key: input.record.key, userId: holder.crewMemberId!, count: input.record.count } : null,
  };
}
