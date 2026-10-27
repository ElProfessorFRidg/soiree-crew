import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { LinearTransition, ZoomIn } from "react-native-reanimated";
import { duration } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { ApiError } from "@/server/api";
import { useCrewData, useLiveParty } from "@/server/crewData";
import { useSession } from "@/server/session";
import {
  confirmDrink,
  fetchConfirmable,
  fetchLeaderboard,
  setCrewParticipation,
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
import { Chip, Panel, Segmented, Switch } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Numeral, Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

const REFRESH_MS = 30_000;

export default function LeaderboardScreen() {
  const i18n = useT();
  const theme = useTheme();
  const params = useLocalSearchParams<{ crewId?: string }>();
  const crews = useCrewData((state) => state.crews);
  const crewId = params.crewId ?? crews[0]?.id;
  const live = useLiveParty();
  const me = useSession((state) => state.session?.userId);
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const [period, setPeriod] = useState<LeaderboardPeriod>(live ? "party" : "month");
  const [metric, setMetric] = useState<LeaderboardMetric>("drinks");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [disabled, setDisabled] = useState(false);
  const [optedOut, setOptedOut] = useState(false);
  const [confirmable, setConfirmable] = useState<ConfirmableDrink[]>([]);
  const leaderRef = useRef<string | null>(null);
  const [leaderChanged, setLeaderChanged] = useState(0);

  const load = useCallback(() => {
    if (!crewId) return;
    const partyId = period === "party" ? live?.party.id : undefined;
    if (period === "party" && !partyId) {
      setRows([]);
      return;
    }
    void fetchLeaderboard(crewId, period, metric, partyId)
      .then((data) => {
        setDisabled(data.disabled);
        setRows(data.rows);
        const leader = data.rows[0]?.value ? data.rows[0].userId : null;
        // MOT-13: a new leader gets its own moment, and only from the server's answer.
        if (leaderRef.current && leader && leader !== leaderRef.current) {
          haptic.heavy();
          setLeaderChanged((n) => n + 1);
        }
        leaderRef.current = leader;
      })
      .catch(() => undefined);
    if (live) void fetchConfirmable(live.party.id).then((data) => setConfirmable(data.drinks)).catch(() => undefined);
  }, [crewId, period, metric, live]);

  useEffect(() => {
    leaderRef.current = null;
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const myRow = rows.find((r) => r.userId === me);

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
        items={(["drinks", "grams", "nights"] as const).map((value) => ({ value, label: i18n.t(`ranking.${value}`) }))}
        onChange={setMetric}
      />

      {disabled ? <Text>{i18n.t("ranking.disabled")}</Text> : null}
      {period === "party" && !live ? <Text>{i18n.t("ranking.noParty")}</Text> : null}

      <View>
        {rows.map((row) => (
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
                {row.userId === me ? `${row.name} (${i18n.t("crew.you")})` : row.name}
              </Text>
              <Numeral size={30} color={row.userId === me ? theme.amber : theme.text}>
                {metric === "grams" ? `${row.value} g` : row.value}
              </Numeral>
            </View>
          </Animated.View>
        ))}
      </View>

      <Text variant="small">
        {i18n.t("ranking.verifiedOnly")} {i18n.t("ranking.dangerCap")}
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
                            : i18n.t("crew.offline"),
                      }),
                    )
                }
              />
            </View>
          ))}
        </Panel>
      ) : null}

      {crewId ? (
        <Panel>
          <View style={styles.switchRow}>
            <Text style={styles.flex}>{i18n.t("ranking.leave")}</Text>
            <Switch
              value={optedOut}
              onValueChange={(on) => {
                setOptedOut(on);
                void setCrewParticipation(crewId, { leaderboardOptOut: on }).then(load).catch(() => setOptedOut(!on));
              }}
              accessibilityLabel={i18n.t("ranking.leave")}
            />
          </View>
        </Panel>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, borderBottomWidth: 1 },
  rank: { width: 30, alignItems: "center" },
  flex: { flex: 1 },
  confirmRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
});
