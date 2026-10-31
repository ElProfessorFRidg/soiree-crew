import { useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { duration, radius, size, type GlassIconName } from "@crew/design-tokens";
import { convertVolume, drinkVolumeUnit, toMillilitres, type UnitSystem } from "@crew/units";
import { useT } from "@/i18n";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { ScalePressable } from "@/ui/Pressable";
import { Chip, Panel, Segmented } from "@/ui/controls";
import { Stepper } from "@/ui/Stepper";
import { Text } from "@/ui/Text";
import { useAppStore } from "@/state/store";
import { catalogueLabel, searchCatalogue } from "./catalogue";
import { CUSTOM_BOUNDS, type CustomDrinkDraft } from "./customDrinks";
import { CUSTOM_ICONS, guessIcon } from "./customOrder";
import { sizeAndStrength, sizeText } from "./display";
import { useDrinkPhoto } from "./drinkPhotos";
import { DrinkPhotoField } from "./DrinkPhotoField";
import { MixEditor } from "./MixEditor";
import { defaultMix, mixToParts, mixTotals, nameFromParts, partsToMix, readParts, recipeText, type Mix } from "./mixedGlass";
import type { CustomDrink } from "./presets";
import { inputText } from "@/ui/inputText";

interface Props {
  unitSystem: UnitSystem;
  initial?: CustomDrink;
  /** A new drink started from another one (the party row's "Modifier"): its values, still editable. */
  prefill?: CustomDrinkDraft;
  onSave: (draft: CustomDrinkDraft) => void;
  onCancel: () => void;
}

export function CustomDrinkEditor({ unitSystem, initial, prefill, onSave, onCancel }: Props) {
  const i18n = useT();
  const theme = useTheme();
  const unit = drinkVolumeUnit(unitSystem);
  // The stepper works in whole menu units: cl, fl oz or ml.
  const step = unit === "ml" ? 25 : 1;
  const toUnit = (ml: number) => Math.round(convertVolume(ml, unit));
  const start = initial ?? prefill;
  const unitLabel = unit === "us_fl_oz" ? "oz" : unit;
  const minVolume = Math.max(1, toUnit(CUSTOM_BOUNDS.volumeMl.min));
  const maxVolume = toUnit(CUSTOM_BOUNDS.volumeMl.max);
  const [name, setName] = useState(start?.name ?? "");
  const [volume, setVolume] = useState(toUnit(start?.volumeMl ?? 330));
  // Strength in tenths of a percent, so 8.4 % is exact.
  const [abvTenths, setAbvTenths] = useState(Math.round((start?.abv ?? 0.08) * 1000));
  const [showNameError, setShowNameError] = useState(false);
  // O-21: the glass follows size and strength until the user picks one.
  const [pickedIcon, setPickedIcon] = useState<GlassIconName | null>(start?.icon ?? null);
  // A brand typed here fills name, size, strength and glass; every field stays editable after.
  const [brandQuery, setBrandQuery] = useState("");
  const country = useAppStore((state) => state.preferences.legalCountry);
  const brands = useMemo(() => searchCatalogue(brandQuery, i18n, 6, country), [brandQuery, i18n, country]);
  // O-21: a glass of several pours. Older drinks have no recipe and open as one drink, as before.
  const [mix, setMix] = useState<Mix | null>(() => {
    const parts = start ? readParts(start) : null;
    return parts ? partsToMix(parts, unit) : null;
  });
  const [mixed, setMixed] = useState(mix !== null);
  const parts = mixed && mix ? mixToParts(mix, unit) : null;
  const totals = parts ? mixTotals(parts) : { volumeMl: toMillilitres(volume, unit), abv: abvTenths / 1000 };
  const tooBig = parts !== null && totals.volumeMl > CUSTOM_BOUNDS.volumeMl.max;
  const icon = pickedIcon ?? guessIcon(totals.volumeMl, totals.abv);
  // The photo stays on this phone (drinkPhotos.ts): undefined until the person changes it here.
  const savedPhoto = useDrinkPhoto(initial?.id);
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const shownPhoto = photo === undefined ? savedPhoto : photo;

  const switchMode = (next: boolean) => {
    if (next === mixed) return;
    if (next && !mix) {
      // A spirit already filled in (from a brand, say) becomes the first pour.
      const spirit = abvTenths >= 150 ? { name: name.trim(), volumeMl: toMillilitres(volume, unit), abv: abvTenths / 1000 } : undefined;
      setMix(defaultMix(unit, spirit));
    }
    if (!next && parts) {
      // Back to one drink: the glass keeps its size and strength, so the estimate does not move.
      setVolume(Math.min(maxVolume, Math.max(minVolume, Math.round(toUnit(totals.volumeMl) / step) * step)));
      setAbvTenths(Math.round(totals.abv * 1000));
    }
    setMixed(next);
  };

  return (
    <Animated.View entering={FadeIn.duration(duration.enter)}>
      <Panel style={{ backgroundColor: theme.bg }}>
        <Segmented
          items={[
            { value: "single", label: i18n.t("myGlass.single") },
            { value: "mixed", label: i18n.t("myGlass.mixed") },
          ]}
          value={mixed ? "mixed" : "single"}
          onChange={(next) => switchMode(next === "mixed")}
          accessibilityLabel={i18n.t("myGlass.kind")}
        />
        {initial || mixed ? null : (
          <>
            <Text variant="label">{i18n.t("drinkCatalogue.brandSearch")}</Text>
            <TextInput
              value={brandQuery}
              onChangeText={setBrandQuery}
              placeholder={i18n.t("drinkCatalogue.brandSearchPlaceholder")}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={i18n.t("drinkCatalogue.brandSearch")}
              accessibilityHint={i18n.t("drinkCatalogue.brandSearchHint")}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              style={[styles.input, inputText(), { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
            />
            {brands.length ? (
              <Animated.View entering={FadeIn.duration(duration.enter)} style={styles.icons}>
                {brands.map((brand) => (
                  <Chip
                    key={brand.id}
                    label={catalogueLabel(brand, i18n)}
                    onPress={() => {
                      setName(catalogueLabel(brand, i18n).slice(0, 40));
                      setShowNameError(false);
                      setVolume(toUnit(brand.volumeMl));
                      setAbvTenths(Math.round(brand.abv * 1000));
                      setPickedIcon(brand.glass);
                      setBrandQuery("");
                    }}
                  />
                ))}
              </Animated.View>
            ) : (
              <Text variant="small">{i18n.t("drinkCatalogue.brandSearchHint")}</Text>
            )}
          </>
        )}
        <Text variant="label">{i18n.t("addDrink.name")}</Text>
        <TextInput
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (text.trim()) setShowNameError(false);
          }}
          placeholder={parts ? nameFromParts(parts) || i18n.t("myGlass.namePlaceholder") : i18n.t("addDrink.namePlaceholder")}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={i18n.t("addDrink.name")}
          autoCapitalize="sentences"
          autoCorrect={false}
          returnKeyType="done"
          maxLength={40}
          style={[
            styles.input,
            inputText(),
            { color: theme.text, backgroundColor: theme.inputBg, borderColor: showNameError ? theme.danger : theme.inputBorder },
          ]}
        />
        {showNameError ? <Text variant="small" color={theme.danger}>{i18n.t("addDrink.nameRequired")}</Text> : null}
        {mixed && mix ? (
          <Animated.View key="mixed" entering={FadeIn.duration(duration.enter)} style={styles.block}>
            <MixEditor mix={mix} unit={unit} onChange={setMix} />
            <View accessible style={[styles.total, { borderColor: tooBig ? theme.danger : theme.line }]}>
              <Text variant="h3">{i18n.t("myGlass.total", { details: sizeAndStrength(totals, unit, i18n) })}</Text>
              {parts?.length ? (
                <Text variant="small">
                  {recipeText(parts, unit, i18n.locale, { unnamed: i18n.t("myGlass.unnamedPour"), soft: i18n.t("myGlass.softFallback") })}
                </Text>
              ) : null}
              {tooBig ? (
                <Text variant="small" color={theme.danger}>
                  {i18n.t("myGlass.tooBig", { max: sizeText(CUSTOM_BOUNDS.volumeMl.max, unit, i18n) })}
                </Text>
              ) : null}
            </View>
          </Animated.View>
        ) : (
          <Animated.View key="single" entering={FadeIn.duration(duration.enter)} style={styles.block}>
            <Text variant="label">{i18n.t("addDrink.volume")}</Text>
            <Stepper
              value={volume}
              min={minVolume}
              max={maxVolume}
              step={step}
              unit={unitLabel}
              onChange={setVolume}
              decreaseLabel={i18n.t("addDrink.lessVolume")}
              increaseLabel={i18n.t("addDrink.moreVolume")}
            />
            <Text variant="label">{i18n.t("addDrink.strength")}</Text>
            <Stepper
              value={abvTenths}
              min={CUSTOM_BOUNDS.abvPercent.min * 10}
              max={CUSTOM_BOUNDS.abvPercent.max * 10}
              step={5}
              unit="%"
              format={(tenths) => i18n.number(tenths / 10, tenths % 10 === 0 ? 0 : 1)}
              onChange={setAbvTenths}
              decreaseLabel={i18n.t("addDrink.lessStrength")}
              increaseLabel={i18n.t("addDrink.moreStrength")}
            />
          </Animated.View>
        )}
        <Text variant="label">{i18n.t("addDrink.glass")}</Text>
        <View style={styles.icons} accessibilityRole="radiogroup">
          {CUSTOM_ICONS.map((name) => {
            const on = name === icon;
            return (
              <ScalePressable
                key={name}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={i18n.t(`addDrink.glasses.${name}`)}
                onPress={() => setPickedIcon(name)}
                style={[styles.icon, { backgroundColor: on ? theme.text : theme.surface2, borderColor: on ? theme.amber : theme.line }]}
              >
                <Icon name={`glass:${name}`} size={24} color={on ? theme.bg : theme.amber} />
              </ScalePressable>
            );
          })}
        </View>
        <DrinkPhotoField uri={shownPhoto} icon={icon} name={name} onPick={setPhoto} onRemove={() => setPhoto(null)} />
        <View style={styles.actions}>
          <Button label={i18n.t("addDrink.cancel")} variant="secondary" height={size.buttonSmall + 4} style={styles.flex} onPress={onCancel} />
          <Button
            label={i18n.t("addDrink.saveDrink")}
            height={size.buttonSmall + 4}
            style={styles.flex}
            onPress={() => {
              // A mixed glass left unnamed takes the names of its pours.
              const named = name.trim() || (parts ? nameFromParts(parts) : "");
              if (!named) {
                setShowNameError(true);
                return;
              }
              if (tooBig) return;
              const photoChange = photo === undefined || (photo === null && !savedPhoto) ? {} : { photo };
              if (parts) onSave({ name: named, volumeMl: totals.volumeMl, abv: totals.abv, icon, parts, ...photoChange });
              else onSave({ name: named, volumeMl: Math.round(toMillilitres(volume, unit)), abv: abvTenths / 1000, icon, ...photoChange });
            }}
          />
        </View>
      </Panel>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 52, borderRadius: radius.input, borderWidth: 1.5, paddingHorizontal: 14 },
  actions: { flexDirection: "row", gap: 10 },
  block: { gap: 12 },
  total: { borderWidth: 1.5, borderRadius: radius.tile, padding: 12, gap: 4 },
  icons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  icon: { width: 48, height: 48, borderRadius: radius.tile, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
});
