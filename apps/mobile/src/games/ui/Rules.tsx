import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { palette, radius } from "@crew/design-tokens";
import type { GameId } from "@crew/games";
import { haptic } from "@/motion/haptics";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";
import { useGameUi } from "../hooks";
import { useGameT, type GameMessageKey } from "../i18n";
import { Dealt } from "./motion";

export function ruleKeys(gameId: GameId): GameMessageKey[] {
  return [`games.${gameId}.rule1`, `games.${gameId}.rule2`, `games.${gameId}.rule3`];
}

/** O-46 at launch: the rules as cards, one at a time. */
export function RuleCards({ gameId }: { gameId: GameId }) {
  const g = useGameT();
  const ui = useGameUi();
  const [index, setIndex] = useState(0);
  const keys = ruleKeys(gameId);
  // Levels 2 and 3 keep only the rule that matters most (research/games.md §2.0).
  const shown = ui.big ? keys.slice(0, 1) : keys;
  const key = shown[index % shown.length] as GameMessageKey;
  return (
    <Dealt dealKey={index} style={[styles.card, { backgroundColor: palette.dark.text }]}>
      {shown.length > 1 ? (
        <Text variant="small" color={palette.light.textMuted}>
          {g.t("setup.rulesPosition", { index: (index % shown.length) + 1, count: shown.length })}
        </Text>
      ) : null}
      <Text style={[styles.rule, ui.big && styles.bigRule]} color={palette.accent.onAccent}>
        {g.t(key)}
      </Text>
      {shown.length > 1 ? (
        <View style={styles.footer}>
          <Text variant="small" color={palette.light.textMuted} style={styles.flex}>
            {g.t("setup.rulesHint")}
          </Text>
          <Button
            label={g.t("setup.nextRule")}
            height={40}
            variant="secondary"
            onPress={() => {
              haptic.select();
              setIndex((i) => i + 1);
            }}
          />
        </View>
      ) : null}
    </Dealt>
  );
}

/** O-46 mid-game: the "?" sheet lists every rule. */
export function RulesList({ gameId }: { gameId: GameId }) {
  const theme = useTheme();
  const g = useGameT();
  const ui = useGameUi();
  return (
    <View style={styles.list}>
      {ruleKeys(gameId).map((key) => (
        <View key={key} style={[styles.item, { backgroundColor: theme.surface2 }]}>
          <Text style={ui.big ? styles.bigRule : null}>{g.t(key)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, padding: 18, gap: 14, minHeight: 150, justifyContent: "space-between" },
  rule: { fontSize: 18, lineHeight: 25, fontFamily: "Archivo-Semibold" },
  bigRule: { fontSize: 21, lineHeight: 28 },
  footer: { flexDirection: "row", alignItems: "center", gap: 10 },
  flex: { flex: 1 },
  list: { gap: 8 },
  item: { borderRadius: radius.tile, padding: 14 },
});
