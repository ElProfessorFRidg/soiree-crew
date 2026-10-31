import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, { ReduceMotion, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";
import { duration, radius, space } from "@crew/design-tokens";
import { useT, type MessageKey } from "@/i18n";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Icon, type AnyIconName } from "@/ui/Icon";
import { Text } from "@/ui/Text";
import { usePermissionPrompt, type PermissionUse } from "./askPermission";

const ICONS: Record<PermissionUse, AnyIconName> = {
  checkin: "pin",
  venue: "pin",
  share: "pin",
  nearby: "pin",
  photo: "camera",
  scan: "qr",
  library: "image",
  reminders: "bell",
  drinkPhoto: "camera",
  drinkLibrary: "image",
};

/** iOS draws it in a window of its own, above the modal screens (add a drink, the recap) too. */
function Above({ children }: { children: ReactNode }) {
  if (Platform.OS === "ios") return <FullWindowOverlay>{children}</FullWindowOverlay>;
  return <View style={[StyleSheet.absoluteFill, styles.layer]}>{children}</View>;
}

/**
 * The explanation before a system permission prompt (askPermission): what it is for, what leaves
 * the phone and what happens to it. Slides up like a sheet; the scrim and "Pas maintenant" say no.
 */
export function PermissionPrompt() {
  const request = usePermissionPrompt((state) => state.request);
  const [shown, setShown] = useState(request);
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    // MOT-12: with Reduce Motion the sheet only fades, to the same place.
    const timing = { duration: reduceMotion ? duration.toastIn : duration.sheetIn, easing: easings.out, reduceMotion: ReduceMotion.Never };
    if (request) {
      setShown(request);
      progress.value = withTiming(1, timing);
      return;
    }
    // The sheet goes back down before the overlay is removed.
    const unmount = () => setShown(null);
    progress.value = withTiming(0, { ...timing, duration: duration.toastIn }, (finished) => {
      if (finished) runOnJS(unmount)();
    });
  }, [request, progress, reduceMotion]);

  const scrim = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheet = useAnimatedStyle(() =>
    reduceMotion ? { opacity: progress.value, transform: [{ translateY: 0 }] } : { opacity: 1, transform: [{ translateY: (1 - progress.value) * 420 }] },
  );

  if (!shown) return null;
  const answer = (go: boolean) => {
    const current = usePermissionPrompt.getState().request;
    if (!current) return;
    haptic.select();
    usePermissionPrompt.setState({ request: null });
    current.resolve(go);
  };

  return (
    <Above>
      <Animated.View style={[StyleSheet.absoluteFill, scrim]}>
        <ScrimPress onPress={() => answer(false)} />
      </Animated.View>
      <Animated.View style={[styles.anchor, sheet]} pointerEvents="box-none">
        <PromptSheet use={shown.use} onAnswer={answer} />
      </Animated.View>
    </Above>
  );
}

function ScrimPress({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const i18n = useT();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={i18n.t("permissions.notNow")}
      onPress={onPress}
      style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]}
    />
  );
}

function PromptSheet({ use, onAnswer }: { use: PermissionUse; onAnswer: (go: boolean) => void }) {
  const theme = useTheme();
  const i18n = useT();
  const insets = useSafeAreaInsets();
  const title = i18n.t(`permissions.${use}.title` as MessageKey);
  const lines = [i18n.t(`permissions.${use}.what` as MessageKey), i18n.t(`permissions.${use}.after` as MessageKey)];

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(title);
  }, [title]);

  return (
    <View
      accessibilityViewIsModal
      style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 20 }]}
    >
      <View style={[styles.grab, { backgroundColor: theme.handle }]} />
      <View style={styles.head}>
        <Icon name={ICONS[use]} size={26} color={theme.text} />
        <Text variant="h2" accessibilityRole="header" style={styles.flex}>
          {title}
        </Text>
      </View>
      {lines.map((line) => (
        <Text key={line}>{line}</Text>
      ))}
      <Text variant="small">{i18n.t("permissions.systemNext")}</Text>
      <View style={styles.actions}>
        <Button label={i18n.t("permissions.continue")} height={56} onPress={() => onAnswer(true)} />
        <Button label={i18n.t("permissions.notNow")} variant="outline" height={48} onPress={() => onAnswer(false)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { zIndex: 900 },
  anchor: { position: "absolute", left: 0, right: 0, bottom: 0 },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: 12,
    paddingHorizontal: space.screenX,
    gap: 14,
  },
  grab: { width: 40, height: 5, borderRadius: 3, alignSelf: "center" },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
  actions: { gap: 10, marginTop: 4 },
});
