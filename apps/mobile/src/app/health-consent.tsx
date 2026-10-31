import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { duration } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { ConsentPanel } from "@/onboarding/ConsentPanel";
import { ProfileFields } from "@/profile/ProfileFields";
import { draftFromProfile, saveProfile } from "@/profile/saveProfile";
import { useAppStore } from "@/state/store";
import { Button } from "@/ui/Button";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

/**
 * SEC-08 after the arrival: someone who went on without the estimate gives the consent here, from
 * the Party screen, then the body profile the estimate needs. Nothing is stored before "Enregistrer".
 */
export default function HealthConsentScreen() {
  const i18n = useT();
  const [health, setHealth] = useState(false);
  const [draft, setDraft] = useState(() => draftFromProfile(useAppStore.getState().profile));
  return (
    <Screen
      back
      title={i18n.t("firstRun.consentScreenTitle")}
      withToasts
      footer={
        <Button
          label={i18n.t("firstRun.consentSave")}
          height={56}
          disabled={!health}
          onPress={() => {
            saveProfile(draft, Date.now());
            haptic.confirmed();
            router.back();
          }}
        />
      }
    >
      <ConsentPanel value={health} onChange={setHealth} />
      {health ? (
        <Animated.View entering={FadeIn.duration(duration.enter).easing(easings.out)} style={styles.profile}>
          <Text variant="h2">{i18n.t("onboarding.profileTitle")}</Text>
          <Text muted>{i18n.t("onboarding.profileBody")}</Text>
          <ProfileFields draft={draft} onChange={setDraft} />
        </Animated.View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { gap: 12 },
});
