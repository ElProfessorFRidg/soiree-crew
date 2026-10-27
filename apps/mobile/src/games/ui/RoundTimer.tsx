import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import { radius, scaled } from "@crew/design-tokens";
import { haptic } from "@/motion/haptics";
import { useTheme } from "@/theme";
import { Text } from "@/ui/Text";
import { useTicker } from "../hooks";
import { useGameT } from "../i18n";

/** O-47 round timer: restarts on every new round (`roundKey`), buzzes once at zero. Off when `seconds` is 0. */
export function RoundTimer({ seconds, roundKey, paused }: { seconds: number; roundKey: string | number; paused?: boolean }) {
  const theme = useTheme();
  const g = useGameT();
  const [left, setLeft] = useState(seconds * 1000);
  const buzzed = useRef(false);

  useEffect(() => {
    setLeft(seconds * 1000);
    buzzed.current = false;
  }, [roundKey, seconds]);

  useTicker(seconds > 0 && !paused && left > 0, (delta) => {
    setLeft((value) => {
      const next = Math.max(0, value - delta);
      if (next === 0 && !buzzed.current) {
        buzzed.current = true;
        haptic.error();
      }
      return next;
    });
  }, 200);

  const share = seconds > 0 ? left / (seconds * 1000) : 0;
  const ms = scaled(200);
  const fill = useAnimatedStyle(() => ({ width: withTiming(`${share * 100}%`, { duration: ms }) }), [share, ms]);
  if (seconds <= 0) return null;
  const done = left === 0;
  return (
    <View style={styles.row} accessibilityRole="progressbar" accessibilityLabel={g.t("shell.timerLabel")} accessibilityValue={{ min: 0, max: seconds, now: Math.ceil(left / 1000) }}>
      <View style={[styles.bar, { backgroundColor: theme.surfaceRaised }]}>
        <Animated.View style={[styles.fill, { backgroundColor: done ? theme.danger : theme.water }, fill]} />
      </View>
      <Text variant="tag" color={done ? theme.danger : theme.textMuted}>
        {g.t("shell.timeLeft", { seconds: Math.ceil(left / 1000) })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  bar: { flex: 1, height: 8, borderRadius: radius.pill, overflow: "hidden" },
  fill: { height: "100%" },
});
