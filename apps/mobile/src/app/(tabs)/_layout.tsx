import { Redirect, Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "expo-router/tabs";
import { useT } from "@/i18n";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Icon, type AnyIconName } from "@/ui/Icon";
import { ScalePressable } from "@/ui/Pressable";
import { Text } from "@/ui/Text";
import { ToastHost } from "@/ui/Toast";

// Tabs appear as their features ship: no tab leads to an empty screen.
const TAB_ICONS: Record<string, AnyIconName> = {
  index: "glass",
  me: "user",
};

function TabBar({ state, descriptors, navigateToTab }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { backgroundColor: theme.bg, borderTopColor: theme.line, paddingBottom: Math.max(insets.bottom, 10) }]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const color = focused ? theme.amber : theme.tabInactive;
        const label = descriptors[route.key]?.options.title ?? route.name;
        return (
          <ScalePressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            pressedScale={0.94}
            onPress={() => {
              if (!focused) navigateToTab(route.key);
            }}
            style={styles.item}
          >
            <Icon name={TAB_ICONS[route.name] ?? "more"} size={22} color={color} />
            <Text variant="tab" color={color}>
              {label}
            </Text>
          </ScalePressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const i18n = useT();
  const insets = useSafeAreaInsets();
  const onboarded = useAppStore((state) => state.ageConfirmedAt !== null && state.profile !== null);
  if (!onboarded) return <Redirect href="/onboarding" />;
  return (
    <View style={{ flex: 1 }}>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
        <Tabs.Screen name="index" options={{ title: i18n.t("tabs.party") }} />
        <Tabs.Screen name="me" options={{ title: i18n.t("tabs.me") }} />
      </Tabs>
      <ToastHost bottomOffset={insets.bottom + 76} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 10,
    paddingHorizontal: 6,
    borderTopWidth: 1,
  },
  item: {
    minWidth: 60,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
});
