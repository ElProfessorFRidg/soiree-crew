import { Linking, StyleSheet, View } from "react-native";
import { palette } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { RelativeTime } from "@/ui/RelativeTime";
import { resolveSos, useRadar } from "@/server/radarData";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { Text } from "@/ui/Text";

/** A crew member's SOS (N-28), shown at the top of the Party and Crew screens until someone marks it sorted. */
export function SosBanner() {
  const i18n = useT();
  const alerts = useRadar((state) => state.sos);
  if (!alerts.length) return null;
  return (
    <>
      {alerts.map((alert) => (
        <Panel key={alert.id} tint="danger" style={styles.panel}>
          <Text variant="h2" color={palette.tint.dangerTextStrong} accessibilityLiveRegion="assertive">
            {i18n.t("sosAlert.received", { name: alert.name })}
          </Text>
          <RelativeTime at={alert.at} variant="body" color={palette.tint.dangerText} />
          <View style={styles.actions}>
            {alert.location ? (
              <Button
                label={i18n.t("sosAlert.openMap")}
                icon="pin"
                variant="danger"
                height={52}
                style={styles.flex}
                onPress={() => void Linking.openURL(`https://www.openstreetmap.org/?mlat=${alert.location!.lat}&mlon=${alert.location!.lng}#map=18/${alert.location!.lat}/${alert.location!.lng}`)}
              />
            ) : null}
            <Button label={i18n.t("sosAlert.resolve")} variant="secondary" height={52} style={styles.flex} onPress={() => void resolveSos(alert.id).catch(() => undefined)} />
          </View>
        </Panel>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 8 },
  actions: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});
