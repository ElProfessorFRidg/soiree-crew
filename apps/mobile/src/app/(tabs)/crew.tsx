import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { duration, space } from "@crew/design-tokens";
import { CreateCrewForm, JoinByCode, type CrewDraft } from "@/crew/AddCrew";
import { CrewArrival } from "@/crew/CrewArrival";
import { CrewPage, partyWhen, useUnreadTotal } from "@/crew/CrewPage";
import { crewErrorMessage } from "@/crew/invite";
import { moodIcon } from "@/crew/moods";
import { PublicCrewList } from "@/crew/PublicCrewList";
import { ServerLine } from "@/crew/ServerChoice";
import { SosBanner } from "@/crew/SosBanner";
import { bringCrew, decideJoinRequest, refreshInvitations, useInvitations, type JoinRequest } from "@/server/socialData";
import { NightAlerts } from "@/party/NightAlerts";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { acceptInvite, createCrew, joinOpenCrew, refreshCrews, refreshParties, respondToParty, useCrewData, type OpenCrew, type Party } from "@/server/crewData";
import { normaliseServerUrl, useSession } from "@/server/session";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button, IconButton } from "@/ui/Button";
import { Chip, Panel, Row, Segmented } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { LiveDot } from "@/ui/LiveDot";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { usePendingInvite } from "@/server/pendingInvite";
import { refreshRadar } from "@/server/radarData";
import { showFailure } from "@/server/errors";

function InvitationCard({ party, crewName }: { party: Party; crewName: string }) {
  const i18n = useT();
  const theme = useTheme();
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const crews = useCrewData((state) => state.crews);
  const [bringing, setBringing] = useState<string | null>(null);
  // COM-05: someone met at a bar asked me, maybe with my crew: I pick which crew comes along.
  const mayBring = party.guest?.mayBringCrew === true && crews.length > 0;
  return (
    <Panel>
      <View style={styles.titleRow}>
        <Icon name={moodIcon(party.mood)} color={theme.amber} />
        <Text variant="h3" style={styles.flex}>
          {party.name || i18n.t(`newParty.moods.${party.mood}`)}
        </Text>
      </View>
      <Text variant="small">
        {party.guest ? i18n.t("crew.guestInvite", { name: party.guest.invitedBy ?? "?" }) : crewName}, {partyWhen(party, i18n, hourCycle)}
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
          respondToParty(party.id, response).catch((error: unknown) => showToast({ tone: "danger", message: crewErrorMessage(error, i18n) }));
        }}
      />
      {mayBring ? (
        <>
          <Text variant="small">{i18n.t("crew.bringCrewHint")}</Text>
          <View style={styles.wrap}>
            {crews.map((c) => (
              <Chip
                key={c.id}
                label={bringing === c.id ? i18n.t("crew.bringing") : c.name}
                icon="users"
                onPress={() => {
                  if (bringing) return;
                  setBringing(c.id);
                  bringCrew(party.id, c.id)
                    .then((count) => {
                      haptic.confirmed();
                      showToast({ message: i18n.plural("crew.broughtCrew", count) });
                    })
                    .catch(showFailure(i18n))
                    .finally(() => setBringing(null));
                }}
              />
            ))}
          </View>
        </>
      ) : null}
    </Panel>
  );
}

/** COM-05: someone asked to join an open party I host; one tap lets them in or not. */
function JoinRequestCard({ request }: { request: JoinRequest }) {
  const i18n = useT();
  const decide = (approve: boolean) => {
    haptic.select();
    decideJoinRequest(request.partyId, request.userId, approve)
      .then(() => {
        if (approve) haptic.confirmed();
      })
      .catch(showFailure(i18n));
  };
  return (
    <Panel>
      <View style={styles.titleRow}>
        <Avatar personId={request.userId} name={request.name} size={34} />
        <Text style={styles.flex}>{i18n.t("crew.joinRequestLine", { name: request.name, party: request.partyName })}</Text>
      </View>
      <View style={styles.actions}>
        <Button label={i18n.t("crew.refuse")} variant="outline" height={44} style={styles.flex} onPress={() => decide(false)} />
        <Button label={i18n.t("crew.approve")} variant="secondary" height={44} style={styles.flex} onPress={() => decide(true)} />
      </View>
    </Panel>
  );
}

