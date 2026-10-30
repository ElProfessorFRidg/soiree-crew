import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { breathRatio, countryRules, drivingLimit, formatBacValue, nightKey } from "@crew/units";
import { useCrewNames } from "@/crew/names";
import { FilterChips } from "@/stats/FilterChips";
import { useMyStats } from "@/stats/useMyStats";
import { BacChart } from "@/curve/BacChart";
import { buildSeries, gramStats, type CurvePeriod } from "@/curve/series";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { RecapCurves } from "@/recap/RecapCurves";
import { useLiveParty } from "@/server/crewData";
import { fetchRecap, type Recap } from "@/server/recapData";
import { useSession } from "@/server/session";
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
  const allIntakes = useIntakes();
  const preferences = useAppStore((state) => state.preferences);
  const [period, setPeriod] = useState<CurvePeriod>("day");
  // N-16: over several nights, the curve can keep only the nights at a venue or with someone.
  const mine = useMyStats();
  const crewName = useCrewNames();
  const nights = period === "day" ? null : mine.nights;
  const intakes = useMemo(
    () => (nights ? allIntakes.filter((d) => nights.has(nightKey(d.consumedAt, -new Date(d.consumedAt).getTimezoneOffset(), preferences.dayBoundaryHour))) : allIntakes),
    [allIntakes, nights, preferences.dayBoundaryHour],
  );

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
      {period !== "day" ? <FilterChips options={mine.data?.filters} value={mine.filter} onChange={mine.setFilter} nameOf={crewName} /> : null}
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
        {nights ? ` ${i18n.t("myStats.filteredNote")}` : ""}
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
      <CrewCurves now={now} legalLimit={legalLimit} formatX={(at) => formatClock(at, i18n.language, preferences.hourCycle)} />
    </Screen>
  );
}

/** O-29: the crew's curves next to mine during a live party, refreshed every minute. */
function CrewCurves({ now, legalLimit, formatX }: { now: number; legalLimit: number; formatX: (at: number) => string }) {
  const i18n = useT();
  const live = useLiveParty();
  const me = useSession((state) => state.session?.userId);
  const partyId = live?.party.id;
  const minute = Math.floor(now / 60_000);
  const [recap, setRecap] = useState<Recap | null>(null);
  useEffect(() => {
    if (!partyId) return;
    void fetchRecap(partyId).then(setRecap).catch(() => undefined);
  }, [partyId, minute]);
  if (!partyId || !recap || recap.participants.filter((p) => p.curve.length > 1).length < 2) return null;
  return (
    <>
      <Text variant="label">{i18n.t("curve.withCrew")}</Text>
      <Panel>
        <RecapCurves
          participants={recap.participants}
          from={recap.window.from}
          legalLimit={legalLimit}
          replay={0}
          meId={me}
          nowAt={now}
          formatX={formatX}
          labels={{
            range: (from, to) => i18n.t("recap.curvesRange", { from, to }),
            hint: i18n.t("curve.withCrewHint"),
            legal: i18n.t("recap.legalLine"),
            rangeEnd: i18n.t("recap.rangeEnd"),
            you: i18n.t("common.you"),
          }}
        />
      </Panel>
    </>
  );
}

const styles = StyleSheet.create({
  chartPanel: { paddingHorizontal: 8, paddingVertical: 12 },
  stats: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, padding: 12, gap: 6 },
  gramsRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
});
