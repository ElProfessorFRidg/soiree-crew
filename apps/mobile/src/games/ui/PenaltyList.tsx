import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { duration, palette, radius } from "@crew/design-tokens";
import { drawForfeit, forfeitSize, mathRandom, penaltyOffer, type ForfeitContent, type PenaltyLine } from "@crew/games";
import { haptic } from "@/motion/haptics";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";
import { useGameUi } from "../hooks";
import { useGameT } from "../i18n";
import type { TablePlayer } from "../store";
import { Tremble } from "./motion";

interface Props {
  lines: readonly PenaltyLine[];
  players: readonly TablePlayer[];
  wasted: ReadonlySet<string>;
  forfeits: ForfeitContent;
  /** Show "nobody takes anything" when the list is empty. */
  showNobody?: boolean;
}

/**
 * Penalties of the round, never an order to drink (research/games.md §2.0): sips always come with a forfeit,
 * no-alcohol players get the forfeit straight away, players at adaptive level 3 get water or a forfeit.
 */
export function PenaltyList({ lines, players, wasted, forfeits, showNobody }: Props) {
  const theme = useTheme();
  const g = useGameT();
  const ui = useGameUi();
  const [drawn, setDrawn] = useState<Record<string, string>>({});
  const key = lines.map((l) => `${l.playerId}:${l.sips}`).join("|");

  useEffect(() => {
    // No-alcohol players get their forfeit at once: it is their default, not a second choice.
    const initial: Record<string, string> = {};
    for (const line of lines) {
      const player = players.find((p) => p.id === line.playerId);
      if (player?.noAlcohol && !wasted.has(player.id)) initial[player.id] = drawForfeit(forfeits, forfeitSize(line.sips), mathRandom);
    }
    setDrawn(initial);
    if (lines.length > 0) haptic.error();
    // Only a new set of penalties redraws the forfeits.
  }, [key]);

  if (lines.length === 0) {
    return showNobody ? (
      <Text variant="h3" align="center">
        {g.t("penalty.nobody")}
      </Text>
    ) : null;
  }

  return (
    <Tremble trigger={key} calm={ui.calmMotion} style={styles.list}>
      {lines.map((line) => {
        const player = players.find((p) => p.id === line.playerId);
        if (!player) return null;
        const offer = penaltyOffer({ noAlcohol: player.noAlcohol, wasted: wasted.has(player.id) }, line.sips);
        const forfeitText = drawn[player.id] ?? null;
        const label =
          offer.kind === "sips_or_forfeit"
            ? g.plural("penalty.sipsOrForfeit", offer.sips)
            : offer.kind === "water_or_forfeit"
              ? g.t("penalty.waterOrForfeit")
              : g.t("penalty.forfeit");
        return (
          <Animated.View key={player.id} entering={FadeIn.duration(duration.enter)} style={[styles.row, { backgroundColor: theme.surface2 }]}>
            <View style={styles.line}>
              <Avatar personId={player.id} name={player.name} size={ui.big ? 48 : 36} />
              <View style={styles.text}>
                <Text variant="h3" style={ui.big ? styles.bigName : null}>
                  {player.name}
                </Text>
                <Text color={offer.kind === "water_or_forfeit" ? palette.tint.waterText : theme.textSoft} style={ui.big ? styles.bigOffer : null}>
                  {label}
                </Text>
              </View>
              {offer.kind !== "forfeit" && !drawn[player.id] ? (
                <Button
                  label={g.t("penalty.drawForfeit")}
                  variant="outline"
                  height={ui.big ? 64 : 40}
                  accessibilityLabel={g.t("penalty.drawForfeitFor", { name: player.name })}
                  onPress={() => {
                    haptic.select();
                    setDrawn((d) => ({ ...d, [player.id]: drawForfeit(forfeits, offer.forfeit, mathRandom) }));
                  }}
                />
              ) : null}
            </View>
            {forfeitText ? (
              <Animated.View entering={FadeIn.duration(duration.enter)} style={[styles.forfeit, { backgroundColor: palette.tint.amberBg }]} accessibilityLabel={`${g.t("penalty.forfeitFor", { name: player.name })}. ${forfeitText}`}>
                <Text color={palette.tint.amberTextStrong} style={ui.big ? styles.bigOffer : null}>
                  {forfeitText}
                </Text>
              </Animated.View>
            ) : null}
          </Animated.View>
        );
      })}
    </Tremble>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: { borderRadius: radius.tile, padding: 12, gap: 10 },
  line: { flexDirection: "row", alignItems: "center", gap: 12 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  forfeit: { borderRadius: radius.buttonSmall, padding: 12 },
  bigName: { fontSize: 20, lineHeight: 24 },
  bigOffer: { fontSize: 18, lineHeight: 24 },
});
