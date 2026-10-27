import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { makeable, MIXER_INGREDIENTS, type IngredientId } from "@/bar/recipes";
import { barText } from "@/bar/text";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Chip, Row, Tag } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

/** O-69: "what can I make?" from the bottles and the fridge. The choice stays on the phone. */
export default function MixerScreen() {
  const i18n = useT();
  const theme = useTheme();
  const text = barText(i18n.language);
  const haveList = useAppStore((state) => state.barHave);
  const have = new Set(haveList as IngredientId[]);
  const results = makeable(have);
  const ready = results.filter((r) => r.missing.length === 0);
  const sorted = [...MIXER_INGREDIENTS].sort((a, b) => text.ingredients[a].localeCompare(text.ingredients[b], i18n.locale));

  const toggle = (id: IngredientId) => {
    haptic.select();
    useAppStore.setState((s) => ({ barHave: s.barHave.includes(id) ? s.barHave.filter((x) => x !== id) : [...s.barHave, id] }));
  };

  return (
    <Screen back title={i18n.t("bar.mixer")}>
      <Text variant="label">{i18n.t("bar.haveWhat")}</Text>
      <View style={styles.chips}>
        {sorted.map((id) => (
          <Chip key={id} label={text.ingredients[id]} selected={have.has(id)} onPress={() => toggle(id)} />
        ))}
      </View>
      <Text variant="h3">{ready.length ? i18n.plural("bar.canMake", ready.length) : i18n.t("bar.needMore")}</Text>
      <View>
        {results.slice(0, 12).map(({ recipe, missing }, index, list) => (
          <Row
            key={recipe.id}
            title={text.recipes[recipe.id as keyof typeof text.recipes].name}
            subtitle={missing.length ? i18n.t("bar.missing", { list: missing.map((m) => text.ingredients[m].toLocaleLowerCase(i18n.locale)).join(", ") }) : i18n.t("bar.haveAll")}
            leading={<View style={[styles.swatch, { backgroundColor: recipe.colour }]} />}
            trailing={missing.length ? <Tag label={i18n.plural("bar.missingCount", missing.length)} /> : <Icon name="check" color={theme.ok} />}
            onPress={() => router.push({ pathname: "/recipe", params: { id: recipe.id } })}
            last={index === list.length - 1}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  swatch: { width: 28, height: 28, borderRadius: 8 },
});
