import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { LinearTransition, ZoomIn } from "react-native-reanimated";
import { duration } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { leaderChanged as isNewLeader, splitPodium } from "@/motion/math/podium";
import { Confetti, Podium, podiumCrownDelay } from "@/recap/Podium";
import { useLevelNow } from "@/state/levelNow";
import { ApiError } from "@/server/api";
import { useCrewData, useLiveParty } from "@/server/crewData";
import { useSession } from "@/server/session";
import {
  confirmDrink,
  fetchConfirmable,
  fetchLeaderboard,
  fetchLeaderboardHistory,
  setCrewParticipation,
  type Champion,
  type LeaderboardHistory,
  fetchTitles,
  type TitlesRow,
  type ConfirmableDrink,
  type LeaderboardMetric,
  type LeaderboardPeriod,
  type LeaderboardRow,
} from "@/server/venueData";
import { formatClock } from "@/i18n/format";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Chip, Panel, Row, Segmented, Switch, Tag } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Numeral, Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { useEcoInterval } from "@/power/eco";
import { DANGER_CAP } from "@crew/bac";
import { breathRatio, countryRules, formatBacValue } from "@crew/units";
import { failureMessage } from "@/server/errors";

const REFRESH_MS = 30_000;

/** RANK-04: who won the last weeks and months, and who keeps winning. */
function Honours({ crewId, metric }: { crewId: string; metric: LeaderboardMetric }) {
  const i18n = useT();
  const theme = useTheme();
  const [history, setHistory] = useState<LeaderboardHistory | null>(null);
  useEffect(() => {
    void fetchLeaderboardHistory(crewId, metric)
      .then(setHistory)
      .catch(() => undefined);
  }, [crewId, metric]);
  if (!history || history.disabled) return null;
  const won = (list: Champion[]) => list.map((c) => `${c.name} (${metric === "grams" ? `${c.value} g` : c.value})`).join(", ");
  const months = history.months.filter((m) => m.champions.length);
  const weeks = history.weeks.filter((w) => w.champions.length);
  if (!months.length && !weeks.length) return null;
  const monthName = (season: string) => new Intl.DateTimeFormat(i18n.locale, { month: "long", year: "numeric" }).format(new Date(`${season}-15T12:00:00`));
  const weekOf = (from: number) => new Intl.DateTimeFormat(i18n.locale, { day: "numeric", month: "short" }).format(new Date(from));
  return (
    <Panel>
      <Text variant="label">{i18n.t("ranking.honours")}</Text>
      {history.streaks
        .filter((st) => st.best >= 2)
        .slice(0, 3)
        .map((st) => (
          <Text key={st.userId} variant="h3">
            {st.current >= 2 ? i18n.plural("ranking.streakNow", st.current, { name: st.name }) : i18n.plural("ranking.streakBest", st.best, { name: st.name })}
          </Text>
        ))}
      {months.map((m) => (
        <Row key={m.season} title={monthName(m.season)} subtitle={won(m.champions)} leading={<Icon name="crown" color={theme.amber} />} />
      ))}
      {weeks.map((w, index) => (
        <Row key={w.from} title={i18n.t("ranking.weekOf", { date: weekOf(w.from) })} subtitle={won(w.champions)} last={index === weeks.length - 1} />
      ))}
    </Panel>
  );
}

