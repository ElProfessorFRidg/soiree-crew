import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { duration, radius } from "@crew/design-tokens";
import { removeDrink, removeWater, restoreDrink } from "@/drinks/actions";
import { drinkLabel } from "@/drinks/display";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { useAppStore } from "@/state/store";
import { useNow } from "@/state/hooks";
import type { DrinkEntry } from "@/sync/types";
import { useTheme } from "@/theme";
import { Button, IconButton } from "@/ui/Button";
import { Tag } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { ScalePressable } from "@/ui/Pressable";
import { Screen } from "@/ui/Screen";
import { Numeral, Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { formatVolume, drinkVolumeUnit } from "@crew/units";

interface Group {
  key: string;
  drinks: DrinkEntry[];
}

export default function HistoryScreen() {
  const i18n = useT();
  const theme = useTheme();
  const now = useNow(60_000);
  const drinks = useAppStore((state) => state.drinks);
  const water = useAppStore((state) => state.water);
  const preferences = useAppStore((state) => state.preferences);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const unit = drinkVolumeUnit(preferences.unitSystem);

  const { groups, tonightWater } = useMemo(() => {
    const start = new Date(now);
    if (start.getHours() < preferences.dayBoundaryHour) start.setDate(start.getDate() - 1);
    start.setHours(preferences.dayBoundaryHour, 0, 0, 0);
    const from = start.getTime();
    const byKey = new Map<string, DrinkEntry[]>();
    for (const drink of drinks) {
      if (drink.consumedAt < from) continue;
      const key = `${drink.kind}:${drink.name ?? ""}:${drink.volumeMl}`;
      byKey.set(key, [...(byKey.get(key) ?? []), drink]);
    }
    const list: Group[] = [...byKey.entries()].map(([key, items]) => ({
      key,
      drinks: items.sort((a, b) => a.consumedAt - b.consumedAt),
    }));
    list.sort((a, b) => (b.drinks.at(-1)?.consumedAt ?? 0) - (a.drinks.at(-1)?.consumedAt ?? 0));
    return { groups: list, tonightWater: water.filter((w) => w.at >= from) };
  }, [drinks, water, now, preferences.dayBoundaryHour]);

  const onRemove = (drink: DrinkEntry) => {
    haptic.select();
    removeDrink(drink);
    showToast({
      message: i18n.t("history.removed"),
      durationMs: 5_000,
      action: { label: i18n.t("common.undo"), onPress: () => restoreDrink(drink) },
    });
  };

  const boundary = formatClock(new Date(2026, 0, 1, preferences.dayBoundaryHour).getTime(), i18n.language, preferences.hourCycle);
  return (
    <Screen back title={i18n.t("history.title")} trailing={<Tag label={i18n.t("history.nightUntil", { time: boundary })} />} withToasts>
      <Text variant="small">
        {i18n.t("history.boundaryNote", { time: boundary })} {i18n.t("history.swipeHint")}
      </Text>
      {groups.length === 0 && tonightWater.length === 0 ? <Text>{i18n.t("history.empty")}</Text> : null}
      {groups.map((group) => {
        const first = group.drinks[0]!;
        const open = !collapsed.has(group.key);
        const title = i18n.t("history.group", {
          count: group.drinks.length,
          drink: `${drinkLabel(first, i18n)} ${formatVolume(first.volumeMl, unit, i18n.locale)} ${unit === "us_fl_oz" ? "oz" : unit}`,
        });
        return (
          <Animated.View key={group.key} layout={LinearTransition.duration(duration.reorder).easing(easings.reorder)} style={styles.group}>
            <ScalePressable
              pressedScale={0.99}
              accessibilityState={{ expanded: open }}
              accessibilityLabel={title}
              onPress={() =>
                setCollapsed((set) => {
                  const next = new Set(set);
                  if (open) next.add(group.key);
                  else next.delete(group.key);
                  return next;
                })
              }
              style={styles.groupHeader}
            >
              <Text variant="h3" style={styles.flex}>
                {title}
              </Text>
              <Icon name={open ? "arrowup" : "arrowdn"} color={theme.textMuted} />
            </ScalePressable>
            {open
              ? group.drinks.map((drink) => (
                  <Animated.View
                    key={drink.id}
                    entering={FadeIn.duration(duration.enter)}
                    exiting={FadeOut.duration(200)}
                    layout={LinearTransition.duration(duration.reorder)}
                    style={styles.itemWrap}
                  >
                    <ReanimatedSwipeable
                      friction={2}
                      rightThreshold={60}
                      overshootRight={false}
                      renderRightActions={() => (
                        <Button
                          label={i18n.t("history.remove")}
                          variant="danger"
                          height={54}
                          style={styles.swipeAction}
                          onPress={() => onRemove(drink)}
                        />
                      )}
                    >
                      <View style={[styles.item, { backgroundColor: theme.surface }]}>
                        <Numeral size={22}>{formatClock(drink.consumedAt, i18n.language, preferences.hourCycle)}</Numeral>
                        <View style={styles.flex}>
                          {drink.sync !== "saved" ? <Tag label={i18n.t("common.sending")} icon="clock" /> : null}
                        </View>
                        {/* The swipe is a shortcut: the button stays for a drunk thumb (ADP-04). */}
                        <IconButton icon="trash" accessibilityLabel={`${i18n.t("history.remove")} ${title}`} onPress={() => onRemove(drink)} />
                      </View>
                    </ReanimatedSwipeable>
                  </Animated.View>
                ))
              : null}
          </Animated.View>
        );
      })}
      {tonightWater.length > 0 ? (
        <View style={styles.groupHeader}>
          <Icon name="drop" color={theme.water} />
          <Text variant="h3" style={styles.flex}>
            {i18n.plural("party.waters", tonightWater.length)}
          </Text>
          <IconButton
            icon="undo"
            accessibilityLabel={i18n.t("common.undo")}
            onPress={() => {
              const last = tonightWater.at(-1);
              if (last) removeWater(last);
            }}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54 },
  itemWrap: { marginLeft: 12 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radius.button, paddingVertical: 8, paddingHorizontal: 14 },
  swipeAction: { marginLeft: 8, minWidth: 110 },
  flex: { flex: 1 },
});
