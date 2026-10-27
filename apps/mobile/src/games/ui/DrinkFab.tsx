import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { size } from "@crew/design-tokens";
import { lastDrink, logDrink } from "@/drinks/actions";
import { defaultPreset, presetFromEntry } from "@/drinks/presets";
import { offerUndo } from "@/drinks/undoToast";
import { useT } from "@/i18n";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Icon } from "@/ui/Icon";
import { ScalePressable } from "@/ui/Pressable";
import { useGameUi } from "../hooks";
import { useGameT } from "../i18n";

/**
 * O-32: logs "same again" for the phone's owner without leaving the game, with the usual undo toast.
 * One tap, no long-press, never pauses a game timer. Game penalties never come through here.
 */
export function DrinkFab({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const i18n = useT();
  const g = useGameT();
  const ui = useGameUi();
  const preferences = useAppStore((s) => s.preferences);
  const box = ui.big ? 72 : size.fab;

  const onPress = () => {
    const last = lastDrink();
    const preset = last ? presetFromEntry(last) : defaultPreset(preferences.unitSystem);
    const drink = logDrink(preset, Date.now(), false);
    if (drink) offerUndo(drink, i18n, preferences.hourCycle);
  };

  return (
    <ScalePressable
      onPress={onPress}
      accessibilityLabel={g.t("shell.addDrink")}
      pressedScale={0.92}
      hitSlop={6}
      style={[styles.fab, { width: box, height: box, borderRadius: box / 2, backgroundColor: theme.amber }, style]}
    >
      <Icon name="glass" size={ui.big ? 30 : 24} color={theme.onAccent} />
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
});
