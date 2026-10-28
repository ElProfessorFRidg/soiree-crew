import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";
import { duration } from "@crew/design-tokens";
import { breathRatio, countryRules, formatBacValue } from "@crew/units";
import { bacColor } from "@/drinks/display";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { closeParty, refreshLiveParty, setPartyStatus, useCrewData, type LiveMember } from "@/server/crewData";
import { useSession } from "@/server/session";
import { useNow } from "@/state/hooks";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Panel, Switch, Tag } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Numeral, Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { useEcoInterval } from "@/power/eco";
import { ScalePressable } from "@/ui/Pressable";
import { startSharing, stopSharing, useLiveShare } from "@/location/liveShare";
import { showFailure } from "@/server/errors";
import { confirmAction } from "@/ui/confirm";

/** Live dashboard refresh while the screen is open, on top of socket hints (O-37). */
const REFRESH_MS = 20_000;

function MemberRow({ member, me }: { member: LiveMember; me: boolean }) {
  const i18n = useT();
  const theme = useTheme();
  const preferences = useAppStore((state) => state.preferences);
  const rules = countryRules(preferences.legalCountry);
  const now = useNow(30_000);
  const home = member.homeSafeAt !== null;
  const absent = member.response !== "going";
  const quietMinutes = member.lastActivityAt ? Math.round((now - member.lastActivityAt) / 60_000) : 0;

  return (
    // O-39: every participant opens their profile.
    <ScalePressable
      pressedScale={0.99}
      onPress={() => router.push({ pathname: "/profile", params: { id: member.userId } })}
      accessibilityRole="button"
      accessibilityLabel={member.displayName}
      style={[styles.member, { borderBottomColor: theme.line }]}
    >
      <Avatar personId={member.userId} name={member.displayName} size={44} faded={home || absent} />
      <View style={styles.flex}>
        <Text variant="h3">{me ? `${member.displayName} (${i18n.t("crew.you")})` : member.displayName}</Text>
        <View style={styles.tags}>
          {absent ? <Tag label={member.response === "declined" ? i18n.t("live.notGoing") : i18n.t("live.invited")} /> : null}
          {home ? <Tag label={i18n.t("live.homeSafe")} tone="ok" icon="home" /> : null}
          {member.designatedDriver ? <Tag label={i18n.t("live.driver")} tone="water" icon="car" /> : null}
          {member.unwellAt && !member.homeSafeAt ? <Tag label={i18n.t("unwell.tag")} tone="danger" /> : null}
          {member.batteryLow ? <Tag label={i18n.t("live.battery")} tone="danger" icon="battery" /> : null}
          {member.quiet && !member.batteryLow ? <Tag label={i18n.t("live.quiet", { minutes: quietMinutes })} tone="amber" icon="clock" /> : null}
          {!absent ? (
            <Text variant="small">
              {i18n.plural("party.drinks", member.drinks)}, {i18n.plural("party.waters", member.water)}
            </Text>
          ) : null}
        </View>
      </View>
      {absent ? null : member.bac === null ? (
        <Text variant="small">{i18n.t("live.noBac")}</Text>
      ) : (
        <View style={styles.bac}>
          <Numeral size={30} color={bacColor(member.bac, rules.limitBlood)}>
            {formatBacValue(member.bac, preferences.bacUnit, breathRatio(rules), i18n.locale)}
          </Numeral>
          {member.trend === "rising" ? <Text variant="tab">{i18n.t("live.rising")}</Text> : member.trend === "falling" ? <Text variant="tab">{i18n.t("live.falling")}</Text> : null}
        </View>
      )}
    </ScalePressable>
  );
}

export default function LiveScreen() {
  const i18n = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const live = useCrewData((state) => (id ? state.live[id] : undefined));
  const party = useCrewData((state) => state.parties.find((p) => p.id === id));
  const me = useSession((state) => state.session?.userId);
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const refreshMs = useEcoInterval(REFRESH_MS);
  const share = useLiveShare();

  useEffect(() => {
    if (!id) return;
    const refresh = () => void refreshLiveParty(id).catch(() => undefined);
    refresh();
    const timer = setInterval(refresh, refreshMs);
    return () => clearInterval(timer);
  }, [id, refreshMs]);

  if (!id) return null;
  const mine = live?.members.find((m) => m.userId === me);
  // Going first, then by name; people at home sink to the bottom.
  const members = [...(live?.members ?? [])].sort((a, b) => {
    const rank = (m: LiveMember) => (m.response !== "going" ? 2 : m.homeSafeAt !== null ? 1 : 0);
    return rank(a) - rank(b) || a.displayName.localeCompare(b.displayName, i18n.locale);
  });

  const toggle = (status: { homeSafe?: boolean; designatedDriver?: boolean }) => {
    haptic.select();
    setPartyStatus(id, status).catch(showFailure(i18n));
  };

  return (
    <Screen back title={party?.name || live?.party.name || i18n.t("live.title")} withToasts>
      {live ? <Text variant="small">{i18n.t("live.updated", { time: formatClock(live.fetchedAt, i18n.language, hourCycle) })}</Text> : null}
      <View>
        {members.map((member) => (
          <Animated.View key={member.userId} layout={LinearTransition.duration(duration.reorder).easing(easings.reorder)}>
            <MemberRow member={member} me={member.userId === me} />
          </Animated.View>
        ))}
      </View>
      {mine && mine.response === "going" && live?.party.live ? (
        <Panel>
          <Button
            label={mine.homeSafeAt ? i18n.t("live.imNotHome") : i18n.t("live.imHome")}
            icon="home"
            variant={mine.homeSafeAt ? "secondary" : "primary"}
            height={64}
            onPress={() => toggle({ homeSafe: !mine.homeSafeAt })}
          />
          <View style={styles.switchRow}>
            <Text style={styles.flex}>{i18n.t("live.imDriver")}</Text>
            <Switch value={mine.designatedDriver} onValueChange={(on) => toggle({ designatedDriver: on })} accessibilityLabel={i18n.t("live.imDriver")} />
          </View>
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text>{i18n.t("live.shareLocation")}</Text>
              <Text variant="small">
                {share.error === "denied"
                  ? i18n.t("live.shareLocationDenied")
                  : share.partyId === id && share.lastSentAt
                    ? i18n.t("live.shareLocationOn", { time: formatClock(share.lastSentAt, i18n.language, hourCycle) })
                    : i18n.t("live.shareLocationHint")}
              </Text>
            </View>
            <Switch
              value={share.partyId === id}
              onValueChange={(on) => {
                haptic.select();
                void (on ? startSharing(id) : stopSharing());
              }}
              accessibilityLabel={i18n.t("live.shareLocation")}
            />
          </View>
          <Button label={i18n.t("goingHome.open")} icon="car" variant="outline" height={48} onPress={() => router.push({ pathname: "/home", params: { id } })} />
        </Panel>
      ) : null}
      {live?.party.live ? (
        <Button
          label={i18n.t("live.close")}
          variant="outline"
          height={48}
          onPress={() =>
            void confirmAction({ title: i18n.t("live.closeConfirm", { party: live.party.name }), confirmLabel: i18n.t("live.close"), cancelLabel: i18n.t("live.closeKeep") }).then((ok) => {
              if (ok) void closeParty(id).catch(showFailure(i18n));
            })
          }
        />
      ) : null}
      <Text variant="disclaimer">{i18n.t("party.notice")}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  member: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 10, borderBottomWidth: 1 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 4 },
  bac: { alignItems: "flex-end", gap: 2 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
});
