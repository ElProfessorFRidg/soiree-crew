import { router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { search, type Candidate } from "@crew/fuzzy";
import { RECIPE_CATEGORIES, RECIPES, recipeAbv, type Recipe, type RecipeCategory } from "@/bar/recipes";
import { barText } from "@/bar/text";
import { Field } from "@/crew/Field";
import { useT } from "@/i18n";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Chip, Row } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { RecipeArt } from "@/bar/RecipeArt";

/** O-66, O-68: the Bar, searchable by name or ingredient, filtered by category. */
export default function BarScreen() {
  const i18n = useT();
  const theme = useTheme();
  const text = barText(i18n.language);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<RecipeCategory | "all">("all");

  const candidates = useMemo<Candidate<Recipe>[]>(
    () =>
      RECIPES.map((recipe) => ({
        value: recipe,
        names: [text.recipes[recipe.id as keyof typeof text.recipes].name, ...recipe.ingredients.map((i) => text.ingredients[i.id])],
      })),
    [text],
  );
  const inCategory = (r: Recipe) => category === "all" || r.category === category;
  const list = query.trim().length >= 2 ? search(query, candidates, 40).filter(inCategory) : RECIPES.filter(inCategory);
  const percent = new Intl.NumberFormat(i18n.locale, { style: "percent", maximumFractionDigits: 0 });

  return (
    <Screen back title={i18n.t("bar.title")}>
      <Field label={i18n.t("bar.search")} placeholder={i18n.t("bar.searchPlaceholder")} value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search" maxLength={40} />
      <View style={styles.chips}>
        {(["all", ...RECIPE_CATEGORIES] as const).map((c) => (
          <Chip key={c} label={text.categories[c]} selected={c === category} onPress={() => setCategory(c)} />
        ))}
      </View>
      <Button label={i18n.t("bar.mixer")} icon="filter" variant="secondary" height={52} onPress={() => router.push("/mixer")} />
      {/* O-76: the alibi generator, also here (not only the morning after). */}
      <Button label={i18n.t("morning.alibi")} icon="sparkdot" variant="outline" height={52} onPress={() => router.push("/alibi")} />
      {list.length === 0 ? <Text>{i18n.t("bar.none", { query: query.trim() })}</Text> : null}
      <View>
        {list.map((recipe, index) => {
          const t = text.recipes[recipe.id as keyof typeof text.recipes];
          return (
            <Row
              key={recipe.id}
              title={t.name}
              subtitle={i18n.t("bar.meta", {
                difficulty: text.difficulty[recipe.difficulty],
                abv: percent.format(recipeAbv(recipe)),
                minutes: recipe.minutes,
              })}
              leading={<RecipeArt recipe={recipe} size={44} />}
              trailing={<Icon name="chev" color={theme.textMuted} />}
              onPress={() => router.push({ pathname: "/recipe", params: { id: recipe.id } })}
              last={index === list.length - 1}
            />
          );
        })}
      </View>
      <Text variant="small">{i18n.plural("bar.count", RECIPES.length)}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
