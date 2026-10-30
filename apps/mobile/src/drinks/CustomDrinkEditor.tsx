import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { duration, radius, size, type, type GlassIconName } from "@crew/design-tokens";
import { convertVolume, drinkVolumeUnit, toMillilitres, type UnitSystem } from "@crew/units";
import { useT } from "@/i18n";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { ScalePressable } from "@/ui/Pressable";
import { Panel } from "@/ui/controls";
import { Stepper } from "@/ui/Stepper";
import { Text } from "@/ui/Text";
import { CUSTOM_BOUNDS, type CustomDrinkDraft } from "./customDrinks";
import { CUSTOM_ICONS, guessIcon } from "./customOrder";
import type { CustomDrink } from "./presets";

interface Props {
  unitSystem: UnitSystem;
  initial?: CustomDrink;
  onSave: (draft: CustomDrinkDraft) => void;
  onCancel: () => void;
}

export function CustomDrinkEditor({ unitSystem, initial, onSave, onCancel }: Props) {
  const i18n = useT();
  const theme = useTheme();
  const unit = drinkVolumeUnit(unitSystem);
  // The stepper works in whole menu units: cl, fl oz or ml.
  const step = unit === "ml" ? 25 : 1;
  const toUnit = (ml: number) => Math.round(convertVolume(ml, unit));
  const [name, setName] = useState(initial?.name ?? "");
  const [volume, setVolume] = useState(toUnit(initial?.volumeMl ?? 330));
  // Strength in tenths of a percent, so 8.4 % is exact.
  const [abvTenths, setAbvTenths] = useState(Math.round((initial?.abv ?? 0.08) * 1000));
  const [showNameError, setShowNameError] = useState(false);
  // O-21: the glass follows size and strength until the user picks one.
  const [pickedIcon, setPickedIcon] = useState<GlassIconName | null>(initial?.icon ?? null);
  const icon = pickedIcon ?? guessIcon(toMillilitres(volume, unit), abvTenths / 1000);

  const unitLabel = unit === "us_fl_oz" ? "oz" : unit;
  const minVolume = Math.max(1, toUnit(CUSTOM_BOUNDS.volumeMl.min));
  const maxVolume = toUnit(CUSTOM_BOUNDS.volumeMl.max);

  return (
    <Animated.View entering={FadeIn.duration(duration.enter)}>
      <Panel style={{ backgroundColor: theme.bg }}>
        <Text variant="label">{i18n.t("addDrink.name")}</Text>
        <TextInput
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (text.trim()) setShowNameError(false);
          }}
          placeholder={i18n.t("addDrink.namePlaceholder")}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={i18n.t("addDrink.name")}
          autoCapitalize="sentences"
          autoCorrect={false}
          returnKeyType="done"
          maxLength={40}
          style={[
            styles.input,
            type.body,
            { color: theme.text, backgroundColor: theme.inputBg, borderColor: showNameError ? theme.danger : theme.inputBorder },
          ]}
        />
        {showNameError ? <Text variant="small" color={theme.danger}>{i18n.t("addDrink.nameRequired")}</Text> : null}
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
        <View style={styles.actions}>
          <Button label={i18n.t("addDrink.cancel")} variant="secondary" height={size.buttonSmall + 4} style={styles.flex} onPress={onCancel} />
          <Button
            label={i18n.t("addDrink.saveDrink")}
            height={size.buttonSmall + 4}
            style={styles.flex}
            onPress={() => {
              if (!name.trim()) {
                setShowNameError(true);
                return;
              }
              onSave({ name, volumeMl: Math.round(toMillilitres(volume, unit)), abv: abvTenths / 1000, icon });
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
  icons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  icon: { width: 48, height: 48, borderRadius: radius.tile, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
});
