import { Redirect, Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { duration } from "@crew/design-tokens";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "expo-router/tabs";
import { useGameT } from "@/games/i18n";
import { useT } from "@/i18n";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { useMorningAfter } from "@/recap/morning";
import { useHomeScreenActions } from "@/system/quickActions";
import { useLevelNow } from "@/state/levelNow";
import { useInvitations } from "@/server/socialData";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Icon, type AnyIconName } from "@/ui/Icon";
import { ScalePressable } from "@/ui/Pressable";
import { Text } from "@/ui/Text";
import { ToastHost } from "@/ui/Toast";

// Tabs appear as their features ship: no tab leads to an empty screen.
const TAB_ICONS: Record<string, AnyIconName> = {
  index: "glass",
  crew: "users",
  bars: "pin",
  games: "dice",
  me: "user",
};

/** One tab: the icon pops when it becomes the active one (DESIGN.md §5 pop), static under Reduce Motion. */
function TabItem({ label, icon, focused, onPress, badge = 0 }: { label: string; icon: AnyIconName; focused: boolean; onPress: () => void; badge?: number }) {
  const theme = useTheme();
  const i18n = useT();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!focused || reduceMotion) return;
    scale.value = withSequence(
      withTiming(1.14, { duration: duration.pop * 0.45, easing: easings.out }),
      withTiming(1, { duration: duration.pop * 0.55, easing: easings.out }),
    );
  }, [focused, reduceMotion, scale]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const color = focused ? theme.amber : theme.tabInactive;
  return (
    <ScalePressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      // O-36: the badge is read out with the tab, not as a separate element.
      accessibilityLabel={badge > 0 ? `${label}, ${i18n.plural("crew.tabBadge", badge)}` : label}
      pressedScale={0.94}
      onPress={onPress}
      style={styles.item}
    >
      <Animated.View style={iconStyle}>
        <Icon name={icon} size={22} color={color} />
        {badge > 0 ? (
          <View style={[styles.badge, { backgroundColor: theme.danger, borderColor: theme.bg }]}>
            <Text variant="tag" color={theme.bg} style={styles.badgeText}>
              {badge > 99 ? "99+" : String(badge)}
            </Text>
          </View>
        ) : null}
      </Animated.View>
      {/* O-11: a long label wraps under the icon instead of being cut. */}
      <Text variant="tab" color={color} align="center">
        {label}
      </Text>
    </ScalePressable>
  );
}

function TabBar({ state, descriptors, navigateToTab }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  // O-36: the real number of invitations waiting, on the Crew tab (DESIGN.md: badge in danger colour).
  const invitations = useInvitations((s) => s.total);
  const slot = width / Math.max(1, state.routes.length);
  // A short amber line slides to the active tab.
  const x = useSharedValue(0);
  useEffect(() => {
    const target = state.index * slot;
    x.value = reduceMotion || slot === 0 ? target : withTiming(target, { duration: duration.toggle, easing: easings.toggle });
  }, [state.index, slot, reduceMotion, x]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View
      accessibilityRole="tablist"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width - 12)}
      style={[styles.bar, { backgroundColor: theme.bg, borderTopColor: theme.line, paddingBottom: Math.max(insets.bottom, 10) }]}
    >
      {slot > 0 ? (
        <Animated.View pointerEvents="none" style={[styles.indicatorSlot, { width: slot }, indicator]}>
          <View style={[styles.indicator, { backgroundColor: theme.amber }]} />
        </Animated.View>
      ) : null}
      {state.routes.map((route, index) => (
        <TabItem
          key={route.key}
          label={descriptors[route.key]?.options.title ?? route.name}
          icon={TAB_ICONS[route.name] ?? "more"}
          focused={state.index === index}
          badge={route.name === "crew" ? invitations : 0}
          onPress={() => {
            if (state.index === index) return;
            haptic.select();
            navigateToTab(route.key);
          }}
        />
      ))}
    </View>
  );
}

export default function TabsLayout() {
  const i18n = useT();
  const games = useGameT();
  const insets = useSafeAreaInsets();
  const onboarded = useAppStore((state) => state.ageConfirmedAt !== null && state.profile !== null);
  useMorningAfter();
  useHomeScreenActions(i18n);
  // ADP-09: at levels 2 and 3 the undo button grows like everything else.
  const level = useLevelNow((state) => state.level);
  if (!onboarded) return <Redirect href="/onboarding" />;
  return (
    <View style={{ flex: 1 }}>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
        <Tabs.Screen name="index" options={{ title: i18n.t("tabs.party") }} />
        <Tabs.Screen name="crew" options={{ title: i18n.t("crew.tab") }} />
        <Tabs.Screen name="games" options={{ title: games.t("catalogue.title") }} />
        <Tabs.Screen name="bars" options={{ title: i18n.t("bars.tab") }} />
        <Tabs.Screen name="me" options={{ title: i18n.t("tabs.me") }} />
      </Tabs>
      <ToastHost bottomOffset={insets.bottom + 76} large={level >= 2} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    paddingTop: 10,
    paddingHorizontal: 6,
    borderTopWidth: 1,
  },
  indicatorSlot: { position: "absolute", top: -1, left: 6, alignItems: "center" },
  indicator: { width: 28, height: 2, borderRadius: 1 },
  badge: {
    position: "absolute",
    top: -6,
    left: 14,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 10, lineHeight: 12 },
  item: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
});
