import { useEffect } from "react";
import { StyleSheet, View, type DimensionValue } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { duration, radius } from "@crew/design-tokens";
import { useTheme } from "@/theme";

/** MOT-10, DESIGN.md §4: a shimmering block where content will be, replaced in place. */
export function Skeleton({ width = "100%", height = 18, round = false }: { width?: DimensionValue; height?: number; round?: boolean }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    t.value = withRepeat(withTiming(1, { duration: duration.shimmer, easing: Easing.linear }), -1, false);
  }, [reduceMotion, t]);
  const style = useAnimatedStyle(() => ({ opacity: 0.45 + 0.35 * Math.sin(t.value * Math.PI) }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: round ? height / 2 : radius.tile, backgroundColor: theme.surfaceRaised }, style]}
    />
  );
}

/** A few rows of placeholders, the shape of a list that is loading. */
export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <View style={styles.rows}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={40} height={40} round />
          <View style={styles.text}>
            <Skeleton width="60%" height={16} />
            <Skeleton width="35%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { gap: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  text: { flex: 1, gap: 6 },
});
