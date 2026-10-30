import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { onLiveHint } from "@/server/liveHints";
import { useConsumePendingReferral } from "@/server/pendingReferral";
import { fetchNotices } from "@/server/profileData";
import { useT } from "@/i18n";
import { UpdateNotice } from "@/system/UpdateNotice";
import { ProfileFields, type ProfileDraft } from "@/profile/ProfileFields";
import { draftFromProfile, saveProfile } from "@/profile/saveProfile";
import { useAppStore } from "@/state/store";
import { fetchOperatorClaims } from "@/server/placeData";
import { useSession } from "@/server/session";
import { useTheme } from "@/theme";
import { Row } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { vaultClosed } from "@/vault/vault";

export default function MeScreen() {
  const i18n = useT();
  const theme = useTheme();
  const profile = useAppStore((state) => state.profile);
  const preferences = useAppStore((state) => state.preferences);
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromProfile(profile));
  // COM-11: the venue-claim queue shows only for the server's operators (the server answers 403 otherwise).
  const session = useSession((s) => s.session);
  const [operator, setOperator] = useState(false);
  useEffect(() => {
    if (!session) return setOperator(false);
    void fetchOperatorClaims()
      .then(() => setOperator(true))
      .catch(() => setOperator(false));
  }, [session]);
  // COM-08: moderation notices (statement of reasons), shown once there is at least one, kept live.
  const [notices, setNotices] = useState<{ count: number; unread: number }>({ count: 0, unread: 0 });
  const loadNotices = useCallback(() => {
    if (!useSession.getState().session) return;
    void fetchNotices()
      .then((data) => setNotices({ count: data.notices.length, unread: data.unread }))
      .catch(() => undefined);
  }, []);
  useFocusEffect(loadNotices);
  useEffect(() => onLiveHint((hint) => (hint === "moderation.notice" || hint === "open" ? loadNotices() : undefined)), [loadNotices]);
  // O-43: a referral link opened before the account existed is sent once connected.
  useConsumePendingReferral(i18n);

  const onProfileChange = (next: ProfileDraft) => {
    // ADP-06: the weight drives tonight's estimate, so it is not changed in the middle of a night.
    if (next.weightKg !== draft.weightKg && vaultClosed()) {
      showToast({ message: i18n.t("vault.weightLocked") });
      return;
    }
    setDraft(next);
    saveProfile(next, profile?.healthConsentAt ?? Date.now());
  };

  return (
    <Screen title={i18n.t("profile.title")} withToasts>
      <UpdateNotice />
      <Text variant="label">{i18n.t("profile.body")}</Text>
      <ProfileFields draft={draft} onChange={onProfileChange} />

      <Row
        title={i18n.t("people.myProfile")}
        leading={<Icon name="user" color={theme.textMuted} />}
        trailing={<Icon name="chev" color={theme.textMuted} />}
        onPress={() => router.push({ pathname: "/profile", params: { id: "me" } })}
      />
      <Row
        title={i18n.t("people.myFriends")}
        leading={<Icon name="users" color={theme.textMuted} />}
        trailing={<Icon name="chev" color={theme.textMuted} />}
        onPress={() => router.push("/friends")}
      />
      {notices.count ? (
        <Row
          title={i18n.t("people.notices")}
          subtitle={notices.unread ? i18n.plural("people.noticesNew", notices.unread) : undefined}
          leading={<Icon name="flag" color={notices.unread ? theme.danger : theme.textMuted} />}
          trailing={<Icon name="chev" color={theme.textMuted} />}
          onPress={() => router.push("/notices")}
        />
      ) : null}
      <Row
        title={i18n.t("myStats.title")}
        leading={<Icon name="trophy" color={theme.textMuted} />}
        trailing={<Icon name="chev" color={theme.textMuted} />}
        onPress={() => router.push("/my-stats")}
      />
      {/* O-76: the morning-after alibi, any day. */}
      <Row
        title={i18n.t("morning.alibi")}
        leading={<Icon name="x:sparkle" color={theme.textMuted} />}
        trailing={<Icon name="chev" color={theme.textMuted} />}
        onPress={() => router.push("/alibi")}
      />
      <Row
        title={i18n.t("privacy.open")}
        leading={<Icon name="shield" color={theme.textMuted} />}
        trailing={<Icon name="chev" color={theme.textMuted} />}
        onPress={() => router.push("/privacy")}
      />
      <Row
        title={i18n.t("settings.open")}
        subtitle={`${i18n.t(`languages.${preferences.language}`)}, ${i18n.t(`countries.${preferences.legalCountry}` as "countries.FR")}, ${i18n.t(`units.${preferences.bacUnit}`)}`}
        leading={<Icon name="gear" color={theme.textMuted} />}
        trailing={<Icon name="chev" color={theme.textMuted} />}
        onPress={() => router.push("/settings")}
        last={!operator}
      />
      {operator ? (
        <Row
          title={i18n.t("place.operatorTitle")}
          leading={<Icon name="flag" color={theme.textMuted} />}
          trailing={<Icon name="chev" color={theme.textMuted} />}
          onPress={() => router.push("/operator")}
          last
        />
      ) : null}
    </Screen>
  );
}
