import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { duration } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { useTheme } from "@/theme";
import { Panel, Row, Switch } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Text } from "@/ui/Text";

/**
 * SEC-08: the health-data consent, before any body data is typed. The switch says exactly what is
 * accepted, the panel says what it unlocks, and the person can go on without it.
 */
export function ConsentPanel({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  const i18n = useT();
  const theme = useTheme();
  return (
    <>
      <Text muted>{i18n.t("onboarding.consentUnlocks")}</Text>
      <Panel>
        <Text variant="h3">{i18n.t("onboarding.consentHealth")}</Text>
        <View style={styles.switchRow}>
          <Text style={styles.flex}>{i18n.t("onboarding.consentSwitch")}</Text>
          <Switch value={value} onValueChange={onChange} accessibilityLabel={i18n.t("onboarding.consentSwitch")} />
        </View>
        <Text variant="small">{i18n.t("onboarding.consentHealthBody")}</Text>
      </Panel>
      {value ? null : (
        <Animated.View entering={FadeIn.duration(duration.enter)} exiting={FadeOut.duration(duration.toastIn)}>
          <Text variant="small">{i18n.t("onboarding.consentWithout")}</Text>
        </Animated.View>
      )}
      <Row
        title={i18n.t("onboarding.consentPrivacy")}
        leading={<Icon name="shield" color={theme.textMuted} />}
        trailing={<Icon name="chev" color={theme.textMuted} />}
        onPress={() => router.push("/privacy")}
        last
      />
    </>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  flex: { flex: 1 },
});
