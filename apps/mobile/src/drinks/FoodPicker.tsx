import { StyleSheet, View } from "react-native";
import { FOOD_LEVELS, type FoodLevel } from "@crew/bac";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { Segmented } from "@/ui/controls";
import { Text } from "@/ui/Text";

/** O-85: empty stomach, light meal or full meal. Feeds absorption and elimination in @crew/bac. */
export function FoodPicker({ value, onChange, title, hint }: { value: FoodLevel; onChange: (next: FoodLevel) => void; title?: string; hint?: string }) {
  const i18n = useT();
  return (
    <View style={styles.block}>
      <Text variant="label">{title ?? i18n.t("addDrink.withFood")}</Text>
      <Segmented<FoodLevel>
        accessibilityLabel={title ?? i18n.t("addDrink.withFood")}
        value={value}
        items={FOOD_LEVELS.map((level) => ({ value: level, label: i18n.t(`addDrink.food.${level}`) }))}
        onChange={(next) => {
          haptic.select();
          onChange(next);
        }}
      />
      {hint ? <Text variant="small">{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
});
