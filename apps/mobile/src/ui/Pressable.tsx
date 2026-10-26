import { type ReactNode } from "react";
import { Pressable as RNPressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { duration } from "@crew/design-tokens";
import { easings } from "@/motion/easing";

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

interface Props extends Omit<PressableProps, "style" | "children"> {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  /** Scale on press, .97 for buttons (DESIGN.md §4). */
  pressedScale?: number;
}

/** Every tappable surface: real accessibility role, press scale with a Reduce Motion fallback. */
export function ScalePressable({ style, children, pressedScale = 0.97, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...rest}
      onPressIn={(event) => {
        if (!reduceMotion) scale.value = withTiming(pressedScale, { duration: duration.press, easing: easings.out });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withTiming(1, { duration: duration.press, easing: easings.out });
        onPressOut?.(event);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
