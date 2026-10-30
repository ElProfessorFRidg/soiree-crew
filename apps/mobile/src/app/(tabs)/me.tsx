import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useT } from "@/i18n";
import { UpdateNotice } from "@/system/UpdateNotice";
import { EmergencyContact } from "@/profile/EmergencyContact";
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
      <EmergencyContact />

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
      <Row
        title={i18n.t("myStats.title")}
        leading={<Icon name="trophy" color={theme.textMuted} />}
        trailing={<Icon name="chev" color={theme.textMuted} />}
        onPress={() => router.push("/my-stats")}
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
