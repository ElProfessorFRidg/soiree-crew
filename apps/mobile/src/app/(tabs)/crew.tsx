import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "react-native-qrcode-svg";
import { Platform, ScrollView, Share, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { duration, palette, space } from "@crew/design-tokens";
import { ConnectServer } from "@/crew/ConnectServer";
import { Field } from "@/crew/Field";
import { crewErrorMessage, inviteCodeFrom, parseInviteQr } from "@/crew/invite";
import { QrScanner } from "@/crew/LinkScanner";
import { moodIcon } from "@/crew/moods";
import { distinctLabels, NICKNAME_MAX } from "@/crew/names";
import { bringCrew, decideJoinRequest, refreshInvitations, setNickname, useInvitations, type JoinRequest } from "@/server/socialData";
import { RadarSection } from "@/crew/RadarSection";
import { SosBanner } from "@/crew/SosBanner";
import { useT, type Translator } from "@/i18n";
import { flyHero, HeroSource } from "@/motion/hero";
import { formatClock } from "@/i18n/format";
import { haptic } from "@/motion/haptics";
import { acceptInvite, createCrew, createInvite, CREW_KINDS, fetchOpenCrews, joinOpenCrew, leaveCrew, refreshCrews, refreshParties, respondToParty, useCrewData, type Crew, type CrewKind, type OpenCrew, type Party } from "@/server/crewData";
import { useSession } from "@/server/session";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button, IconButton } from "@/ui/Button";
import { Chip, Panel, Row, Segmented, Tag } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { LiveDot } from "@/ui/LiveDot";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { guarded } from "@/vault/vault";
import { useDraft } from "@/state/drafts";
import { usePendingInvite } from "@/server/pendingInvite";
import { ScalePressable } from "@/ui/Pressable";
import { refreshRadar } from "@/server/radarData";
import { StartHereBanner } from "@/crew/StartHereBanner";
import { addPartyToCalendar } from "@/crew/calendar";
import { CalendarSubscribe } from "@/crew/CalendarSubscribe";
import { showFailure } from "@/server/errors";
import { confirmAction } from "@/ui/confirm";
import { useCopy } from "@/ui/Copyable";
import { useLevelNow } from "@/state/levelNow";

function partyWhen(party: Party, i18n: Translator, hourCycle: "h12" | "h23"): string {
  const day = new Intl.DateTimeFormat(i18n.locale, { weekday: "long", day: "numeric", month: "long" }).format(new Date(party.startsAt));
  return `${day}, ${formatClock(party.startsAt, i18n.language, hourCycle)}`;
}

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
          <View style={styles.kinds}>
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

/** QOL-11: the crew names its members. Anyone in the crew can give, change or remove a nickname. */
function Nicknames({ crew, labels }: { crew: Crew; labels: Map<string, string> }) {
  const i18n = useT();
  const me = useSession((state) => state.session?.userId);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const nameOf = (id: string | null | undefined) => (id ? (id === me ? i18n.t("crew.you") : (labels.get(id) ?? "?")) : "?");
  const save = (memberId: string, value: string | null) => {
    setSaving(memberId);
    setNickname(crew.id, memberId, value)
      .then(() => {
        haptic.confirmed();
        setDrafts(({ [memberId]: _done, ...rest }) => rest);
      })
      .catch(showFailure(i18n))
      .finally(() => setSaving(null));
  };
  return (
    <Animated.View entering={FadeIn.duration(duration.enter)} style={styles.nicknames}>
      <Text variant="small">{i18n.t("crew.nicknamesHint")}</Text>
      {crew.members.map((member) => {
        const draft = drafts[member.id];
        const changed = draft !== undefined && draft.trim() !== (member.nickname ?? "");
        return (
          <View key={member.id} style={styles.nicknameRow}>
            <Avatar personId={member.id} name={labels.get(member.id) ?? member.displayName} size={34} />
            <View style={styles.flex}>
              <Field
                label={i18n.t("crew.nicknameFor", { name: member.displayName })}
                placeholder={member.displayName}
                value={draft ?? member.nickname ?? ""}
                onChangeText={(text) => setDrafts((d) => ({ ...d, [member.id]: text }))}
                maxLength={NICKNAME_MAX}
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => (changed ? save(member.id, (draft ?? "").trim() || null) : undefined)}
              />
              {member.nickname && member.nicknameSetBy ? <Text variant="small">{i18n.t("crew.nicknameBy", { name: nameOf(member.nicknameSetBy) })}</Text> : null}
            </View>
            {changed ? (
              <Button label={i18n.t("crew.nicknameSave")} variant="secondary" height={40} loading={saving === member.id} onPress={() => save(member.id, (draft ?? "").trim() || null)} />
            ) : member.nickname ? (
              <IconButton icon="x" accessibilityLabel={i18n.t("crew.nicknameClear", { name: member.displayName })} onPress={() => save(member.id, null)} />
            ) : null}
          </View>
        );
      })}
    </Animated.View>
  );
}