/** The messages button keeps its unread count, read out with it. */
function ChatButton() {
  const i18n = useT();
  const theme = useTheme();
  const unread = useUnreadTotal();
  return (
    <View>
      <IconButton
        icon="chat"
        accessibilityLabel={unread ? `${i18n.t("chat.title")}, ${i18n.plural("crewHub.unread", unread)}` : i18n.t("chat.title")}
        onPress={() => router.push("/messages")}
      />
      {unread ? (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.badge, { backgroundColor: theme.danger, borderColor: theme.bg }]}
        >
          <Text variant="tag" color={theme.bg} style={styles.badgeText}>
            {unread > 99 ? "99+" : String(unread)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** "+ Ajouter": a code, a new crew, or the public ones. */
function AddCrewPanel({ busy, onCode, onCreate, onDiscover }: { busy: "create" | "join" | null; onCode: (code: string, server: string | null) => void; onCreate: (draft: CrewDraft) => Promise<boolean>; onDiscover: () => void }) {
  const i18n = useT();
  return (
    <Animated.View entering={FadeIn.duration(duration.enter)} style={styles.addBlock}>
      <Text variant="label">{i18n.t("crew.joinCrew")}</Text>
      <JoinByCode busy={busy === "join"} onSubmit={onCode} />
      <Text variant="label">{i18n.t("crew.newCrew")}</Text>
      <CreateCrewForm withKind busy={busy === "create"} onSubmit={onCreate} />
      <Button label={i18n.t("crewHub.seePublic")} icon="search" variant="outline" height={48} onPress={onDiscover} />
    </Animated.View>
  );
}

export default function CrewScreen() {
  const i18n = useT();
  const theme = useTheme();
  const session = useSession((state) => state.session);
  const crews = useCrewData((state) => state.crews);
  const parties = useCrewData((state) => state.parties);
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const [view, setView] = useState<"mine" | "discover">("mine");
  // Several crews: one page at a time, picked in the switcher.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = crews.find((c) => c.id === selectedId) ?? crews[0] ?? null;
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const pendingInvite = usePendingInvite((state) => state.invite);
  const joinRequests = useInvitations((state) => state.joinRequests);

  // O-36: the badge and the requests are fresh whenever the tab shows.
  useFocusEffect(
    useCallback(() => {
      if (session) void refreshInvitations().catch(() => undefined);
    }, [session]),
  );

  // QOL-05: an invite link opened before signing up is accepted as soon as the account exists.
  useEffect(() => {
    if (!session || !pendingInvite) return;
    usePendingInvite.setState({ invite: null });
    if (session.url !== pendingInvite.server) return;
    void acceptInvite(pendingInvite.code)
      .then(() => {
        haptic.confirmed();
        showToast({ message: i18n.t("join.joined") });
      })
      .catch(() => showToast({ tone: "danger", message: i18n.t("join.failed") }));
  }, [session, pendingInvite, i18n]);

  if (!session) {
    return (
      <Screen title={i18n.t("crew.connectTitle")} withToasts>
        <CrewArrival />
      </Screen>
    );
  }

  const now = Date.now();
  const crewNameOf = (id: string) => crews.find((c) => c.id === id)?.name ?? "";
  // COM-05: a guest card stays while its crew can still be brought along.
  const invitations = parties.filter((p) => p.closedAt === null && p.endsAt > now && (p.myResponse !== "going" || (p.guest?.mayBringCrew ?? false)));
  const going = parties
    .filter((p) => p.closedAt === null && p.endsAt > now && p.myResponse === "going" && !invitations.includes(p))
    .sort((a, b) => a.startsAt - b.startsAt);
  const mine = new Set(crews.map((c) => c.id));
  // Nights of other crews I was invited to: they belong to no page of mine, so they stay on top.
  const elsewhere = going.filter((p) => p.guest || !mine.has(p.crewId));
  const upcoming = selected ? going.filter((p) => p.crewId === selected.id && !p.guest) : [];

  const onCode = (code: string, server: string | null) => {
    const url = server ? normaliseServerUrl(server) : null;
    // An invite to another server goes through the join screen, which says so.
    if (url && url !== session.url) {
      router.push({ pathname: "/join", params: { code, server: url } });
      return;
    }
    setBusy("join");
    acceptInvite(code)
      .then((crewId) => {
        haptic.confirmed();
        showToast({ message: i18n.t("join.joined") });
        setSelectedId(crewId);
        setAdding(false);
      })
      .catch((error: unknown) => showToast({ tone: "danger", message: crewErrorMessage(error, i18n) }))
      .finally(() => setBusy(null));
  };

  const onCreate = async (draft: CrewDraft): Promise<boolean> => {
    setBusy("create");
    try {
      const id = await createCrew(draft.name, draft.kind, { open: draft.open, ...(draft.category ? { category: draft.category } : {}) });
      haptic.confirmed();
      showToast({ message: i18n.t("arrival.created", { crew: draft.name }) });
      setSelectedId(id);
      setAdding(false);
      return true;
    } catch (error) {
      showToast({ tone: "danger", message: crewErrorMessage(error, i18n) });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const onJoinPublic = async (crew: OpenCrew) => {
    try {
      await joinOpenCrew(crew.id);
      haptic.confirmed();
      showToast({ message: i18n.t("arrival.joined", { crew: crew.name }) });
      setSelectedId(crew.id);
      setView("mine");
    } catch (error) {
      showFailure(i18n)(error);
    }
  };

  const showAdd = adding || crews.length === 0;
  const addPanel = (
    <AddCrewPanel
      key="add"
      busy={busy}
      onCode={onCode}
      onCreate={onCreate}
      onDiscover={() => {
        setAdding(false);
        setView("discover");
      }}
    />
  );

  return (
    <Screen
      title={i18n.t("crew.tab")}
      trailing={
        <View style={styles.headerActions}>
          <ChatButton />
          <IconButton icon="search" accessibilityLabel={i18n.t("search.title")} onPress={() => router.push("/search")} />
        </View>
      }
      withToasts
      onRefresh={() => Promise.all([refreshCrews(), refreshParties(), refreshInvitations(), ...crews.map((c) => refreshRadar(c.id))])}
    >
      <SosBanner key="sos" />
      <NightAlerts key="alerts" />
      <Segmented
        key="view"
        accessibilityLabel={i18n.t("crew.tab")}
        value={view}
        items={[
          { value: "mine", label: i18n.t("crewHub.mine") },
          { value: "discover", label: i18n.t("crewHub.discover") },
        ]}
        onChange={setView}
      />

      {view === "discover" ? (
        <View key="discover" style={styles.section}>
          <PublicCrewList onJoin={onJoinPublic} />
          <ServerLine server={session.url} />
        </View>
      ) : null}

      {view === "mine" && invitations.length ? (
        <View key="invitations" style={styles.section}>
          <Text variant="label">{i18n.t("crew.invitations")}</Text>
          {invitations.map((party) => (
            <InvitationCard key={party.id} party={party} crewName={crewNameOf(party.crewId)} />
          ))}
        </View>
      ) : null}
      {view === "mine" && joinRequests.length ? (
        <View key="requests" style={styles.section}>
          <Text variant="label">{i18n.t("crew.joinRequests")}</Text>
          {joinRequests.map((request) => (
            <JoinRequestCard key={`${request.partyId}-${request.userId}`} request={request} />
          ))}
        </View>
      ) : null}
      {view === "mine" && elsewhere.length ? (
        <View key="elsewhere">
          <Text variant="label">{i18n.t("crew.upcoming")}</Text>
          {elsewhere.map((party, index) => (
            <Row
              key={party.id}
              title={party.name || i18n.t(`newParty.moods.${party.mood}`)}
              subtitle={`${party.guest ? i18n.t("crew.guestInvite", { name: party.guest.invitedBy ?? "?" }) : crewNameOf(party.crewId)}, ${partyWhen(party, i18n, hourCycle)}`}
              leading={party.live ? <LiveDot size={10} /> : <Icon name={moodIcon(party.mood)} color={theme.textMuted} />}
              trailing={<Icon name="chev" color={theme.textMuted} />}
              onPress={() => router.push({ pathname: "/live", params: { id: party.id } })}
              last={index === elsewhere.length - 1}
            />
          ))}
        </View>
      ) : null}

      {view === "mine" && crews.length > 1 ? (
        <ScrollView key="switcher" horizontal showsHorizontalScrollIndicator={false} style={styles.switcher} contentContainerStyle={styles.switcherChips}>
          {crews.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={c.id === selected?.id && !adding}
              onPress={() => {
                setSelectedId(c.id);
                setAdding(false);
              }}
            />
          ))}
          <Chip label={i18n.t("crewHub.add")} icon="plus" selected={adding} onPress={() => setAdding((on) => !on)} />
        </ScrollView>
      ) : null}

      {view === "mine" && crews.length === 0 ? (
        <Text key="none" muted>
          {i18n.t("crew.noCrew")}
        </Text>
      ) : null}
      {view === "mine" && showAdd && crews.length !== 1 ? addPanel : null}

      {view === "mine" && selected && !(adding && crews.length > 1) ? <CrewPage key={`page-${selected.id}`} crew={selected} upcoming={upcoming} /> : null}

      {/* One crew: no switcher, the way to a second one sits under the crew, and opens right there. */}
      {view === "mine" && crews.length === 1 ? (
        <Row
          key="add-another"
          title={i18n.t("crew.addAnother")}
          leading={<Icon name="plus" color={theme.textMuted} />}
          trailing={<Icon name={adding ? "arrowup" : "arrowdn"} color={theme.textMuted} />}
          onPress={() => setAdding((open) => !open)}
          last
        />
      ) : null}
      {view === "mine" && showAdd && crews.length === 1 ? addPanel : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  headerActions: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  actions: { flexDirection: "row", gap: 10 },
  section: { gap: space.blockGap },
  addBlock: { gap: space.blockGap },
  switcher: { marginHorizontal: -space.screenX },
  switcherChips: { gap: 8, paddingHorizontal: space.screenX, paddingVertical: 4 },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 10, lineHeight: 12 },
});
