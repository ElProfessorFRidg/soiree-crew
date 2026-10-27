import { router } from "expo-router";
import { useEffect } from "react";
import { Share, StyleSheet, View } from "react-native";
import { palette, radius } from "@crew/design-tokens";
import { standings, type EndReason, type GameId, type PenaltyLedger } from "@crew/games";
import { haptic } from "@/motion/haptics";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Numeral, Text } from "@/ui/Text";
import { useGameUi } from "../hooks";
import { useGameT, type GamePluralKey } from "../i18n";
import { recordDuration, toEnginePlayer, type TablePlayer } from "../store";
import { FadeInAfter } from "./motion";

export interface GameRecord {
  key: GamePluralKey;
  playerId: string;
  count: number;
}

/** The best (highest) value of a per-player tally, for the record line. */
export function topOf(tally: Readonly<Record<string, number>>, key: GamePluralKey): GameRecord | null {
  let best: GameRecord | null = null;
  for (const [playerId, count] of Object.entries(tally)) if (count > 0 && (!best || count > best.count)) best = { key, playerId, count };
  return best;
}

interface Props {
  gameId: GameId;
  players: readonly TablePlayer[];
  ledger: PenaltyLedger;
  endReason: EndReason | null;
  startedAt: number;
  record: GameRecord | null;
  onAgain: () => void;
}

/** O-47 result: penalties per player, the game's record, and a text result for the system share sheet. */
export function EndScreen({ gameId, players, ledger, endReason, startedAt, record, onAgain }: Props) {
  const theme = useTheme();
  const g = useGameT();
  const ui = useGameUi();
  const ranking = standings(players.map(toEnginePlayer), ledger);
  const recordName = record ? players.find((p) => p.id === record.playerId)?.name : undefined;
  const recordLine = record && recordName ? g.plural(record.key, record.count, { name: recordName }) : null;

  useEffect(() => {
    haptic.confirmed();
    // A finished game feeds the computed "usually N min" line of the catalogue.
    if (endReason !== "notEnoughPlayers") recordDuration(gameId, Date.now() - startedAt);
  }, [endReason, gameId, startedAt]);

  const share = () => {
    const lines = ranking.map(({ player, penalties }) => g.t("end.shareLine", { name: player.name, penalties: g.plural("shell.penalties", penalties) }));
    const message = [g.t("end.shareTitle", { game: g.t(`games.${gameId}.name`) }), ...lines, recordLine].filter(Boolean).join("\n");
    void Share.share({ message });
  };

  return (
    <View style={styles.wrap}>
      <Text variant="h1" accessibilityRole="header">
        {g.t("end.title")}
      </Text>
      {endReason === "notEnoughPlayers" ? <Text>{g.t("end.notEnough")}</Text> : null}
      {recordLine ? (
        <View style={[styles.record, { backgroundColor: palette.tint.amberBg }]}>
          <Text variant="h3" color={palette.tint.amberTextStrong}>
            {recordLine}
          </Text>
        </View>
      ) : null}
      <Text variant="label">{g.t("end.standings")}</Text>
      <View>
        {ranking.map(({ player, penalties }, index) => (
          <FadeInAfter key={player.id} delayMs={index * 80}>
            <View style={[styles.row, { borderBottomColor: theme.line }]}>
              <Avatar personId={player.id} name={player.name} size={ui.big ? 48 : 38} />
              <Text variant="h3" style={styles.name}>
                {player.name}
              </Text>
              <Numeral size={ui.big ? 40 : 30}>{String(penalties)}</Numeral>
            </View>
          </FadeInAfter>
        ))}
      </View>
      <Button label={g.t("end.share")} icon="share" variant="secondary" height={ui.secondary} onPress={share} />
      <Button label={g.t("end.again")} height={ui.action} onPress={onAgain} />
      <Button label={g.t("end.otherGames")} variant="outline" height={ui.secondary} onPress={() => router.replace("/(tabs)/games")} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  record: { borderRadius: radius.card, padding: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 58, borderBottomWidth: 1 },
  name: { flex: 1 },
});
