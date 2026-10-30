import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { ClipPath, Defs, Path, Rect } from "react-native-svg";
import { duration, glassIcons, spring } from "@crew/design-tokens";
import { useTheme } from "@/theme";
import { pullProgress } from "./pure/pullProgress";

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/** The pint of the glass icons, closed so it can clip the liquid. */
const GLASS_SHAPE = "M6.5 3h11l-1.4 18H7.9L6.5 3z";
const GLASS_TOP = 3;
const GLASS_BOTTOM = 21;
const SIZE = 40;

interface Props {
  /** The scroll offset of the screen; negative while the finger pulls past the top. */
  scrollY: SharedValue<number>;
  refreshing: boolean;
  top: number;
}

/**
 * MOT-10: pull to refresh as an amber pint filling under the finger. Full, it stays while the
 * screen reloads, the level breathing; once the answer is in, it leaves on the `snap` spring.
 * Reduce Motion: the glass fills with the pull and fades, nothing breathes.
 */
export function PullGlass({ scrollY, refreshing, top }: Props) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const held = useSharedValue(0);
  const level = useSharedValue(1);

  useEffect(() => {
    if (refreshing) {
      held.value = withTiming(1, { duration: duration.press });
      if (!reduceMotion) level.value = withRepeat(withTiming(0.6, { duration: duration.pulse / 2, easing: Easing.inOut(Easing.quad) }), -1, true);
      return;
    }
    cancelAnimation(level);
    level.value = 1;
    held.value = reduceMotion ? withTiming(0, { duration: duration.toggle }) : withSpring(0, spring.snap);
  }, [refreshing, reduceMotion, held, level]);

  const fill = useAnimatedProps(() => {
    const pulled = pullProgress(scrollY.value);
    const amount = Math.max(pulled, held.value * level.value);
    const height = (GLASS_BOTTOM - GLASS_TOP) * amount;
    return { y: GLASS_BOTTOM - height, height };
  });
  const wrap = useAnimatedStyle(() => {
    const shown = Math.max(pullProgress(scrollY.value), held.value);
    return { opacity: Math.min(1, shown * 1.6), transform: [{ scale: 0.7 + 0.3 * shown }] };
  });

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.wrap, { top }, wrap]}
    >
      <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24">
        <Defs>
          <ClipPath id="pull-glass">
            <Path d={GLASS_SHAPE} />
          </ClipPath>
        </Defs>
        <AnimatedRect x={0} width={24} fill={theme.amber} opacity={0.85} clipPath="url(#pull-glass)" animatedProps={fill} />
        <Path d={glassIcons.pint} stroke={theme.amber} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 2 },
});
