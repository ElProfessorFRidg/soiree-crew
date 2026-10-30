import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { radius } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { CHANNEL_ICONS, channelOf } from "@/notify/channels";
import { markRead, refreshInbox, useInbox } from "@/notify/inbox";
import { openItem } from "@/notify/push";
import { itemText } from "@/notify/text";
import { showFailure } from "@/server/errors";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Button, IconButton } from "@/ui/Button";
import { Panel, Row } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

/** N-35: the notification centre. Everything the server sent, newest first; tapping opens the exact item. */
export default function NotificationsScreen() {
  const i18n = useT();
  const theme = useTheme();
  const items = useInbox((state) => state.items);
  const unread = useInbox((state) => state.unread);
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const offline = showFailure(i18n);

  useEffect(() => {
    void refreshInbox().catch(offline);
    // Once on open; the live socket keeps it current afterwards.
  }, []);

  const today = new Date().toDateString();
  const when = (at: number) => {
    const clock = formatClock(at, i18n.language, hourCycle);
    if (new Date(at).toDateString() === today) return clock;
    return `${new Intl.DateTimeFormat(i18n.locale, { weekday: "short", day: "numeric", month: "short" }).format(new Date(at))}, ${clock}`;
  };

  return (
    <Screen
      back
      title={i18n.t("notify.title")}
      withToasts
      onRefresh={refreshInbox}
      trailing={<IconButton icon="gear" accessibilityLabel={i18n.t("notify.settingsOpen")} onPress={() => router.push("/notification-settings")} />}
    >
      {unread > 0 ? (
        <Button label={i18n.t("notify.markAllRead")} variant="outline" height={40} icon="check" onPress={() => void markRead("all").catch(offline)} />
      ) : null}
      {items.length === 0 ? (
        <Text muted>{i18n.t("notify.empty")}</Text>
      ) : (
        <Panel>
          {items.map((item, index) => {
            const fresh = item.readAt === null;
            const channel = channelOf(item.kind);
            return (
              <Row
                key={item.id}
                title={itemText(i18n, item)}
                subtitle={`${i18n.t(`notify.channels.${channel}`)}, ${when(item.at)}`}
                leading={<Icon name={CHANNEL_ICONS[channel]} color={fresh ? (channel === "safety" ? theme.danger : theme.amber) : theme.textMuted} />}
                trailing={fresh ? <View style={[styles.dot, { backgroundColor: theme.amber }]} /> : <Icon name="chev" color={theme.textMuted} />}
                onPress={() => openItem(item)}
                last={index === items.length - 1}
              />
            );
          })}
        </Panel>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dot: { width: 10, height: 10, borderRadius: radius.pill },
});
