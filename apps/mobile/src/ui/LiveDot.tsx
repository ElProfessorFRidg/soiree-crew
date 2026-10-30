import { useEffect } from "react";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { duration } from "@crew/design-tokens";
import { useTheme } from "@/theme";

/** DESIGN.md §5: shown only while something is really live; the opacity pulses (static under Reduce Motion). */
export function LiveDot({ size = 8 }: { size?: number }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(withTiming(0.35, { duration: duration.pulse / 2, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(opacity);
  }, [reduceMotion, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.ok }, style]} />;
}
