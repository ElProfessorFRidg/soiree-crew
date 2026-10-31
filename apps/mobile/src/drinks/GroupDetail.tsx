import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { duration, radius, space } from "@crew/design-tokens";
import { catalogueDrink, type CatalogueDrink, type DrinkGroup } from "@crew/fuzzy";
import type { VolumeUnit } from "@crew/units";
import { useT } from "@/i18n";
import { easings } from "@/motion/easing";
import { useTheme } from "@/theme";
import { Chip, Switch } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { useAppStore } from "@/state/store";
import { brandsOf, catalogueLabel, filterBrands, sizeOptions, strengthOptions } from "./catalogue";
import { sizeText, strengthText } from "./display";
import { inputText } from "@/ui/inputText";

/** What the open tile will log: a brand or none, a size, a strength, and whether to keep it. */
export interface GroupChoice {
  brandId: string | null;
  volumeMl: number;
  abv: number;
  keep: boolean;
  /** The user picked a size: a brand picked afterwards keeps it. */
  sizeTouched: boolean;
}

interface Props {
  group: DrinkGroup;
  choice: GroupChoice;
  unit: VolumeUnit;
  /** The bar's house pint, offered as a strength chip when it is not one already. */
  houseAbv: number | null;
  onChange: (next: GroupChoice) => void;
}

const same = (a: number, b: number) => Math.abs(a - b) < 0.0005;

/**
 * The detail under the grid (draft C): brand chips (optional), the sizes that make sense for the
 * group, the strengths that make sense for it (no 40 % beer), and "Garder dans Mes boissons".
 */
export function GroupDetail({ group, choice, unit, houseAbv, onChange }: Props) {
  const i18n = useT();
  const theme = useTheme();
  const brand = choice.brandId ? catalogueDrink(choice.brandId) : undefined;
  const country = useAppStore((state) => state.preferences.legalCountry);
  const [brandQuery, setBrandQuery] = useState("");
  const all = useMemo(() => brandsOf(group, country), [group, country]);
  const brands = useMemo(() => filterBrands(all, brandQuery, i18n), [all, brandQuery, i18n]);
  const sizes = sizeOptions(group, country, choice.volumeMl, brand?.volumeMl ?? 0, ...(brand?.sizes ?? []));
  const strengths = strengthOptions(group, choice.abv, brand?.abv ?? 0, group === "beer" ? (houseAbv ?? 0) : 0);

  const pickBrand = (next: CatalogueDrink | null) => {
    if (!next) {
      onChange({ ...choice, brandId: null });
      return;
    }
    // A brand comes with its label strength, and its usual size unless a size was chosen.
    onChange({ ...choice, brandId: next.id, abv: next.abv, volumeMl: choice.sizeTouched ? choice.volumeMl : next.volumeMl });
  };

  return (
    <Animated.View
      entering={FadeIn.duration(duration.enter).easing(easings.out)}
      layout={LinearTransition.duration(duration.reorder).easing(easings.reorder)}
      style={[styles.panel, { backgroundColor: theme.surface2 }]}
    >
      {all.length ? (
        <View style={styles.block}>
          <Text variant="label">{i18n.t("drinkCatalogue.brand")}</Text>
          {/* Dozens of beers: typing a few letters narrows the row, typos and neighbour keys forgiven. */}
          {all.length > 8 ? (
            <TextInput
              value={brandQuery}
              onChangeText={setBrandQuery}
              placeholder={i18n.t("drinkCatalogue.brandFilter")}
              placeholderTextColor={theme.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              returnKeyType="search"
              accessibilityLabel={i18n.t("drinkCatalogue.brandFilter")}
              style={[styles.filter, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.line }]}
            />
          ) : null}
          {/* One scrolling row: twenty brands of beer must not push the Add button off screen. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.bleed} contentContainerStyle={styles.scrollRow}>
            <Chip label={i18n.t("drinkCatalogue.noBrand")} selected={!brand} onPress={() => pickBrand(null)} />
            {brands.length === 0 ? <Text variant="small" style={styles.none}>{i18n.t("drinkCatalogue.brandNone")}</Text> : null}
            {brands.map((b) => (
              <Chip key={b.id} label={catalogueLabel(b, i18n)} selected={brand?.id === b.id} onPress={() => pickBrand(b)} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.block}>
        <Text variant="label">{i18n.t("drinkCatalogue.size")}</Text>
        <View style={styles.wrap} accessibilityRole="radiogroup">
          {sizes.map((size) => {
            const volume = sizeText(size.volumeMl, unit, i18n);
            const label = size.serving ? i18n.t("drinkCatalogue.sizeChip", { name: i18n.t(`drinkCatalogue.servings.${size.serving}`), size: volume }) : volume;
            return (
              <Chip
                key={size.volumeMl}
                label={label}
                selected={size.volumeMl === choice.volumeMl}
                onPress={() => onChange({ ...choice, volumeMl: size.volumeMl, sizeTouched: true })}
              />
            );
          })}
        </View>
      </View>

      {strengths.length ? (
        <View style={styles.block}>
          <Text variant="label">{i18n.t("drinkCatalogue.strength")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.bleed} contentContainerStyle={styles.scrollRow}>
            {strengths.map((abv) => (
              <Chip
                key={abv}
                label={strengthText(abv, i18n)}
                icon={houseAbv !== null && group === "beer" && same(abv, houseAbv) ? "pin" : undefined}
                selected={same(abv, choice.abv)}
                // Another strength is another drink: a Kronenbourg at 8 % is no Kronenbourg.
                onPress={() => onChange({ ...choice, abv, brandId: brand && !same(brand.abv, abv) ? null : choice.brandId })}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.keep}>
        <Text style={styles.flex}>{i18n.t("drinkCatalogue.keep", { list: i18n.t("addDrink.myDrinks") })}</Text>
        <Switch
          value={choice.keep}
          onValueChange={(keep) => onChange({ ...choice, keep })}
          accessibilityLabel={i18n.t("drinkCatalogue.keep", { list: i18n.t("addDrink.myDrinks") })}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: radius.card, paddingVertical: space.cardPadding, paddingHorizontal: space.cardPadding, gap: 14, overflow: "hidden" },
  block: { gap: 8 },
  // The chip rows run to the panel's edges so a half-visible chip says "there is more".
  bleed: { marginHorizontal: -space.cardPadding },
  scrollRow: { paddingHorizontal: space.cardPadding, gap: 8, paddingVertical: 6 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filter: { minHeight: 44, borderRadius: radius.input, borderWidth: 1.5, paddingHorizontal: 14, ...inputText({ fontSize: 16 }) },
  none: { alignSelf: "center" },
  keep: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  flex: { flex: 1 },
});
