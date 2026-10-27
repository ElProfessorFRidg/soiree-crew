import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { duration, radius, space } from "@crew/design-tokens";
import { drinkVolumeUnit, formatVolume, type VolumeUnit } from "@crew/units";
import { logDrink } from "@/drinks/actions";
import { CustomDrinkEditor } from "@/drinks/CustomDrinkEditor";
import { removeCustomDrink, restoreCustomDrink, saveCustomDrink, sortedCustomDrinks } from "@/drinks/customDrinks";
import { drinkLabel, drinkWithArticle } from "@/drinks/display";
import { offerUndo } from "@/drinks/undoToast";
import { presetFromCustom, presetsFor, type CustomDrink, type DrinkPreset } from "@/drinks/presets";
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
import { showToast, ToastHost } from "@/ui/Toast";

const MINUTE_MS = 60_000;

function volumeText(preset: DrinkPreset, unit: VolumeUnit, i18n: Translator): string {
  if (preset.abv === 0) return i18n.t("drinks.softSub");
  const suffix = unit === "us_fl_oz" ? "oz" : unit;
  return `${formatVolume(preset.volumeMl, unit, i18n.locale)} ${suffix}`;
}

type Selection = { type: "preset"; index: number } | { type: "custom"; id: string };
type Editing = { mode: "new" } | { mode: "edit"; drink: CustomDrink } | null;

