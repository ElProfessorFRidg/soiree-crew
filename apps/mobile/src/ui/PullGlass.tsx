import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { ClipPath, Defs, Path } from "react-native-svg";
import { duration, glassIcons, spring } from "@crew/design-tokens";
import { useTheme } from "@/theme";
import { useEcoLoop } from "@/power/eco";
import { pullProgress } from "./pure/pullProgress";

const AnimatedPath = Animated.createAnimatedComponent(Path);

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

/** The beer, its top a wave of `tilt` (sloshing) and `phase` (rolling), from `amount` of the glass. */
function liquid(amount: number, phase: number, tilt: number, foam: number): string {
  "worklet";
  const surface = GLASS_BOTTOM - (GLASS_BOTTOM - GLASS_TOP) * amount;
  const wave = amount <= 0.02 || amount >= 0.98 ? 0 : 0.9;
  let d = `M0 ${GLASS_BOTTOM + 1} L0 ${surface}`;
  for (let x = 0; x <= 24; x += 2) {
    const y = surface - foam + Math.sin(phase + x * 0.45) * wave + (x - 12) * tilt * 0.06;
    d += ` L${x} ${y.toFixed(2)}`;
  }
  return `${d} L24 ${GLASS_BOTTOM + 1} Z`;
}

/**
 * MOT-10: pull to refresh as an amber pint filling under the finger. Let go full and the screen
 * reloads: the glass stays, filling up again and again with its beer sloshing and a head of foam,
 * until the answer is in, then it leaves on the `snap` spring.
 * Reduce Motion: the glass fills with the pull and fades, nothing moves on its own.
 */
export function PullGlass({ scrollY, refreshing, top }: Props) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const held = useSharedValue(0);
  const level = useSharedValue(1);
  const phase = useSharedValue(0);
  const tilt = useSharedValue(0);
  const loop = useEcoLoop(false);
  const tiltLoop = useEcoLoop(true);

  useEffect(() => {
    if (refreshing) {
      held.value = withTiming(1, { duration: duration.press });
      if (!reduceMotion) {
        // Poured from low to the brim, a short pause full, then drunk and poured again.
        level.value = 0.15;
        level.value = withRepeat(
          withSequence(withTiming(1, { duration: 750 * loop.slow, easing: Easing.out(Easing.cubic) }), withDelay(150 * loop.slow, withTiming(0.15, { duration: 250 * loop.slow, easing: Easing.in(Easing.quad) }))),
          loop.count,
          false,
        );
        phase.value = withRepeat(withTiming(Math.PI * 2, { duration: 900 * loop.slow, easing: Easing.linear }), loop.count, false);
        tilt.value = withRepeat(withSequence(withTiming(1, { duration: 380 * loop.slow, easing: Easing.inOut(Easing.sin) }), withTiming(-1, { duration: 380 * loop.slow, easing: Easing.inOut(Easing.sin) })), -1, true);
      }
      return;
    }
    cancelAnimation(level);
    cancelAnimation(phase);
    cancelAnimation(tilt);
    level.value = withTiming(1, { duration: duration.press });
    tilt.value = withSpring(0, spring.snap);
    held.value = reduceMotion ? withTiming(0, { duration: duration.toggle }) : withDelay(120, withSpring(0, spring.snap));
  }, [refreshing, reduceMotion, held, level, phase, tilt, loop.count, loop.slow, tiltLoop.count]);

  const amountOf = () => {
    "worklet";
    return Math.max(pullProgress(scrollY.value), held.value * level.value);
  };
  const beer = useAnimatedProps(() => ({ d: liquid(amountOf(), phase.value, tilt.value, 0) }));
  // A thin head of foam rides the surface once there is enough beer to have one.
  const foamBody = useAnimatedProps(() => {
    const amount = amountOf();
    const top = GLASS_BOTTOM - (GLASS_BOTTOM - GLASS_TOP) * amount;
    return { d: `M0 ${top - 1.6} L24 ${top - 1.6} L24 ${top + 0.4} L0 ${top + 0.4} Z`, opacity: amount > 0.3 ? 0.9 : 0 };
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
        <AnimatedPath fill={theme.amber} opacity={0.85} clipPath="url(#pull-glass)" animatedProps={beer} />
        <AnimatedPath fill="#FFF6E0" clipPath="url(#pull-glass)" animatedProps={foamBody} />
        <Path d={glassIcons.pint} stroke={theme.amber} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 2 },
});
