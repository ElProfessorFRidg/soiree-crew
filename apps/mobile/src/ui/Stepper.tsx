import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { duration, numeral, radius } from "@crew/design-tokens";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { useTheme } from "@/theme";
import { Icon } from "./Icon";
import { ScalePressable } from "./Pressable";
import { Numeral, Text } from "./Text";

interface Props {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  format?: (value: number) => string;
  unit?: string;
  decreaseLabel: string;
  increaseLabel: string;
  /** Shown inline when a bound is reached; the screen never freezes (O-04). */
  boundMessage?: string;
  /** False where a typed number would mean nothing, like a clock time; the buttons and the hold still work. */
  editable?: boolean;
  /** Figure size; 44 by default. */
  size?: number;
}

/** Hold a button: the first repeat waits a little, then the steps speed up. */
const HOLD_DELAY_MS = 380;
const REPEAT_START_MS = 140;
const REPEAT_FASTEST_MS = 45;

/**
 * A number set three ways: a tap for one step, a hold that speeds up (62 to 80 kg in a second),
 * or a tap on the figure to type it. Every step ticks when haptics are on.
 */
export function Stepper({ value, min, max, step = 1, onChange, format, unit, decreaseLabel, increaseLabel, boundMessage, editable = true, size = 44 }: Props) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const first = useRef(true);
  const current = useRef(value);
  current.current = value;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeated = useRef(false);
  const [editing, setEditing] = useState<string | null>(null);
  const atBound = value <= min || value >= max;
  const decimals = step < 1 ? String(step).split(".")[1]?.length ?? 1 : 0;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    scale.value = withSequence(
      withTiming(1.06, { duration: duration.pop * 0.5, easing: easings.out }),
      withTiming(1, { duration: duration.pop * 0.5, easing: easings.out }),
    );
  }, [value, scale]);
  useEffect(() => () => stopRepeat(), []);

  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const clamp = (n: number) => Math.min(max, Math.max(min, Number((Math.round(n / step) * step).toFixed(decimals))));

  const change = (delta: number): boolean => {
    const next = clamp(current.current + delta);
    if (next === current.current) {
      haptic.error();
      return false;
    }
    haptic.select();
    current.current = next;
    onChange(next);
    return true;
  };

  function stopRepeat() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }
  const startRepeat = (delta: number) => {
    repeated.current = false;
    stopRepeat();
    let wait = REPEAT_START_MS;
    const tick = () => {
      repeated.current = true;
      if (!change(delta)) return stopRepeat();
      wait = Math.max(REPEAT_FASTEST_MS, wait * 0.85);
      timer.current = setTimeout(tick, wait);
    };
    timer.current = setTimeout(tick, HOLD_DELAY_MS);
  };
  const release = (delta: number) => {
    stopRepeat();
    // A plain tap: one step. A hold already stepped while the finger was down.
    if (!repeated.current) change(delta);
  };

  const commit = () => {
    if (editing === null) return;
    const typed = Number.parseFloat(editing.replace(",", "."));
    setEditing(null);
    if (!Number.isFinite(typed)) return;
    const next = clamp(typed);
    if (next !== value) {
      haptic.select();
      onChange(next);
    }
  };

  const button = (delta: number, label: string) => (
    <ScalePressable
      accessibilityRole="button"
      accessibilityLabel={label}
      pressedScale={0.9}
      onPressIn={() => startRepeat(delta)}
      onPressOut={() => release(delta)}
      style={[styles.button, { backgroundColor: theme.surfaceRaised }]}
    >
      <Icon name={delta < 0 ? "x:minus" : "plus"} size={24} color={theme.amber} />
    </ScalePressable>
  );

  const shown = format ? format(value) : value.toFixed(decimals);
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {button(-step, decreaseLabel)}
        <Pressable
          accessibilityRole="adjustable"
          accessibilityValue={{ text: unit ? `${shown} ${unit}` : shown }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(event) => change(event.nativeEvent.actionName === "increment" ? step : -step)}
          disabled={!editable}
          onPress={() => setEditing(value.toFixed(decimals))}
          style={styles.valueTouch}
        >
          <Animated.View style={[styles.value, editing !== null && styles.valueEditing, pop]} accessibilityLiveRegion="polite">
            {editing !== null ? (
              <TextInput
                value={editing}
                onChangeText={setEditing}
                onBlur={commit}
                onSubmitEditing={commit}
                autoFocus
                selectTextOnFocus
                keyboardType={decimals ? "decimal-pad" : "number-pad"}
                returnKeyType="done"
                maxLength={6}
                // The whole value is selected and typing replaces it: no caret, which iOS draws as
                // tall as the line, far taller than the digits of this compressed numeral.
                caretHidden
                selectionColor={theme.amber}
                style={[styles.input, { fontFamily: numeral(size).fontFamily, fontSize: Math.round(size * 0.8), color: theme.text, borderColor: theme.amber, backgroundColor: theme.surface2 }]}
              />
            ) : (
              <Numeral size={size}>{shown}</Numeral>
            )}
            {unit ? (
              <Text variant="h3" muted>
                {unit}
              </Text>
            ) : null}
          </Animated.View>
        </Pressable>
        {button(step, increaseLabel)}
      </View>
      {atBound && boundMessage ? (
        <Text variant="small" color={theme.danger} align="center">
          {boundMessage}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  button: { width: 52, height: 52, borderRadius: radius.button, alignItems: "center", justifyContent: "center" },
  valueTouch: { flex: 1, minHeight: 56, justifyContent: "center" },
  value: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 6 },
  // The box is taller than the digits it holds: the unit centres on it instead of sinking under it.
  valueEditing: { alignItems: "center" },
  input: { minWidth: 96, height: 56, textAlign: "center", borderWidth: 1.5, borderRadius: radius.input, paddingHorizontal: 14, paddingVertical: 0, letterSpacing: -0.5 },
});