export default function LeaderboardScreen() {
  const i18n = useT();
  const theme = useTheme();
  const params = useLocalSearchParams<{ crewId?: string }>();
  const crews = useCrewData((state) => state.crews);
  const crewId = params.crewId ?? crews[0]?.id;
  const live = useLiveParty();
  const livePartyId = live?.party.id;
  const me = useSession((state) => state.session?.userId);
  const preferences = useAppStore((state) => state.preferences);
  const hourCycle = preferences.hourCycle;
  const refreshMs = useEcoInterval(REFRESH_MS);
  const [period, setPeriod] = useState<LeaderboardPeriod>(live ? "party" : "month");
  const [metric, setMetric] = useState<LeaderboardMetric>("drinks");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [disabled, setDisabled] = useState(false);
  const optedOut = crews.find((c) => c.id === crewId)?.me.leaderboardOptOut ?? false;
  const [confirmable, setConfirmable] = useState<ConfirmableDrink[]>([]);
  const leaderRef = useRef<string | null>(null);
  const [leaderChanged, setLeaderChanged] = useState(0);
  /** MOT-13: the podium rises for each board's first answer and again for a new leader. */
  const [podiumReplay, setPodiumReplay] = useState(0);
  const freshBoard = useRef(true);
  const calm = useLevelNow((state) => state.level) >= 2;

  const load = useCallback(() => {
    if (!crewId) return;
    const partyId = period === "party" ? livePartyId : undefined;
    if (period === "party" && !partyId) {
      setRows([]);
      return;
    }
    void fetchLeaderboard(crewId, period, metric, partyId)
      .then((data) => {
        setDisabled(data.disabled);
        setRows(data.rows);
        const leader = data.rows[0]?.value ? data.rows[0].userId : null;
        // MOT-13: a new leader gets its own moment, and only from the server's answer. The podium
        // drops the crown and plays the heavy haptic when it lands.
        if (freshBoard.current) {
          freshBoard.current = false;
          setPodiumReplay((n) => n + 1);
        } else if (isNewLeader(leaderRef.current, leader)) {
          setLeaderChanged((n) => n + 1);
          setPodiumReplay((n) => n + 1);
        }
        leaderRef.current = leader;
      })
      .catch(() => undefined);
    if (livePartyId) void fetchConfirmable(livePartyId).then((data) => setConfirmable(data.drinks)).catch(() => undefined);
  }, [crewId, period, metric, livePartyId]);

  useEffect(() => {
    leaderRef.current = null;
    freshBoard.current = true;
    load();
    const timer = setInterval(load, refreshMs);
    return () => clearInterval(timer);
  }, [load, refreshMs]);

  const myRow = rows.find((r) => r.userId === me);
  const { podium, rest } = splitPodium(rows);
  const displayName = (row: { userId: string; name: string }) => (row.userId === me ? `${row.name} (${i18n.t("crew.you")})` : row.name);
  const shownValue = (value: number) => (metric === "grams" ? `${value} g` : String(value));

  return (
    <Screen back title={i18n.t("ranking.title")} withToasts>
      <View style={styles.chips}>
        {(["party", "week", "month", "all"] as const).map((value) => (
          <Chip key={value} label={i18n.t(`ranking.${value}`)} selected={period === value} onPress={() => setPeriod(value)} />
        ))}
      </View>
      <Segmented<LeaderboardMetric>
        accessibilityLabel={i18n.t("ranking.title")}
        value={metric}
        items={(["drinks", "grams", "nights", "games"] as const).map((value) => ({ value, label: i18n.t(`ranking.${value}`) }))}
        onChange={setMetric}
      />

      {disabled ? <Text>{i18n.t("ranking.disabled")}</Text> : null}
      {period === "party" && !live ? <Text>{i18n.t("ranking.noParty")}</Text> : null}

      {podium.length ? (
        <View style={styles.podium}>
          <Podium
            entries={podium.map((row) => ({ userId: row.userId, name: displayName(row), rank: row.rank, value: row.value }))}
            replay={podiumReplay}
            calm={calm}
            valueLabel={(entry) => shownValue(entry.value)}
            a11yLabel={(entry) => i18n.t("ranking.a11y", { rank: entry.rank, name: entry.name, value: entry.value })}
          />
          <Confetti replay={podiumReplay} delayMs={podiumCrownDelay()} calm={calm} />
        </View>
      ) : null}

      <View>
        {rest.map((row) => (
          <Animated.View key={row.userId} layout={LinearTransition.duration(duration.reorder).easing(easings.reorder)}>
            <View
              style={[styles.row, { borderBottomColor: theme.line }]}
              accessible
              accessibilityLabel={i18n.t("ranking.a11y", { rank: row.rank, name: row.name, value: row.value })}
            >
              <View style={styles.rank}>
                {row.rank === 1 && row.value > 0 ? (
                  <Animated.View key={leaderChanged} entering={ZoomIn.duration(duration.crownDrop).easing(easings.overshoot)}>
                    <Icon name="crown" size={22} color={theme.amber} />
                  </Animated.View>
                ) : (
                  <Numeral size={22} color={theme.textMuted}>
                    {row.rank}
                  </Numeral>
                )}
              </View>
              <Avatar personId={row.userId} name={row.name} size={40} />
              <Text variant="h3" style={styles.flex}>
                {displayName(row)}
              </Text>
              <Numeral size={30} color={row.userId === me ? theme.amber : theme.text}>
                {shownValue(row.value)}
              </Numeral>
            </View>
          </Animated.View>
        ))}
      </View>

      <Text variant="small">
        {i18n.t("ranking.verifiedOnly")}{" "}
        {i18n.t("ranking.dangerCap", {
          value: `${formatBacValue(DANGER_CAP, preferences.bacUnit, breathRatio(countryRules(preferences.legalCountry)), i18n.locale)} ${i18n.t(`units.${preferences.bacUnit}`)}`,
        })}
      </Text>
      {myRow?.unverified ? <Text variant="small">{i18n.plural("ranking.myUnverified", myRow.unverified)}</Text> : null}

      {live ? (
        <Panel>
          <Text variant="h3">{i18n.t("ranking.confirmTitle")}</Text>
          {confirmable.length === 0 ? <Text variant="small">{i18n.t("ranking.noConfirmable")}</Text> : null}
          {confirmable.map((drink) => (
            <View key={drink.id} style={styles.confirmRow}>
              <Avatar personId={drink.userId} name={drink.name} size={32} />
              <Text style={styles.flex}>
                {drink.name}, {formatClock(drink.consumedAt, i18n.language, hourCycle)}
              </Text>
              <Button
                label={drink.confirmedByMe ? i18n.t("ranking.confirmed") : i18n.t("ranking.confirm")}
                variant={drink.confirmedByMe ? "secondary" : "primary"}
                height={40}
                disabled={drink.confirmedByMe}
                onPress={() =>
                  void confirmDrink(drink.id)
                    .then(() => {
                      haptic.confirmed();
                      load();
                    })
                    .catch((error: unknown) =>
                      showToast({
                        tone: "danger",
                        message:
                          error instanceof ApiError && error.failure.kind === "http" && error.failure.code === "not_together"
                            ? i18n.t("ranking.notTogether")
                            : failureMessage(error, i18n),
                      }),
                    )
                }
              />
            </View>
          ))}
        </Panel>
      ) : null}

      {crewId && !disabled ? <Honours crewId={crewId} metric={metric} /> : null}

      {crewId ? <BarTitles crewId={crewId} /> : null}

      {crewId ? (
        <Panel>
          <View style={styles.switchRow}>
            <Text style={styles.flex}>{i18n.t("ranking.leave")}</Text>
            <Switch
              value={optedOut}
              onValueChange={(on) => void setCrewParticipation(crewId, { leaderboardOptOut: on }).then(load).catch(() => undefined)}
              accessibilityLabel={i18n.t("ranking.leave")}
            />
          </View>
        </Panel>
      ) : null}
    </Screen>
  );
}

