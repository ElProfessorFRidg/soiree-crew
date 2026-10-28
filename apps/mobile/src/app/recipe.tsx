import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { RECIPES, recipeAbv, recipeVolume, STAPLES } from "@/bar/recipes";
import { barText } from "@/bar/text";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { api } from "@/server/api";
import { useCrewData } from "@/server/crewData";
import { newId, useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Panel, Segmented } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Stepper } from "@/ui/Stepper";
import { Numeral, Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { RecipeArt } from "@/bar/RecipeArt";
import { showFailure } from "@/server/errors";

const OZ_PER_CL = 0.338;

/** O-67: the recipe card: measures in cl or oz for one or more glasses, steps, strength, and the shopping list. */
export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const i18n = useT();
  const theme = useTheme();
  const text = barText(i18n.language);
  const unitSystem = useAppStore((state) => state.preferences.unitSystem);
  const [unit, setUnit] = useState<"cl" | "oz">(unitSystem === "us_customary" ? "oz" : "cl");
  const [glasses, setGlasses] = useState(1);
  const [busy, setBusy] = useState(false);
  // The next party I'm going to, live or coming: where the shopping goes.
  const party = useCrewData((state) => {
    const now = Date.now();
    return [...state.parties].filter((p) => p.myResponse === "going" && p.closedAt === null && p.endsAt >= now).sort((a, b) => a.startsAt - b.startsAt)[0];
  });
  const recipe = RECIPES.find((r) => r.id === id);
  if (!recipe) return <Screen back>{null}</Screen>;
  const t = text.recipes[recipe.id as keyof typeof text.recipes];
  const percent = new Intl.NumberFormat(i18n.locale, { style: "percent", maximumFractionDigits: 0 });
  const amount = (cl: number) =>
    unit === "cl" ? `${i18n.number(Math.round(cl * glasses * 10) / 10)} cl` : `${i18n.number(Math.round(cl * glasses * OZ_PER_CL * 10) / 10)} oz`;

  const addToShopping = () => {
    if (!party) return;
    setBusy(true);
    const labels = recipe.ingredients.filter((i) => !STAPLES.has(i.id)).map((i) => text.ingredients[i.id]);
    void Promise.all(labels.map((label) => api(`/v1/parties/${party.id}/items`, { method: "POST", body: { id: newId(), label } })))
      .then(() => {
        haptic.confirmed();
        showToast({ message: i18n.plural("bar.addedToList", labels.length, { party: party.name }) });
      })
      .catch(showFailure(i18n))
      .finally(() => setBusy(false));
  };

  return (
    <Screen
      back
      title={t.name}
      withToasts
      footer={
        party ? (
          <Button label={i18n.t("bar.addToList", { party: party.name })} icon="plus" height={56} loading={busy} onPress={addToShopping} />
        ) : undefined
      }
    >
      <View style={styles.art}>
        <RecipeArt recipe={recipe} size={160} />
      </View>
      <View style={styles.facts}>
        <View style={styles.fact}>
          <Numeral size={32} color={theme.amber}>
            {percent.format(recipeAbv(recipe))}
          </Numeral>
          <Text variant="small">{i18n.t("bar.strength")}</Text>
        </View>
        <View style={styles.fact}>
          <Text variant="h2">{text.difficulty[recipe.difficulty]}</Text>
          <Text variant="small">{text.categories[recipe.category]}</Text>
        </View>
        <View style={styles.fact}>
          <Numeral size={32}>{i18n.t("bar.minutes", { minutes: recipe.minutes })}</Numeral>
          <Text variant="small">{i18n.t("bar.time")}</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <Stepper value={glasses} min={1} max={12} onChange={setGlasses} decreaseLabel={i18n.t("bar.fewer")} increaseLabel={i18n.t("bar.more")} />
        <Text style={styles.flex}>{i18n.plural("bar.glasses", glasses)}</Text>
        <Segmented<"cl" | "oz">
          accessibilityLabel={i18n.t("bar.unit")}
          value={unit}
          items={[
            { value: "cl", label: "cl" },
            { value: "oz", label: "oz" },
          ]}
          onChange={setUnit}
        />
      </View>

      <Panel>
        <Text variant="label">{i18n.t("bar.ingredients")}</Text>
        {recipe.ingredients.map((ing) => (
          <View key={ing.id} style={[styles.line, { borderBottomColor: theme.line }]}>
            <Text style={styles.flex}>{text.ingredients[ing.id]}</Text>
            <Text variant="h3">
              {ing.top && ing.cl
                ? i18n.t("bar.topUp", { amount: amount(ing.cl) })
                : ing.cl
                  ? amount(ing.cl)
                  : ing.count
                    ? `${i18n.number(ing.count * glasses)} ${ing.unit ? text.units[ing.unit] : ""}`.trim()
                    : ""}
            </Text>
          </View>
        ))}
        <Text variant="small">{i18n.t("bar.volume", { amount: amount(recipeVolume(recipe)) })}</Text>
      </Panel>

      <Text variant="label">{i18n.t("bar.steps")}</Text>
      {t.steps.map((step, index) => (
        <View key={step} style={styles.step}>
          <Text variant="h3" color={theme.amber} style={styles.stepNumber}>
            {index + 1}
          </Text>
          <Text style={styles.flex}>{step}</Text>
        </View>
      ))}
      {!party ? <Text variant="small">{i18n.t("bar.noParty")}</Text> : null}
      <Text variant="small">{i18n.t("bar.estimate")}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  art: { alignItems: "center" },
  facts: { flexDirection: "row", gap: 12 },
  fact: { flex: 1, gap: 2 },
  controls: { flexDirection: "row", alignItems: "center", gap: 12 },
  line: { flexDirection: "row", alignItems: "center", minHeight: 44, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  step: { flexDirection: "row", gap: 12 },
  stepNumber: { width: 20 },
  flex: { flex: 1 },
});
