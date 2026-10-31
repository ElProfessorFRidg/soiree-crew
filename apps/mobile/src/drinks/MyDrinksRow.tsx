import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { duration, radius, space } from "@crew/design-tokens";
import { drinkVolumeUnit } from "@crew/units";
import { useT } from "@/i18n";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { useVenueData } from "@/server/venueData";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { ScalePressable } from "@/ui/Pressable";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { logDrink } from "./actions";
import { sortedCustomDrinks } from "./customDrinks";
import { drinkLabel, drinkShortLabel, sizeAndStrength } from "./display";
import { drinkKey, rankRow } from "./myRow";
import { presetFromCustom, presetFromEntry, type CustomDrink, type DrinkPreset } from "./presets";
import { offerUndo } from "./undoToast";

interface RowItem {
  key: string;
  preset: DrinkPreset;
  /** Set when the item is one of "Mes boissons": editing it edits the saved drink. */
  saved?: CustomDrink;
}

/** The ranking reads this much history: months of nights, and still instant. */
const HISTORY_LIMIT = 400;
/** The row reorders at most this often while the screen stays open, never under a moving thumb. */
const RANK_BUCKET_MS = 10 * 60_000;

/**
 * The party screen's row under "Encore": my drinks, ordered by what I usually have at this hour,
 * on this night, at this bar, and what I had tonight. Tap logs with the undo toast; a long press
 * (or the VoiceOver actions) edits or takes it off the row. Ends with "+" for a new drink.
 */
