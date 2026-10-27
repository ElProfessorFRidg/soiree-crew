import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { duration, palette, scaled } from "@crew/design-tokens";

const PIECES = 14;
const COLOURS = palette.avatar;

/** One flying piece. Its path is fixed by its index, so the burst looks the same on every phone. */
function Piece({ index, radius }: { index: number; radius: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay((index % 5) * 50, withTiming(1, { duration: duration.confetti, easing: Easing.bezier(0.3, 0.6, 0.4, 1) }));
  }, [index, t]);
  const angle = (index / PIECES) * Math.PI * 2;
  const reach = radius * (0.9 + (index % 3) * 0.25);
  const style = useAnimatedStyle(() => {
    const p = t.value;
    // Out from the centre, then falling under a little gravity.
    const x = Math.cos(angle) * reach * p;
    const y = Math.sin(angle) * reach * p + 260 * p * p;
    return { opacity: 1 - p, transform: [{ translateX: x }, { translateY: y }, { rotate: `${600 * p}deg` }] };
  });
  return <Animated.View style={[styles.piece, { backgroundColor: COLOURS[index % COLOURS.length] }, style]} />;
}

/** Bomb explosion (MOT-07): a scale burst and particles, 700 ms burst and 1.8 s fall. No white flash. */
export function Burst({ size, calm }: { size: number; calm?: boolean }) {
  const reduceMotion = useReducedMotion();
  const ring = useSharedValue(0);
  useEffect(() => {
    ring.value = withTiming(1, { duration: scaled(700), easing: Easing.out(Easing.cubic) });
  }, [ring]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: 1 - ring.value, transform: [{ scale: 0.4 + ring.value * 2.6 }] }));
  if (reduceMotion) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
      <Animated.View style={[{ width: size * 0.8, height: size * 0.8, borderRadius: size, backgroundColor: palette.semantic.danger }, ringStyle]} />
      {calm ? null : Array.from({ length: PIECES }, (_, i) => <Piece key={i} index={i} radius={size * 0.9} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  piece: { position: "absolute", width: 8, height: 14, borderRadius: 2 },
});
