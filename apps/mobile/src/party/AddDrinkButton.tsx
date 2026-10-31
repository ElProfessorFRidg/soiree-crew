import { useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { duration } from "@crew/design-tokens";
import { easings } from "@/motion/easing";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";

interface Props {
  label: string;
  /** What screen readers say when it differs from the label ("Encore : Flash vodka"). */
  accessibilityLabel?: string;
  /** True while the last drink waits for the server: the fill stays up until it answers. */
  pending: boolean;
  onPress: () => void;
  height: number;
  fontSize?: number;
  iconSize?: number;
}

/** MOT-03: amber fill rises inside the button on tap, drains when the server confirms. */
export function AddDrinkButton({ label, accessibilityLabel, pending, onPress, height, fontSize = 18, iconSize = 22 }: Props) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(0);
  const pressedAt = useRef(0);
  // Re-runs the drain effect after every tap, even when the answer came back before React saw "pending".
  const [presses, setPresses] = useState(0);

  useEffect(() => {
    if (pending) return;
    // A fast answer still lets the glass fill completely before it drains.
    const wait = Math.max(0, duration.fill - (Date.now() - pressedAt.current));
    fill.value = withDelay(wait, withTiming(0, { duration: duration.fill, easing: easings.out }));
  }, [pending, presses, fill]);

  const fillStyle = useAnimatedStyle(() => ({ height: `${fill.value * 100}%` }));

  return (
    <Button
      label={label}
      accessibilityLabel={accessibilityLabel}
      icon="plus"
      iconSize={iconSize}
      height={height}
      fontSize={fontSize}
      style={{ flex: 1 }}
      onPress={() => {
        pressedAt.current = Date.now();
        setPresses((n) => n + 1);
        fill.value = reduceMotion ? 1 : withTiming(1, { duration: duration.fill, easing: easings.out });
        onPress();
      }}
      underlay={<Animated.View style={[styles.fill, { backgroundColor: theme.amberPressed }, fillStyle]} />}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
});
