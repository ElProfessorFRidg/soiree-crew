import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Share, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { duration } from "@crew/design-tokens";
import { ConnectServer } from "@/crew/ConnectServer";
import { Field } from "@/crew/Field";
import { RadarSection } from "@/crew/RadarSection";
import { SosBanner } from "@/crew/SosBanner";
import { useT, type Translator } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { haptic } from "@/motion/haptics";
import { ApiError } from "@/server/api";
import { acceptInvite, createCrew, createInvite, leaveCrew, respondToParty, useCrewData, type Crew, type Party } from "@/server/crewData";
import { useSession } from "@/server/session";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Panel, Row, Segmented, Tag } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { guarded } from "@/vault/vault";

function errorMessage(error: unknown, i18n: Translator): string {
  if (error instanceof ApiError && error.failure.kind === "http") {
    if (error.failure.status === 404) return i18n.t("crew.inviteInvalid");
    return i18n.t("crew.serverError", { code: error.failure.code });
  }
  return i18n.t("crew.offline");
}

function partyWhen(party: Party, i18n: Translator, hourCycle: "h12" | "h23"): string {
  const day = new Intl.DateTimeFormat(i18n.locale, { weekday: "long", day: "numeric", month: "long" }).format(new Date(party.startsAt));
  return `${day}, ${formatClock(party.startsAt, i18n.language, hourCycle)}`;
}

function InvitationCard({ party, crewName }: { party: Party; crewName: string }) {
  const i18n = useT();
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  return (
    <Panel>
      <Text variant="h3">{party.name || i18n.t(`newParty.moods.${party.mood}`)}</Text>
      <Text variant="small">
        {crewName}, {partyWhen(party, i18n, hourCycle)}
      </Text>
      <Segmented<"going" | "declined" | "invited">
        accessibilityLabel={party.name}
        value={party.myResponse}
        items={[
          { value: "going", label: i18n.t("crew.going") },
          { value: "declined", label: i18n.t("crew.declined") },
        ]}
        onChange={(response) => {
          if (response === "invited") return;
          haptic.select();
          respondToParty(party.id, response).catch((error: unknown) => showToast({ tone: "danger", message: errorMessage(error, i18n) }));
        }}
      />
    </Panel>
  );
}

