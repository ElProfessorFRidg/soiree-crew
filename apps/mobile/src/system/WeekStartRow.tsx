import { useT } from "@/i18n";
import { useAppStore } from "@/state/store";
import { Segmented } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { deviceFirstDayOfWeek } from "./weekStart";

/** PREF-02: the week starts as the phone says, or on the day picked here (Monday, Sunday or Saturday). */
export function WeekStartRow() {
  const i18n = useT();
  const chosen = useAppStore((state) => state.weekStartOverride);
  // 4 January 2026 is a Sunday: day n of the week is 4 + n January.
  const dayName = (day: number) => new Intl.DateTimeFormat(i18n.locale, { weekday: "short" }).format(new Date(2026, 0, 4 + day));
  return (
    <>
      <Text variant="label">{i18n.t("settings.weekStart")}</Text>
      <Text variant="small">{i18n.t("settings.weekStartHint", { day: new Intl.DateTimeFormat(i18n.locale, { weekday: "long" }).format(new Date(2026, 0, 4 + deviceFirstDayOfWeek())) })}</Text>
      <Segmented<"phone" | 1 | 0 | 6>
        accessibilityLabel={i18n.t("settings.weekStart")}
        value={chosen === 1 || chosen === 0 || chosen === 6 ? chosen : "phone"}
        items={[
          { value: "phone", label: i18n.t("settings.hourPhone") },
          { value: 1, label: dayName(1) },
          { value: 0, label: dayName(0) },
          { value: 6, label: dayName(6) },
        ]}
        onChange={(choice) => useAppStore.setState({ weekStartOverride: choice === "phone" ? null : choice })}
      />
    </>
  );
}
