import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, space } from "@crew/design-tokens";
import { drinkVolumeUnit, formatVolume, type VolumeUnit } from "@crew/units";
import { logDrink } from "@/drinks/actions";
import { drinkLabel } from "@/drinks/display";
import { offerUndo } from "@/drinks/undoToast";
import { presetsFor, type DrinkPreset } from "@/drinks/presets";
import { useT, type Translator } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { haptic } from "@/motion/haptics";
import { useNow } from "@/state/hooks";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Button, IconButton } from "@/ui/Button";
import { Switch } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { ScalePressable } from "@/ui/Pressable";
import { Numeral, Text } from "@/ui/Text";

const MINUTE_MS = 60_000;

function volumeText(preset: DrinkPreset, unit: VolumeUnit, i18n: Translator): string {
  if (preset.abv === 0) return i18n.t("drinks.softSub");
  const suffix = unit === "us_fl_oz" ? "oz" : unit;
  return `${formatVolume(preset.volumeMl, unit, i18n.locale)} ${suffix}`;
}

export default function AddDrinkSheet() {
  const i18n = useT();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const preferences = useAppStore((state) => state.preferences);
  const presets = presetsFor(preferences.unitSystem);
  const unit = drinkVolumeUnit(preferences.unitSystem);
  const now = useNow(MINUTE_MS / 4);
  const [picked, setPicked] = useState(() => presets.findIndex((preset) => preset.kind === "pint"));
  // Minutes before now. Never negative: a drink in the future does not count (O-22).
  const [minutesAgo, setMinutesAgo] = useState(0);
  const [withFood, setWithFood] = useState(false);

  const preset = presets[picked] ?? presets[0]!;
  const consumedAt = now - minutesAgo * MINUTE_MS;

  return (
    <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.title}>
        <Text variant="h2" accessibilityRole="header">
          {i18n.t("addDrink.title")}
        </Text>
        <IconButton icon="x" accessibilityLabel={i18n.t("common.close")} onPress={() => router.back()} />
      </View>

      <View style={styles.grid}>
        {presets.map((item, index) => {
          const on = index === picked;
          const fg = on ? theme.bg : theme.text;
          return (
            <ScalePressable
              key={item.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${drinkLabel(item.kind, i18n)}, ${volumeText(item, unit, i18n)}`}
              onPress={() => {
                haptic.select();
                setPicked(index);
              }}
              style={[styles.tile, { backgroundColor: on ? theme.text : theme.surface2 }]}
            >
              <Icon name={`glass:${item.icon}`} size={26} color={on ? theme.bg : theme.amber} />
              <Text variant="tag" color={fg} align="center">
                {drinkLabel(item.kind, i18n)}
              </Text>
              <Text variant="tab" color={on ? theme.bg : theme.textMuted} align="center">
                {volumeText(item, unit, i18n)}
              </Text>
            </ScalePressable>
          );
        })}
      </View>

      <View style={styles.time}>
        <Text variant="label">{i18n.t("addDrink.drankAt")}</Text>
        <View style={styles.timeRow}>
          <IconButton icon="back" accessibilityLabel={i18n.t("addDrink.earlier")} onPress={() => setMinutesAgo((m) => m + 1)} />
          <Numeral size={30} style={styles.timeValue}>
            {formatClock(consumedAt, i18n.language, preferences.hourCycle)}
          </Numeral>
          <IconButton
            icon="chev"
            accessibilityLabel={i18n.t("addDrink.later")}
            onPress={() => {
              if (minutesAgo === 0) haptic.error();
              setMinutesAgo((m) => Math.max(0, m - 1));
            }}
          />
        </View>
        {minutesAgo === 0 ? <Text variant="small">{i18n.t("addDrink.noFuture")}</Text> : null}
      </View>

      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text variant="h3">{i18n.t("addDrink.withFood")}</Text>
          <Text variant="small">{i18n.t("addDrink.withFoodHint")}</Text>
        </View>
        <Switch value={withFood} onValueChange={setWithFood} accessibilityLabel={i18n.t("addDrink.withFood")} />
      </View>

      <Button
        label={i18n.t("addDrink.add", { drink: i18n.t(`drinks.article.${preset.kind}`) })}
        height={56}
        onPress={() => {
          const drink = logDrink(preset, consumedAt, withFood);
          if (!drink) return;
          router.back();
          offerUndo(drink, i18n, preferences.hourCycle);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingHorizontal: space.screenX, paddingTop: 20, gap: 16 },
  title: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: {
    flexBasis: "22%",
    flexGrow: 1,
    minHeight: 84,
    borderRadius: radius.tile,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  time: { gap: 8 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  timeValue: { flex: 1, textAlign: "center" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
});
