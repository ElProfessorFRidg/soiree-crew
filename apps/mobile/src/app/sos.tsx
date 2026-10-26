import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { palette } from "@crew/design-tokens";
import { countryRules } from "@crew/units";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { useLiveBac, useNow, useUiLevel } from "@/state/hooks";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Panel, Row } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

const HOLD_MS = 2_000;
const COUNTDOWN_S = 5;
const RING = 220;
const STROKE = 10;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function call(number: string) {
  haptic.heavy();
  void Linking.openURL(`tel:${number}`);
}

/**
 * N-28. At levels 0 and 1 the call needs a 2 s hold, so a pocket tap never dials.
 * At levels 2 and 3 a long press is not allowed (ADP-04), so one tap starts a
 * 5 s countdown with a big cancel button (decision D-07).
 */
export default function SosScreen() {
  const i18n = useT();
  const theme = useTheme();
  const now = useNow();
  const live = useLiveBac(now);
  const { level } = useUiLevel(live?.estimate.bac ?? 0, now);
  const country = useAppStore((state) => state.preferences.legalCountry);
  const rules = countryRules(country);
  const primary = rules.emergency.ambulance ?? rules.emergency.primary;

  const progress = useSharedValue(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (ticker.current) clearInterval(ticker.current);
    },
    [],
  );

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      call(primary);
      return;
    }
    const timer = setTimeout(() => setCountdown((s) => (s === null ? null : s - 1)), 1_000);
    return () => clearTimeout(timer);
  }, [countdown, primary]);

  const circumference = Math.PI * (RING - STROKE);
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - progress.value) }));

  const startHold = () => {
    progress.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear });
    let ticks = 0;
    ticker.current = setInterval(() => {
      ticks += 1;
      haptic.holdTick();
      if (ticks >= 4 && ticker.current) clearInterval(ticker.current);
    }, HOLD_MS / 4);
    holdTimer.current = setTimeout(() => call(primary), HOLD_MS);
  };
  const endHold = () => {
    cancelAnimation(progress);
    progress.value = withTiming(0, { duration: 200 });
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (ticker.current) clearInterval(ticker.current);
  };

  const holdMode = level < 2;

  return (
    <Screen back title={i18n.t("sos.title")}>
      <View style={styles.center}>
        {holdMode ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={i18n.t("sos.holdA11y")}
            onPressIn={startHold}
            onPressOut={endHold}
            style={styles.ringButton}
          >
            <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
              <Circle cx={RING / 2} cy={RING / 2} r={(RING - STROKE) / 2} stroke={palette.tint.dangerBg} strokeWidth={STROKE} fill="none" />
              <AnimatedCircle
                cx={RING / 2}
                cy={RING / 2}
                r={(RING - STROKE) / 2}
                stroke={theme.danger}
                strokeWidth={STROKE}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${circumference} ${circumference}`}
                animatedProps={ringProps}
                transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
              />
            </Svg>
            <View style={[styles.core, { backgroundColor: theme.danger }]}>
              <Icon name="phone" size={40} color={theme.onAccent} />
              <Text variant="h2" color={theme.onAccent}>
                {primary}
              </Text>
            </View>
          </Pressable>
        ) : countdown === null ? (
          <Button
            label={i18n.t("sos.tap", { number: primary })}
            icon="phone"
            variant="danger"
            height={104}
            fontSize={24}
            iconSize={30}
            style={styles.wide}
            onPress={() => {
              haptic.heavy();
              setCountdown(COUNTDOWN_S);
            }}
          />
        ) : (
          <View style={[styles.wide, styles.countdown]}>
            <Text variant="h2" align="center" accessibilityLiveRegion="assertive">
              {i18n.t("sos.countdown", { seconds: countdown })}
            </Text>
            <Button label={i18n.t("sos.cancel")} variant="secondary" height={104} fontSize={24} onPress={() => setCountdown(null)} />
          </View>
        )}
        {holdMode ? <Text align="center">{i18n.t("sos.hold")}</Text> : null}
      </View>

      <Text variant="label">{i18n.t("sos.numbers")}</Text>
      <Panel>
        {rules.emergency.ambulance ? (
          <Row title={i18n.t("sos.ambulance")} subtitle={rules.emergency.ambulance} onPress={() => call(rules.emergency.ambulance!)} />
        ) : null}
        {rules.emergency.police ? (
          <Row title={i18n.t("sos.police")} subtitle={rules.emergency.police} onPress={() => call(rules.emergency.police!)} />
        ) : null}
        {rules.emergency.fire ? (
          <Row title={i18n.t("sos.fire")} subtitle={rules.emergency.fire} onPress={() => call(rules.emergency.fire!)} />
        ) : null}
        {rules.emergency.eu112 && primary !== "112" ? (
          <Row title={i18n.t("sos.europe")} subtitle="112" onPress={() => call("112")} last />
        ) : !rules.emergency.ambulance ? (
          <Row title={i18n.t("sos.ambulance")} subtitle={primary} onPress={() => call(primary)} last />
        ) : null}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", gap: 16, paddingVertical: 12 },
  ringButton: { width: RING, height: RING, alignItems: "center", justifyContent: "center" },
  core: { width: RING - 44, height: RING - 44, borderRadius: RING, alignItems: "center", justifyContent: "center", gap: 6 },
  wide: { alignSelf: "stretch" },
  countdown: { gap: 16 },
});
