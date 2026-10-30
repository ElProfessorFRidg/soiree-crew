import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { moodIcon } from "@/crew/moods";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { haptic } from "@/motion/haptics";
import { useCrewData } from "@/server/crewData";
import { showFailure } from "@/server/errors";
import { inviteGuest } from "@/server/socialData";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Panel, Row, Switch } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

/**
 * COM-05: invite someone met at a bar (a regular, a profile) to one of my crews' coming parties,
 * with their crew if they like. The server checks their "who can send requests" setting and blocks.
 */
export default function InviteToPartyScreen() {
  const { userId, name } = useLocalSearchParams<{ userId: string; name?: string }>();
  const i18n = useT();
  const theme = useTheme();
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const crews = useCrewData((state) => state.crews);
  const parties = useCrewData((state) => state.parties);
  const [withCrew, setWithCrew] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const who = name || "?";
  const now = Date.now();
  // My crews' own parties still to come or under way; a party I am only a guest at is not mine to share.
  const mine = parties.filter((p) => !p.guest && p.closedAt === null && p.endsAt > now && crews.some((c) => c.id === p.crewId));
  const crewNameOf = (id: string) => crews.find((c) => c.id === id)?.name ?? "";
  const when = (at: number) => `${new Intl.DateTimeFormat(i18n.locale, { weekday: "long", day: "numeric", month: "long" }).format(new Date(at))}, ${formatClock(at, i18n.language, hourCycle)}`;

  const invite = (partyId: string) => {
    setSending(partyId);
    inviteGuest(partyId, userId, withCrew)
      .then(() => {
        haptic.confirmed();
        setSent((s) => new Set(s).add(partyId));
        showToast({ message: i18n.t("people.inviteSent", { name: who }) });
      })
      .catch(showFailure(i18n))
      .finally(() => setSending(null));
  };

  return (
    <Screen back title={i18n.t("people.inviteTitle", { name: who })} withToasts>
      <View style={styles.head}>
        <Avatar personId={userId} name={who} size={48} />
        <Text style={styles.flex}>{i18n.t("people.invitePick")}</Text>
      </View>
      <Panel>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text>{i18n.t("people.inviteWithCrew")}</Text>
            <Text variant="small">{i18n.t("people.inviteWithCrewHint")}</Text>
          </View>
          <Switch value={withCrew} onValueChange={setWithCrew} accessibilityLabel={i18n.t("people.inviteWithCrew")} />
        </View>
      </Panel>
      {mine.length === 0 ? (
        <>
          <Text>{i18n.t("people.inviteNoParty")}</Text>
          <Button label={i18n.t("crew.newParty")} icon="plus" height={52} onPress={() => router.push("/new-party")} />
        </>
      ) : (
        <View>
          {mine.map((party, index) => (
            <Row
              key={party.id}
              title={party.name || i18n.t(`newParty.moods.${party.mood}`)}
              subtitle={`${crewNameOf(party.crewId)}, ${when(party.startsAt)}`}
              leading={<Icon name={moodIcon(party.mood)} color={theme.amber} />}
              trailing={
                sent.has(party.id) ? (
                  <Icon name="check" color={theme.ok} />
                ) : (
                  <Button label={i18n.t("people.inviteSend")} variant="secondary" height={40} loading={sending === party.id} onPress={() => invite(party.id)} />
                )
              }
              last={index === mine.length - 1}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
});