export default function AddDrinkSheet() {
  const i18n = useT();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const preferences = useAppStore((state) => state.preferences);
  const customDrinks = sortedCustomDrinks(useAppStore((state) => state.customDrinks));
  const presets = presetsFor(preferences.unitSystem);
  const unit = drinkVolumeUnit(preferences.unitSystem);
  const now = useNow(MINUTE_MS / 4);
  const [selection, setSelection] = useState<Selection>(() => ({
    type: "preset",
    index: Math.max(0, presets.findIndex((preset) => preset.kind === "pint")),
  }));
  // Minutes before now. Never negative: a drink in the future does not count (O-22).
  const [minutesAgo, setMinutesAgo] = useState(0);
  const [withFood, setWithFood] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const selectedCustom = selection.type === "custom" ? customDrinks.find((d) => d.id === selection.id) : undefined;
  const preset: DrinkPreset = selectedCustom
    ? presetFromCustom(selectedCustom)
    : (presets[selection.type === "preset" ? selection.index : 0] ?? presets[0]!);
  const consumedAt = now - minutesAgo * MINUTE_MS;

  const pick = (next: Selection) => {
    haptic.select();
    setSelection(next);
  };

  const onRemove = (drink: CustomDrink) => {
    setMenuFor(null);
    if (selection.type === "custom" && selection.id === drink.id) setSelection({ type: "preset", index: 0 });
    removeCustomDrink(drink);
    showToast({
      message: i18n.t("addDrink.removed"),
      durationMs: 5_000,
      action: { label: i18n.t("common.undo"), onPress: () => restoreCustomDrink(drink) },
    });
  };

  return (
    <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        <View style={styles.title}>
          <Text variant="h2" accessibilityRole="header">
            {i18n.t("addDrink.title")}
          </Text>
          <IconButton icon="x" accessibilityLabel={i18n.t("common.close")} onPress={() => router.back()} />
        </View>

        <View style={styles.grid} accessibilityRole="radiogroup">
          {presets.map((item, index) => {
            const on = selection.type === "preset" && selection.index === index;
            const fg = on ? theme.bg : theme.text;
            return (
              <ScalePressable
                key={item.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${drinkLabel(item, i18n)}, ${volumeText(item, unit, i18n)}`}
                onPress={() => pick({ type: "preset", index })}
                style={[styles.tile, { backgroundColor: on ? theme.text : theme.surface2 }]}
              >
                <Icon name={`glass:${item.icon}`} size={26} color={on ? theme.bg : theme.amber} />
                <Text variant="tag" color={fg} align="center">
                  {drinkLabel(item, i18n)}
                </Text>
                <Text variant="tab" color={on ? theme.bg : theme.textMuted} align="center">
                  {volumeText(item, unit, i18n)}
                </Text>
              </ScalePressable>
            );
          })}
        </View>

        <Text variant="label">{i18n.t("addDrink.myDrinks")}</Text>
        {customDrinks.map((drink) => {
          const asPreset = presetFromCustom(drink);
          const on = selection.type === "custom" && selection.id === drink.id;
          const strength = `${i18n.number(drink.abv * 100, Math.round(drink.abv * 1000) % 10 === 0 ? 0 : 1)} %`;
          if (editing?.mode === "edit" && editing.drink.id === drink.id) {
            return (
              <CustomDrinkEditor
                key={drink.id}
                unitSystem={preferences.unitSystem}
                initial={drink}
                onCancel={() => setEditing(null)}
                onSave={(draft) => {
                  saveCustomDrink(draft, drink);
                  setEditing(null);
                }}
              />
            );
          }
          return (
            <View key={drink.id}>
              <View style={[styles.customRow, { backgroundColor: on ? theme.text : theme.surface2 }]}>
                <ScalePressable
                  pressedScale={0.99}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${drink.name}, ${volumeText(asPreset, unit, i18n)}, ${strength}`}
                  onPress={() => pick({ type: "custom", id: drink.id })}
                  onLongPress={() => {
                    haptic.select();
                    setMenuFor(drink.id);
                  }}
                  style={styles.customMain}
                >
                  <Icon name={`glass:${drink.icon}`} size={24} color={on ? theme.bg : theme.amber} />
                  <View style={styles.flex}>
                    <Text variant="h3" color={on ? theme.bg : theme.text}>
                      {drink.name}
                    </Text>
                    <Text variant="small" color={on ? theme.bg : theme.textMuted}>
                      {volumeText(asPreset, unit, i18n)}, {strength}
                    </Text>
                  </View>
                </ScalePressable>
                {/* Long press is a shortcut, never the only way in (ADP-04). */}
                <IconButton
                  icon="more"
                  accessibilityLabel={i18n.t("addDrink.more", { name: drink.name })}
                  onPress={() => setMenuFor((open) => (open === drink.id ? null : drink.id))}
                />
              </View>
              {menuFor === drink.id ? (
                <Animated.View entering={FadeIn.duration(duration.enter)} style={styles.menu}>
                  <Button
                    label={i18n.t("addDrink.edit")}
                    icon="edit"
                    variant="secondary"
                    height={44}
                    style={styles.flex}
                    onPress={() => {
                      setMenuFor(null);
                      setEditing({ mode: "edit", drink });
                    }}
                  />
                  <Button label={i18n.t("addDrink.remove")} icon="trash" variant="danger" height={44} style={styles.flex} onPress={() => onRemove(drink)} />
                </Animated.View>
              ) : null}
            </View>
          );
        })}
        {editing?.mode === "new" ? (
          <CustomDrinkEditor
            unitSystem={preferences.unitSystem}
            onCancel={() => setEditing(null)}
            onSave={(draft) => {
              const created = saveCustomDrink(draft);
              setEditing(null);
              setSelection({ type: "custom", id: created.id });
            }}
          />
        ) : (
          <Button label={i18n.t("addDrink.newDrink")} icon="plus" variant="outline" height={48} onPress={() => setEditing({ mode: "new" })} />
        )}

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
          label={i18n.t("addDrink.add", { drink: drinkWithArticle(preset, i18n) })}
          height={56}
          onPress={() => {
            const drink = logDrink(preset, consumedAt, withFood);
            if (!drink) return;
            router.back();
            offerUndo(drink, i18n, preferences.hourCycle);
          }}
        />
      </ScrollView>
      <ToastHost bottomOffset={insets.bottom + 16} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  content: { paddingHorizontal: space.screenX, paddingTop: 20, gap: 16 },
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
  customRow: { flexDirection: "row", alignItems: "center", borderRadius: radius.tile, paddingRight: 6 },
  customMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 14 },
  menu: { flexDirection: "row", gap: 8, marginTop: 8 },
  time: { gap: 8 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  timeValue: { flex: 1, textAlign: "center" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
});
