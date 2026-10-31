import { router, useSegments } from "expo-router";
import { Children, isValidElement, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, StyleSheet, View } from "react-native";
import Animated, { FadeInUp, interpolate, runOnJS, useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { duration, scaled, space } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { useTheme } from "@/theme";
import { IconButton } from "./Button";
import { PullGlass } from "./PullGlass";
import { Text } from "./Text";
import { ToastHost } from "./Toast";
import { BrandMark } from "./BrandMark";
import { haptic } from "@/motion/haptics";
import { useKeyboardShown } from "./useKeyboardShown";

interface Props {
  title?: string;
  /** The app's icon and name above the title, on the screens people screenshot and share. */
  brand?: boolean;
  back?: boolean;
  trailing?: ReactNode;
  children: ReactNode;
  /** Pinned under the scroll view, above the home indicator. */
  footer?: ReactNode;
  withToasts?: boolean;
  /** MOT-10: pull to refresh. The screen shows the filling glass until the promise settles. */
  onRefresh?: () => Promise<unknown>;
  /** Off while a hold is running, so a small slide of the finger does not turn into a scroll. */
  scrollEnabled?: boolean;
}

export function Screen({ title, brand, back, trailing, children, footer, withToasts, onRefresh, scrollEnabled = true }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const theme = useTheme();
  const i18n = useT();
  const insets = useSafeAreaInsets();
  // iOS draws the tab bar as a floating capsule over the screen: whatever sits at the bottom of a
  // tab (a pinned button, the end of the list, a toast) goes above it, not under it.
  const segments = useSegments() as string[];
  const overTabBar = Platform.OS === "ios" && segments[0] === "(tabs)" ? TAB_BAR : 0;
  // With the keyboard up the footer sits right on it: no home indicator nor tab bar to clear.
  const keyboard = useKeyboardShown();
  const footerBottom = keyboard ? 12 : insets.bottom + 12 + overTabBar;
  // The band under the status bar fills in once content scrolls under the clock.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const band = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [0, 16], [0, 1], "clamp") }));
  // MOT-10: on iOS the pull shows as a filling glass and the system spinner stays hidden. Android's
  // list does not scroll past its top, so it keeps the native spinner, tinted amber.
  const customPull = Platform.OS === "ios";
  // MOT-10, iOS: the pull is felt as well as seen. A light tick each third of the glass while it
  // fills, a firmer one when it lets go and the refresh starts, then success or a warning when the
  // answer comes. Ticks re-arm only once the list is back at its top.
  const pullStep = useSharedValue(0);
  useAnimatedReaction(
    () => (onRefresh && customPull ? Math.min(3, Math.floor(Math.max(0, -scrollY.value) / 28)) : 0),
    (step, previous) => {
      if (step === 0) pullStep.value = 0;
      else if (previous !== null && step > previous && step > pullStep.value) {
        pullStep.value = step;
        runOnJS(haptic.pullTick)();
      }
    },
  );
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
              tintColor={customPull ? "transparent" : theme.amber}
              colors={[theme.amber]}
              progressBackgroundColor={theme.surface}
              onRefresh={() => {
                setRefreshing(true);
                haptic.pullRelease();
                void onRefresh()
                  .then(() => haptic.confirmed())
                  .catch(() => haptic.error())
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
        {brand ? <BrandMark /> : null}
        {title ? (
          <Text variant="h1" accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {/* Blocks rise into place one after the other when the screen opens (Reduce Motion: none). */}
        {Children.toArray(children).map((child, index) => (
          <Animated.View
            key={isValidElement(child) && child.key != null ? child.key : index}
            // A child that renders a fragment (a settings page, say) keeps the gap between its blocks.
            style={styles.block}
            entering={FadeInUp.delay(scaled(Math.min(index, 8) * 45))
              .duration(duration.enter)
              .withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] })}
          >
            {child}
          </Animated.View>
        ))}
      </Animated.ScrollView>
      {onRefresh && customPull ? <PullGlass scrollY={scrollY} refreshing={refreshing} top={insets.top + 10} /> : null}
      <Animated.View
        pointerEvents="none"
        style={[styles.band, { height: insets.top, backgroundColor: theme.bg, borderBottomColor: theme.line }, band]}
      />
      {footer ? <View style={[styles.footer, { paddingBottom: footerBottom }]}>{footer}</View> : null}
      {withToasts ? <ToastHost bottomOffset={insets.bottom + 24 + overTabBar} /> : null}
    </KeyboardAvoidingView>
  );
}

/** Height of iOS's floating tab bar above the home indicator. */
const TAB_BAR = 64;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space.screenX, gap: space.sectionGap },
  block: { gap: space.sectionGap },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  footer: { paddingHorizontal: space.screenX, paddingTop: 12 },
  band: { position: "absolute", top: 0, left: 0, right: 0, borderBottomWidth: StyleSheet.hairlineWidth },
});