function CrewCard({ crew }: { crew: Crew }) {
  const i18n = useT();
  const theme = useTheme();
  const me = useSession((state) => state.session?.userId);
  const [invite, setInvite] = useState<{ code: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const onInvite = async () => {
    try {
      const created = await createInvite(crew.id);
      setInvite(created);
      await Share.share({ message: i18n.t("crew.inviteShare", { crew: crew.name, url: created.url }) });
    } catch (error) {
      showToast({ tone: "danger", message: errorMessage(error, i18n) });
    }
  };

  const onLeave = () => {
    Alert.alert(i18n.t("crew.leaveConfirm", { crew: crew.name }), undefined, [
      { text: i18n.t("crew.leaveKeep"), style: "cancel" },
      {
        text: i18n.t("crew.leave"),
        style: "destructive",
        onPress: () => {
          const ran = guarded({ kind: "leaveCrew", crewId: crew.id, crewName: crew.name }, () =>
            void leaveCrew(crew.id).catch((error: unknown) => showToast({ tone: "danger", message: errorMessage(error, i18n) })),
          );
          if (!ran) showToast({ message: i18n.t("vault.queued") });
        },
      },
    ]);
  };

  return (
    <Panel>
      <View style={styles.crewHead}>
        <View style={styles.flex}>
          <Text variant="h2">{crew.name}</Text>
          <Text variant="small">{i18n.plural("crew.members", crew.members.length)}</Text>
        </View>
        {crew.role === "admin" ? <Tag label={i18n.t("crew.admin")} /> : null}
      </View>
      <View style={styles.members}>
        {crew.members.map((member) => (
          <View key={member.id} style={styles.member}>
            <Avatar personId={member.id} name={member.nickname ?? member.displayName} />
            <Text variant="tab" align="center" numberOfLines={2}>
              {member.id === me ? i18n.t("crew.you") : (member.nickname ?? member.displayName)}
            </Text>
          </View>
        ))}
      </View>
      <Row
        title={i18n.t("money.pools")}
        leading={<Icon name="euro" color={theme.textMuted} />}
        trailing={<Icon name="chev" color={theme.textMuted} />}
        onPress={() => router.push({ pathname: "/money", params: { crewId: crew.id } })}
      />
      <Row
        title={i18n.t("recap.list")}
        leading={<Icon name="sparkdot" color={theme.textMuted} />}
        trailing={<Icon name="chev" color={theme.textMuted} />}
        onPress={() => router.push("/recaps")}
        last
      />
      {invite ? (
        <Animated.View entering={FadeIn.duration(duration.enter)} style={styles.inviteRow}>
          <Text style={styles.flex}>{i18n.t("crew.inviteCodeIs", { code: invite.code })}</Text>
          <Button
            label={copied ? i18n.t("crew.copied") : i18n.t("crew.copyCode")}
            variant="secondary"
            height={40}
            onPress={() => {
              void Clipboard.setStringAsync(invite.code);
              haptic.select();
              setCopied(true);
              setTimeout(() => setCopied(false), 1_800);
            }}
          />
        </Animated.View>
      ) : null}
      <View style={styles.actions}>
        <Button label={i18n.t("crew.invite")} icon="share" height={44} style={styles.flex} onPress={() => void onInvite()} />
        <Button label={i18n.t("crew.leave")} variant="outline" height={44} style={styles.flex} onPress={onLeave} />
      </View>
    </Panel>
  );
}

export default function CrewScreen() {
  const i18n = useT();
  const theme = useTheme();
  const session = useSession((state) => state.session);
  const crews = useCrewData((state) => state.crews);
  const parties = useCrewData((state) => state.parties);
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const [crewName, setCrewName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);

  if (!session) {
    return (
      <Screen title={i18n.t("crew.connectTitle")} withToasts>
        <ConnectServer />
      </Screen>
    );
  }

  const now = Date.now();
  const crewNameOf = (id: string) => crews.find((c) => c.id === id)?.name ?? "";
  const invitations = parties.filter((p) => p.closedAt === null && p.endsAt > now && p.myResponse !== "going");
  const going = parties.filter((p) => p.closedAt === null && p.endsAt > now && p.myResponse === "going");

  return (
    <Screen title={i18n.t("crew.tab")} withToasts>
      <SosBanner />
      {crews[0] ? <RadarSection crewId={crews[0].id} /> : null}
      {invitations.length ? (
        <>
          <Text variant="label">{i18n.t("crew.invitations")}</Text>
          {invitations.map((party) => (
            <InvitationCard key={party.id} party={party} crewName={crewNameOf(party.crewId)} />
          ))}
        </>
      ) : null}

      {going.length ? (
        <View>
          <Text variant="label">{i18n.t("crew.upcoming")}</Text>
          {going.map((party, index) => (
            <Row
              key={party.id}
              title={party.name || i18n.t(`newParty.moods.${party.mood}`)}
              subtitle={`${crewNameOf(party.crewId)}, ${partyWhen(party, i18n, hourCycle)}`}
              leading={party.live ? <View style={[styles.liveDot, { backgroundColor: theme.ok }]} /> : <Icon name="cal" color={theme.textMuted} />}
              trailing={<Icon name="chev" color={theme.textMuted} />}
              onPress={() => router.push({ pathname: "/live", params: { id: party.id } })}
              last={index === going.length - 1}
            />
          ))}
        </View>
      ) : null}

      {crews.length ? <Button label={i18n.t("crew.newParty")} icon="plus" height={56} onPress={() => router.push("/new-party")} /> : null}

      <Text variant="label">{i18n.t("crew.myCrews")}</Text>
      {crews.length === 0 ? <Text>{i18n.t("crew.noCrew")}</Text> : null}
      {crews.map((crew) => (
        <CrewCard key={crew.id} crew={crew} />
      ))}

      <Panel>
        <Field
          label={i18n.t("crew.joinCrew")}
          placeholder={i18n.t("crew.inviteCode")}
          value={code}
          onChangeText={(text) => setCode(text.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
        />
        <Button
          label={i18n.t("crew.join")}
          variant="secondary"
          height={44}
          disabled={code.trim().length !== 8}
          loading={busy === "join"}
          onPress={() => {
            setBusy("join");
            acceptInvite(code)
              .then(() => {
                haptic.confirmed();
                setCode("");
              })
              .catch((error: unknown) => showToast({ tone: "danger", message: errorMessage(error, i18n) }))
              .finally(() => setBusy(null));
          }}
        />
      </Panel>

      <Panel>
        <Field label={i18n.t("crew.newCrew")} placeholder={i18n.t("crew.crewName")} value={crewName} onChangeText={setCrewName} maxLength={40} />
        <Button
          label={i18n.t("crew.create")}
          variant="secondary"
          height={44}
          disabled={!crewName.trim()}
          loading={busy === "create"}
          onPress={() => {
            setBusy("create");
            createCrew(crewName.trim())
              .then(() => {
                haptic.confirmed();
                setCrewName("");
              })
              .catch((error: unknown) => showToast({ tone: "danger", message: errorMessage(error, i18n) }))
              .finally(() => setBusy(null));
          }}
        />
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  crewHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  members: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  member: { width: 60, alignItems: "center", gap: 4 },
  inviteRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  actions: { flexDirection: "row", gap: 10 },
  liveDot: { width: 10, height: 10, borderRadius: 5 },
});
