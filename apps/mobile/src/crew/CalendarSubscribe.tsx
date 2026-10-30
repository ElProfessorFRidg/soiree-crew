import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { duration } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { fetchCalendarFeed, resetCalendarFeed, revokeCalendarFeed, webcalUrl } from "@/server/calendarData";
import { showFailure } from "@/server/errors";
import { Button } from "@/ui/Button";
import { Switch } from "@/ui/controls";
import { confirmAction } from "@/ui/confirm";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

/**
 * N-06: "Sync with my calendar" (Radar prototype, week screen). A private link per person and
 * crew that the phone's calendar subscribes to; it can be copied, replaced or switched off.
 */
export function CalendarSubscribe({ crewId }: { crewId: string }) {
  const i18n = useT();
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const failed = showFailure(i18n);

  useEffect(() => {
    void fetchCalendarFeed(crewId)
      .then(setUrl)
      .catch(() => setUrl(null));
  }, [crewId]);

  const subscribe = (link: string) =>
    void Linking.openURL(webcalUrl(link)).catch(() => showToast({ tone: "danger", message: i18n.t("crew.calendarFailed") }));

  const onToggle = (on: boolean) => {
    if (busy) return;
    setBusy(true);
    const work = on
      ? resetCalendarFeed(crewId).then((link) => {
          setUrl(link);
          haptic.confirmed();
          subscribe(link);
        })
      : revokeCalendarFeed(crewId).then(() => setUrl(null));
    void work.catch(failed).finally(() => setBusy(false));
  };

  if (url === undefined) return null;
  return (
    <View style={styles.block}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text variant="h3">{i18n.t("crew.calendarSync")}</Text>
          <Text variant="small">{i18n.t("crew.calendarSyncHint")}</Text>
        </View>
        <Switch value={url !== null} disabled={busy} onValueChange={onToggle} accessibilityLabel={i18n.t("crew.calendarSync")} />
      </View>
      {url ? (
        <Animated.View entering={FadeIn.duration(duration.enter)} style={styles.block}>
          <Button label={i18n.t("crew.calendarSubscribe")} icon="cal" variant="secondary" height={44} onPress={() => subscribe(url)} />
          <View style={styles.actions}>
            <Button
              label={i18n.t("crew.calendarCopy")}
              icon="link"
              variant="outline"
              height={40}
              style={styles.flex}
              onPress={() => {
                void Clipboard.setStringAsync(url);
                haptic.select();
                showToast({ message: i18n.t("crew.copied") });
              }}
            />
            <Button
              label={i18n.t("crew.calendarReset")}
              icon="undo"
              variant="outline"
              height={40}
              style={styles.flex}
              onPress={() =>
                void confirmAction({
                  title: i18n.t("crew.calendarResetTitle"),
                  body: i18n.t("crew.calendarResetBody"),
                  confirmLabel: i18n.t("crew.calendarReset"),
                  cancelLabel: i18n.t("crew.calendarKeep"),
                }).then((ok) => {
                  if (!ok) return;
                  setBusy(true);
                  void resetCalendarFeed(crewId)
                    .then((link) => {
                      setUrl(link);
                      showToast({ message: i18n.t("crew.calendarResetDone") });
                    })
                    .catch(failed)
                    .finally(() => setBusy(false));
                })
              }
            />
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  actions: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});
