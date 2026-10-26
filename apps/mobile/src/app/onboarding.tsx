import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { duration } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { ProfileFields } from "@/profile/ProfileFields";
import { draftFromProfile, saveProfile } from "@/profile/saveProfile";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Panel, Switch } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

/** Legal drinking age of the country picked for the legal limit (O-02, decision D-04). */
function legalAge(country: string): number {
  return country.startsWith("US") ? 21 : 18;
}

export default function Onboarding() {
  const i18n = useT();
  const theme = useTheme();
  const country = useAppStore((state) => state.preferences.legalCountry);
  const ageConfirmed = useAppStore((state) => state.ageConfirmedAt !== null);
  const [refused, setRefused] = useState(false);
  const [draft, setDraft] = useState(() => draftFromProfile(useAppStore.getState().profile));
  const [consent, setConsent] = useState(false);
  const age = legalAge(country);

  if (!ageConfirmed) {
    return (
      <Screen>
        <Animated.View entering={FadeIn.duration(duration.enter).easing(easings.out)} style={styles.age}>
          <Text variant="h1">{i18n.t("onboarding.ageTitle", { age })}</Text>
          <Text muted>{i18n.t("onboarding.ageBody")}</Text>
          <Button
            label={i18n.t("onboarding.ageYes", { age })}
            height={64}
            onPress={() => {
              haptic.select();
              useAppStore.setState({ ageConfirmedAt: Date.now() });
            }}
          />
          <Button label={i18n.t("onboarding.ageNo")} variant="secondary" onPress={() => setRefused(true)} />
          {refused ? <Text color={theme.danger}>{i18n.t("onboarding.ageRefused", { age })}</Text> : null}
        </Animated.View>
      </Screen>
    );
  }

  return (
    <Screen
      title={i18n.t("onboarding.profileTitle")}
      footer={
        <Button
          label={i18n.t("onboarding.start")}
          height={56}
          disabled={!consent}
          onPress={() => {
            saveProfile(draft, Date.now());
            router.replace("/(tabs)");
          }}
        />
      }
    >
      <Text muted>{i18n.t("onboarding.profileBody")}</Text>
      {/* Consent comes before the health data is typed (SEC-08). */}
      <Panel>
        <View style={styles.consent}>
          <Text variant="h3" style={styles.flex}>
            {i18n.t("onboarding.consent")}
          </Text>
          <Switch value={consent} onValueChange={setConsent} accessibilityLabel={i18n.t("onboarding.consent")} />
        </View>
        <Text variant="small">{i18n.t("onboarding.consentHint")}</Text>
      </Panel>
      {consent ? <ProfileFields draft={draft} onChange={setDraft} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  age: { gap: 16, paddingTop: 80 },
  consent: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
});
