import { router } from "expo-router";
import { useEffect } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { POISONING_CARD_THRESHOLD } from "@crew/bac";
import { palette } from "@crew/design-tokens";
import { breathRatio, countryRules, formatBacValue } from "@crew/units";
import { useT, type Translator } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { haptic } from "@/motion/haptics";
import { refreshLiveParty, setPartyStatus, useCrewData, useEndedParty, useLiveParty, type LiveMember } from "@/server/crewData";
import { showFailure } from "@/server/errors";
import { useSession } from "@/server/session";
import { useNow } from "@/state/hooks";
import { useAppStore } from "@/state/store";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

export const mapUrl = (p: { lat: number; lng: number }) => `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=18/${p.lat}/${p.lng}`;

/** O-88: a crew member's estimate is past 2.0 g/L. The signs, the number to call, the SOS. */
function DangerCard({ member, partyId, i18n }: { member: LiveMember; partyId: string; i18n: Translator }) {
  const preferences = useAppStore((state) => state.preferences);
  const rules = countryRules(preferences.legalCountry);
  const number = rules.emergency.ambulance ?? rules.emergency.primary;
  const threshold = `${formatBacValue(POISONING_CARD_THRESHOLD, preferences.bacUnit, breathRatio(rules), i18n.locale)} ${i18n.t(`units.${preferences.bacUnit}`)}`;
  return (
    <Panel tint="danger" style={styles.panel}>
      <Text variant="h3" color={palette.tint.dangerTextStrong} accessibilityLiveRegion="assertive">
        {i18n.t("nightAlerts.dangerTitle", { name: member.displayName, value: threshold })}
      </Text>
      <Text color={palette.tint.dangerText}>{i18n.t("party.poisoningBody", { number })}</Text>
      <Button label={i18n.t("party.callEmergency", { number })} icon="phone" variant="danger" height={52} onPress={() => void Linking.openURL(`tel:${number}`)} />
      <View style={styles.row}>
        <Button label={i18n.t("party.sos")} icon="alert" variant="secondary" height={48} style={styles.flex} onPress={() => router.push("/sos")} />
        <Button label={i18n.t("unwell.see")} icon="pin" variant="outline" height={48} style={styles.flex} onPress={() => router.push({ pathname: "/live", params: { id: partyId } })} />
      </View>
    </Panel>
  );
}

/** N-29 and QOL-10: no sign of life for longer than the party allows; a low battery is said, not hidden. */
function QuietCard({ member, partyId, now, i18n }: { member: LiveMember; partyId: string; now: number; i18n: Translator }) {
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const minutes = member.lastActivityAt ? Math.round((now - member.lastActivityAt) / 60_000) : 0;
  return (
    <Panel tint="amber" style={styles.panel}>
      <Text variant="h3" accessibilityLiveRegion="polite">
        {i18n.t("nightAlerts.quietTitle", { name: member.displayName, minutes })}
      </Text>
      {member.batteryLow ? (
        <Text variant="small">
          {member.batteryLowAt ? i18n.t("nightAlerts.batterySince", { time: formatClock(member.batteryLowAt, i18n.language, hourCycle) }) : i18n.t("live.battery")}
        </Text>
      ) : null}
      <View style={styles.row}>
        {member.lastKnown ? (
          <Button label={i18n.t("nightAlerts.lastKnown")} icon="pin" variant="secondary" height={48} style={styles.flex} onPress={() => void Linking.openURL(mapUrl(member.lastKnown!))} />
        ) : null}
        <Button label={i18n.t("unwell.see")} variant="outline" height={48} style={styles.flex} onPress={() => router.push({ pathname: "/live", params: { id: partyId } })} />
      </View>
    </Panel>
  );
}

/** N-25: the night is over. Am I home, and who is not yet? */
function HomeCheck({ i18n, now }: { i18n: Translator; now: number }) {
  const ended = useEndedParty(now);
  const live = useCrewData((state) => (ended ? state.live[ended.id] : undefined));
  const me = useSession((state) => state.session?.userId);
  useEffect(() => {
    if (ended) void refreshLiveParty(ended.id).catch(() => undefined);
  }, [ended?.id]);
  if (!ended || !live) return null;
  const going = live.members.filter((m) => m.response === "going");
  const mine = going.find((m) => m.userId === me);
  const missing = going.filter((m) => m.userId !== me && m.homeSafeAt === null);
  const asked = mine !== undefined && mine.homeSafeAt === null;
  if (!asked && missing.length === 0) return null;
  return (
    <Panel {...(asked ? { tint: "amber" as const } : {})} style={styles.panel}>
      {asked ? (
        <>
          <Text variant="h3">{i18n.t("homeCheck.title", { party: ended.name })}</Text>
          <Button
            label={i18n.t("live.imHome")}
            icon="home"
            height={56}
            onPress={() => {
              haptic.confirmed();
              void setPartyStatus(ended.id, { homeSafe: true })
                .then(() => showToast({ message: i18n.t("party.homeMarked") }))
                .catch(showFailure(i18n));
            }}
          />
        </>
      ) : null}
      {missing.length ? (
        <Text variant="small" accessibilityLiveRegion="polite">
          {i18n.t("homeCheck.notYet", { names: missing.map((m) => m.displayName).join(", ") })}
        </Text>
      ) : null}
    </Panel>
  );
}

/** The night's alerts at the top of the Party and Crew screens: danger first, then silences, then the way home. */
export function NightAlerts() {
  const i18n = useT();
  const now = useNow(30_000);
  const current = useLiveParty();
  const me = useSession((state) => state.session?.userId);
  const members = (current?.live?.members ?? []).filter((m) => m.userId !== me && m.response === "going" && m.homeSafeAt === null);
  const danger = members.filter((m) => m.bac !== null && m.bac >= POISONING_CARD_THRESHOLD);
  const quiet = members.filter((m) => m.quiet && !danger.includes(m));
  return (
    <>
      {current
        ? danger.map((m) => <DangerCard key={`d-${m.userId}`} member={m} partyId={current.party.id} i18n={i18n} />)
        : null}
      {current ? quiet.map((m) => <QuietCard key={`q-${m.userId}`} member={m} partyId={current.party.id} now={now} i18n={i18n} />) : null}
      {current ? null : <HomeCheck i18n={i18n} now={now} />}
    </>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 10 },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  flex: { flexGrow: 1, flexBasis: 140 },
});
