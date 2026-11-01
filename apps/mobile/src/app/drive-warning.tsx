import { CameraView } from "expo-camera";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Linking, Platform, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { breathRatio, formatBacValue } from "@crew/units";
import { fontFiles } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { variantKey } from "@/i18n/variants";
import { driveReading, silenceAsPassenger } from "@/location/driving";
import { useAppStore } from "@/state/store";
import { askPermission } from "@/system/askPermission";
import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";

// The driving warning: a deep red screen, the reminders appearing one after the other over about
// 30 s, strong vibrations and the torch blinking a few times. It closes only after the 30 s, or
// at once with "Je suis passager". Reduce Motion: a steady red, every line at once, no torch.

const HOLD_S = 30;
/** One line every 5 s: six lines over the 30 s. */
const LINE_GAP_MS = 5_000;
const LINE_FADE_MS = 1_800;
const RED = "#7A0010";
const RED_BRIGHT = "#C1121F";
const WHITE = "#FFFFFF";
/** The torch: on and off this many times. */
const BLINKS = 4;
const BLINK_MS = 280;

const native = Platform.OS === "ios" || Platform.OS === "android";

function Line({ text, index, still, big }: { text: string; index: number; still: boolean; big?: boolean }) {
  const opacity = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) {
      opacity.value = 1;
      return;
    }
    opacity.value = withDelay(index * LINE_GAP_MS, withTiming(1, { duration: LINE_FADE_MS, easing: Easing.out(Easing.quad) }));
  }, [index, still, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={style}>
      <Text variant={big ? "h1" : "h2"} color={WHITE} align="center" style={big ? styles.big : styles.line} accessibilityRole="text">
        {text}
      </Text>
    </Animated.View>
  );
}

export default function DriveWarningScreen() {
  const i18n = useT();
  const reduceMotion = useReducedMotion();
  const preferences = useAppStore((state) => state.preferences);
  const contact = useAppStore((state) => state.emergencyContact);
  const [openedAt] = useState(() => Date.now());
  const [left, setLeft] = useState(HOLD_S);
  const [torchReady, setTorchReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [camera, setCamera] = useState(false);
  const canClose = left <= 0;
  const canCloseRef = useRef(false);
  canCloseRef.current = canClose;

  // The lines, picked once for this warning.
  const lines = useMemo(() => {
    const occasion = String(openedAt);
    const reading = driveReading(openedAt);
    const out: { text: string; big?: boolean }[] = [{ text: i18n.t(variantKey("drive.drank", occasion)) }];
    if (reading) {
      const ratio = breathRatio(reading.rules);
      const unit = i18n.t(`units.${preferences.bacUnit}`);
      const value = `${formatBacValue(reading.estimate.bac, preferences.bacUnit, ratio, i18n.locale)} ${unit}`;
      const limit = `${formatBacValue(reading.limit, preferences.bacUnit, ratio, i18n.locale)} ${unit}`;
      out.push({ text: i18n.t(reading.driving.overLimitNow ? "drive.levelOver" : "drive.level", { value, limit }) });
      const later = reading.driving.underLimitAt;
      out.push({
        text:
          later !== null && later > openedAt
            ? i18n.t("drive.notBefore", { time: formatClock(later, i18n.language, preferences.hourCycle) })
            : i18n.t("drive.underLimit"),
      });
    }
    out.push({ text: i18n.t(variantKey("drive.dontDrink", occasion)), big: true });
    out.push({ text: i18n.t(variantKey("drive.phone", occasion)) });
    out.push({ text: i18n.t(variantKey("drive.options", occasion)) });
    return out;
    // Picked once: the screen re-rendering every second keeps the same lines.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openedAt]);

  // The countdown before "Fermer".
  useEffect(() => {
    useAppStore.setState({ driveWarningAt: null });
    const timer = setInterval(() => setLeft(Math.max(0, HOLD_S - Math.floor((Date.now() - openedAt) / 1000))), 500);
    return () => clearInterval(timer);
  }, [openedAt]);

  // No way out but the buttons: Android back waits for the 30 s; the iOS swipe is off (_layout.tsx).
  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => !canCloseRef.current);
    return () => back.remove();
  }, []);

  // Strong vibrations: a warning, then a heavy pulse with each line.
  useEffect(() => {
    if (!native || !useAppStore.getState().hapticsOn) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i < 6; i++) {
      const at = reduceMotion ? i * 600 : i * LINE_GAP_MS;
      timers.push(setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined), at));
      timers.push(setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined), at + 180));
    }
    return () => timers.forEach(clearTimeout);
  }, [reduceMotion]);

  // The torch, foreground only and never with Reduce Motion. A refusal is silent.
  useEffect(() => {
    if (!native || reduceMotion) return;
    let alive = true;
    void askPermission("camera", "torch").then((answer) => {
      if (alive && answer.granted) setCamera(true);
    });
    return () => {
      alive = false;
    };
  }, [reduceMotion]);

  useEffect(() => {
    if (!torchReady) return;
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      setTorchOn(step % 2 === 1);
      if (step >= BLINKS * 2) {
        clearInterval(timer);
        setTorchOn(false);
        setCamera(false);
      }
    }, BLINK_MS);
    return () => clearInterval(timer);
  }, [torchReady]);

  // The pulse: deep red to bright red and back, about once a second.
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 550 }), withTiming(0, { duration: 650 })), -1);
  }, [reduceMotion, pulse]);
  const background = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(pulse.value, [0, 1], [RED, RED_BRIGHT]) }));

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  return (
    <Animated.View style={[styles.root, background]} accessibilityViewIsModal>
      {camera ? (
        <CameraView
          style={styles.camera}
          facing="back"
          enableTorch={torchOn}
          onCameraReady={() => setTorchReady(true)}
          onMountError={() => setCamera(false)}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
      <SafeAreaView style={styles.safe}>
        <View style={styles.lines} accessible accessibilityRole="alert" accessibilityLabel={`${i18n.t("drive.a11y")} ${lines.map((l) => l.text).join(" ")}`}>
          <Text color={WHITE} align="center" style={styles.title}>
            {i18n.t("drive.notifTitle")}
          </Text>
          {lines.map((line, index) => (
            <Line key={index} text={line.text} index={index} still={reduceMotion} big={line.big} />
          ))}
        </View>
        <View style={styles.actions}>
          {contact ? (
            <Button
              label={i18n.t("drive.call", { name: contact.name })}
              icon="phone"
              variant="secondary"
              height={52}
              onPress={() => void Linking.openURL(`tel:${contact.phone}`)}
            />
          ) : null}
          <Button label={i18n.t("drive.ride")} variant="secondary" height={52} onPress={() => router.replace("/home")} />
          <Button
            label={i18n.t("drive.passenger")}
            variant="outline"
            height={52}
            onPress={() => {
              void silenceAsPassenger();
              canCloseRef.current = true;
              close();
            }}
          />
          <Button
            label={canClose ? i18n.t("drive.close") : i18n.t("drive.closeIn", { seconds: left })}
            variant="outline"
            height={48}
            disabled={!canClose}
            onPress={close}
          />
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 24, justifyContent: "space-between" },
  lines: { flex: 1, justifyContent: "center", gap: 18 },
  title: { fontFamily: fontFiles.title, fontSize: 40, lineHeight: 44 },
  big: { fontSize: 38, lineHeight: 42 },
  line: { fontSize: 24, lineHeight: 30 },
  actions: { gap: 10, paddingBottom: 12 },
  // Out of sight: only its torch matters.
  camera: { position: "absolute", width: 1, height: 1, opacity: 0, top: 0, left: 0 },
});
