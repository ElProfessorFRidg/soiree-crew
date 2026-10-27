import { BETA_CENTRAL, BETA_FED, BETA_SAFE, distributionFactor } from "@crew/bac";
import { countryRules, drivingLimit, formatBacValue, breathRatio } from "@crew/units";
import { useT } from "@/i18n";
import { useAppStore } from "@/state/store";
import { Panel } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

/** O-86: what the estimate is made of, with this phone's own numbers, and why it is not a breathalyser. */
export default function EstimateScreen() {
  const i18n = useT();
  const profile = useAppStore((state) => state.profile);
  const preferences = useAppStore((state) => state.preferences);
  const rules = countryRules(preferences.legalCountry);
  const limit = drivingLimit(rules, preferences.driverCategory);
  const unit = i18n.t(`units.${preferences.bacUnit}`);
  const bac = (gPerL: number) => `${formatBacValue(gPerL, preferences.bacUnit, breathRatio(rules), i18n.locale)} ${unit}`;
  const rate = (gPerL: number) => i18n.t("estimate.perHour", { value: bac(gPerL) });
  const factor = profile ? distributionFactor(profile) : null;

  return (
    <Screen back title={i18n.t("estimate.title")}>
      <Text>{i18n.t("estimate.intro")}</Text>
      <Panel>
        <Text variant="label">{i18n.t("estimate.inputs")}</Text>
        {profile ? (
          <>
            <Text>{i18n.t("estimate.weight", { kg: i18n.number(profile.weightKg) })}</Text>
            {factor !== null ? <Text>{i18n.t("estimate.water", { factor: i18n.number(factor, 2) })}</Text> : null}
          </>
        ) : (
          <Text>{i18n.t("estimate.noProfile")}</Text>
        )}
        <Text>{i18n.t("estimate.drinks")}</Text>
        <Text>{i18n.t("estimate.food")}</Text>
      </Panel>
      <Panel>
        <Text variant="label">{i18n.t("estimate.model")}</Text>
        <Text>{i18n.t("estimate.absorption")}</Text>
        <Text>{i18n.t("estimate.elimination", { central: rate(BETA_CENTRAL), fed: rate(BETA_FED) })}</Text>
        <Text>{i18n.t("estimate.driving", { safe: rate(BETA_SAFE) })}</Text>
      </Panel>
      <Panel>
        <Text variant="label">{i18n.t("estimate.country", { country: i18n.t(`countries.${preferences.legalCountry}` as "countries.FR") })}</Text>
        <Text>{i18n.t("estimate.limit", { limit: limit > 0 ? bac(limit) : i18n.t("estimate.zero") })}</Text>
        <Text>{i18n.t("estimate.standard", { grams: i18n.number(rules.standardDrinkGrams) })}</Text>
      </Panel>
      <Panel tint="danger">
        <Text variant="label">{i18n.t("estimate.limits")}</Text>
        <Text>{i18n.t("estimate.limitsBody")}</Text>
        <Text>{i18n.t("estimate.breath")}</Text>
      </Panel>
    </Screen>
  );
}
