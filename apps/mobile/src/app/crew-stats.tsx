import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useT, type Translator } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { fetchCrewStats, type CrewBoardRow, type CrewStats } from "@/server/statsData";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Panel, Tag } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { SkeletonRows } from "@/ui/Skeleton";
import { Numeral, Text } from "@/ui/Text";

const BAR_HEIGHT = 80;

/** Simple bars, tallest = full height, labels under each. Data stays readable as text too. */
function Bars({ values, labels }: { values: number[]; labels: string[] }) {
  const theme = useTheme();
  const max = Math.max(1, ...values);
  return (
    <View style={styles.bars} accessible accessibilityLabel={labels.map((l, i) => `${l} ${values[i]}`).join(", ")}>
      {values.map((v, i) => (
        <View key={labels[i]} style={styles.barCol}>
          <Text variant="small">{v > 0 ? String(v) : ""}</Text>
          <View style={[styles.bar, { height: Math.max(2, (v / max) * BAR_HEIGHT), backgroundColor: v > 0 ? theme.amber : theme.surfaceRaised }]} />
          <Text variant="tab" align="center">
            {labels[i]}
          </Text>
        </View>
      ))}
    </View>
  );
}

function clockFromNoon(minutes: number, i18n: Translator, hourCycle: "h12" | "h23"): string {
  return formatClock(new Date(2026, 0, 1, 12, minutes).getTime(), i18n.language, hourCycle);
}

/** N-14, JOY-06, JOY-08, RANK-05: what the crew's nights look like, as plain figures. */
export default function CrewStatsScreen() {
  const { crewId } = useLocalSearchParams<{ crewId: string }>();
  const i18n = useT();
  const theme = useTheme();
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const [stats, setStats] = useState<CrewStats | null>(null);
  const load = useCallback(() => fetchCrewStats(crewId).then(setStats), [crewId]);
  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  if (!stats) {
    return (
      <Screen back title={i18n.t("crewStats.title")}>
        <SkeletonRows />
      </Screen>
    );
  }

  // Monday first, as the server counts them.
  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(i18n.locale, { weekday: "narrow" }).format(new Date(2026, 10, 2 + i)),
  );
  const monthLabels = stats.months.map((m) => new Intl.DateTimeFormat(i18n.locale, { month: "narrow" }).format(new Date(`${m.month}-15T12:00:00`)));

  const boards: { title: string; rows: { row: CrewBoardRow; value: string }[] }[] = [];
  const board = (title: string, pick: (r: CrewBoardRow) => number | null | undefined, format: (v: number) => string, ascending = false) => {
    const rows = stats.boards
      .map((row) => ({ row, v: pick(row) }))
      .filter((x): x is { row: CrewBoardRow; v: number } => typeof x.v === "number" && x.v > 0)
      .sort((a, b) => (ascending ? a.v - b.v : b.v - a.v))
      .slice(0, 3)
      .map((x) => ({ row: x.row, value: format(x.v) }));
    if (rows.length) boards.push({ title, rows });
  };
  board(i18n.t("crewStats.boardNights"), (r) => r.nights, (v) => i18n.number(v));
  board(i18n.t("crewStats.boardRuled"), (r) => r.venuesRuled, (v) => i18n.number(v));
  board(i18n.t("crewStats.boardDriver"), (r) => r.soberDriver, (v) => i18n.number(v));
  board(i18n.t("crewStats.boardLastHome"), (r) => r.lastHome, (v) => clockFromNoon(v, i18n, hourCycle));
  board(i18n.t("crewStats.boardFirstDrink"), (r) => r.firstDrink, (v) => clockFromNoon(v, i18n, hourCycle), true);
  board(i18n.t("crewStats.boardHydration"), (r) => r.hydration, (v) => i18n.number(v, 2));

  return (
    <Screen back title={i18n.t("crewStats.title")} onRefresh={load}>
      {stats.totalNights === 0 ? <Text>{i18n.t("crewStats.empty")}</Text> : null}

      <Panel>
        <Numeral size={48} color={theme.amber}>
          {i18n.number(stats.streak.current)}
        </Numeral>
        <Text variant="h3">{i18n.plural("crewStats.streak", stats.streak.current)}</Text>
        <Text variant="small">{i18n.t("crewStats.streakHint")}</Text>
        {stats.streak.best > stats.streak.current ? <Text variant="small">{i18n.plural("crewStats.best", stats.streak.best)}</Text> : null}
      </Panel>

      <Panel>
        <Text variant="h3">{i18n.plural("crewStats.nights", stats.totalNights)}</Text>
        {stats.milestones.reached.length ? (
          <View style={styles.tags}>
            {stats.milestones.reached.map((m) => (
              <Tag key={m} label={i18n.number(m)} tone="amber" icon="star" />
            ))}
          </View>
        ) : null}
        {stats.milestones.next ? <Text variant="small">{i18n.t("crewStats.nextMilestone", { count: stats.milestones.next })}</Text> : null}
      </Panel>

      {stats.totalNights > 0 ? (
        <>
          <Text variant="label">{i18n.t("crewStats.weekdays")}</Text>
          <Bars values={stats.weekdays} labels={weekdayLabels} />
          <Text variant="label">{i18n.t("crewStats.months")}</Text>
          <Bars values={stats.months.map((m) => m.count)} labels={monthLabels} />
        </>
      ) : null}

      {stats.topVenues.length ? (
        <Panel>
          <Text variant="label">{i18n.t("crewStats.topVenues")}</Text>
          {stats.topVenues.map((v) => (
            <View key={v.venueId} style={styles.line}>
              <Text style={styles.flex}>{v.name}</Text>
              <Text variant="small">{i18n.plural("crewStats.venueVisits", v.visits)}</Text>
            </View>
          ))}
        </Panel>
      ) : null}

      <Text variant="label">{i18n.t("crewStats.honours")}</Text>
      <Panel>
        {stats.honours.map((h) => (
          <View key={h.userId} style={styles.honour}>
            <Avatar personId={h.userId} name={h.name} size={32} />
            <View style={styles.flex}>
              <Text variant="h3">{h.name}</Text>
              <Text variant="small">
                {i18n.t("crewStats.since", { date: new Intl.DateTimeFormat(i18n.locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(h.joinedAt)) })}
              </Text>
              {h.badges.length ? (
                <View style={styles.tags}>
                  {h.badges.map((b) => (
                    <Tag key={b} label={i18n.t(`crewStats.badge.${b}`)} tone={b === "boss" ? "amber" : "ok"} />
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        ))}
      </Panel>

      {boards.length ? <Text variant="label">{i18n.t("crewStats.boards")}</Text> : null}
      {boards.map((b) => (
        <Panel key={b.title}>
          <Text variant="h3">{b.title}</Text>
          {b.rows.map(({ row, value }, index) => (
            <View key={row.userId} style={styles.line}>
              <Text variant="small" style={styles.rank}>
                {index + 1}
              </Text>
              <Avatar personId={row.userId} name={row.name} size={28} />
              <Text style={styles.flex}>{row.name}</Text>
              <Text variant="h3">{value}</Text>
            </View>
          ))}
        </Panel>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  bar: { width: "100%", borderRadius: 4 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  line: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40 },
  flex: { flex: 1 },
  rank: { width: 16 },
  honour: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 6 },
});
