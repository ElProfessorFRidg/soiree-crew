import { useEffect, useRef, type ComponentRef } from "react";
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { radius } from "@crew/design-tokens";
import { haptic } from "@/motion/haptics";
import { useTheme } from "@/theme";
import { Text } from "@/ui/Text";

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export interface DateWheelProps {
  value: DateParts;
  minYear: number;
  maxYear: number;
  onChange: (next: DateParts) => void;
  monthLabel: (month: number) => string;
  labels: { day: string; month: string; year: string };
}

const ITEM = 44;
const VISIBLE = 5;

const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

interface WheelProps {
  label: string;
  items: { value: number; text: string }[];
  selected: number;
  onSelect: (value: number) => void;
  flex: number;
}

/** One column: a snapping list with the chosen row between two hairlines. Also moves by swipe up and down for screen readers. */
function Wheel({ label, items, selected, onSelect, flex }: WheelProps) {
  const theme = useTheme();
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const index = Math.max(0, items.findIndex((item) => item.value === selected));

  // The column follows the value when it moves from outside (a day clamped to a short month).
  useEffect(() => {
    ref.current?.scrollTo({ y: index * ITEM, animated: false });
  }, [index, items.length]);

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.min(items.length - 1, Math.max(0, Math.round(event.nativeEvent.contentOffset.y / ITEM)));
    const item = items[next];
    if (item && item.value !== selected) {
      haptic.select();
      onSelect(item.value);
    }
  };

  return (
    <View
      style={[styles.column, { flex }]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: items[index]?.text ?? "" }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        const step = event.nativeEvent.actionName === "increment" ? 1 : -1;
        const item = items[Math.min(items.length - 1, Math.max(0, index + step))];
        if (item) onSelect(item.value);
      }}
    >
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM}
        decelerationRate="fast"
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        contentOffset={{ x: 0, y: index * ITEM }}
        contentContainerStyle={{ paddingVertical: ITEM * Math.floor(VISIBLE / 2) }}
        nestedScrollEnabled
      >
        {items.map((item) => (
          <View key={item.value} style={styles.item}>
            <Text variant={item.value === selected ? "h3" : "body"} color={item.value === selected ? theme.text : theme.textMuted}>
              {item.text}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * O-02: day, month and year as three wheels. iOS uses the system wheel instead (DateWheel.ios.tsx);
 * elsewhere this is the same gesture drawn in the app. Only a real day can come out of it.
 */
export function DateWheel({ value, minYear, maxYear, onChange, monthLabel, labels }: DateWheelProps) {
  const theme = useTheme();
  const days = daysIn(value.year, value.month);
  const set = (patch: Partial<DateParts>) => {
    const next = { ...value, ...patch };
    onChange({ ...next, day: Math.min(next.day, daysIn(next.year, next.month)) });
  };
  return (
    <View style={[styles.wheel, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <View pointerEvents="none" style={[styles.band, { borderColor: theme.line, top: ITEM * Math.floor(VISIBLE / 2) }]} />
      <Wheel
        label={labels.day}
        flex={1}
        selected={Math.min(value.day, days)}
        items={Array.from({ length: days }, (_, i) => ({ value: i + 1, text: String(i + 1) }))}
        onSelect={(day) => set({ day })}
      />
      <Wheel
        label={labels.month}
        flex={2}
        selected={value.month}
        items={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, text: monthLabel(i + 1) }))}
        onSelect={(month) => set({ month })}
      />
      <Wheel
        label={labels.year}
        flex={1.3}
        selected={value.year}
        items={Array.from({ length: maxYear - minYear + 1 }, (_, i) => ({ value: maxYear - i, text: String(maxYear - i) }))}
        onSelect={(year) => set({ year })}
      />
    </View>
  );
}

export const hasNativeDateWheel = false;

const styles = StyleSheet.create({
  wheel: { flexDirection: "row", height: ITEM * VISIBLE, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  column: { height: ITEM * VISIBLE },
  item: { height: ITEM, alignItems: "center", justifyContent: "center" },
  band: { position: "absolute", left: 0, right: 0, height: ITEM, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
});
