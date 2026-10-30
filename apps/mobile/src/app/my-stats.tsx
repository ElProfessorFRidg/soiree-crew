import { router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { drinkLabel } from "@/drinks/display";
import { DRINK_FAMILIES, myStats, nightsByWeek, type DrinkFamily } from "@/drinks/myStats";
import { nightKey } from "@crew/units";
import { useCrewNames } from "@/crew/names";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { FilterChips } from "@/stats/FilterChips";
import { useMyStats } from "@/stats/useMyStats";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Bars } from "@/ui/Bars";
import { Chip, Panel, Row, Segmented } from "@/ui/controls";
import { Heatmap } from "@/ui/Heatmap";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Numeral, Text } from "@/ui/Text";

type Period = "30" | "90" | "365";
const DAY_MS = 86_400_000;

/** O-81, N-16: my own figures, by period and kind of drink, from what this phone logged. */
export default function MyStatsScreen() {
  const i18n = useT();
  const theme = useTheme();
  const allDrinks = useAppStore((state) => state.drinks);
  const allWater = useAppStore((state) => state.water);
  const dayBoundaryHour = useAppStore((state) => state.preferences.dayBoundaryHour);
  const [period, setPeriod] = useState<Period>("30");
  const [family, setFamily] = useState<DrinkFamily>("all");
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  // N-13, N-16: habits and the venue / person filter come from the server; my drinks stay here.
  const mine = useMyStats();
  const crewName = useCrewNames();
  const { drinks, water } = useMemo(() => {
    if (!mine.nights) return { drinks: allDrinks, water: allWater };
    const keep = (at: number) => mine.nights!.has(nightKey(at, -new Date(at).getTimezoneOffset(), dayBoundaryHour));
    return { drinks: allDrinks.filter((d) => keep(d.consumedAt)), water: allWater.filter((w) => keep(w.at)) };
  }, [allDrinks, allWater, mine.nights, dayBoundaryHour]);

  const stats = useMemo(() => {
    const to = Date.now();
    return myStats(drinks, water, { from: to - Number(period) * DAY_MS, to, family, dayBoundaryHour, bucket: period === "365" ? "month" : "week" });
  }, [drinks, water, period, family, dayBoundaryHour]);

  const year = useMemo(() => nightsByWeek(drinks, Date.now(), dayBoundaryHour), [drinks, dayBoundaryHour]);
  const habits = mine.data?.habits;
  const clock = (minutesAfterNoon: number) => formatClock(new Date(2026, 0, 1, 12, minutesAfterNoon).getTime(), i18n.language, hourCycle);
  const yearNights = year.reduce((sum, n) => sum + n, 0);

  const weekdayLabels = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(i18n.locale, { weekday: "narrow" }).format(new Date(2026, 10, 2 + i)));
  const bucketLabels = stats.buckets.map((b) =>
    period === "365"
      ? new Intl.DateTimeFormat(i18n.locale, { month: "narrow" }).format(new Date(b.start))
      : new Intl.DateTimeFormat(i18n.locale, { day: "numeric" }).format(new Date(b.start)),
  );
  const big = (value: string, label: string) => (
    <View style={styles.figure}>
      <Numeral size={36} color={theme.amber}>
        {value}
      </Numeral>
      <Text variant="small">{label}</Text>
    </View>
  );

  return (
    <Screen back title={i18n.t("myStats.title")}>
      <Segmented<Period>
        accessibilityLabel={i18n.t("myStats.period")}
        value={period}
        items={[
          { value: "30", label: i18n.t("myStats.days30") },
          { value: "90", label: i18n.t("myStats.days90") },
          { value: "365", label: i18n.t("myStats.year") },
        ]}
        onChange={setPeriod}
      />
      <View style={styles.chips}>
        {DRINK_FAMILIES.map((f) => (
          <Chip key={f} label={i18n.t(`myStats.family.${f}`)} selected={f === family} onPress={() => setFamily(f)} />
        ))}
      </View>
      <FilterChips options={mine.data?.filters} value={mine.filter} onChange={mine.setFilter} nameOf={crewName} />

      {habits && habits.nights > 0 ? (
        <Panel>
          <Text variant="label">{i18n.t("myStats.habits")}</Text>
          {habits.usualFirstDrink !== null ? <Text>{i18n.t("people.usualFirst", { time: clock(habits.usualFirstDrink) })}</Text> : null}
          {habits.usualPacePerHour !== null ? <Text>{i18n.t("people.usualPace", { value: i18n.number(habits.usualPacePerHour, 1) })}</Text> : null}
          {habits.usualLeaving !== null ? <Text>{i18n.t("people.usualLeaving", { time: clock(habits.usualLeaving) })}</Text> : null}
          <Text variant="small">{i18n.plural("myStats.habitsFrom", habits.nights)}</Text>
        </Panel>
      ) : null}

      {stats.drinks === 0 ? <Text>{i18n.t("myStats.empty")}</Text> : null}
      <Panel>
        <View style={styles.figures}>
          {big(i18n.number(stats.nights), i18n.plural("myStats.nights", stats.nights))}
          {big(i18n.number(stats.drinks), i18n.plural("myStats.drinks", stats.drinks))}
          {big(i18n.number(stats.perNight, 1), i18n.t("myStats.perNight"))}
        </View>
        <Text variant="small">
          {i18n.t("myStats.grams", { grams: i18n.number(stats.grams) })}{" "}
          {stats.waterRatio !== null ? i18n.plural("myStats.water", stats.water, { water: i18n.number(stats.water), ratio: i18n.number(stats.waterRatio, 2) }) : ""}
        </Text>
      </Panel>

      <Text variant="label">{period === "365" ? i18n.t("myStats.byMonth") : i18n.t("myStats.byWeek")}</Text>
      <Bars values={stats.buckets.map((b) => b.count)} labels={bucketLabels} />
      <Text variant="label">{i18n.t("myStats.byWeekday")}</Text>
      <Bars values={stats.weekdays} labels={weekdayLabels} />

      {family === "all" ? (
        <>
          <Text variant="label">{i18n.t("myStats.byFamily")}</Text>
          <Bars
            values={(["beer", "wine", "spirits", "cocktail", "other"] as const).map((f) => stats.byFamily[f])}
            labels={(["beer", "wine", "spirits", "cocktail", "other"] as const).map((f) => i18n.t(`myStats.short.${f}`))}
          />
        </>
      ) : null}

      {stats.topKinds.length ? (
        <Panel>
          <Text variant="label">{i18n.t("myStats.top")}</Text>
          {stats.topKinds.map((k) => (
            <View key={`${k.kind}-${k.name ?? ""}`} style={styles.line}>
              <Text style={styles.flex}>{drinkLabel(k, i18n)}</Text>
              <Text variant="h3">{i18n.number(k.count)}</Text>
            </View>
          ))}
        </Panel>
      ) : null}
      <Text variant="label">{i18n.t("myStats.yearTitle")}</Text>
      <Panel>
        <Heatmap values={year} accessibilityLabel={i18n.plural("myStats.yearCount", yearNights)} />
        <Text variant="small">{i18n.plural("myStats.yearCount", yearNights)}</Text>
      </Panel>
      <Panel>
        <Row title={i18n.t("wrapped.title")} trailing={<Icon name="chev" color={theme.textMuted} />} onPress={() => router.push("/wrapped")} last />
      </Panel>
      <Text variant="small">{mine.nights ? i18n.t("myStats.filteredNote") : i18n.t("myStats.note")}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  figures: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  figure: { flex: 1, gap: 2 },
  line: { flexDirection: "row", alignItems: "center", minHeight: 40, gap: 10 },
  flex: { flex: 1 },
});
