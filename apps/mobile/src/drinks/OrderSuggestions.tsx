import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { duration, radius } from "@crew/design-tokens";
import type { VolumeUnit } from "@crew/units";
import { useT } from "@/i18n";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { useLevelNow } from "@/state/levelNow";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { ScalePressable } from "@/ui/Pressable";
import { Numeral, Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { savedMatch } from "./catalogue";
import { removeCustomDrink, restoreCustomDrink } from "./customDrinks";
import { drinkLabel, sizeAndStrength } from "./display";
import { keepInMyDrinks } from "./keep";
import type { DrinkPreset } from "./presets";

export interface Suggestion {
  key: string;
  preset: DrinkPreset;
  quantity: number;
  /** Found through a misspelling: the card says "did you mean" instead of claiming it. */
  guess?: boolean;
  /** What was typed for it and the catalogue drink it became, to learn the spelling once picked. */
  typed?: string | null;
  catalogueId?: string | null;
}

interface Props {
  suggestion: Suggestion;
  unit: VolumeUnit;
  onQuantity: (quantity: number) => void;
  onAdd: () => void;
}

const MAX_QUANTITY = 12;

/**
 * One drink understood from the typed text (ADP-05): what it is, its size and strength, how many,
 * a star to keep it in "Mes boissons", and its own Add button.
 */
export function SuggestionCard({ suggestion, unit, onQuantity, onAdd }: Props) {
  const i18n = useT();
  const theme = useTheme();
  // ADP-09: bigger targets once the night gets blurry.
  const big = useLevelNow((state) => state.level) >= 2;
  const target = big ? 56 : 44;
  const { preset, quantity } = suggestion;
  const customDrinks = useAppStore((state) => state.customDrinks);
  const saved = savedMatch(preset, customDrinks, i18n);
  const name = drinkLabel(preset, i18n);
  const list = i18n.t("addDrink.myDrinks");

  const toggleSaved = () => {
    if (saved) {
      haptic.select();
      removeCustomDrink(saved);
      showToast({ message: i18n.t("addDrink.removed"), durationMs: 5_000, action: { label: i18n.t("common.undo"), onPress: () => restoreCustomDrink(saved) } });
      return;
    }
    haptic.confirmed();
    keepInMyDrinks(preset, i18n);
    showToast({ message: i18n.t("drinkCatalogue.kept", { drink: name, list }) });
  };

  const step = (delta: number) => {
    const next = Math.min(MAX_QUANTITY, Math.max(1, quantity + delta));
    if (next === quantity) {
      haptic.error();
      return;
    }
    haptic.select();
    onQuantity(next);
  };

  const round = (icon: "plus" | "x:minus", label: string, delta: number) => (
    <ScalePressable
      accessibilityLabel={label}
      pressedScale={0.9}
      onPress={() => step(delta)}
      style={[styles.round, { width: target, height: target, backgroundColor: theme.surfaceRaised }]}
    >
      <Icon name={icon} size={big ? 26 : 22} color={theme.amber} />
    </ScalePressable>
  );

  return (
    <Animated.View
      entering={FadeIn.duration(duration.enter).easing(easings.out)}
      exiting={FadeOut.duration(Math.round(duration.enter / 2))}
      layout={LinearTransition.duration(duration.reorder).easing(easings.reorder)}
      style={[styles.card, { backgroundColor: theme.surface2 }]}
    >
      <View style={styles.head}>
        <View style={[styles.glass, { backgroundColor: theme.surfaceRaised }]}>
          <Icon name={`glass:${preset.icon}`} size={24} color={theme.amber} />
        </View>
        <View style={styles.flex}>
          {suggestion.guess ? (
            <Text variant="small" color={theme.amber}>
              {i18n.t("drinkCatalogue.didYouMean")}
            </Text>
          ) : null}
          <Text variant="h3">{name}</Text>
          <Text variant="small">{sizeAndStrength(preset, unit, i18n)}</Text>
        </View>
        <ScalePressable
          accessibilityRole="button"
          accessibilityLabel={saved ? i18n.t("drinkCatalogue.starred", { drink: name, list }) : i18n.t("drinkCatalogue.star", { drink: name, list })}
          accessibilityState={{ selected: Boolean(saved) }}
          pressedScale={0.88}
          onPress={toggleSaved}
          style={[styles.round, { width: target, height: target, backgroundColor: saved ? theme.amber : "transparent" }]}
        >
          <Icon name="star" size={22} color={saved ? theme.onAccent : theme.textMuted} />
        </ScalePressable>
      </View>
      <View style={styles.foot}>
        <View style={styles.quantity} accessible accessibilityLabel={i18n.t("drinkCatalogue.quantity", { count: quantity })}>
          {round("x:minus", i18n.t("drinkCatalogue.less"), -1)}
          <Numeral size={big ? 30 : 24} style={styles.count}>
            {String(quantity)}
          </Numeral>
          {round("plus", i18n.t("drinkCatalogue.more"), 1)}
        </View>
        <Button
          label={i18n.t("drinkCatalogue.add")}
          icon="plus"
          height={target + 4}
          style={styles.add}
          accessibilityLabel={i18n.t("drinkCatalogue.addLine", { count: quantity, drink: name })}
          onPress={onAdd}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.tile, padding: 12, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  glass: { width: 44, height: 44, borderRadius: radius.tile, alignItems: "center", justifyContent: "center" },
  foot: { flexDirection: "row", alignItems: "center", gap: 12 },
  quantity: { flexDirection: "row", alignItems: "center", gap: 10 },
  count: { minWidth: 28, textAlign: "center" },
  round: { borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  add: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
});
