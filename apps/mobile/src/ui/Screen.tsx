import { router } from "expo-router";
import { Children, isValidElement, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, StyleSheet, View } from "react-native";
import Animated, { FadeInUp, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { duration, space } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { useTheme } from "@/theme";
import { IconButton } from "./Button";
import { Text } from "./Text";
import { ToastHost } from "./Toast";

interface Props {
  title?: string;
  back?: boolean;
  trailing?: ReactNode;
  children: ReactNode;
  /** Pinned under the scroll view, above the home indicator. */
  footer?: ReactNode;
  withToasts?: boolean;
  /** MOT-10: pull to refresh. The screen shows the spinner until the promise settles. */
  onRefresh?: () => Promise<unknown>;
  /** Off while a hold is running, so a small slide of the finger does not turn into a scroll. */
  scrollEnabled?: boolean;
}

export function Screen({ title, back, trailing, children, footer, withToasts, onRefresh, scrollEnabled = true }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const theme = useTheme();
  const i18n = useT();
  const insets = useSafeAreaInsets();
  // The band under the status bar fills in once content scrolls under the clock.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const band = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [0, 16], [0, 1], "clamp") }));
  return (
    // QOL-08: the keyboard never covers the field being typed, and the footer button rides above it.
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.screen, { backgroundColor: theme.bg }]}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        scrollEnabled={scrollEnabled}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              tintColor={theme.amber}
              colors={[theme.amber]}
              progressBackgroundColor={theme.surface}
              onRefresh={() => {
                setRefreshing(true);
                void onRefresh()
                  .catch(() => undefined)
                  .finally(() => setRefreshing(false));
              }}
            />
          ) : undefined
        }
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.screenTop, paddingBottom: footer ? 24 : insets.bottom + 110 }]}
      >
        {back || trailing ? (
          <View style={styles.top}>
            {back ? <IconButton icon="back" accessibilityLabel={i18n.t("common.back")} onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} /> : <View />}
            {trailing}
          </View>
        ) : null}
        {title ? (
          <Text variant="h1" accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {/* Blocks rise into place one after the other when the screen opens (Reduce Motion: none). */}
        {Children.toArray(children).map((child, index) => (
          <Animated.View
            key={isValidElement(child) && child.key != null ? child.key : index}
            entering={FadeInUp.delay(Math.min(index, 8) * 45)
              .duration(duration.enter)
              .withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] })}
          >
            {child}
          </Animated.View>
        ))}
      </Animated.ScrollView>
      <Animated.View
        pointerEvents="none"
        style={[styles.band, { height: insets.top, backgroundColor: theme.bg, borderBottomColor: theme.line }, band]}
      />
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>{footer}</View> : null}
      {withToasts ? <ToastHost bottomOffset={insets.bottom + 24} /> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space.screenX, gap: space.sectionGap },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  footer: { paddingHorizontal: space.screenX, paddingTop: 12 },
  band: { position: "absolute", top: 0, left: 0, right: 0, borderBottomWidth: StyleSheet.hairlineWidth },
});
