import { useEffect, useState } from "react";
import { AppState, Image, Platform, StyleSheet, View } from "react-native";
import { themes } from "@crew/design-tokens";

/**
 * SEC-05: the app switcher shows a snapshot of the last screen, BAC, messages and money included.
 * The moment the app stops being active, a plain cover with the icon replaces it, so the snapshot
 * iOS takes shows nothing personal. Android uses the secure-window flag instead.
 */
export function PrivacyCover() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const subscription = AppState.addEventListener("change", (status) => setHidden(status !== "active"));
    return () => subscription.remove();
  }, []);
  if (!hidden) return null;
  return (
    <View style={[StyleSheet.absoluteFill, styles.cover]} pointerEvents="none">
      <Image source={require("../../assets/icon.png")} style={styles.icon} accessibilityIgnoresInvertColors />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { backgroundColor: themes.dark.bg, alignItems: "center", justifyContent: "center", zIndex: 1000 },
  icon: { width: 88, height: 88, borderRadius: 20 },
});
