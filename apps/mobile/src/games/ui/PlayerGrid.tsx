import { StyleSheet, View } from "react-native";
import { radius } from "@crew/design-tokens";
import { haptic } from "@/motion/haptics";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { IconButton } from "@/ui/Button";
import { ScalePressable } from "@/ui/Pressable";
import { Numeral, Text } from "@/ui/Text";
import { useGameUi } from "../hooks";

export interface GridPlayer {
  id: string;
  name: string;
}

interface Props {
  players: readonly GridPlayer[];
  onPress?: (id: string) => void;
  selected?: ReadonlySet<string>;
  /** A number shown on the tile (fingers, votes). */
  counts?: Readonly<Record<string, number>>;
  /** Small minus under the count, to undo one tap. Hidden at adaptive levels 2 and 3. */
  onMinus?: (id: string) => void;
  minusLabel?: (name: string) => string;
  disabled?: ReadonlySet<string>;
  /** Extra line under the name (an exit stake, a role). */
  caption?: (id: string) => string | null;
  accessibilityLabel?: (player: GridPlayer) => string;
}

/** Player tiles: two columns at adaptive levels 2 and 3 so every target stays huge (ADP-04). */
export function PlayerGrid({ players, onPress, selected, counts, onMinus, minusLabel, disabled, caption, accessibilityLabel }: Props) {
  const theme = useTheme();
  const ui = useGameUi();
  const columns = ui.big || players.length <= 4 ? 2 : 3;
  const basis = columns === 2 ? "48%" : "31%";
  return (
    <View style={styles.grid}>
      {players.map((player) => {
        const on = selected?.has(player.id) ?? false;
        const off = disabled?.has(player.id) ?? false;
        const count = counts?.[player.id] ?? 0;
        const line = caption?.(player.id) ?? null;
        const fg = on ? theme.bg : theme.text;
        return (
          <View key={player.id} style={[styles.cell, { flexBasis: basis }]}>
            <ScalePressable
              onPress={
                onPress && !off
                  ? () => {
                      haptic.select();
                      onPress(player.id);
                    }
                  : undefined
              }
              disabled={!onPress || off}
              accessibilityState={{ selected: on, disabled: off }}
              accessibilityLabel={accessibilityLabel?.(player) ?? player.name}
              style={[styles.tile, { minHeight: ui.tile, backgroundColor: on ? theme.text : theme.surface2, opacity: off ? 0.4 : 1 }]}
            >
              <Avatar personId={player.id} name={player.name} size={ui.big ? 44 : 34} />
              <View style={styles.name}>
                <Text variant="h3" color={fg} numberOfLines={2} style={ui.big ? styles.bigName : null}>
                  {player.name}
                </Text>
                {line ? (
                  <Text variant="small" color={on ? theme.bg : theme.textMuted}>
                    {line}
                  </Text>
                ) : null}
              </View>
              {counts ? (
                <Numeral size={ui.big ? 40 : 30} color={count > 0 ? fg : theme.textMuted}>
                  {String(count)}
                </Numeral>
              ) : null}
            </ScalePressable>
            {onMinus && !ui.big && count > 0 ? (
              <View style={styles.minus}>
                <IconButton icon="x" size={32} accessibilityLabel={minusLabel?.(player.name) ?? player.name} onPress={() => onMinus(player.id)} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between" },
  cell: { flexGrow: 1 },
  tile: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: radius.tile },
  name: { flex: 1, minWidth: 0 },
  bigName: { fontSize: 19, lineHeight: 23 },
  minus: { position: "absolute", top: -6, right: -6 },
});
