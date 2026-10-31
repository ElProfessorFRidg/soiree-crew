import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";
import { duration } from "@crew/design-tokens";
import { breathRatio, countryRules, formatBacValue } from "@crew/units";
import { bacColor } from "@/drinks/display";
import { useT } from "@/i18n";
import { useCrewNames } from "@/crew/names";
import { formatClock } from "@/i18n/format";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { closeParty, refreshLiveParty, setPartyStatus, setQuietAfter, useCrewData, type LiveMember } from "@/server/crewData";
import { mapUrl } from "@/party/NightAlerts";
import { Stepper } from "@/ui/Stepper";
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
import { OpenPartyPanel } from "@/crew/OpenParty";
import { ReportPanel } from "@/moderation/ReportPanel";
import { OpenSettingsButton } from "@/system/OpenSettingsButton";

/** Live dashboard refresh while the screen is open, on top of socket hints (O-37). */
const REFRESH_MS = 20_000;

function MemberRow({ member, me, crewId }: { member: LiveMember; me: boolean; crewId?: string }) {
  const i18n = useT();
  // QOL-11: the crew's name for this person, told apart from a namesake.
  const name = useCrewNames(crewId)(member.userId, member.displayName);
  const theme = useTheme();
  const preferences = useAppStore((state) => state.preferences);
  const rules = countryRules(preferences.legalCountry);
  const now = useNow(30_000);
  const home = member.homeSafeAt !== null;
  const absent = member.response !== "going";
  const quietMinutes = member.lastActivityAt ? Math.round((now - member.lastActivityAt) / 60_000) : 0;
  // O-37: who speeds up and who slows down, from the last hour against the one before.
  const pace = member.pace;
  const paceTrend = pace && pace.lastHour > pace.previousHour ? "up" : pace && pace.lastHour < pace.previousHour ? "down" : null;

  return (
    // O-39: every participant opens their profile.
    <ScalePressable
      pressedScale={0.99}
      onPress={() => router.push({ pathname: "/profile", params: { id: member.userId } })}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={[styles.member, { borderBottomColor: theme.line }]}
    >
      <Avatar personId={member.userId} name={name} size={44} faded={home || absent} />
      <View style={styles.flex}>
        <Text variant="h3">{me ? `${name} (${i18n.t("crew.you")})` : name}</Text>
        <View style={styles.tags}>
          {absent ? <Tag label={member.response === "declined" ? i18n.t("live.notGoing") : i18n.t("live.invited")} /> : null}
          {home ? <Tag label={i18n.t("live.homeSafe")} tone="ok" icon="home" /> : null}
          {member.designatedDriver ? <Tag label={i18n.t("live.driver")} tone="water" icon="car" /> : null}
          {member.unwellAt && !member.homeSafeAt ? <Tag label={i18n.t("unwell.tag")} tone="danger" /> : null}
          {member.batteryLow ? (
            <Tag
              label={member.batteryLowAt ? i18n.t("live.batterySince", { time: formatClock(member.batteryLowAt, i18n.language, preferences.hourCycle) }) : i18n.t("live.battery")}
              tone="danger"
              icon="battery"
            />
          ) : null}
          {paceTrend === "up" ? <Tag label={i18n.t("live.speedingUp")} tone="amber" /> : paceTrend === "down" ? <Tag label={i18n.t("live.slowingDown")} /> : null}
          {member.quiet && !member.batteryLow ? <Tag label={i18n.t("live.quiet", { minutes: quietMinutes })} tone="amber" icon="clock" /> : null}
          {!absent ? (
            <Text variant="small">
              {i18n.plural("party.drinks", member.drinks)}, {i18n.plural("party.waters", member.water)}
              {pace ? `, ${i18n.plural("live.lastHour", pace.lastHour)}` : ""}
            </Text>
          ) : null}
          {member.venue ? <Text variant="small">{i18n.t("live.atVenue", { venue: member.venue.name })}</Text> : null}
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

type Movement = { userId: string; name: string; at: number; kind: "arrived" | "home" };

/** O-37: arrivals and departures of the night, newest first. */
function Movements({ members }: { members: LiveMember[] }) {
  const i18n = useT();
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const list: Movement[] = [];
  for (const m of members) {
    if (m.arrivedAt) list.push({ userId: m.userId, name: m.displayName, at: m.arrivedAt, kind: "arrived" });
    if (m.homeSafeAt) list.push({ userId: m.userId, name: m.displayName, at: m.homeSafeAt, kind: "home" });
  }
  if (!list.length) return null;
  list.sort((a, b) => b.at - a.at);
  return (
    <View style={styles.feed}>
      <Text variant="label">{i18n.t("live.movements")}</Text>
      {list.slice(0, 12).map((item) => (
        <View key={`${item.kind}-${item.userId}`} style={styles.feedRow}>
          <Numeral size={22}>{formatClock(item.at, i18n.language, hourCycle)}</Numeral>
          <Text style={styles.flex}>{i18n.t(item.kind === "arrived" ? "live.arrived" : "live.wentHome", { name: item.name })}</Text>
        </View>
      ))}
    </View>
  );
}

/** QOL-10: where a phone that ran low was last seen, when its owner shared their position. */
function LastKnown({ members }: { members: LiveMember[] }) {
  const i18n = useT();
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const known = members.filter((m) => m.batteryLow && m.lastKnown && m.homeSafeAt === null);
  if (!known.length) return null;
  return (
    <View style={styles.feed}>
      {known.map((m) => (
        <Button
          key={m.userId}
          label={i18n.t("live.lastKnownOf", { name: m.displayName, time: formatClock(m.lastKnown!.at, i18n.language, hourCycle) })}
          icon="pin"
          variant="outline"
          height={48}
          onPress={() => void Linking.openURL(mapUrl(m.lastKnown!))}
        />
      ))}
    </View>
  );
}

/** N-29: the creator or a crew admin sets how long a silence lasts before the party is told. */
function QuietSetting({ partyId, minutes }: { partyId: string; minutes: number }) {
  const i18n = useT();
  const [value, setValue] = useState(minutes);
  useEffect(() => setValue(minutes), [minutes]);
  useEffect(() => {
    if (value === minutes) return;
    // Held steps settle first; one request once the finger is up.
    const timer = setTimeout(() => void setQuietAfter(partyId, value).catch(showFailure(i18n)), 700);
    return () => clearTimeout(timer);
  }, [value, minutes, partyId]);
  return (
    <View style={styles.feed}>
      <Text variant="label">{i18n.t("live.quietAfter")}</Text>
      <Stepper
        value={value}
        min={15}
        max={240}
        step={15}
        unit={i18n.t("live.minutes")}
        size={34}
        onChange={setValue}
        decreaseLabel={i18n.t("live.quietSooner")}
        increaseLabel={i18n.t("live.quietLater")}
      />
      <Text variant="small">{i18n.t("live.quietHint")}</Text>
    </View>
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
  const crewRole = useCrewData((state) => state.crews.find((c) => c.id === party?.crewId)?.role);

  useEffect(() => {
    if (!id) return;
    const refresh = () => void refreshLiveParty(id).catch(() => undefined);
    refresh();
    const timer = setInterval(refresh, refreshMs);
    return () => clearInterval(timer);
  }, [id, refreshMs]);

  if (!id) return null;
  const mine = live?.members.find((m) => m.userId === me);
  const ended = party ? party.closedAt !== null || party.endsAt < Date.now() : live ? !live.party.live && live.party.closedAt !== null : false;
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
            <MemberRow member={member} me={member.userId === me} crewId={live?.party.crewId} />
          </Animated.View>
        ))}
      </View>
      <LastKnown members={members} />
      <Movements members={members} />
      {live?.party.live && party && (party.createdBy === me || crewRole === "admin") ? <QuietSetting partyId={id} minutes={party.quietAfterMinutes ?? 45} /> : null}
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
                {share.error === "denied" || share.error === "blocked"
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
          {share.error === "blocked" ? <OpenSettingsButton /> : null}
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
      {ended ? (
        // JOY-09: once the party is over, the photo strip is offered right here.
        <Panel>
          <Text>{i18n.t("strip.ended")}</Text>
          <Button label={i18n.t("strip.open")} icon="x:film" height={52} onPress={() => router.push({ pathname: "/photo-strip", params: { partyId: id } })} />
          <Button label={i18n.t("strip.seeRecap")} variant="outline" height={48} onPress={() => router.push({ pathname: "/recap", params: { id } })} />
        </Panel>
      ) : null}
      {/* COM-05: the hosts can open the party at one of the crew's bars. */}
      <OpenPartyPanel partyId={id} />
      {/* COM-08, O-77: a party (its name, its notes) can go to the crew's admins. */}
      <ReportPanel targetKind="party" targetId={id} compact />
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
  feed: { gap: 8 },
  feedRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 32 },
});
