import { router } from "expo-router";
import { memo, useCallback, useMemo, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View, type ListRenderItem } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space } from "@crew/design-tokens";
import { browseRecipes, recipeCandidates } from "@/bar/browse";
import { RECIPE_CATEGORIES, RECIPES, recipeAbv, type Recipe, type RecipeCategory } from "@/bar/recipes";
import { barText } from "@/bar/text";
import { Field } from "@/crew/Field";
import { useT } from "@/i18n";
import { useTheme } from "@/theme";
import { Button, IconButton } from "@/ui/Button";
import { Chip, Row } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Text } from "@/ui/Text";
import { RecipeArt } from "@/bar/RecipeArt";

type BarText = ReturnType<typeof barText>;

const RecipeRow = memo(function RecipeRow({ recipe, name, meta, last, chevron }: { recipe: Recipe; name: string; meta: string; last: boolean; chevron: string }) {
  return (
    <Row
      title={name}
      subtitle={meta}
      leading={<RecipeArt recipe={recipe} size={44} />}
      trailing={<Icon name="chev" color={chevron} />}
      onPress={() => router.push({ pathname: "/recipe", params: { id: recipe.id } })}
      last={last}
    />
  );
});

/**
 * O-66, O-68: the Bar, searchable by name or ingredient, filtered by category. The 470-odd
 * recipes sit in a virtualised list: only the rows near the screen are drawn.
 */
export default function BarScreen() {
  const i18n = useT();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const text: BarText = barText(i18n.language);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<RecipeCategory | "all">("all");

  const candidates = useMemo(
    () => recipeCandidates((recipe) => text.recipes[recipe.id as keyof typeof text.recipes].name, (id) => text.ingredients[id]),
    [text],
  );
  const list = useMemo(() => browseRecipes(query, category, candidates), [query, category, candidates]);
  const percent = useMemo(() => new Intl.NumberFormat(i18n.locale, { style: "percent", maximumFractionDigits: 0 }), [i18n.locale]);

  const renderItem = useCallback<ListRenderItem<Recipe>>(
    ({ item, index }) => (
      <RecipeRow
        recipe={item}
        name={text.recipes[item.id as keyof typeof text.recipes].name}
        meta={i18n.t("bar.meta", { difficulty: text.difficulty[item.difficulty], abv: percent.format(recipeAbv(item)), minutes: item.minutes })}
        last={index === list.length - 1}
        chevron={theme.textMuted}
      />
    ),
    [text, i18n, percent, list.length, theme.textMuted],
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.top}>
        <IconButton icon="back" accessibilityLabel={i18n.t("common.back")} onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} />
      </View>
      <Text variant="h1" accessibilityRole="header">
        {i18n.t("bar.title")}
      </Text>
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
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.screen, { backgroundColor: theme.bg }]}>
      <FlatList
        data={list}
        keyExtractor={(recipe) => recipe.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListFooterComponent={<Text variant="small" style={styles.footer}>{i18n.plural("bar.count", RECIPES.length)}</Text>}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews={Platform.OS === "android"}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.screenTop, paddingBottom: insets.bottom + 110 }]}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space.screenX },
  header: { gap: space.sectionGap, marginBottom: space.sectionGap },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  footer: { marginTop: space.sectionGap },
});
