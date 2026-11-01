import { CameraView } from "expo-camera";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { breathRatio, formatBacValue } from "@crew/units";
import { fontFiles } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { variantKey } from "@/i18n/variants";
import { driveReading, silenceAsPassenger } from "@/location/driving";
import { useAppStore } from "@/state/store";
import { askPermission } from "@/system/askPermission";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { Text } from "@/ui/Text";

// The driving warning: a deep red screen in layers (a crimson glow breathing over a dark garnet,
// warmer at the top), a car in a pulsing halo, the reminders appearing slowly one after the other,
// strong vibrations and the torch blinking a few times. Nothing to tap at first: the safe ways out
// (call, another way home) come after a while, "passenger" later and only held down, and "close"
// only once every line has had time to sink in. Reduce Motion: steady colours, every line at once,
// no torch, same waits.

/** Long enough to read every line twice; short enough not to keep a real passenger hostage. */
const HOLD_S = 45;
/** One line every 6 s: the six lines are all there after about 32 s. */
const LINE_GAP_MS = 6_000;
const LINE_FADE_MS = 2_200;
/** When the safe ways out show up, then "passenger" (held down), in seconds. */
const HELP_AFTER_S = 12;
const PASSENGER_AFTER_S = 20;
const PASSENGER_HOLD_MS = 2_000;
const WHITE = "#FFFFFF";
const GARNET = "#2A0006";
const CRIMSON = "#9B0F1E";
const SCARLET = "#E5383B";
const EMBER = "#FF7A45";
/** The torch: on and off this many times. */
const BLINKS = 4;
const BLINK_MS = 280;

const native = Platform.OS === "ios" || Platform.OS === "android";

function Line({ text, index, still, big }: { text: string; index: number; still: boolean; big?: boolean }) {
  const opacity = useSharedValue(still ? 1 : 0);
  const rise = useSharedValue(still ? 0 : 14);
  useEffect(() => {
    if (still) {
      opacity.value = 1;
      rise.value = 0;
      return;
    }
    const easing = Easing.out(Easing.cubic);
    opacity.value = withDelay(index * LINE_GAP_MS, withTiming(1, { duration: LINE_FADE_MS, easing }));
    rise.value = withDelay(index * LINE_GAP_MS, withTiming(0, { duration: LINE_FADE_MS, easing }));
  }, [index, still, opacity, rise]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: rise.value }] }));
  return (
    <Animated.View style={style}>
      <Text variant={big ? "h1" : "h2"} color={WHITE} align="center" style={big ? styles.big : styles.line} accessibilityRole="text">
        {text}
      </Text>
    </Animated.View>
  );
}

/** The layered red: garnet edges, a crimson to scarlet core that breathes, an ember warmth on top. */
function Backdrop({ still }: { still: boolean }) {
  const glow = useSharedValue(still ? 0.6 : 0.35);
  useEffect(() => {
    if (still) return;
    glow.value = withRepeat(withSequence(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), withTiming(0.35, { duration: 1100, easing: Easing.inOut(Easing.sin) })), -1);
    return () => cancelAnimation(glow);
  }, [still, glow]);
  const core = useAnimatedStyle(() => ({ opacity: glow.value }));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="base" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={CRIMSON} />
            <Stop offset="0.55" stopColor="#5C0410" />
            <Stop offset="1" stopColor={GARNET} />
          </LinearGradient>
          <LinearGradient id="ember" x1="0" y1="0" x2="1" y2="0.6">
            <Stop offset="0" stopColor={EMBER} stopOpacity={0.28} />
            <Stop offset="0.6" stopColor={EMBER} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#base)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#ember)" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, core]}>
        <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="core" cx="50" cy="38" r="62" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={SCARLET} stopOpacity={0.95} />
              <Stop offset="0.45" stopColor={CRIMSON} stopOpacity={0.55} />
              <Stop offset="1" stopColor={GARNET} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#core)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** The car in a halo that pulses outwards, like a warning light. */
function Beacon({ still }: { still: boolean }) {
  const ring = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    ring.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(ring);
  }, [still, ring]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - ring.value), transform: [{ scale: 1 + ring.value * 0.7 }] }));
  return (
    <View style={styles.beacon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {still ? null : <Animated.View style={[styles.halo, halo]} />}
      <View style={styles.badge}>
        <Icon name="car" size={34} color={WHITE} />
      </View>
    </View>
  );
}