export function MyDrinksRow({ now, exclude, big }: { now: number; exclude: string | null; big: boolean }) {
  const i18n = useT();
  const theme = useTheme();
  const drinks = useAppStore((state) => state.drinks);
  const customDrinks = useAppStore((state) => state.customDrinks);
  const drinkVenues = useAppStore((state) => state.drinkVenues);
  const hidden = useAppStore((state) => state.hiddenRowDrinks);
  const unitSystem = useAppStore((state) => state.preferences.unitSystem);
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const venueId = useVenueData((state) => state.openCheckIn?.venueId ?? null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const bucket = Math.floor(now / RANK_BUCKET_MS);
  const unit = drinkVolumeUnit(unitSystem);

  const items = useMemo<RowItem[]>(() => {
    const byKey = new Map<string, RowItem>();
    const recent = [...drinks].sort((a, b) => b.consumedAt - a.consumedAt).slice(0, HISTORY_LIMIT);
    // Newest first, so a drink's row entry carries its latest glass and name.
    for (const drink of recent) {
      const key = drinkKey(drink);
      if (!byKey.has(key)) byKey.set(key, { key, preset: presetFromEntry(drink) });
    }
    const saved = sortedCustomDrinks(customDrinks);
    for (const drink of saved) {
      const preset = presetFromCustom(drink);
      byKey.set(drinkKey({ presetId: preset.id, kind: preset.kind, volumeMl: preset.volumeMl, abv: preset.abv, name: preset.name }), { key: "", preset, saved: drink });
    }
    for (const [key, item] of byKey) item.key = key;
    const order = rankRow(
      recent.map((d) => ({ key: drinkKey(d), consumedAt: d.consumedAt, venueId: drinkVenues[d.id] ?? null })),
      saved.map((d) => drinkKey({ presetId: `custom:${d.id}`, kind: "custom", volumeMl: d.volumeMl, abv: d.abv, name: d.name })),
      { now: bucket * RANK_BUCKET_MS + RANK_BUCKET_MS, venueId, exclude, hidden: new Set(hidden) },
    );
    return order.flatMap((key) => {
      const item = byKey.get(key);
      return item ? [item] : [];
    });
  }, [drinks, customDrinks, drinkVenues, hidden, venueId, exclude, bucket]);

  const height = big ? 76 : 64;
  const open = menuFor ? items.find((item) => item.key === menuFor) : undefined;

  const log = (item: RowItem) => {
    setMenuFor(null);
    const drink = logDrink(item.preset, Date.now());
    if (drink) offerUndo(drink, i18n, hourCycle);
  };
  const edit = (item: RowItem) => {
    setMenuFor(null);
    if (item.saved) {
      router.push({ pathname: "/add-drink", params: { edit: item.saved.id } });
      return;
    }
    // A drink from the history becomes a saved one, started from its values; it then replaces this entry.
    router.push({
      pathname: "/add-drink",
      params: { new: "1", name: drinkLabel(item.preset, i18n), volumeMl: String(item.preset.volumeMl), abv: String(item.preset.abv), icon: item.preset.icon, replaceKey: item.key },
    });
  };
  const hide = (item: RowItem) => {
    setMenuFor(null);
    haptic.select();
    useAppStore.setState((state) => ({ hiddenRowDrinks: [...state.hiddenRowDrinks.filter((k) => k !== item.key), item.key] }));
    showToast({
      message: i18n.t("drinkCatalogue.rowHidden"),
      durationMs: 5_000,
      action: {
        label: i18n.t("common.undo"),
        onPress: () => useAppStore.setState((state) => ({ hiddenRowDrinks: state.hiddenRowDrinks.filter((k) => k !== item.key) })),
      },
    });
  };

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.row}
        accessibilityLabel={i18n.t("addDrink.myDrinks")}
        accessibilityHint={i18n.t("drinkCatalogue.rowHint")}
      >
        {items.map((item) => {
          const name = drinkLabel(item.preset, i18n);
          // The chip is narrow: the short name, the full one for screen readers.
          const shown = drinkShortLabel(item.preset, i18n);
          const details = sizeAndStrength(item.preset, unit, i18n);
          const on = item.key === menuFor;
          return (
            <Animated.View
              key={item.key}
              entering={FadeIn.duration(duration.enter).easing(easings.out)}
              exiting={FadeOut.duration(Math.round(duration.enter / 2))}
              layout={LinearTransition.duration(duration.reorder).easing(easings.reorder)}
            >
              <ScalePressable
                accessibilityLabel={i18n.t("drinkCatalogue.rowAdd", { drink: name, details })}
                accessibilityHint={i18n.t("drinkCatalogue.rowHint")}
                accessibilityActions={[
                  { name: "edit", label: i18n.t("drinkCatalogue.rowEdit") },
                  { name: "hide", label: i18n.t("drinkCatalogue.rowHide") },
                ]}
                onAccessibilityAction={(event) => (event.nativeEvent.actionName === "edit" ? edit(item) : hide(item))}
                onPress={() => log(item)}
                onLongPress={() => {
                  haptic.select();
                  setMenuFor((current) => (current === item.key ? null : item.key));
                }}
                delayLongPress={350}
                style={[styles.item, { minHeight: height, backgroundColor: on ? theme.text : theme.surface2 }]}
              >
                <Icon name={`glass:${item.preset.icon}`} size={big ? 28 : 24} color={on ? theme.bg : theme.amber} />
                <View style={styles.text}>
                  {/* Names wrap to a second line rather than lose their end (O-11). */}
                  <Text variant="h3" color={on ? theme.bg : theme.text} numberOfLines={2}>
                    {shown}
                  </Text>
                  <Text variant="small" color={on ? theme.bg : theme.textMuted} numberOfLines={1}>
                    {details}
                  </Text>
                </View>
              </ScalePressable>
            </Animated.View>
          );
        })}
        <Animated.View layout={LinearTransition.duration(duration.reorder).easing(easings.reorder)}>
          <ScalePressable
            accessibilityLabel={i18n.t("addDrink.newDrink")}
            onPress={() => router.push({ pathname: "/add-drink", params: { new: "1" } })}
            style={[styles.plus, { width: height, minHeight: height, borderColor: theme.handle }]}
          >
            <Icon name="plus" size={big ? 30 : 26} color={theme.text} />
          </ScalePressable>
        </Animated.View>
      </ScrollView>
      {open ? (
        <Animated.View key={open.key} entering={FadeIn.duration(duration.enter).easing(easings.out)} style={styles.menu}>
          <Button label={i18n.t("drinkCatalogue.rowEdit")} icon="edit" variant="secondary" height={big ? 56 : 48} style={styles.flex} onPress={() => edit(open)} />
          <Button label={i18n.t("drinkCatalogue.rowHide")} icon="x" variant="outline" height={big ? 56 : 48} style={styles.flex} onPress={() => hide(open)} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  // Edge to edge: the row scrolls under the screen margins, a cut card says there is more.
  bleed: { marginHorizontal: -space.screenX },
  row: { paddingHorizontal: space.screenX, gap: 8 },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.tile, maxWidth: 220 },
  text: { minWidth: 0, flexShrink: 1, gap: 2 },
  plus: { borderRadius: radius.tile, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  menu: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
});
