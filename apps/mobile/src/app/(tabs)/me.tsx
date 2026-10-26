import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { duration } from "@crew/design-tokens";
import { COUNTRIES, countryRules, drivingLimit, formatBacValue, breathRatio, type BacUnit, type UiLanguage } from "@crew/units";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { ProfileFields, type ProfileDraft } from "@/profile/ProfileFields";
import { draftFromProfile, saveProfile } from "@/profile/saveProfile";
import { useAppStore } from "@/state/store";
import { submit } from "@/sync/engine";
import type { UserPreferences } from "@crew/units";
import { useTheme } from "@/theme";
import { Chip, Panel, Row, Segmented, Switch } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

const ALL_UNITS: readonly BacUnit[] = [
  "g_per_l_blood",
  "mg_per_l_breath",
  "permille",
  "percent_bac",
  "mg_per_100ml_blood",
  "ug_per_100ml_breath",
  "ug_per_l_breath",
];

function setPreferences(patch: Partial<UserPreferences>) {
  const current = useAppStore.getState().preferences;
  const previous: Partial<UserPreferences> = {};
  for (const key of Object.keys(patch) as (keyof UserPreferences)[]) {
    (previous as Record<string, unknown>)[key] = current[key];
  }
  haptic.select();
  submit({ kind: "preferences.set", patch, previous });
}

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
    setDraft(next);
    saveProfile(next, profile?.healthConsentAt ?? Date.now());
  };

  return (
    <Screen title={i18n.t("profile.title")}>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54 },
  flex: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
