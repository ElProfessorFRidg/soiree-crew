import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { useAppStore } from "@/state/store";
import { Button } from "@/ui/Button";
import { Chip, Switch } from "@/ui/controls";
import { Stepper } from "@/ui/Stepper";
import { Text } from "@/ui/Text";
import { clockOf, weekdayNames, type HourRange, type WeekSchedule } from "./hours";

const STEP = 30;
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** One range: the days it applies to, a start, and an end that may run past midnight. */
function RangeEditor({ title, range, onChange }: { title: string; range: HourRange; onChange: (next: HourRange) => void }) {
  const i18n = useT();
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const names = weekdayNames(i18n);
  // The end is edited as minutes after the start's midnight, so 2 am reads as later than 6 pm.
  const end = range.to > range.from ? range.to : range.to + 1440;
  // Moving the start keeps the length, so the end follows.
  const length = end - range.from;
  const clock = (m: number) => clockOf(m, i18n, hourCycle);
  return (
    <View style={styles.range}>
      <Text variant="label">{title}</Text>
      <View style={styles.chips}>
        {names.map((name, day) => (
          <Chip
            key={day}
            label={name}
            selected={range.days.includes(day)}
            onPress={() => {
              haptic.select();
              const days = range.days.includes(day) ? range.days.filter((d) => d !== day) : [...range.days, day].sort((a, b) => a - b);
              if (days.length) onChange({ ...range, days });
            }}
          />
        ))}
      </View>
      <Text variant="small">{i18n.t("venue.hours.from")}</Text>
      <Stepper
        value={range.from}
        min={0}
        max={1440 - STEP}
        step={STEP}
        format={clock}
        onChange={(from) => onChange({ ...range, from, to: (from + length) % 1440 })}
        decreaseLabel={i18n.t("newParty.earlier")}
        increaseLabel={i18n.t("newParty.later")}
      />
      <Text variant="small">{i18n.t("venue.hours.to")}</Text>
      <Stepper
        value={end}
        min={range.from + STEP}
        max={range.from + 1440 - STEP}
        step={STEP}
        format={clock}
        onChange={(to) => onChange({ ...range, to: to % 1440 })}
        decreaseLabel={i18n.t("newParty.earlier")}
        increaseLabel={i18n.t("newParty.later")}
      />
    </View>
  );
}

/**
 * N-08: opening hours and happy hour as a weekly schedule, so "open now" can be computed.
 * One range each covers nearly every bar; the days chips handle closed days.
 */
export function HoursEditor({ initial, busy, onSave, onCancel }: { initial: WeekSchedule | null; busy?: boolean; onSave: (schedule: WeekSchedule) => void; onCancel?: () => void }) {
  const i18n = useT();
  const [open, setOpen] = useState<HourRange | null>(initial?.open[0] ?? { days: ALL_DAYS, from: 18 * 60, to: 2 * 60 });
  const [happy, setHappy] = useState<HourRange | null>(initial?.happy[0] ?? null);
  return (
    <View style={styles.editor}>
      <View style={styles.switchRow}>
        <Text style={styles.flex}>{i18n.t("venue.hours.knowOpen")}</Text>
        <Switch
          value={open !== null}
          onValueChange={(on) => setOpen(on ? { days: ALL_DAYS, from: 18 * 60, to: 2 * 60 } : null)}
          accessibilityLabel={i18n.t("venue.hours.knowOpen")}
        />
      </View>
      {open ? <RangeEditor title={i18n.t("venue.hours.open")} range={open} onChange={setOpen} /> : null}
      <View style={styles.switchRow}>
        <Text style={styles.flex}>{i18n.t("venue.hours.hasHappy")}</Text>
        <Switch
          value={happy !== null}
          onValueChange={(on) => setHappy(on ? { days: ALL_DAYS, from: 18 * 60, to: 20 * 60 } : null)}
          accessibilityLabel={i18n.t("venue.hours.hasHappy")}
        />
      </View>
      {happy ? <RangeEditor title={i18n.t("venue.hours.happy")} range={happy} onChange={setHappy} /> : null}
      <View style={styles.actions}>
        {onCancel ? <Button label={i18n.t("chat.cancel")} variant="outline" height={48} style={styles.flex} onPress={onCancel} /> : null}
        <Button
          label={i18n.t("common.save")}
          height={48}
          style={styles.flex}
          loading={busy ?? false}
          onPress={() => onSave({ open: open ? [open] : [], happy: happy ? [happy] : [] })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  editor: { gap: 12 },
  range: { gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  actions: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});
