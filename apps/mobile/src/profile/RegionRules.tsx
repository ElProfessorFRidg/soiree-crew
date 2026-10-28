import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { duration } from "@crew/design-tokens";
import { breathRatio, COUNTRIES, countryRules, drivingLimit, formatBacValue, type BacUnit, UI_LANGUAGES } from "@crew/units";
import { useT } from "@/i18n";
import { setPreferences } from "@/state/preferences";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Chip, Panel, Row, Switch } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Text } from "@/ui/Text";

const ALL_UNITS: readonly BacUnit[] = [
  "g_per_l_blood",
  "mg_per_l_breath",
  "permille",
  "percent_bac",
  "mg_per_100ml_blood",
  "ug_per_100ml_breath",
  "ug_per_l_breath",
];

/** PREF-04: language, legal country and BAC unit are set separately; none is inferred from another. */
export function RegionRules() {
  const i18n = useT();
  const theme = useTheme();
  const preferences = useAppStore((state) => state.preferences);
  const [pickingCountry, setPickingCountry] = useState(false);
  const rules = countryRules(preferences.legalCountry);
  const ratio = breathRatio(rules);
  const limitText = (gPerL: number) => `${formatBacValue(gPerL, preferences.bacUnit, ratio, i18n.locale)} ${i18n.t(`units.${preferences.bacUnit}`)}`;
  const novice = drivingLimit(rules, "novice");
  const standard = drivingLimit(rules, "standard");

  return (
    <>
      <Text variant="label">{i18n.t("profile.language")}</Text>
      <Panel>
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={i18n.t("profile.language")}>
          {UI_LANGUAGES.map((language) => (
            <Chip key={language} label={i18n.t(`languages.${language}`)} selected={preferences.language === language} onPress={() => setPreferences({ language })} />
          ))}
        </View>
      </Panel>

      <Text variant="label">{i18n.t("profile.rules")}</Text>
      <Panel>
        <Row
          title={i18n.t("profile.country")}
          subtitle={`${i18n.t(`countries.${preferences.legalCountry}` as "countries.FR")}, ${limitText(standard)}`}
          trailing={<Icon name={pickingCountry ? "arrowup" : "arrowdn"} color={theme.textMuted} />}
          onPress={() => setPickingCountry((open) => !open)}
        />
        {pickingCountry ? (
          <Animated.View entering={FadeIn.duration(duration.enter)}>
            {Object.keys(COUNTRIES).map((code, index, list) => (
              <Row
                key={code}
                title={i18n.t(`countries.${code}` as "countries.FR")}
                trailing={code === preferences.legalCountry ? <Icon name="check" color={theme.amber} /> : null}
                onPress={() => {
                  const next = countryRules(code);
                  setPreferences({ legalCountry: code, bacUnit: next.bacUnits[0] ?? "g_per_l_blood", currency: next.currency });
                  setPickingCountry(false);
                }}
                last={index === list.length - 1}
              />
            ))}
          </Animated.View>
        ) : null}
        {!rules.verified ? (
          <Text variant="small" color={theme.danger}>
            {i18n.t("profile.unverified")}
          </Text>
        ) : null}
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text variant="h3">{i18n.t("profile.novice")}</Text>
            {novice !== standard ? <Text variant="small">{i18n.t("profile.noviceHint", { novice: limitText(novice), standard: limitText(standard) })}</Text> : null}
          </View>
          <Switch
            value={preferences.driverCategory === "novice"}
            onValueChange={(on) => setPreferences({ driverCategory: on ? "novice" : "standard" })}
            accessibilityLabel={i18n.t("profile.novice")}
          />
        </View>
      </Panel>

      <Text variant="label">{i18n.t("profile.bacUnit")}</Text>
      <Panel>
        <View style={styles.chips}>
          {ALL_UNITS.map((unit) => (
            <Chip key={unit} label={i18n.t(`units.${unit}`)} selected={unit === preferences.bacUnit} onPress={() => setPreferences({ bacUnit: unit })} />
          ))}
        </View>
        <Text variant="small">{i18n.t("settings.bacExample", { value: limitText(standard), long: i18n.t(`units.long.${preferences.bacUnit}`) })}</Text>
      </Panel>
    </>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54 },
  flex: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
