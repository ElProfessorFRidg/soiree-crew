import { useEffect, useRef, useState } from "react";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { duration } from "@crew/design-tokens";
import { easings } from "@/motion/easing";
import { Numeral } from "@/ui/Text";

/** DESIGN.md §5: digits roll from the old to the new value in 14 steps, about 630 ms. */
const ROLL_STEPS = 14;
const ROLL_STEP_MS = 45;
/** Changes smaller than this (the 15 s clock tick) update in place without a roll. */
const ROLL_THRESHOLD = 0.02;

interface Props {
  value: number;
  format: (value: number) => string;
  size: number;
  color: string;
  accessibilityLabel?: string;
}

export function RollingNumber({ value, format, size, color, accessibilityLabel }: Props) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const scale = useSharedValue(1);

  useEffect(() => {
    const from = shownRef.current;
    if (reduceMotion || Math.abs(value - from) < ROLL_THRESHOLD) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    let step = 0;
    scale.value = withSequence(
      withTiming(1.08, { duration: duration.pop * 0.6, easing: easings.out }),
      withTiming(1, { duration: duration.pop * 0.4, easing: easings.out }),
    );
    const timer = setInterval(() => {
      step += 1;
      const next = step >= ROLL_STEPS ? value : from + ((value - from) * step) / ROLL_STEPS;
      shownRef.current = next;
      setShown(next);
      if (step >= ROLL_STEPS) clearInterval(timer);
    }, ROLL_STEP_MS);
    return () => clearInterval(timer);
  }, [value, reduceMotion, scale]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[{ alignSelf: "flex-start", transformOrigin: "left bottom" }, animated]}>
      <Numeral size={size} color={color} accessibilityLabel={accessibilityLabel} accessibilityLiveRegion="polite">
        {format(shown)}
      </Numeral>
    </Animated.View>
  );
}
