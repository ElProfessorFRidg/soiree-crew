import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Celebration, momentText } from "@/crew/Celebration";
import { useT, type Translator } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { fetchCrewStats, type CrewBoardRow, type CrewStats } from "@/server/statsData";
import { useSession } from "@/server/session";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { BadgeUnlock, useBadgeCelebrations } from "@/ui/BadgeUnlock";
import { badgeKey } from "@/ui/pure/badgeUnlocks";
import { EmptyState } from "@/ui/EmptyState";
import { Button } from "@/ui/Button";
import { Panel, Tag } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { SkeletonRows } from "@/ui/Skeleton";
import { Numeral, Text } from "@/ui/Text";
import { Bars } from "@/ui/Bars";

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
  const viewerId = useSession((state) => state.session?.userId ?? null);
  // MOT-10: badges this phone has not shown yet pop in, one after the other.
  const celebrate = useBadgeCelebrations(crewId ?? null, viewerId, stats?.honours ?? null);
  const celebrated = [...celebrate];

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
  board(i18n.t("crewStats.boardGames"), (r) => r.gamesWon, (v) => i18n.number(v));
  board(i18n.t("crewStats.boardDriver"), (r) => r.soberDriver, (v) => i18n.number(v));
  board(i18n.t("crewStats.boardLastHome"), (r) => r.lastHome, (v) => clockFromNoon(v, i18n, hourCycle));
  board(i18n.t("crewStats.boardFirstDrink"), (r) => r.firstDrink, (v) => clockFromNoon(v, i18n, hourCycle), true);
  board(i18n.t("crewStats.boardHydration"), (r) => r.hydration, (v) => i18n.number(v, 2));

  return (
    <Screen back title={i18n.t("crewStats.title")} onRefresh={load}>
      {stats.totalNights === 0 ? <EmptyState icon="cal" text={i18n.t("crewStats.empty")} /> : null}
      {stats.totalNights > 0 ? (
        <Button label={i18n.t("wrapped.open")} icon="sparkdot" variant="secondary" height={52} onPress={() => router.push({ pathname: "/wrapped", params: { crewId } })} />
      ) : null}

      <Panel>
        <Numeral size={48} color={theme.amber}>
          {i18n.number(stats.streak.current)}
        </Numeral>
        <Text variant="h3">{i18n.plural("crewStats.streak", stats.streak.current)}</Text>
        <Text variant="small">{i18n.t("crewStats.streakHint")}</Text>
        {stats.streak.best > stats.streak.current ? <Text variant="small">{i18n.plural("crewStats.best", stats.streak.best)}</Text> : null}
        {/* JOY-06: one quiet week a month is frozen instead of breaking the streak. */}
        {stats.streak.frozenWeeks?.length ? <Text variant="small">{i18n.plural("crewStats.frozen", stats.streak.frozenWeeks.length)}</Text> : null}
        {stats.streak.freezeAvailable !== undefined && stats.streak.current > 0 ? (
          <Tag label={i18n.t(stats.streak.freezeAvailable ? "crewStats.freezeReady" : "crewStats.freezeUsed")} tone={stats.streak.freezeAvailable ? "water" : "amber"} icon="clock" />
        ) : null}
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

      {/* JOY-08: milestones, anniversaries and the first venue conquered, newest first. */}
      {stats.moments?.length ? (
        <Panel>
          <Text variant="label">{i18n.t("crewStats.moments")}</Text>
          {[...stats.moments].reverse().map((m) => (
            <View key={m.id} style={styles.line}>
              <Text style={styles.flex}>{momentText(m, i18n)}</Text>
              <Text variant="small">{new Intl.DateTimeFormat(i18n.locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${m.night}T12:00:00`))}</Text>
            </View>
          ))}
        </Panel>
      ) : null}
      {stats.moments ? <Celebration crewId={crewId} moments={stats.moments} /> : null}

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
              {(h.titles ?? []).map((title) => (
                <Text key={`${title.period}-${title.board}`} variant="small" color={theme.amberText}>
                  {i18n.t(`crewStats.titles.${title.period}`, { board: i18n.t(`crewStats.titleBoard.${title.board}`) })}
                </Text>
              ))}
              {h.badges.length ? (
                <View style={styles.tags}>
                  {h.badges.map((b) => {
                    const key = badgeKey(crewId, h.userId, b);
                    const order = celebrated.indexOf(key);
                    return (
                      <BadgeUnlock key={b} celebrate={order >= 0} order={order} withHaptic={order === 0}>
                        <Tag label={i18n.t(`crewStats.badge.${b}`)} tone={b === "boss" || b === "champion" ? "amber" : "ok"} />
                      </BadgeUnlock>
                    );
                  })}
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
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  line: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40 },
  flex: { flex: 1 },
  rank: { width: 16 },
  honour: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 6 },
});
