import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Field } from "@/crew/Field";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { useCrewData } from "@/server/crewData";
import { addVenue, currentFix, useVenueData, type VenueKind } from "@/server/venueData";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Panel, Segmented, Switch } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { useDraft } from "@/state/drafts";
import { showFailure } from "@/server/errors";
import { OpenSettingsButton } from "@/system/OpenSettingsButton";

/**
 * N-08: a venue is placed where the user stands; no address search, no third-party geocoder.
 * The address is typed (for directions and to copy), and the crew's HQ is a switch away.
 */
export default function AddVenueScreen() {
  const i18n = useT();
  const theme = useTheme();
  const { crewId } = useLocalSearchParams<{ crewId: string }>();
  const [name, setName, clearName] = useDraft("add-venue:name");
  const [address, setAddress, clearAddress] = useDraft("add-venue:address");
  const [kind, setKind] = useState<VenueKind>("bar");
  const [isHq, setIsHq] = useState(false);
  const isAdmin = useCrewData((state) => state.crews.find((c) => c.id === crewId)?.role === "admin");
  const hasHq = useVenueData((state) => (crewId ? (state.byCrew[crewId]?.venues.some((v) => v.isHq) ?? false) : false));
  // The server says the same: the first HQ is anyone's call, moving it is the admin's.
  const canHq = kind !== "home" && (!hasHq || isAdmin);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  const [declined, setDeclined] = useState(false);
  const locate = useCallback(() => {
    setDeclined(false);
    setLocationError(null);
    void currentFix("venue").then((result) => {
      if (result.ok) setPosition({ lat: result.fix.lat, lng: result.fix.lng });
      else if (result.declined) {
        setDeclined(true);
        setLocationError(i18n.t("permissions.venueNeeded"));
      } else {
        setLocationError(result.failure === "denied" ? i18n.t("addVenue.locationDenied") : i18n.t("addVenue.locationUnavailable"));
        setBlocked(result.failure === "denied" && result.canAskAgain === false);
      }
    });
  }, [i18n]);
  useEffect(locate, [locate]);

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
            addVenue(crewId, { name: name.trim(), kind, ...position, ...(address.trim() ? { address: address.trim() } : {}), ...(canHq && isHq ? { isHq: true } : {}) })
              .then(() => {
                haptic.confirmed();
                clearName();
                clearAddress();
                router.back();
              })
              .catch(showFailure(i18n))
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
      <Field
        label={i18n.t("addVenue.address")}
        placeholder={i18n.t("addVenue.addressPlaceholder")}
        hint={i18n.t("addVenue.addressHint")}
        value={address}
        onChangeText={setAddress}
        maxLength={120}
        textContentType="fullStreetAddress"
        autoComplete="street-address"
      />
      {canHq ? (
        <Panel>
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text>{i18n.t("addVenue.hq")}</Text>
              <Text variant="small">{hasHq ? i18n.t("addVenue.hqMove") : i18n.t("addVenue.hqHint")}</Text>
            </View>
            <Switch value={isHq} onValueChange={setIsHq} accessibilityLabel={i18n.t("addVenue.hq")} />
          </View>
        </Panel>
      ) : null}
      <View style={styles.status}>
        {locationError ? (
          <>
            <Text color={theme.danger}>{locationError}</Text>
            {blocked ? <OpenSettingsButton /> : null}
            {declined ? <Button label={i18n.t("permissions.allowLocation")} icon="pin" variant="outline" height={44} onPress={locate} /> : null}
          </>
        ) : !position ? (
          <Text variant="small">{i18n.t("addVenue.locating")}</Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: { minHeight: 24 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  flex: { flex: 1, gap: 2 },
});