/** "Je suis passager", held down: a quick tap is not enough to wave the warning away. */
function PassengerHold({ label, hint, onConfirm }: { label: string; hint: string; onConfirm: () => void }) {
  const fill = useSharedValue(0);
  const start = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    fill.value = withTiming(1, { duration: PASSENGER_HOLD_MS, easing: Easing.linear }, (done) => {
      if (done) runOnJS(onConfirm)();
    });
  };
  const stop = () => {
    cancelAnimation(fill);
    fill.value = withTiming(0, { duration: 200 });
  };
  const bar = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <Pressable onPressIn={start} onPressOut={stop} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} style={styles.hold}>
      <Animated.View style={[styles.holdFill, bar]} />
      <Text color={WHITE} align="center" style={styles.holdLabel}>
        {label}
      </Text>
      <Text color={WHITE} align="center" variant="small" style={styles.holdHint}>
        {hint}
      </Text>
    </Pressable>
  );
}

export default function DriveWarningScreen() {
  const i18n = useT();
  const reduceMotion = useReducedMotion();
  const preferences = useAppStore((state) => state.preferences);
  const contact = useAppStore((state) => state.emergencyContact);
  const [openedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [torchReady, setTorchReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [camera, setCamera] = useState(false);
  const canClose = elapsed >= HOLD_S;
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

  // The clock behind every wait.
  useEffect(() => {
    useAppStore.setState({ driveWarningAt: null });
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - openedAt) / 1000)), 500);
    return () => clearInterval(timer);
  }, [openedAt]);

  // No way out but the buttons: Android back waits for the hold; the iOS swipe is off (_layout.tsx).
  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => !canCloseRef.current);
    return () => back.remove();
  }, []);

  // Strong vibrations: a warning, then a heavy double pulse with each line.
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

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };
  const appear = reduceMotion ? undefined : FadeInDown.duration(700);
  const progress = Math.min(1, elapsed / HOLD_S);

  return (
    <View style={styles.root} accessibilityViewIsModal>
      <Backdrop still={reduceMotion} />
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
          <Beacon still={reduceMotion} />
          <Text color={WHITE} align="center" style={styles.title}>
            {i18n.t("drive.notifTitle")}
          </Text>
          {lines.map((line, index) => (
            <Line key={index} text={line.text} index={index} still={reduceMotion} big={line.big} />
          ))}
        </View>
        <View style={styles.actions}>
          {elapsed >= HELP_AFTER_S ? (
            <Animated.View entering={appear} style={styles.actions}>
              {contact ? (
                <Button label={i18n.t("drive.call", { name: contact.name })} icon="phone" variant="secondary" height={52} onPress={() => void Linking.openURL(`tel:${contact.phone}`)} />
              ) : null}
              <Button label={i18n.t("drive.ride")} variant="secondary" height={52} onPress={() => router.replace("/home")} />
            </Animated.View>
          ) : null}
          {elapsed >= PASSENGER_AFTER_S && !canClose ? (
            <Animated.View entering={appear}>
              <PassengerHold
                label={i18n.t("drive.passenger")}
                hint={i18n.t("drive.passengerHold")}
                onConfirm={() => {
                  void silenceAsPassenger();
                  canCloseRef.current = true;
                  close();
                }}
              />
            </Animated.View>
          ) : null}
          {canClose ? (
            <Animated.View entering={appear}>
              <Button label={i18n.t("drive.close")} variant="outline" height={48} onPress={close} />
            </Animated.View>
          ) : (
            // No close button yet: only a thin line filling up says the wait has an end.
            <View style={styles.track} accessibilityLabel={i18n.t("drive.closeIn", { seconds: HOLD_S - elapsed })}>
              <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GARNET },
  safe: { flex: 1, paddingHorizontal: 24, justifyContent: "space-between" },
  lines: { flex: 1, justifyContent: "center", gap: 18 },
  title: { fontFamily: fontFiles.title, fontSize: 40, lineHeight: 44 },
  big: { fontSize: 38, lineHeight: 42 },
  line: { fontSize: 24, lineHeight: 30 },
  actions: { gap: 10, paddingBottom: 12 },
  beacon: { alignSelf: "center", width: 88, height: 88, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  halo: { position: "absolute", width: 88, height: 88, borderRadius: 44, backgroundColor: SCARLET },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.45)",
  },
  hold: { minHeight: 60, borderRadius: 16, overflow: "hidden", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.5)" },
  holdFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "rgba(255,255,255,0.28)" },
  holdLabel: { fontFamily: fontFiles.title, fontSize: 17 },
  holdHint: { opacity: 0.75 },
  track: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)", overflow: "hidden", marginBottom: 8 },
  trackFill: { height: 4, backgroundColor: "rgba(255,255,255,0.7)" },
  // Out of sight: only its torch matters.
  camera: { position: "absolute", width: 1, height: 1, opacity: 0, top: 0, left: 0 },
});
