import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { duration } from "@crew/design-tokens";
import { COUNTRIES, countryRules, drivingLimit, formatBacValue, breathRatio, type BacUnit, type UiLanguage } from "@crew/units";
import { useT } from "@/i18n";
import { AccountSection } from "@/profile/AccountSection";
import { ProfileFields, type ProfileDraft } from "@/profile/ProfileFields";
import { draftFromProfile, saveProfile } from "@/profile/saveProfile";
import { useAppStore } from "@/state/store";
import { setPreferences } from "@/state/preferences";
import { useTheme } from "@/theme";
import { Chip, Panel, Row, Segmented, Switch } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { vaultClosed } from "@/vault/vault";

const ALL_UNITS: readonly BacUnit[] = [
  "g_per_l_blood",
  "mg_per_l_breath",
  "permille",
  "percent_bac",
  "mg_per_100ml_blood",
  "ug_per_100ml_breath",
  "ug_per_l_breath",
];

export default function MeScreen() {
  const i18n = useT();
  const theme = useTheme();
  const profile = useAppStore((state) => state.profile);
  const preferences = useAppStore((state) => state.preferences);
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromProfile(profile));
  const [pickingCountry, setPickingCountry] = useState(false);

  const rules = countryRules(preferences.legalCountry);
  const ratio = breathRatio(rules);
  const limitText = (gPerL: number) =>
    `${formatBacValue(gPerL, preferences.bacUnit, ratio, i18n.locale)} ${i18n.t(`units.${preferences.bacUnit}`)}`;
  const novice = drivingLimit(rules, "novice");
  const standard = drivingLimit(rules, "standard");

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
      <Text variant="label">{i18n.t("profile.body")}</Text>
      <ProfileFields draft={draft} onChange={onProfileChange} />

      <Text variant="label">{i18n.t("profile.rules")}</Text>
      <Panel>
        <Row
          title={i18n.t("profile.country")}
          subtitle={i18n.t(`countries.${preferences.legalCountry}` as "countries.FR")}
          trailing={<Icon name={pickingCountry ? "arrowup" : "arrowdn"} color={theme.textMuted} />}
          onPress={() => setPickingCountry((open) => !open)}
        />
        {pickingCountry ? (
          <Animated.View entering={FadeIn.duration(duration.enter)}>
            {Object.keys(COUNTRIES).map((code, index, list) => (
              <Row
                key={code}
                title={i18n.t(`countries.${code}` as "countries.FR")}
                trailing={code === preferences.legalCountry ? <Icon name="check" color={theme.amber} /> : null}
                onPress={() => {
                  const next = countryRules(code);
                  setPreferences({ legalCountry: code, bacUnit: next.bacUnits[0] ?? "g_per_l_blood", currency: next.currency });
                  setPickingCountry(false);
                }}
                last={index === list.length - 1}
              />
            ))}
          </Animated.View>
        ) : null}
        {!rules.verified ? <Text variant="small" color={theme.danger}>{i18n.t("profile.unverified")}</Text> : null}
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text variant="h3">{i18n.t("profile.novice")}</Text>
            {novice !== standard ? (
              <Text variant="small">{i18n.t("profile.noviceHint", { novice: limitText(novice), standard: limitText(standard) })}</Text>
            ) : null}
          </View>
          <Switch
            value={preferences.driverCategory === "novice"}
            onValueChange={(on) => setPreferences({ driverCategory: on ? "novice" : "standard" })}
            accessibilityLabel={i18n.t("profile.novice")}
          />
        </View>
      </Panel>

      <Panel>
        <Text variant="label">{i18n.t("profile.bacUnit")}</Text>
        <View style={styles.chips}>
          {ALL_UNITS.map((unit) => (
            <Chip
              key={unit}
              label={i18n.t(`units.${unit}`)}
              selected={unit === preferences.bacUnit}
              onPress={() => setPreferences({ bacUnit: unit })}
            />
          ))}
        </View>
        <Text variant="small">{i18n.t(`units.long.${preferences.bacUnit}`)}</Text>
      </Panel>

      <Panel>
        <Text variant="label">{i18n.t("profile.language")}</Text>
        <Segmented<UiLanguage>
          accessibilityLabel={i18n.t("profile.language")}
          value={preferences.language}
          items={[
            { value: "fr", label: i18n.t("languages.fr") },
            { value: "en", label: i18n.t("languages.en") },
          ]}
          onChange={(language) => setPreferences({ language })}
        />
      </Panel>
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
        title={i18n.t("settings.open")}
        leading={<Icon name="gear" color={theme.textMuted} />}
        trailing={<Icon name="chev" color={theme.textMuted} />}
        onPress={() => router.push("/settings")}
        last
      />
      <AccountSection />
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54 },
  flex: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
