import { useEffect, useRef, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { duration, scaled } from "@crew/design-tokens";
import { easings } from "@/motion/easing";

// MOT-09, DESIGN.md §5 "Venue takeover" and "Live dot": what moves on a venue pin of the Bars map.
// `still` covers Reduce Motion and UI levels 2 and 3: the end state shows at once, nothing loops.

/** Same rhythm as LiveDot: one opacity pulse every 1600 ms, ease-in-out. */
const PULSE_MS = 1600;

/** A takeover still worth showing: a pin mounting later (filter change, scroll back) does not replay it. */
const FRESH_MS = 3_000;

/**
 * Runs `play` once per takeover at `at` (epoch ms, 0 for none), and only while it is fresh. A pin that
 * just got its first boss mounts with the takeover already set, so it still plays.
 */
function useOnTakeover(at: number, play: () => void): void {
  const seen = useRef(0);
  const run = useRef(play);
  run.current = play;
  useEffect(() => {
    if (at === 0 || at === seen.current || Date.now() - at > FRESH_MS) return;
    seen.current = at;
    run.current();
  }, [at]);
}

/** The crown of a pin. Static when the map loads; drops with overshoot on a takeover. */
export function CrownDrop({ takeoverAt, still, children }: { takeoverAt: number; still: boolean; children: ReactNode }) {
  const t = useSharedValue(1);
  useOnTakeover(takeoverAt, () => {
    if (still) return;
    t.value = 0;
    t.value = withTiming(1, { duration: duration.crownDrop, easing: easings.overshoot });
  });
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, t.value * 1.4),
    transform: [{ translateY: (1 - t.value) * -46 }, { scale: 1 + (1 - t.value) * 0.5 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** The new boss's colour washing over the venue: a disc that grows and fades, once per takeover. */
export function TakeoverWash({ takeoverAt, color, size, still }: { takeoverAt: number; color: string; size: number; still: boolean }) {
  const t = useSharedValue(1);
  useOnTakeover(takeoverAt, () => {
    if (still) return;
    t.value = 0;
    t.value = withTiming(1, { duration: duration.wash, easing: easings.out });
  });
  const style = useAnimatedStyle(() => ({
    opacity: t.value >= 1 ? 0 : 0.85 * (1 - t.value),
    transform: [{ scale: 0.2 + t.value * 3.8 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.disc, { width: size, height: size, borderRadius: size / 2, backgroundColor: color, marginLeft: -size / 2, marginTop: -size / 2 }, style]}
    />
  );
}

/** A ring around a venue where the crew is right now. It pulses only while `live`; static under `still`. */
export function LivePulse({ live, color, size, still }: { live: boolean; color: string; size: number; still: boolean }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const moving = live && !still && !reduceMotion;
  useEffect(() => {
    if (!moving) {
      cancelAnimation(opacity);
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(withTiming(0.35, { duration: scaled(PULSE_MS) / 2, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(opacity);
  }, [moving, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (!live) return null;
  const ring = size + 12;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.disc, { width: ring, height: ring, borderRadius: ring / 2, borderWidth: 3, borderColor: color, marginLeft: -ring / 2, marginTop: -ring / 2 }, style]}
    />
  );
}

const styles = StyleSheet.create({
  disc: { position: "absolute", left: "50%", top: "50%" },
});
