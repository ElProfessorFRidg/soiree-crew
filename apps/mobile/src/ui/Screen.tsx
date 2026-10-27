import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space } from "@crew/design-tokens";
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
  return (
    // QOL-08: the keyboard never covers the field being typed, and the footer button rides above it.
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.screen, { backgroundColor: theme.bg }]}>
      <ScrollView
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
        {children}
      </ScrollView>
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
});
