import { DatePicker, Host } from "@expo/ui/swift-ui";
import { datePickerStyle, labelsHidden, tint } from "@expo/ui/swift-ui/modifiers";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme";
import type { DateWheelProps } from "./DateWheel";

/** The system's date wheel (SwiftUI), day, month and year, limited to the years asked for. */
export function DateWheel({ value, minYear, maxYear, onChange }: DateWheelProps) {
  const theme = useTheme();
  // Local noon: a time zone never moves the day.
  const at = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12);
  return (
    <View style={styles.wrap}>
      <Host matchContents colorScheme="dark">
        <DatePicker
          selection={at(value.year, value.month, value.day)}
          range={{ start: at(minYear, 1, 1), end: at(maxYear, 12, 31) }}
          displayedComponents={["date"]}
          onDateChange={(date) => onChange({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() })}
          modifiers={[datePickerStyle("wheel"), labelsHidden(), tint(theme.amber)]}
        />
      </Host>
    </View>
  );
}

export const hasNativeDateWheel = true;

const styles = StyleSheet.create({ wrap: { alignItems: "center" } });
