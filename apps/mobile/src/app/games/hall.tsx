import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { GAMES, isGameId } from "@crew/games";
import { useGameT, type GamePluralKey } from "@/games/i18n";
import { useGamesStore } from "@/games/store";
import { useCrewData } from "@/server/crewData";
import { fetchCrewHall, flushGameResults, type CrewHall } from "@/server/gameData";
import { useSession } from "@/server/session";
import { Chip, Panel } from "@/ui/controls";
import { EmptyState } from "@/ui/EmptyState";
import { Screen } from "@/ui/Screen";
import { SkeletonRows } from "@/ui/Skeleton";
import { Text } from "@/ui/Text";

function WinLine({ index, name, wins }: { index: number; name: string; wins: number }) {
  const g = useGameT();
  return (
    <View style={styles.line}>
      <Text variant="small" style={styles.rank}>
        {index + 1}
      </Text>
      <Text style={styles.flex}>{name}</Text>
      <Text variant="h3">{g.plural("hall.wins", wins)}</Text>
    </View>
  );
}

/** Offline, or without a crew: who wins most and each game's record, from the games played on this phone. */
function LocalHall() {
  const g = useGameT();
  const hall = useGamesStore((s) => s.hall ?? {});
  const played = GAMES.filter((game) => (hall[game.id]?.played ?? 0) > 0);
  return (
    <>
      <Text variant="small">{g.t("hall.note")}</Text>
      {played.length === 0 ? <EmptyState icon="trophy" text={g.t("hall.empty")} /> : null}
      {played.map((game) => {
        const entry = hall[game.id]!;
        const top = Object.entries(entry.wins)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);
        return (
          <Panel key={game.id}>
            <Text variant="h3">{g.t(`games.${game.id}.name`)}</Text>
            <Text variant="small">{g.plural("hall.played", entry.played)}</Text>
            {top.map(([name, wins], index) => (
              <WinLine key={name} index={index} name={name} wins={wins} />
            ))}
            {entry.record ? <Text variant="small">{g.plural(entry.record.key as GamePluralKey, entry.record.count, { name: entry.record.name })}</Text> : null}
          </Panel>
        );
      })}
    </>
  );
}

/** N-24: the crew's hall of fame, kept by the server and the same on every phone of the crew. */
export default function HallOfFameScreen() {
  const g = useGameT();
  const session = useSession((s) => s.session);
  const crews = useCrewData((s) => s.crews);
  const [crewId, setCrewId] = useState<string | null>(crews[0]?.id ?? null);
  const [hall, setHall] = useState<CrewHall | null>(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    if (!session || !crewId) return;
    // Games still waiting to be sent go first, so the board includes them.
    await flushGameResults();
    try {
      setHall(await fetchCrewHall(crewId));
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, [session, crewId]);

  useEffect(() => {
    setHall(null);
    void load();
  }, [load]);

  if (!session || !crewId) {
    return (
      <Screen back title={g.t("hall.title")}>
        <LocalHall />
      </Screen>
    );
  }

  const games = (hall?.games ?? []).filter((game) => isGameId(game.gameId));
  return (
    <Screen back title={g.t("hall.title")} onRefresh={load}>
      {crews.length > 1 ? (
        <View style={styles.chips}>
          {crews.map((crew) => (
            <Chip key={crew.id} label={crew.name} selected={crew.id === crewId} onPress={() => setCrewId(crew.id)} />
          ))}
        </View>
      ) : null}
      {offline ? (
        <>
          <Text variant="small">{g.t("hall.offline")}</Text>
          <LocalHall />
        </>
      ) : !hall ? (
        <SkeletonRows rows={4} />
      ) : (
        <>
          <Text variant="small">{g.t("hall.crewNote")}</Text>
          {games.length === 0 ? <EmptyState icon="trophy" text={g.t("hall.empty")} /> : null}
          {hall.top.length ? (
            <Panel tint="amber">
              <Text variant="h3">{g.t("hall.top")}</Text>
              {hall.top.map((row, index) => (
                <WinLine key={row.userId} index={index} name={row.name} wins={row.wins} />
              ))}
            </Panel>
          ) : null}
          {games.map((game) => (
            <Panel key={game.gameId}>
              <Text variant="h3">{g.t(`games.${game.gameId as (typeof GAMES)[number]["id"]}.name`)}</Text>
              <Text variant="small">{g.plural("hall.played", game.played)}</Text>
              {game.wins.map((row, index) => (
                <WinLine key={row.userId} index={index} name={row.name} wins={row.wins} />
              ))}
              {game.record ? <Text variant="small">{g.plural(game.record.key as GamePluralKey, game.record.count, { name: game.record.name })}</Text> : null}
            </Panel>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  line: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 36 },
  rank: { width: 16 },
  flex: { flex: 1 },
});
