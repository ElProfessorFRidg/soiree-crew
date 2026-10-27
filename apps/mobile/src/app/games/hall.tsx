import { StyleSheet, View } from "react-native";
import { GAMES } from "@crew/games";
import { useGameT, type GamePluralKey } from "@/games/i18n";
import { useGamesStore } from "@/games/store";
import { Panel } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

/** N-24: who wins most, and each game's record, from the games played on this phone. */
export default function HallOfFameScreen() {
  const g = useGameT();
  const hall = useGamesStore((s) => s.hall ?? {});
  const played = GAMES.filter((game) => (hall[game.id]?.played ?? 0) > 0);
  return (
    <Screen back title={g.t("hall.title")}>
      <Text variant="small">{g.t("hall.note")}</Text>
      {played.length === 0 ? <Text>{g.t("hall.empty")}</Text> : null}
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
              <View key={name} style={styles.line}>
                <Text variant="small" style={styles.rank}>
                  {index + 1}
                </Text>
                <Text style={styles.flex}>{name}</Text>
                <Text variant="h3">{g.plural("hall.wins", wins)}</Text>
              </View>
            ))}
            {entry.record ? <Text variant="small">{g.plural(entry.record.key as GamePluralKey, entry.record.count, { name: entry.record.name })}</Text> : null}
          </Panel>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 36 },
  rank: { width: 16 },
  flex: { flex: 1 },
});
