import { router } from "expo-router";
import { useMemo, useState } from "react";
import QRCode from "react-native-qrcode-svg";
import { ScrollView, Share, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { duration, palette, space } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { flyHero, HeroSource } from "@/motion/hero";
import { haptic } from "@/motion/haptics";
import { CREW_CATEGORIES, CREW_CITY_MAX, CREW_DESCRIPTION_MAX, createInvite, deleteCrew, leaveCrew, updateCrew, type Crew, type CrewCategory } from "@/server/crewData";
import { showFailure } from "@/server/errors";
import { useSession } from "@/server/session";
import { setNickname, useInvitations } from "@/server/socialData";
import { useLevelNow } from "@/state/levelNow";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button, IconButton } from "@/ui/Button";
import { confirmAction } from "@/ui/confirm";
import { useCopy } from "@/ui/Copyable";
import { Chip, Panel, Segmented, Tag } from "@/ui/controls";
import { ScalePressable } from "@/ui/Pressable";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { guarded } from "@/vault/vault";
import { CalendarSubscribe } from "./CalendarSubscribe";
import { CrewCelebration } from "./Celebration";
import { Field } from "./Field";
import { crewErrorMessage } from "./invite";
import { distinctLabels, NICKNAME_MAX } from "./names";
import { StartHereBanner } from "./StartHereBanner";

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
              <Button label={i18n.t("crew.nicknameSave")} variant="secondary" height={44} loading={saving === member.id} onPress={() => save(member.id, (draft ?? "").trim() || null)} />
            ) : member.nickname ? (
              <IconButton icon="x" accessibilityLabel={i18n.t("crew.nicknameClear", { name: member.displayName })} onPress={() => save(member.id, null)} />
            ) : null}
          </View>
        );
      })}
    </Animated.View>
  );
}

/**
 * Admins only (the server checks it too): public or private, and what the listing says about the
 * crew. Private takes the crew out of the listing at once; the details wait for "Enregistrer".
 */
function ListingSettings({ crew }: { crew: Crew }) {
  const i18n = useT();
  const open = Boolean(crew.open);
  const [category, setCategory] = useState<CrewCategory | null>(crew.category ?? null);
  const [city, setCity] = useState(crew.city ?? "");
  const [description, setDescription] = useState(crew.description ?? "");
  const [saving, setSaving] = useState(false);
  const changed = category !== (crew.category ?? null) || city.trim() !== (crew.city ?? "") || description.trim() !== (crew.description ?? "");

  const setOpen = (next: boolean) => {
    updateCrew(crew.id, { open: next })
      .then(() => {
        haptic.confirmed();
        showToast({ message: next ? i18n.t("crewHub.nowPublic") : i18n.t("crewHub.nowPrivate") });
      })
      .catch(showFailure(i18n));
  };
  const save = () => {
    setSaving(true);
    updateCrew(crew.id, { category, city: city.trim() || null, description: description.trim() })
      .then(() => {
        haptic.confirmed();
        showToast({ message: i18n.t("crewHub.listingSaved") });
      })
      .catch(showFailure(i18n))
      .finally(() => setSaving(false));
  };

  return (
    <View style={styles.listing}>
      <Segmented<"public" | "private">
        accessibilityLabel={i18n.t("arrival.visibility")}
        value={open ? "public" : "private"}
        items={[
          { value: "private", label: i18n.t("arrival.private") },
          { value: "public", label: i18n.t("arrival.public") },
        ]}
        onChange={(next) => setOpen(next === "public")}
      />
      <Text variant="small">{open ? i18n.t("arrival.publicHint") : i18n.t("arrival.privateHint")}</Text>
      {open ? (
        <Animated.View entering={FadeIn.duration(duration.enter)} style={styles.listing}>
          <Text variant="label">{i18n.t("arrival.categoryLabel")}</Text>
          <View style={styles.wrap}>
            {CREW_CATEGORIES.map((c) => (
              <Chip key={c} label={i18n.t(`arrival.categories.${c}`)} selected={category === c} onPress={() => setCategory(category === c ? null : c)} />
            ))}
          </View>
          <Field label={i18n.t("crewHub.city")} value={city} onChangeText={setCity} maxLength={CREW_CITY_MAX} textContentType="addressCity" autoComplete="postal-address-locality" returnKeyType="next" />
          <Field
            label={i18n.t("crewHub.description")}
            placeholder={i18n.t("crewHub.descriptionPlaceholder")}
            value={description}
            onChangeText={setDescription}
            maxLength={CREW_DESCRIPTION_MAX}
            returnKeyType="done"
            blurOnSubmit
          />
          {changed ? <Button label={i18n.t("common.save")} variant="secondary" height={44} loading={saving} onPress={save} /> : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

/** One crew: members, nicknames, its screens, the invite, and for admins the public listing. */
export function CrewCard({ crew }: { crew: Crew }) {
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

  /** ADP-06: deleting the crew for everyone waits for the morning when the estimate is high. */
  const onDelete = () => {
    void confirmAction({
      title: i18n.t("crew.deleteConfirm", { crew: crew.name }),
      body: i18n.t("crew.deleteBody"),
      confirmLabel: i18n.t("crew.delete"),
      cancelLabel: i18n.t("crew.leaveKeep"),
      destructive: true,
    }).then((ok) => {
      if (!ok) return;
      const ran = guarded({ kind: "deleteCrew", crewId: crew.id, crewName: crew.name }, () =>
        void deleteCrew(crew.id).catch((error: unknown) => showToast({ tone: "danger", message: crewErrorMessage(error, i18n) })),
      );
      if (!ran) showToast({ message: i18n.t("vault.queued") });
    });
  };

  const details = [i18n.t(`crew.kinds.${crew.kind ?? "friends"}`), crew.city, i18n.plural("crew.members", crew.members.length)].filter(Boolean).join(" · ");

  return (
    <Panel>
      <StartHereBanner crew={crew} />
      <View style={styles.crewHead}>
        <View style={styles.flex}>
          <Text variant="h2">{crew.name}</Text>
          <Text variant="small">{details}</Text>
        </View>
        {crew.open ? <Tag tone="ok" label={i18n.t("arrival.public")} /> : null}
        {crew.role === "admin" ? <Tag label={i18n.t("crew.admin")} /> : null}
      </View>
      {crew.description ? <Text variant="small">{crew.description}</Text> : null}
      {/* JOY-08: a milestone, anniversary or first conquest celebrated once, here. */}
      <CrewCelebration crewId={crew.id} />

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
            ["recap.list", "x:sparkle", () => router.push("/recaps")],
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
      {crew.role === "admin" ? <ListingSettings key={crew.id} crew={crew} /> : null}
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
              height={level >= 2 ? 56 : 44}
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
      <Button label={i18n.t("crew.leave")} variant="outline" height={44} onPress={onLeave} />
      {crew.role === "admin" ? <Button label={i18n.t("crew.delete")} variant="outline" height={44} onPress={onDelete} /> : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  crewHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  members: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  member: { width: 60, alignItems: "center", gap: 4 },
  inviteRow: { flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "stretch" },
  invitePanel: { alignItems: "center", gap: 10 },
  qr: { width: 192, height: 192, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  nicknames: { gap: 12 },
  nicknameRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  marker: { position: "absolute", top: -2, right: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  chipRow: { marginHorizontal: -space.cardPadding },
  chips: { gap: 8, paddingHorizontal: space.cardPadding, paddingVertical: 4 },
  listing: { gap: 10 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
