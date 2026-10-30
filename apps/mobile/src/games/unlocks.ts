import { useEffect, useMemo, useState } from "react";
import { isUnlocked, lockReason, type GameDefinition, type LockReason } from "@crew/games";
import { useCrewData } from "@/server/crewData";
import { fetchFriends } from "@/server/profileData";
import { useSession } from "@/server/session";
import { useGamesStore } from "./store";

let friendsCache: { at: number; ids: string[] } | null = null;
const FRIENDS_TTL_MS = 10 * 60_000;

/**
 * O-48: how many people the player knows through the app: crew mates of every crew and friends,
 * each counted once, never themself. Read from the cached crews and one friends call.
 */
export function useKnownPeople(): number {
  const session = useSession((s) => s.session);
  const crews = useCrewData((s) => s.crews);
  const [friends, setFriends] = useState<string[]>(friendsCache?.ids ?? []);

  useEffect(() => {
    if (!session) return;
    if (friendsCache && Date.now() - friendsCache.at < FRIENDS_TTL_MS) return;
    void fetchFriends()
      .then((list) => {
        friendsCache = { at: Date.now(), ids: list.friends.map((f) => f.userId) };
        setFriends(friendsCache.ids);
      })
      .catch(() => undefined);
  }, [session]);

  return useMemo(() => {
    const people = new Set<string>(friends);
    for (const crew of crews) for (const m of crew.members) people.add(m.id);
    if (session) people.delete(session.userId);
    return people.size;
  }, [crews, friends, session]);
}

/** The lock of a game for this table, with the friends unlock remembered once reached. */
export function useGameLock(game: GameDefinition, playerCount: number): LockReason | null {
  const known = useKnownPeople();
  const opened = useGamesStore((s) => (s.unlocked ?? []).includes(game.id));
  const nowOpen = isUnlocked(game, known);

  useEffect(() => {
    if (nowOpen && !opened && game.unlockAtFriends !== undefined) {
      useGamesStore.setState((s) => ({ unlocked: [...(s.unlocked ?? []), game.id] }));
    }
  }, [nowOpen, opened, game]);

  return lockReason(game, playerCount, opened ? undefined : known);
}
