import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Field } from "@/crew/Field";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { addVenue, currentFix, type VenueKind } from "@/server/venueData";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Panel, Segmented } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { useDraft } from "@/state/drafts";

/** N-08: a venue is placed where the user stands; no address search, no third-party geocoder. */
export default function AddVenueScreen() {
  const i18n = useT();
  const theme = useTheme();
  const { crewId } = useLocalSearchParams<{ crewId: string }>();
  const [name, setName, clearName] = useDraft("add-venue:name");
  const [kind, setKind] = useState<VenueKind>("bar");
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void currentFix().then((result) => {
      if (result.ok) setPosition({ lat: result.fix.lat, lng: result.fix.lng });
      else setLocationError(result.failure === "denied" ? i18n.t("addVenue.locationDenied") : i18n.t("addVenue.locationUnavailable"));
    });
  }, [i18n]);

  return (
    <Screen
      back
      title={i18n.t("addVenue.title")}
      withToasts
      footer={
        <Button
          label={i18n.t("addVenue.save")}
          height={56}
          disabled={!position || !name.trim() || !crewId}
          loading={busy}
          onPress={() => {
            if (!position || !crewId) return;
            setBusy(true);
            addVenue(crewId, { name: name.trim(), kind, ...position })
              .then(() => {
                haptic.confirmed();
                clearName();
                router.back();
              })
              .catch(() => showToast({ tone: "danger", message: i18n.t("crew.offline") }))
              .finally(() => setBusy(false));
          }}
        />
      }
    >
      <Field label={i18n.t("addVenue.name")} placeholder={i18n.t("addVenue.namePlaceholder")} value={name} onChangeText={setName} maxLength={60} autoFocus />
      <Panel>
        <Text variant="label">{i18n.t("addVenue.kind")}</Text>
        <Segmented<VenueKind>
          accessibilityLabel={i18n.t("addVenue.kind")}
          value={kind}
          items={(["bar", "club", "spot", "home"] as const).map((value) => ({ value, label: i18n.t(`addVenue.${value}`) }))}
          onChange={setKind}
        />
        {kind === "home" ? <Text variant="small">{i18n.t("addVenue.homeHint")}</Text> : null}
      </Panel>
      <View style={styles.status}>
        {locationError ? (
          <Text color={theme.danger}>{locationError}</Text>
        ) : !position ? (
          <Text variant="small">{i18n.t("addVenue.locating")}</Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: { minHeight: 24 },
});
