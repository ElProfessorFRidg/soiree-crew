import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { CHANNEL_ICONS } from "@/notify/channels";
import { CHANNELS, NOTIFICATION_KINDS, isKind, type Channel, type NotificationKind } from "@/notify/inbox";
import { REMOTE_PUSH } from "@/notify/remote";
import { api } from "@/server/api";
import { showFailure } from "@/server/errors";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Panel, Row, Switch } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

interface Settings {
  kinds: { kind: string; channel: string; safety: boolean; on: boolean }[];
  mutedParties: { partyId: string; name: string; until: number }[];
}

/** N-35: per-type switches, grouped by the six channels (QOL-30), and the parties muted for now. */
export default function NotificationSettingsScreen() {
  const i18n = useT();
  const theme = useTheme();
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const [settings, setSettings] = useState<Settings | null>(null);
  const offline = showFailure(i18n);

  const load = () => api<Settings>("/v1/notifications/settings").then(setSettings);
  useEffect(() => {
    void load().catch(offline);
  }, []);

  const toggle = (kind: NotificationKind, on: boolean) => {
    if (!settings) return;
    const before = settings;
    // Optimistic: the switch moves at once and comes back if the server refuses.
    setSettings({ ...settings, kinds: settings.kinds.map((k) => (k.kind === kind ? { ...k, on } : k)) });
    api("/v1/notifications/settings", { method: "PUT", body: { types: { [kind]: on } } }).catch((error: unknown) => {
      setSettings(before);
      offline(error);
    });
  };

  const unmute = (partyId: string) => {
    if (!settings) return;
    setSettings({ ...settings, mutedParties: settings.mutedParties.filter((m) => m.partyId !== partyId) });
    api(`/v1/parties/${partyId}/mute`, { method: "DELETE" }).catch((error: unknown) => {
      offline(error);
      void load().catch(() => undefined);
    });
  };

  const byChannel = (channel: Channel) =>
    (settings?.kinds ?? []).filter((k): k is Settings["kinds"][number] & { kind: NotificationKind } => k.channel === channel && isKind(k.kind)).sort(
      (a, b) => NOTIFICATION_KINDS.indexOf(a.kind) - NOTIFICATION_KINDS.indexOf(b.kind),
    );

  return (
    <Screen back title={i18n.t("notify.settingsOpen")} withToasts onRefresh={load}>
      <Text variant="small">{i18n.t("notify.settingsHint")}</Text>
      {REMOTE_PUSH ? null : <Text variant="small">{i18n.t("notify.pushOff")}</Text>}
      {settings
        ? CHANNELS.map((channel) => {
            const kinds = byChannel(channel);
            if (!kinds.length) return null;
            return (
              <View key={channel} style={styles.group}>
                <View style={styles.label}>
                  <Icon name={CHANNEL_ICONS[channel]} size={18} color={theme.textMuted} />
                  <Text variant="label">{i18n.t(`notify.channels.${channel}`)}</Text>
                </View>
                <Panel>
                  {kinds.map((k) => (
                    <View key={k.kind} style={styles.switchRow}>
                      <View style={styles.flex}>
                        <Text variant="h3">{i18n.t(`notify.kinds.${k.kind}`)}</Text>
                        {k.safety ? <Text variant="small">{i18n.t("notify.safetyLocked")}</Text> : null}
                      </View>
                      <Switch value={k.on} disabled={k.safety} onValueChange={(on) => toggle(k.kind, on)} accessibilityLabel={i18n.t(`notify.kinds.${k.kind}`)} />
                    </View>
                  ))}
                </Panel>
              </View>
            );
          })
        : null}
      {settings?.mutedParties.length ? (
        <View style={styles.group}>
          <Text variant="label">{i18n.t("notify.mutedParties")}</Text>
          <Panel>
            {settings.mutedParties.map((m, index) => (
              <Row
                key={m.partyId}
                title={m.name}
                subtitle={i18n.t("notify.mutedUntil", { time: formatClock(m.until, i18n.language, hourCycle) })}
                trailing={<Button label={i18n.t("notify.unmute")} variant="outline" height={40} onPress={() => unmute(m.partyId)} />}
                last={index === settings.mutedParties.length - 1}
              />
            ))}
          </Panel>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  label: { flexDirection: "row", alignItems: "center", gap: 8 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  flex: { flex: 1 },
});
