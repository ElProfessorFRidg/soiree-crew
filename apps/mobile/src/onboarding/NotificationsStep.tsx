import { router } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import type { Translator } from "@/i18n";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { registerForPush } from "@/notify/push";
import { setPreferences } from "@/state/preferences";
import { useAppStore } from "@/state/store";
import { askPermission } from "@/system/askPermission";
import { openAppSettings } from "@/system/permissions";
import { useTheme } from "@/theme";
import { Panel, Row, Switch } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

/** O-03, QOL-20: what may ring, said before the phone asks. Water and limit need the health consent. */
export function NotificationsStep({ health }: { health: boolean }) {
  const i18n = useT();
  const theme = useTheme();
  const preferences = useAppStore((state) => state.preferences);
  const hour = (h: number) => formatClock(new Date(2026, 0, 1, h).getTime(), i18n.language, preferences.hourCycle);
  const rows = [
    ...(health
      ? ([
          ["settings.water", "onboarding.notifWater", preferences.waterReminderMinutes !== null, (on: boolean) => setPreferences({ waterReminderMinutes: on ? 45 : null })],
          ["settings.limit", "onboarding.notifLimit", preferences.warnNearLimit, (on: boolean) => setPreferences({ warnNearLimit: on })],
        ] as const)
      : []),
    ["settings.recap", "onboarding.notifRecap", preferences.notifyRecap, (on: boolean) => setPreferences({ notifyRecap: on })],
  ] as const;
  return (
    <>
      <Text variant="h1">{i18n.t("onboarding.notifTitle")}</Text>
      <Text muted>{i18n.t("onboarding.notifBody")}</Text>
      <Panel>
        {rows.map(([title, hint, value, onChange]) => (
          <View key={title} style={styles.switchRow}>
            <View style={styles.flex}>
              <Text variant="h3">{i18n.t(title)}</Text>
              <Text variant="small">{i18n.t(hint)}</Text>
            </View>
            <Switch value={value} onValueChange={onChange} accessibilityLabel={i18n.t(title)} />
          </View>
        ))}
      </Panel>
      {/* The row opens the setting it describes: the hours are changed in Settings, Notifications. */}
      <Row
        title={i18n.t("settings.quiet")}
        subtitle={i18n.t("onboarding.quietBody", { from: hour(preferences.quietFromHour), to: hour(preferences.quietToHour) })}
        leading={<Icon name="moon" color={theme.textMuted} />}
        trailing={<Icon name="chev" color={theme.textMuted} />}
        accessibilityLabel={`${i18n.t("settings.quiet")}, ${i18n.t("onboarding.quietChange")}`}
        onPress={() => router.push({ pathname: "/settings", params: { section: "notifications" } })}
        last
      />
      <Text variant="small">{i18n.t("onboarding.notifAsk")}</Text>
    </>
  );
}

/**
 * Continuing the notifications step: with at least one reminder on, the phone asks now, right after
 * the step said what will ring. A refusal says where to turn them on later and lets the flow go on.
 */
export async function askForReminders(i18n: Translator, signedIn: boolean): Promise<void> {
  const preferences = useAppStore.getState().preferences;
  const anyOn = preferences.waterReminderMinutes !== null || preferences.warnNearLimit || preferences.notifyRecap;
  if (!anyOn) return;
  const answer = await askPermission("notifications", null);
  if (answer.granted) {
    if (signedIn) void registerForPush().catch(() => undefined);
    return;
  }
  showToast({
    message: i18n.t("onboarding.notifRefused"),
    durationMs: 8_000,
    ...(Platform.OS === "web" ? {} : { action: { label: i18n.t("common.openSettings"), onPress: openAppSettings } }),
  });
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  flex: { flex: 1 },
});
