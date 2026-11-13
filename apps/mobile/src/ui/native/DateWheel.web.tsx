import { createElement } from "react";
import { StyleSheet, View } from "react-native";
import { radius } from "@crew/design-tokens";
import { useTheme } from "@/theme";
import type { DateParts, DateWheelProps } from "./DateWheel";

export type { DateParts, DateWheelProps };

const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

interface SelectProps {
  label: string;
  value: number;
  options: { value: number; text: string }[];
  onSelect: (value: number) => void;
  flex: number;
}

/** A browser has no snapping wheel that works with a mouse: three native selects do, and work with a keyboard too. */
function Select({ label, value, options, onSelect, flex }: SelectProps) {
  const theme = useTheme();
  return (
    <View style={{ flex }}>
      {createElement(
        "select",
        {
          "aria-label": label,
          value,
          onChange: (event: { target: { value: string } }) => onSelect(Number(event.target.value)),
          style: {
            width: "100%",
            height: 52,
            fontSize: 17,
            padding: "0 10px",
            borderRadius: radius.card,
            border: `1px solid ${theme.line}`,
            backgroundColor: theme.surface,
            color: theme.text,
            cursor: "pointer",
          },
        },
        options.map((option) => createElement("option", { key: option.value, value: option.value }, option.text)),
      )}
    </View>
  );
}

/** O-02 on the web: day, month and year as native selects, so the picker works with mouse, touch and keyboard. */
export function DateWheel({ value, minYear, maxYear, onChange, monthLabel, labels }: DateWheelProps) {
  const days = daysIn(value.year, value.month);
  const set = (patch: Partial<DateParts>) => {
    const next = { ...value, ...patch };
    onChange({ ...next, day: Math.min(next.day, daysIn(next.year, next.month)) });
  };
  return (
    <View style={styles.row}>
      <Select label={labels.day} flex={1} value={Math.min(value.day, days)} options={Array.from({ length: days }, (_, i) => ({ value: i + 1, text: String(i + 1) }))} onSelect={(day) => set({ day })} />
      <Select label={labels.month} flex={2} value={value.month} options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, text: monthLabel(i + 1) }))} onSelect={(month) => set({ month })} />
      <Select label={labels.year} flex={1.3} value={value.year} options={Array.from({ length: maxYear - minYear + 1 }, (_, i) => ({ value: maxYear - i, text: String(maxYear - i) }))} onSelect={(year) => set({ year })} />
    </View>
  );
}

export const hasNativeDateWheel = false;

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
});
