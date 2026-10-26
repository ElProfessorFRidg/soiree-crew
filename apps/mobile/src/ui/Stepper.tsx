import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { duration } from "@crew/design-tokens";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { useTheme } from "@/theme";
import { IconButton } from "./Button";
import { Numeral, Text } from "./Text";

interface Props {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  format?: (value: number) => string;
  unit?: string;
  decreaseLabel: string;
  increaseLabel: string;
  /** Shown inline when a bound is reached; the screen never freezes (O-04). */
  boundMessage?: string;
}

export function Stepper({ value, min, max, step = 1, onChange, format, unit, decreaseLabel, increaseLabel, boundMessage }: Props) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const first = useRef(true);
  const atBound = value <= min || value >= max;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    scale.value = withSequence(
      withTiming(1.08, { duration: duration.pop * 0.6, easing: easings.out }),
      withTiming(1, { duration: duration.pop * 0.4, easing: easings.out }),
    );
  }, [value, scale]);

  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const change = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next === value) {
      haptic.error();
      return;
    }
    haptic.select();
    onChange(next);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <IconButton icon="back" accessibilityLabel={decreaseLabel} onPress={() => change(-step)} />
        <Animated.View style={[styles.value, pop]} accessibilityLiveRegion="polite">
          <Numeral size={40}>{format ? format(value) : String(value)}</Numeral>
          {unit ? <Text variant="h3" muted>{unit}</Text> : null}
        </Animated.View>
        <IconButton icon="chev" accessibilityLabel={increaseLabel} onPress={() => change(step)} />
      </View>
      {atBound && boundMessage ? <Text variant="small" color={theme.danger}>{boundMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  value: { flex: 1, flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 6 },
});
