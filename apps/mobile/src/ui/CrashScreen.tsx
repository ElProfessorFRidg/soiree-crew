import type { ErrorBoundaryProps } from "expo-router";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radius, themes } from "@crew/design-tokens";
import { createTranslator } from "@/i18n";
import { useAppStore } from "@/state/store";

// Rendered in place of a layout that crashed, so none of its providers (theme, i18n, safe area)
// can be assumed: plain components, the dark theme and a translator built from the stored language.

/** QOL: a crash in one screen never leaves a blank app; it says so and offers a way out. */
export function CrashScreen({ retry }: ErrorBoundaryProps) {
  const i18n = createTranslator(useAppStore.getState().preferences.language);
  const theme = themes.dark;
  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]} accessibilityRole="alert">
      <Text style={[styles.title, { color: theme.text }]}>{i18n.t("common.crashTitle")}</Text>
      <Text style={[styles.body, { color: theme.textMuted }]}>{i18n.t("common.crashBody")}</Text>
      <Pressable accessibilityRole="button" onPress={() => void retry()} style={[styles.button, { backgroundColor: theme.amber }]}>
        <Text style={[styles.label, { color: theme.onAccent }]}>{i18n.t("common.retry")}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          router.replace("/");
          void retry();
        }}
        style={[styles.button, styles.outline, { borderColor: theme.textMuted }]}
      >
        <Text style={[styles.label, { color: theme.text }]}>{i18n.t("common.crashHome")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 14 },
  title: { fontSize: 24, fontWeight: "700" },
  body: { fontSize: 16, lineHeight: 22 },
  button: { minHeight: 52, borderRadius: radius.button, alignItems: "center", justifyContent: "center" },
  outline: { borderWidth: 1.5 },
  label: { fontSize: 16, fontWeight: "700" },
});