function CrewCard({ crew }: { crew: Crew }) {
  const i18n = useT();
  const theme = useTheme();
  const me = useSession((state) => state.session?.userId);
  const mentions = useInvitations((state) => state.mentions[crew.id] ?? 0);
  // QOL-11: two « Lucas » in one crew read « Lucas » and « Lucas 2 », the same on every phone.
  const labels = useMemo(() => distinctLabels(crew.members), [crew.members]);
  const [invite, setInvite] = useState<{ code: string; url: string } | null>(null);
  const [inviting, setInviting] = useState(false);
  const copyCode = useCopy();
  const level = useLevelNow((state) => state.level);
  const [naming, setNaming] = useState(false);

  // O-36: the invite shows as a QR to scan on the spot, with the code and the link to share.
  const onInvite = async () => {
    if (invite) {
      setInvite(null);
      return;
    }
    setInviting(true);
    try {
      setInvite(await createInvite(crew.id));
      haptic.select();
    } catch (error) {
      showToast({ tone: "danger", message: crewErrorMessage(error, i18n) });
    } finally {
      setInviting(false);
    }
  };

  const onLeave = () => {
    void confirmAction({ title: i18n.t("crew.leaveConfirm", { crew: crew.name }), confirmLabel: i18n.t("crew.leave"), cancelLabel: i18n.t("crew.leaveKeep") }).then((ok) => {
      if (!ok) return;
      const ran = guarded({ kind: "leaveCrew", crewId: crew.id, crewName: crew.name }, () =>
        void leaveCrew(crew.id).catch((error: unknown) => showToast({ tone: "danger", message: crewErrorMessage(error, i18n) })),
      );
      if (!ran) showToast({ message: i18n.t("vault.queued") });
    });
  };

  return (
    <Panel>
      <StartHereBanner crew={crew} />
      <View style={styles.crewHead}>
        <View style={styles.flex}>
          <Text variant="h2">{crew.name}</Text>
          <Text variant="small">{`${i18n.t(`crew.kinds.${crew.kind ?? "friends"}`)}, ${i18n.plural("crew.members", crew.members.length)}`}</Text>
        </View>
        {crew.open ? <Tag tone="ok" label={i18n.t("crew.openTag")} /> : null}
        {crew.role === "admin" ? <Tag label={i18n.t("crew.admin")} /> : null}
      </View>

      <View style={styles.members}>
        {crew.members.map((member) => {
          const label = labels.get(member.id) ?? member.displayName;
          return (
            <ScalePressable
              key={member.id}
              style={styles.member}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => {
                flyHero(`avatar:${member.id}`);
                router.push({ pathname: "/profile", params: { id: member.id === me ? "me" : member.id } });
              }}
            >
              <HeroSource heroKey={`avatar:${member.id}`} node={<Avatar personId={member.id} name={label} />}>
                <Avatar personId={member.id} name={label} />
              </HeroSource>
              <Text variant="tab" align="center" numberOfLines={2}>
                {member.id === me ? i18n.t("crew.you") : label}
              </Text>
            </ScalePressable>
          );
        })}
      </View>
      {/* One scrolling row instead of a list of links (Radar board). */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chips}>
        {(
          [
            ["money.pools", "euro", () => router.push({ pathname: "/money", params: { crewId: crew.id } })],
            ["feed.title", "bell", () => router.push({ pathname: "/feed", params: { crewId: crew.id } })],
            ["polls.title", "cal", () => router.push({ pathname: "/polls", params: { crewId: crew.id } })],
            ["crewStats.open", "trophy", () => router.push({ pathname: "/crew-stats", params: { crewId: crew.id } })],
            ["recap.list", "sparkdot", () => router.push("/recaps")],
            ["stickers.title", "image", () => router.push({ pathname: "/stickers", params: { crewId: crew.id } })],
            ["crew.nicknames", "edit", () => setNaming((on) => !on)],
            ...(crew.role === "admin" ? ([["people.reports", "flag", () => router.push({ pathname: "/reports", params: { crewId: crew.id } })]] as const) : []),
          ] as const
        ).map(([key, icon, go]) =>
          // N-31: an unseen mention in the feed puts a marker on its chip.
          key === "feed.title" && mentions > 0 ? (
            <View key={key}>
              <Chip label={`${i18n.t(key)}, ${i18n.plural("crew.mentionsMarker", mentions)}`} icon={icon} onPress={go} />
              <View pointerEvents="none" style={[styles.marker, { backgroundColor: theme.danger, borderColor: theme.surface }]} />
            </View>
          ) : (
            <Chip key={key} label={i18n.t(key)} icon={icon} selected={key === "crew.nicknames" && naming} onPress={go} />
          ),
        )}
      </ScrollView>
      {naming ? <Nicknames crew={crew} labels={labels} /> : null}
      {invite ? (
        <Animated.View entering={FadeIn.duration(duration.enter)} style={styles.invitePanel}>
          <View style={[styles.qr, { backgroundColor: palette.dark.text }]}>
            <QRCode value={invite.url} size={168} backgroundColor={palette.dark.text} color={palette.accent.onAccent} />
          </View>
          <Text variant="small" align="center">
            {i18n.t("crew.inviteQrHint")}
          </Text>
          <View style={styles.inviteRow}>
            {/* QOL-19: the code copies on a long press too, with the same haptic and "Copied". */}
            <Text style={styles.flex} selectable onLongPress={() => copyCode.copy(invite.code)} accessibilityHint={i18n.t("common.copyHint")}>
              {i18n.t("crew.inviteCodeIs", { code: invite.code })}
            </Text>
            <Button
              label={copyCode.copied ? i18n.t("crew.copied") : i18n.t("crew.copyCode")}
              variant="secondary"
              height={level >= 2 ? 56 : 40}
              onPress={() => copyCode.copy(invite.code)}
            />
          </View>
          <Button
            label={i18n.t("crew.shareLink")}
            icon="share"
            variant="outline"
            height={44}
            onPress={() => void Share.share({ message: i18n.t("crew.inviteShare", { crew: crew.name, url: invite.url }) }).catch(() => undefined)}
          />
        </Animated.View>
      ) : null}
      <CalendarSubscribe crewId={crew.id} />
      <Button label={invite ? i18n.t("crew.inviteHide") : i18n.t("crew.invite")} icon={invite ? "x" : "qr"} height={48} loading={inviting} onPress={() => void onInvite()} />
      <Button label={i18n.t("crew.leave")} variant="outline" height={40} onPress={onLeave} />
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
  const [crewName, setCrewName, clearCrewName] = useDraft("crew:name");
  const [crewKind, setCrewKind] = useState<CrewKind>("friends");
  // Several crews: the radar shows one at a time, picked here.
  const [radarCrew, setRadarCrew] = useState<string | null>(null);
  const radarId = crews.find((c) => c.id === radarCrew)?.id ?? crews[0]?.id;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [addOpen, setAddOpen] = useState(false);
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
        <ConnectServer />
      </Screen>
    );
  }

  const now = Date.now();
  const crewNameOf = (id: string) => crews.find((c) => c.id === id)?.name ?? "";
  // COM-05: a guest card stays while its crew can still be brought along.
  const invitations = parties.filter((p) => p.closedAt === null && p.endsAt > now && (p.myResponse !== "going" || (p.guest?.mayBringCrew ?? false)));
  const going = parties.filter((p) => p.closedAt === null && p.endsAt > now && p.myResponse === "going" && !invitations.includes(p));
  const subtitleOf = (party: Party) => (party.guest ? i18n.t("crew.guestInvite", { name: party.guest.invitedBy ?? "?" }) : crewNameOf(party.crewId));

  return (
    <Screen
      title={i18n.t("crew.tab")}
      trailing={
        <View style={styles.headerActions}>
          <IconButton icon="chat" accessibilityLabel={i18n.t("chat.title")} onPress={() => router.push("/messages")} />
          <IconButton icon="search" accessibilityLabel={i18n.t("search.title")} onPress={() => router.push("/search")} />
        </View>
      }
      withToasts
      onRefresh={() => Promise.all([refreshCrews(), refreshParties(), ...crews.map((c) => refreshRadar(c.id))])}
    >
      <SosBanner />
      {crews.length > 1 ? (
        <View style={styles.kinds}>
          {crews.map((c) => (
            <Chip key={c.id} label={c.name} selected={c.id === radarId} onPress={() => setRadarCrew(c.id)} />
          ))}
        </View>
      ) : null}
      {radarId ? <RadarSection crewId={radarId} /> : null}
      {invitations.length ? (
        <>
          <Text variant="label">{i18n.t("crew.invitations")}</Text>
          {invitations.map((party) => (
            <InvitationCard key={party.id} party={party} crewName={crewNameOf(party.crewId)} />
          ))}
        </>
      ) : null}
      {joinRequests.length ? (
        <>
          <Text variant="label">{i18n.t("crew.joinRequests")}</Text>
          {joinRequests.map((request) => (
            <JoinRequestCard key={`${request.partyId}-${request.userId}`} request={request} />
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
              subtitle={`${subtitleOf(party)}, ${partyWhen(party, i18n, hourCycle)}`}
              leading={party.live ? <LiveDot size={10} /> : <Icon name={moodIcon(party.mood)} color={theme.textMuted} />}
              trailing={
                !party.live && Platform.OS !== "web" ? (
                  <IconButton icon="cal" accessibilityLabel={i18n.t("crew.addToCalendar")} onPress={() => void addPartyToCalendar(party, crewNameOf(party.crewId), i18n)} />
                ) : (
                  <Icon name="chev" color={theme.textMuted} />
                )
              }
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

      {crews.length ? (
        <Row
          title={i18n.t("crew.addAnother")}
          leading={<Icon name="plus" color={theme.textMuted} />}
          trailing={<Icon name={addOpen ? "arrowup" : "arrowdn"} color={theme.textMuted} />}
          onPress={() => setAddOpen((open) => !open)}
          last
        />
      ) : null}
      {!crews.length || addOpen ? (
        <Animated.View entering={FadeIn.duration(duration.enter)} style={styles.addBlock}>
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
            <QrScanner
              label={i18n.t("crew.scanQr")}
              hint={i18n.t("crew.scanQrHint")}
              parse={parseInviteQr}
              onScan={(found) => router.push({ pathname: "/join", params: { code: found.code, server: found.server ?? session.url } })}
            />
            <Button
              label={i18n.t("crew.pasteInvite")}
              variant="outline"
              icon="link"
              height={44}
              onPress={() =>
                void Clipboard.getStringAsync().then((text) => {
                  // QOL-29: a friend who installed from a link pastes it here; the code is taken from the link or as typed.
                  const found = inviteCodeFrom(text);
                  if (found) setCode(found);
                  else showToast({ message: i18n.t("crew.pasteNothing") });
                })
              }
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
                  .catch((error: unknown) => showToast({ tone: "danger", message: crewErrorMessage(error, i18n) }))
                  .finally(() => setBusy(null));
              }}
            />
          </Panel>

          <Panel>
            <Field label={i18n.t("crew.newCrew")} placeholder={i18n.t("crew.crewName")} value={crewName} onChangeText={setCrewName} maxLength={40} />
            <View style={styles.kinds}>
              {CREW_KINDS.map((k) => (
                <Chip key={k} label={i18n.t(`crew.kinds.${k}`)} selected={crewKind === k} onPress={() => setCrewKind(k)} />
              ))}
            </View>
            <Button
              label={i18n.t("crew.create")}
              variant="secondary"
              height={44}
              disabled={!crewName.trim()}
              loading={busy === "create"}
              onPress={() => {
                setBusy("create");
                createCrew(crewName.trim(), crewKind)
                  .then(() => {
                    haptic.confirmed();
                    clearCrewName();
                  })
                  .catch((error: unknown) => showToast({ tone: "danger", message: crewErrorMessage(error, i18n) }))
                  .finally(() => setBusy(null));
              }}
            />
          </Panel>
        </Animated.View>
      ) : null}
      <OpenCrews />
    </Screen>
  );
}

/** Open crews on this server (a student union, a club): join without an invite. */
function OpenCrews() {
  const i18n = useT();
  const [q, setQ] = useState("");
  const [list, setList] = useState<OpenCrew[] | null>(null);
  useEffect(() => {
    const id = setTimeout(() => {
      void fetchOpenCrews(q.trim())
        .then((r) => setList(r.crews))
        .catch(() => setList(null));
    }, 300);
    return () => clearTimeout(id);
  }, [q]);
  // Shown only where there is something to join: a private server keeps the tab as it was.
  if (!list || (!list.length && !q)) return null;
  return (
    <Panel>
      <Text variant="label">{i18n.t("crew.openTitle")}</Text>
      <Field label={i18n.t("crew.openSearch")} value={q} onChangeText={setQ} maxLength={40} />
      {list.length === 0 ? <Text variant="small">{i18n.t("crew.openNone")}</Text> : null}
      {list.map((c, index) => (
        <Row
          key={c.id}
          title={c.name}
          subtitle={[i18n.t(`crew.kinds.${c.kind}`), i18n.plural("crew.members", c.members), c.description].filter(Boolean).join(", ")}
          trailing={
            <Button
              label={i18n.t("crew.join")}
              variant="secondary"
              height={40}
              onPress={() =>
                void joinOpenCrew(c.id)
                  .then(() => {
                    haptic.confirmed();
                    setList((l) => l?.filter((x) => x.id !== c.id) ?? null);
                  })
                  .catch(showFailure(i18n))
              }
            />
          }
          last={index === list.length - 1}
        />
      ))}
    </Panel>
  );
}

const styles = StyleSheet.create({
  kinds: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  headerActions: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
  crewHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  members: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  member: { width: 60, alignItems: "center", gap: 4 },
  inviteRow: { flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "stretch" },
  invitePanel: { alignItems: "center", gap: 10 },
  qr: { width: 192, height: 192, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  nicknames: { gap: 12 },
  nicknameRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  marker: { position: "absolute", top: -2, right: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  actions: { flexDirection: "row", gap: 10 },
  chipRow: { marginHorizontal: -space.cardPadding },
  chips: { gap: 8, paddingHorizontal: space.cardPadding, paddingVertical: 4 },
  addBlock: { gap: space.blockGap },
});