/** TER-06: bars held this season and the titles that come with going out. */
function BarTitles({ crewId }: { crewId: string }) {
  const i18n = useT();
  const theme = useTheme();
  const [rows, setRows] = useState<TitlesRow[]>([]);
  useEffect(() => {
    void fetchTitles(crewId)
      .then((data) => setRows(data.rows.filter((r) => r.visited > 0)))
      .catch(() => undefined);
  }, [crewId]);
  if (!rows.length) return null;
  const label = (t: TitlesRow["titles"][number]) => (t.kind === "mayor" ? i18n.t("ranking.mayor", { venue: t.venueName ?? "" }) : i18n.t(`ranking.${t.kind}`));
  return (
    <>
      <Text variant="label">{i18n.t("ranking.bars")}</Text>
      <Text variant="small">{i18n.t("ranking.barsHint")}</Text>
      <View>
        {rows.map((row, index) => (
          <View key={row.userId} style={[styles.row, { borderBottomColor: theme.line, borderBottomWidth: index === rows.length - 1 ? 0 : 1 }]}>
            <Avatar personId={row.userId} name={row.name} />
            <View style={styles.flex}>
              <Text variant="h3">{row.name}</Text>
              <Text variant="small">
                {i18n.plural("ranking.ruled", row.ruled)}, {i18n.plural("ranking.visited", row.visited)}
              </Text>
              {row.titles.length ? (
                <View style={styles.chips}>
                  {row.titles.map((t, i) => (
                    <Tag key={`${t.kind}-${i}`} label={label(t)} tone={t.kind === "mayor" ? "amber" : "neutral"} icon={t.kind === "mayor" ? "crown" : undefined} />
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  podium: { position: "relative" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, borderBottomWidth: 1 },
  rank: { width: 30, alignItems: "center" },
  flex: { flex: 1 },
  confirmRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
});
