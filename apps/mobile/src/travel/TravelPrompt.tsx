import { getLocales } from "expo-localization";
import { StyleSheet, View } from "react-native";
import { COUNTRIES, countryRules } from "@crew/units";
import { useT } from "@/i18n";
import { setPreferences } from "@/state/preferences";
import { useAppStore } from "@/state/store";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { Text } from "@/ui/Text";

/**
 * PREF-05: when the phone says another country than the one used for the legal
 * limit, suggest switching in one tap. Never switch silently; "keep" is remembered.
 */
export function TravelPrompt() {
  const i18n = useT();
  const legalCountry = useAppStore((state) => state.preferences.legalCountry);
  const dismissed = useAppStore((state) => state.travelDismissed);
  const region = getLocales()[0]?.regionCode?.toUpperCase() ?? null;
  if (!region || region === legalCountry || !COUNTRIES[region] || dismissed === region) return null;
  const name = i18n.t(`countries.${region}` as "countries.FR");
  return (
    <Panel tint="water">
      <Text variant="h3">{i18n.t("travel.title")}</Text>
      <Text>{i18n.t("travel.body", { country: name })}</Text>
      <View style={styles.actions}>
        <Button label={i18n.t("travel.keep")} variant="outline" height={44} style={styles.flex} onPress={() => useAppStore.setState({ travelDismissed: region })} />
        <Button
          label={i18n.t("travel.switch", { country: name })}
          variant="secondary"
          height={44}
          style={styles.flex}
          onPress={() => {
            const rules = countryRules(region);
            setPreferences({ legalCountry: region, unitSystem: rules.unitSystem, bacUnit: rules.bacUnits[0] ?? "g_per_l_blood" });
          }}
        />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});
