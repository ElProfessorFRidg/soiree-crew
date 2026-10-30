import { DatePicker, Host } from "@expo/ui/swift-ui";
import { labelsHidden, tint } from "@expo/ui/swift-ui/modifiers";
import type { TimePickerProps } from "./TimePicker";

/** The system's compact time picker (SwiftUI): a pill that opens the wheel. */
export function TimePicker({ value, min, max, tintColor, onChange }: TimePickerProps) {
  return (
    <Host matchContents colorScheme="dark">
      <DatePicker
        selection={new Date(value)}
        range={{ start: new Date(min), end: new Date(max) }}
        displayedComponents={["hourAndMinute"]}
        onDateChange={(date) => onChange(date.getTime())}
        modifiers={[labelsHidden(), tint(tintColor)]}
      />
    </Host>
  );
}

export const hasNativeTimePicker = true;
