import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { breathRatio, countryRules, drivingLimit, formatBacValue } from "@crew/units";
import { BacChart } from "@/curve/BacChart";
import { buildSeries, gramStats, type CurvePeriod } from "@/curve/series";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { useBodyProfile, useIntakes, useNow } from "@/state/hooks";
import { useAppStore } from "@/state/store";
import { Panel, Segmented } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Numeral, Text } from "@/ui/Text";

const PERIODS: readonly CurvePeriod[] = ["day", "week", "month", "total", "average"];

function nightStart(now: number, boundaryHour: number): number {
  const start = new Date(now);
  if (start.getHours() < boundaryHour) start.setDate(start.getDate() - 1);
  start.setHours(boundaryHour, 0, 0, 0);
  return start.getTime();
}

export default function CurveScreen() {
  const i18n = useT();
  const now = useNow(30_000);
  const profile = useBodyProfile();
  const storedProfile = useAppStore((state) => state.profile);
  const intakes = useIntakes();
  const preferences = useAppStore((state) => state.preferences);
  const [period, setPeriod] = useState<CurvePeriod>("day");

  const rules = countryRules(preferences.legalCountry);
  const ratio = breathRatio(rules);
  const legalLimit = drivingLimit(rules, preferences.driverCategory);
  const offsetMinutes = -new Date(now).getTimezoneOffset();

  const series = useMemo(
    () =>
      profile
        ? buildSeries(period, {
            intakes,
            profile,
            now,
            nightStart: nightStart(now, preferences.dayBoundaryHour),
            offsetMinutes,
            boundaryHour: preferences.dayBoundaryHour,
          })
        : null,
    [period, intakes, profile, now, preferences.dayBoundaryHour, offsetMinutes],
  );
  const stats = useMemo(() => gramStats(intakes, now, offsetMinutes, preferences.dayBoundaryHour), [intakes, now, offsetMinutes, preferences.dayBoundaryHour]);

  if (!series || !storedProfile) return null;

  const unitLabel = i18n.t(`units.${preferences.bacUnit}`);
  const formatValue = (gPerL: number) => `${formatBacValue(gPerL, preferences.bacUnit, ratio, i18n.locale)} ${unitLabel}`;
  const dateFormat = new Intl.DateTimeFormat(i18n.locale, { day: "numeric", month: "short" });
  const formatX = (at: number) =>
    series.kind === "timeline" ? formatClock(at, i18n.language, preferences.hourCycle) : dateFormat.format(new Date(at));
  const body = i18n.t(`profile.${storedProfile.declaredBody}`).toLocaleLowerCase(i18n.locale);

  return (
    <Screen back title={i18n.t("curve.title")}>
      <Segmented<CurvePeriod>
        accessibilityLabel={i18n.t("curve.periods")}
        value={period}
        items={PERIODS.map((value) => ({ value, label: i18n.t(`curve.${value}`) }))}
        onChange={setPeriod}
      />
      <Panel style={styles.chartPanel}>
        <BacChart
          series={series}
          now={now}
          legalLimit={legalLimit}
          personalLimit={preferences.personalLimit}
          formatValue={formatValue}
          formatX={formatX}
          legalLabel={i18n.t("curve.legal")}
          personalLabel={i18n.t("curve.personal")}
          accessibilityLabel={
            series.peak ? i18n.t("curve.a11y", { value: formatValue(series.peak.value) }) : i18n.t("curve.a11yEmpty")
          }
        />
      </Panel>
      <Text variant="small">
        {i18n.t("curve.profileNote", { weight: storedProfile.weightKg, body })}
        {period === "average" ? ` ${i18n.t("curve.averageNote")}` : ""}
      </Text>
      <View style={styles.stats}>
        {(
          [
            ["curve.statsMonth", stats.thisMonth],
            ["curve.statsTotal", stats.total],
            ["curve.statsPerNight", stats.perNight],
          ] as const
        ).map(([key, grams]) => (
          <Panel key={key} style={styles.stat}>
            <Text variant="label">{i18n.t(key)}</Text>
            <View style={styles.gramsRow}>
              <Numeral size={28}>{i18n.number(Math.round(grams))}</Numeral>
              <Text variant="h3">{i18n.t("curve.gramUnit")}</Text>
            </View>
          </Panel>
        ))}
      </View>
      <Text variant="small">{i18n.t("curve.gramsNote")}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chartPanel: { paddingHorizontal: 8, paddingVertical: 12 },
  stats: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, padding: 12, gap: 6 },
  gramsRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
});
