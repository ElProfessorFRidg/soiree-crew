import { getLocales } from "expo-localization";
import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { COUNTRIES, countryRules } from "@crew/units";
import { useT } from "@/i18n";
import { phoneTimeZone } from "@/system/timeZone";
import { setPreferences } from "@/state/preferences";
import { useAppStore } from "@/state/store";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { countryOfTimeZone } from "./zoneCountry";

/** "America/Sao_Paulo" reads "Sao Paulo". */
const zoneCity = (zone: string) => zone.split("/").pop()!.replace(/_/g, " ");

/**
 * PREF-05: when the phone says another country than the one used for the legal limit, from its
 * region setting or from a new time zone (the clock follows the network abroad, the region rarely
 * changes), suggest switching in one tap. Never switch silently; "keep" is remembered.
 */
export function TravelPrompt() {
  const i18n = useT();
  const legalCountry = useAppStore((state) => state.preferences.legalCountry);
  const dismissed = useAppStore((state) => state.travelDismissed);
  const lastZone = useAppStore((state) => state.lastTimeZone);
  const zoneDismissed = useAppStore((state) => state.travelZoneDismissed);
  const region = getLocales()[0]?.regionCode?.toUpperCase() ?? null;
  const zone = phoneTimeZone();
  const zoneChanged = !!zone && !!lastZone && zone !== lastZone && zoneDismissed !== zone;
  const zoneGuess = zoneChanged ? countryOfTimeZone(zone) : null;

  const regionSuggests = !!region && region !== legalCountry && !!COUNTRIES[region] && dismissed !== region;
  const zoneSuggests = !regionSuggests && !!zoneGuess && zoneGuess !== legalCountry && !!COUNTRIES[zoneGuess] && dismissed !== zoneGuess;
  // A new zone that matches nothing known: ask to check, without guessing a country.
  const zoneUnknown = !regionSuggests && zoneChanged && !zoneGuess;

  useEffect(() => {
    if (!zone) return;
    // First launch, or a new zone that changes nothing (back home, same country): just remember it.
    if (lastZone === null || (zone !== lastZone && zoneGuess !== null && (zoneGuess === legalCountry || !COUNTRIES[zoneGuess]))) {
      useAppStore.setState({ lastTimeZone: zone });
    }
  }, [zone, lastZone, zoneGuess, legalCountry]);

  const seen = () => useAppStore.setState({ lastTimeZone: zone, travelZoneDismissed: zone });

  if (zoneUnknown) {
    return (
      <Panel tint="water">
        <Text variant="h3">{i18n.t("travel.zoneTitle")}</Text>
        <Text>{i18n.t("travel.zoneBody", { zone: zoneCity(zone!) })}</Text>
        <View style={styles.actions}>
          <Button label={i18n.t("travel.zoneFine")} variant="outline" height={44} onPress={seen} />
          <Button
            label={i18n.t("travel.zoneCheck")}
            variant="secondary"
            height={44}
           
            onPress={() => {
              seen();
              router.push({ pathname: "/settings", params: { section: "region" } });
            }}
          />
        </View>
      </Panel>
    );
  }

  const country = regionSuggests ? region : zoneSuggests ? zoneGuess : null;
  if (!country) return null;
  const name = i18n.t(`countries.${country}` as "countries.FR");
  return (
    <Panel tint="water">
      <Text variant="h3">{i18n.t("travel.title")}</Text>
      <Text>{regionSuggests ? i18n.t("travel.body", { country: name }) : i18n.t("travel.zoneCountryBody", { zone: zoneCity(zone!), country: name })}</Text>
      <View style={styles.actions}>
        <Button
          label={i18n.t("travel.keep")}
          variant="outline"
          height={44}
         
          onPress={() => useAppStore.setState({ travelDismissed: country, ...(zoneSuggests ? { lastTimeZone: zone } : {}) })}
        />
        <Button
          label={i18n.t("travel.switch", { country: name })}
          variant="secondary"
          height={44}
         
          onPress={() => {
            const rules = countryRules(country);
            setPreferences({ legalCountry: country, unitSystem: rules.unitSystem, bacUnit: rules.bacUnits[0] ?? "g_per_l_blood" });
            if (zone) useAppStore.setState({ lastTimeZone: zone });
          }}
        />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  // Stacked: side by side, a country name such as "États-Unis" broke over two lines.
  actions: { gap: 8 },
});
