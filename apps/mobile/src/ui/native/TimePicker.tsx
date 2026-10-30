export interface TimePickerProps {
  value: number;
  min: number;
  max: number;
  tintColor: string;
  onChange: (at: number) => void;
}

/** iOS only (TimePicker.ios.tsx); other platforms keep their own controls. */
export function TimePicker(_props: TimePickerProps) {
  return null;
}

export const hasNativeTimePicker = false;
