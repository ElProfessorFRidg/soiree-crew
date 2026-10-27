import { useEffect, useRef, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { duration } from "@crew/design-tokens";
import { easings } from "@/motion/easing";

/**
 * 3D card flip (MOT-06): rotateY 0 to 180 in 550 ms easeFlip, backface hidden.
 * Reduce Motion swaps the turn for a crossfade with the same end state.
 */
export function FlipCard({
  flipped,
  front,
  back,
  style,
}: {
  flipped: boolean;
  front: ReactNode;
  back: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(flipped ? 1 : 0);
  useEffect(() => {
    turn.value = withTiming(flipped ? 1 : 0, { duration: reduceMotion ? duration.enter : duration.flip, easing: easings.flip });
  }, [flipped, reduceMotion, turn]);

  const frontStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: 1 - turn.value }
      : { transform: [{ perspective: 900 }, { rotateY: `${interpolate(turn.value, [0, 1], [0, 180])}deg` }] },
  );
  const backStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: turn.value }
      : { transform: [{ perspective: 900 }, { rotateY: `${interpolate(turn.value, [0, 1], [180, 360])}deg` }] },
  );

  return (
    <View style={style}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.face, frontStyle]} pointerEvents={flipped ? "none" : "auto"}>
        {front}
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.face, backStyle]} pointerEvents={flipped ? "auto" : "none"}>
        {back}
      </Animated.View>
    </View>
  );
}

/**
 * Deal: the card slides in from the deck and settles. Re-runs whenever `dealKey` changes.
 * No overshoot: a card draw is a routine action (MOT-01).
 */
export function Dealt({ dealKey, children, style }: { dealKey: string | number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: reduceMotion ? duration.toggle : duration.enter, easing: easings.out });
  }, [dealKey, progress, reduceMotion]);
  const animated = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: progress.value }
      : {
          opacity: interpolate(progress.value, [0, 0.4, 1], [0, 1, 1]),
          transform: [
            { translateY: interpolate(progress.value, [0, 1], [-46, 0]) },
            { rotate: `${interpolate(progress.value, [0, 1], [-5, 0])}deg` },
            { scale: interpolate(progress.value, [0, 1], [0.92, 1]) },
          ],
        },
  );
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * A short tremble before a penalty shows (MOT-06). `trigger` changes start it.
 * Calm motion (adaptive levels 2 and 3) and Reduce Motion skip the shake.
 */
export function Tremble({ trigger, children, calm, style }: { trigger: unknown; children: ReactNode; calm?: boolean; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(0);
  useEffect(() => {
    if (trigger === null || trigger === undefined || trigger === false || calm || reduceMotion) return;
    x.value = withSequence(
      withTiming(-4, { duration: 45 }),
      withRepeat(withTiming(4, { duration: 70, easing: Easing.linear }), 4, true),
      withTiming(0, { duration: 45 }),
    );
  }, [trigger, calm, reduceMotion, x]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/** Continuous shake whose strength follows `strength` (0 to 1): the bomb and the crash curve. */
export function useShake(strength: number, enabled: boolean) {
  const reduceMotion = useReducedMotion();
  const phase = useSharedValue(0);
  const amount = useSharedValue(0);
  useEffect(() => {
    const on = enabled && !reduceMotion && strength > 0;
    amount.value = withTiming(on ? strength : 0, { duration: duration.toggle });
    if (on) phase.value = withRepeat(withTiming(1, { duration: 250, easing: Easing.linear }), -1, false);
    else phase.value = 0;
  }, [strength, enabled, reduceMotion, amount, phase]);
  return useAnimatedStyle(() => {
    const t = phase.value * Math.PI * 2;
    return {
      transform: [{ translateX: Math.sin(t * 2) * 4 * amount.value }, { translateY: Math.cos(t * 3) * 2 * amount.value }, { rotate: `${Math.sin(t) * 3 * amount.value}deg` }],
    };
  });
}

/** A one-off pop for counters and tiles (no overshoot beyond 1.06). */
export function usePop(trigger: unknown) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduceMotion) return;
    scale.value = withSequence(withTiming(1.06, { duration: duration.pop * 0.5, easing: easings.out }), withTiming(1, { duration: duration.pop * 0.5, easing: easings.out }));
  }, [trigger, reduceMotion, scale]);
  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

/** Delays a child's fade-in, for staggered reveals. */
export function FadeInAfter({ delayMs, children, style }: { delayMs: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withDelay(delayMs, withTiming(1, { duration: duration.enter, easing: easings.out }));
  }, [delayMs, opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  face: { backfaceVisibility: "hidden" },
});
