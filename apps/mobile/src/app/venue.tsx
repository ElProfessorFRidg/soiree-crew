import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { haptic } from "@/motion/haptics";
import { api } from "@/server/api";
import { useCrewData } from "@/server/crewData";
import { useSession } from "@/server/session";
import { fetchVenuePage, overturnCheckIn, setCrewParticipation, type VenuePage } from "@/server/venueData";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Panel, Row, Switch, Tag } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Numeral, Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { ReportPanel } from "@/moderation/ReportPanel";

export default function VenueScreen() {
  const i18n = useT();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSession((state) => state.session?.userId);
  const crews = useCrewData((state) => state.crews);
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const [page, setPage] = useState<VenuePage | null>(null);
  const territoryOut = crews.find((c) => c.id === page?.venue.crewId)?.me.territoryOptOut ?? false;

  const load = useCallback(() => {
    if (!id) return;
    void fetchVenuePage(id)
      .then(setPage)
      .catch(() => showToast({ tone: "danger", message: i18n.t("crew.offline") }));
  }, [id, i18n]);
  useEffect(load, [load]);

  if (!page) return <Screen back withToasts>{null}</Screen>;
  const isAdmin = crews.find((c) => c.id === page.venue.crewId)?.role === "admin";
  const myChallenger = page.bossId === me ? page.challengers[0] : undefined;
  const bossPoints = page.top[0]?.points ?? 0;

  return (
    <Screen back title={page.venue.name} withToasts>
      <Text variant="small">{i18n.t("venue.season", { season: page.season })}</Text>

      {myChallenger ? (
        <Panel tint="amber">
          <Text variant="h3">{i18n.t("venue.challenger", { name: myChallenger.name, gap: bossPoints - myChallenger.points, venue: page.venue.name })}</Text>
        </Panel>
      ) : null}

      <View>
        <Text variant="label">{i18n.t("venue.top")}</Text>
        {page.top.length === 0 ? <Text>{i18n.t("bars.noBoss")}</Text> : null}
        {page.top.map((row, index) => (
          <Row
            key={row.userId}
            title={row.userId === me ? `${row.name} (${i18n.t("crew.you")})` : row.name}
            subtitle={i18n.plural("venue.nights", row.nights)}
            leading={
              <View style={styles.rank}>
                {row.userId === page.bossId ? <Icon name="crown" size={18} color={theme.amber} /> : <Text variant="h3">{index + 1}</Text>}
                <Avatar personId={row.userId} name={row.name} size={34} />
              </View>
            }
            trailing={<Numeral size={26}>{i18n.t("venue.pointsShort", { count: row.points })}</Numeral>}
            last={index === page.top.length - 1}
          />
        ))}
      </View>

      <Button
        label={i18n.t("bars.checkIn")}
        icon="pin"
        height={56}
        onPress={() => router.push({ pathname: "/checkin", params: { venueId: page.venue.id, crewId: page.venue.crewId } })}
      />

      {page.pastMayors.length ? (
        <View>
          <Text variant="label">{i18n.t("venue.pastMayors")}</Text>
          {page.pastMayors.map((mayor, index) => (
            <Row key={mayor.season} title={mayor.name} subtitle={mayor.season} leading={<Icon name="crown" color={theme.textMuted} />} last={index === page.pastMayors.length - 1} />
          ))}
        </View>
      ) : null}

      {page.latestNights.length ? (
        <View>
          <Text variant="label">{i18n.t("venue.latestNights")}</Text>
          {page.latestNights.map((night, index) => (
            <Row
              key={night.partyId}
              title={night.name}
              subtitle={`${new Intl.DateTimeFormat(i18n.locale, { day: "numeric", month: "long" }).format(new Date(night.startsAt))}, ${formatClock(night.startsAt, i18n.language, hourCycle)}`}
              trailing={<Text variant="small">{i18n.plural("crew.members", night.members)}</Text>}
              last={index === page.latestNights.length - 1}
            />
          ))}
        </View>
      ) : null}

      {page.cheatAttempts.length ? (
        <Panel>
          <Text variant="label">{i18n.t("venue.cheats")}</Text>
          {page.cheatAttempts.map((attempt) => (
            <View key={attempt.id} style={styles.cheat}>
              <Text style={styles.flex}>{attempt.name}</Text>
              {attempt.overturned ? (
                <Tag label={i18n.t("venue.overturned")} tone="ok" />
              ) : isAdmin ? (
                <Button
                  label={i18n.t("venue.overturn")}
                  variant="secondary"
                  height={40}
                  onPress={() => void overturnCheckIn(attempt.id).then(load).catch(() => undefined)}
                />
              ) : (
                <Tag label={i18n.t("checkin.rejected")} tone="danger" />
              )}
            </View>
          ))}
        </Panel>
      ) : null}

      <Panel>
        <View style={styles.switchRow}>
          <Text style={styles.flex}>{i18n.t("venue.territoryOut")}</Text>
          <Switch
            value={territoryOut}
            onValueChange={(on) => {
              haptic.select();
              void setCrewParticipation(page.venue.crewId, { territoryOptOut: on }).then(load).catch(() => undefined);
            }}
            accessibilityLabel={i18n.t("venue.territoryOut")}
          />
        </View>
        <Button
          label={i18n.t("venue.workHere")}
          variant="outline"
          height={44}
          onPress={() =>
            void api(`/v1/venues/${page.venue.id}/workplace`, { method: "POST" })
              .then(() => {
                showToast({ message: i18n.t("venue.workHereHint") });
                load();
              })
              .catch(() => undefined)
          }
        />
      </Panel>
      <ReportPanel targetKind="venue" targetId={page.venue.id} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  rank: { flexDirection: "row", alignItems: "center", gap: 8, width: 64 },
  cheat: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  flex: { flex: 1 },
});
