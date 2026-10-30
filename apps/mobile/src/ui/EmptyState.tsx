import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { duration, extraIcons, glassIcons, icons, type ExtraIconName, type GlassIconName, type IconName } from "@crew/design-tokens";
import { easings } from "@/motion/easing";
import { useTheme } from "@/theme";
import { Button } from "./Button";
import type { AnyIconName } from "./Icon";
import { Text } from "./Text";

const AnimatedPath = Animated.createAnimatedComponent(Path);
/** Longer than any icon of the 24 grid, so one dash covers the whole stroke. */
const DASH = 160;
const ART = 64;

function pathOf(name: AnyIconName): string {
  if (name.startsWith("glass:")) return glassIcons[name.slice(6) as GlassIconName];
  if (name.startsWith("x:")) return extraIcons[name.slice(2) as ExtraIconName];
  return icons[name as IconName] ?? "";
}

interface Props {
  icon: AnyIconName;
  text: string;
  /** "Empty state with action" (SCREENS.md): the one thing that fills this list. */
  action?: { label: string; onPress: () => void };
}

/**
 * MOT-10: an empty list says so with a drawing. The icon traces itself once, then the line and
 * the action fade in: it points at the empty place, then stays still. Reduce Motion: drawn, static.
 */
export function EmptyState({ icon, text, action }: Props) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const draw = useSharedValue(reduceMotion ? 1 : 0);
  const rest = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      draw.value = 1;
      rest.value = 1;
      return;
    }
    draw.value = withTiming(1, { duration: duration.rise, easing: easings.out });
    rest.value = withDelay(duration.enter, withTiming(1, { duration: duration.enter, easing: easings.out }));
  }, [reduceMotion, draw, rest]);

  const stroke = useAnimatedProps(() => ({ strokeDashoffset: DASH * (1 - draw.value) }));
  const below = useAnimatedStyle(() => ({ opacity: rest.value, transform: [{ translateY: (1 - rest.value) * 8 }] }));

  return (
    <View style={styles.wrap} accessible accessibilityLabel={text}>
      <View style={[styles.art, { backgroundColor: theme.surfaceRaised }]}>
        <Svg width={ART * 0.6} height={ART * 0.6} viewBox="0 0 24 24">
          <AnimatedPath
            d={pathOf(icon)}
            stroke={theme.amber}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={[DASH, DASH]}
            animatedProps={stroke}
          />
        </Svg>
      </View>
      <Animated.View style={[styles.below, below]}>
        <Text align="center" muted>
          {text}
        </Text>
        {action ? <Button label={action.label} variant="secondary" onPress={action.onPress} /> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 14, paddingVertical: 20 },
  art: { width: ART, height: ART, borderRadius: ART / 2, alignItems: "center", justifyContent: "center" },
  below: { alignItems: "center", gap: 12, alignSelf: "stretch" },
});
