import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { duration, palette, radius, size, space } from "@crew/design-tokens";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { useTheme } from "@/theme";
import { Icon, type AnyIconName } from "./Icon";
import { ScalePressable } from "./Pressable";
import { Text } from "./Text";

export type TagTone = "neutral" | "amber" | "danger" | "water" | "ok";

export function Tag({ label, tone = "neutral", icon }: { label: string; tone?: TagTone; icon?: AnyIconName }) {
  const theme = useTheme();
  const tones: Record<TagTone, { bg: string; fg: string }> = {
    neutral: { bg: theme.surfaceRaised, fg: theme.name === "dark" ? "#E3E7E4" : theme.text },
    amber: { bg: palette.tint.amberBg, fg: palette.tint.amberText },
    danger: { bg: palette.tint.dangerBg, fg: palette.tint.dangerText },
    water: { bg: palette.tint.waterBg, fg: palette.tint.waterText },
    ok: { bg: palette.tint.okBg, fg: palette.tint.okText },
  };
  const colors = tones[tone];
  return (
    <View style={[styles.tag, { backgroundColor: colors.bg }]}>
      {icon ? <Icon name={icon} size={13} color={colors.fg} /> : null}
      <Text variant="tag" color={colors.fg}>
        {label}
      </Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: AnyIconName;
}) {
  const theme = useTheme();
  const bg = selected ? theme.text : theme.surfaceRaised;
  const fg = selected ? theme.bg : theme.text;
  return (
    <ScalePressable
      onPress={
        onPress
          ? () => {
              haptic.select();
              onPress();
            }
          : undefined
      }
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      // The touch area reaches 48 px tall without crowding a row of chips (ADP-09).
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      style={[styles.chip, { backgroundColor: bg }]}
    >
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text variant="chip" color={fg}>
        {label}
      </Text>
    </ScalePressable>
  );
}

export function Switch({
  value,
  onValueChange,
  accessibilityLabel,
  disabled,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const progress = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: duration.toggle, easing: easings.toggle });
  }, [value, progress]);

  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [theme.lineStrong, theme.amber]),
  }));
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * 20 }] }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      aria-checked={value}
      onPress={
        disabled
          ? undefined
          : () => {
              haptic.select();
              onValueChange(!value);
            }
      }
      hitSlop={6}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Animated.View style={[styles.track, track]}>
        <Animated.View style={[styles.knob, { backgroundColor: theme.text }, knob]} />
      </Animated.View>
    </Pressable>
  );
}

export function Segmented<T extends string | number>({
  items,
  value,
  onChange,
  accessibilityLabel,
  height = size.segmentedItem,
}: {
  items: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  accessibilityLabel: string;
  height?: number;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, items.findIndex((item) => item.value === value));
  // The light pill slides to the chosen item instead of jumping (DESIGN.md §5, toggle).
  const pillWidth = items.length ? (width - SEG_PAD * 2 - SEG_GAP * (items.length - 1)) / items.length : 0;
  const x = useSharedValue(0);
  useEffect(() => {
    const target = index * (pillWidth + SEG_GAP);
    x.value = reduceMotion || pillWidth <= 0 ? target : withTiming(target, { duration: duration.toggle, easing: easings.toggle });
  }, [index, pillWidth, reduceMotion, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.seg, { backgroundColor: theme.surface2 }]}
    >
      {pillWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.segPill, { width: pillWidth, top: SEG_PAD, bottom: SEG_PAD, left: SEG_PAD, backgroundColor: theme.text }, pill]}
        />
      ) : null}
      {items.map((item) => {
        const on = item.value === value;
        return (
          <Pressable
            key={String(item.value)}
            accessibilityRole="radio"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (on) return;
              haptic.select();
              onChange(item.value);
            }}
            // The 38 px token is under the 44 px touch rule: the hit area covers the gap.
            hitSlop={{ top: 3, bottom: 3 }}
            style={[styles.segItem, { minHeight: height, backgroundColor: on && pillWidth <= 0 ? theme.text : "transparent" }]}
          >
            <Text variant="chip" style={{ fontSize: 13 }} color={on ? theme.bg : theme.textSoft} align="center">
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const SEG_PAD = 3;
const SEG_GAP = 3;

/** Surface block ("pan" in the prototype). Never nested in another Panel. */
export function Panel({ children, style, tint }: { children: ReactNode; style?: StyleProp<ViewStyle>; tint?: TagTone }) {
  const theme = useTheme();
  const tints: Partial<Record<TagTone, string>> = {
    amber: palette.tint.amberBg,
    danger: palette.tint.dangerBg,
    water: palette.tint.waterBg,
    ok: palette.tint.okBg,
  };
  return (
    <View style={[styles.panel, { backgroundColor: (tint && tints[tint]) ?? theme.surface }, style]}>{children}</View>
  );
}

export function Row({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  accessibilityLabel,
  last,
}: {
  title: string;
  /** A string, or a node such as a RelativeTime (QOL-12). */
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  last?: boolean;
}) {
  const theme = useTheme();
  const content = (
    <>
      {leading}
      <View style={styles.rowText}>
        <Text variant="h3">{title}</Text>
        {subtitle ? <Text variant="small">{subtitle}</Text> : null}
      </View>
      {trailing}
    </>
  );
  const rowStyle = [styles.row, { borderBottomColor: theme.line, borderBottomWidth: last ? 0 : 1 }];
  if (!onPress) return <View style={rowStyle}>{content}</View>;
  return (
    <ScalePressable onPress={onPress} pressedScale={0.99} accessibilityLabel={accessibilityLabel ?? title} style={rowStyle}>
      {content}
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    minHeight: size.tag,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: size.chip,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
  track: {
    width: size.switch.width,
    height: size.switch.height,
    borderRadius: radius.pill,
    padding: 4,
  },
  knob: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  seg: {
    flexDirection: "row",
    borderRadius: radius.segmented,
    padding: 3,
    gap: 3,
  },
  segPill: { position: "absolute", borderRadius: radius.segmentedItem },
  segItem: {
    flex: 1,
    borderRadius: radius.segmentedItem,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  panel: {
    borderRadius: radius.card,
    padding: space.cardPadding,
    gap: space.blockGap,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 54,
    paddingVertical: 8,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
