import { type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { duration, radius, space, scaled } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { easings } from "@/motion/easing";
import { useTheme } from "@/theme";
import { Text } from "@/ui/Text";

/** Bottom sheet inside the game screen (DESIGN.md §3): scrim, grab handle, slide up 320 ms. */
export function Sheet({ visible, title, onClose, children, footer }: { visible: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const theme = useTheme();
  const i18n = useT();
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View entering={FadeIn.duration(duration.toggle)} exiting={FadeOut.duration(scaled(160))} style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={i18n.t("common.close")} />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        entering={SlideInDown.duration(duration.sheetIn).easing(easings.out)}
        exiting={SlideOutDown.duration(scaled(220))}
        style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 18 }]}
      >
        <View style={[styles.grab, { backgroundColor: theme.handle }]} />
        <Text variant="h2" accessibilityRole="header">
          {title}
        </Text>
        <ScrollView style={styles.body} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "86%",
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: 12,
    paddingHorizontal: space.screenX,
    gap: 14,
    zIndex: 20,
  },
  grab: { width: 40, height: 5, borderRadius: 3, alignSelf: "center" },
  body: { flexGrow: 0 },
  content: { gap: 10 },
});
