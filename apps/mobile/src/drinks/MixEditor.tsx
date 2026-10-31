import { useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { duration, radius } from "@crew/design-tokens";
import type { VolumeUnit } from "@crew/units";
import { useT } from "@/i18n";
import { easings } from "@/motion/easing";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Button, IconButton } from "@/ui/Button";
import { Chip } from "@/ui/controls";
import { inputText } from "@/ui/inputText";
import { Stepper } from "@/ui/Stepper";
import { Text } from "@/ui/Text";
import { catalogueLabel, searchCatalogue } from "./catalogue";
import { MIX_BOUNDS, halfAndHalf, newPour, pourStep, softStep, toStep, type Mix, type Pour } from "./mixedGlass";

interface Props {
  mix: Mix;
  unit: VolumeUnit;
  onChange: (next: Mix) => void;
}

const reorder = () => LinearTransition.duration(duration.reorder).easing(easings.reorder);

/**
 * O-21, the pours of a mixed glass: each spirit with its name (the catalogue fills its strength),
 * its dose and its strength, then the soft it is topped with. Amounts are free, in the user's unit.
 */
export function MixEditor({ mix, unit, onChange }: Props) {
  const i18n = useT();
  const theme = useTheme();
  const unitLabel = unit === "us_fl_oz" || unit === "uk_fl_oz" ? "oz" : unit;
  const setPour = (key: string, change: Partial<Pour>) => onChange({ ...mix, pours: mix.pours.map((pour) => (pour.key === key ? { ...pour, ...change } : pour)) });
  const evenAlready = mix.pours.length === 2 && mix.pours[0]!.volume === mix.pours[1]!.volume;

  return (
    <View style={styles.wrap}>
      <Text variant="label">{i18n.t("myGlass.pours")}</Text>
      {mix.pours.map((pour) => (
        <Animated.View
          key={pour.key}
          entering={FadeIn.duration(duration.enter).easing(easings.out)}
          exiting={FadeOut.duration(Math.round(duration.enter / 2))}
          layout={reorder()}
          style={[styles.pour, { backgroundColor: theme.surface2 }]}
        >
          <PourRow pour={pour} unit={unit} unitLabel={unitLabel} canRemove={mix.pours.length > 1} onChange={(change) => setPour(pour.key, change)} onRemove={() => onChange({ ...mix, pours: mix.pours.filter((p) => p.key !== pour.key) })} />
        </Animated.View>
      ))}
      <Animated.View layout={reorder()} style={styles.actions}>
        {evenAlready ? null : (
          <Button
            label={i18n.t("myGlass.halfAndHalf")}
            accessibilityHint={i18n.t("myGlass.halfAndHalfHint")}
            variant="secondary"
            height={44}
            onPress={() => onChange(halfAndHalf(mix, unit))}
          />
        )}
        {mix.pours.length < MIX_BOUNDS.pours ? (
          <Button
            label={i18n.t("myGlass.addPour")}
            icon="plus"
            variant="outline"
            height={44}
            onPress={() => onChange({ ...mix, pours: [...mix.pours, newPour(unit)] })}
          />
        ) : null}
      </Animated.View>
      <Animated.View layout={reorder()} style={styles.wrap}>
        <Text variant="label">{i18n.t("myGlass.soft")}</Text>
        <TextInput
          value={mix.softName}
          onChangeText={(softName) => onChange({ ...mix, softName })}
          placeholder={i18n.t("myGlass.softPlaceholder")}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={i18n.t("myGlass.soft")}
          autoCapitalize="sentences"
          autoCorrect={false}
          returnKeyType="done"
          maxLength={40}
          style={[styles.input, inputText(), { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
        />
        <Stepper
          value={mix.softVolume}
          min={0}
          max={toStep(MIX_BOUNDS.softMl.max, unit, softStep(unit))}
          step={softStep(unit)}
          unit={unitLabel}
          size={34}
          onChange={(softVolume) => onChange({ ...mix, softVolume })}
          decreaseLabel={i18n.t("addDrink.lessVolume")}
          increaseLabel={i18n.t("addDrink.moreVolume")}
        />
      </Animated.View>
    </View>
  );
}

interface PourRowProps {
  pour: Pour;
  unit: VolumeUnit;
  unitLabel: string;
  canRemove: boolean;
  onChange: (change: Partial<Pour>) => void;
  onRemove: () => void;
}

function PourRow({ pour, unit, unitLabel, canRemove, onChange, onRemove }: PourRowProps) {
  const i18n = useT();
  const theme = useTheme();
  const country = useAppStore((state) => state.preferences.legalCountry);
  // Suggestions while the name is being typed; a pick (or a name that is one) puts them away.
  const [typing, setTyping] = useState(false);
  const spirits = useMemo(() => {
    if (!typing) return [];
    const found = searchCatalogue(pour.name, i18n, 8, country).filter((drink) => drink.abv > 0);
    // Typed in full and already at its strength: nothing left to pick.
    const done = found.some((drink) => catalogueLabel(drink, i18n).toLowerCase() === pour.name.trim().toLowerCase() && Math.round(drink.abv * 1000) === pour.abvTenths);
    return done ? [] : found.slice(0, 4);
  }, [typing, pour.name, pour.abvTenths, i18n, country]);
  const step = pourStep(unit);
  const label = pour.name.trim() || i18n.t("myGlass.unnamedPour");

  return (
    <>
      <View style={styles.head}>
        <TextInput
          value={pour.name}
          onChangeText={(name) => {
            setTyping(true);
            onChange({ name });
          }}
          placeholder={i18n.t("myGlass.pourPlaceholder")}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={i18n.t("myGlass.pourName")}
          accessibilityHint={i18n.t("myGlass.pourHint")}
          autoCapitalize="sentences"
          autoCorrect={false}
          returnKeyType="done"
          maxLength={40}
          style={[styles.input, styles.flex, inputText(), { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
        />
        {canRemove ? <IconButton icon="x" accessibilityLabel={i18n.t("myGlass.removePour", { name: label })} onPress={onRemove} /> : null}
      </View>
      {spirits.length ? (
        <Animated.View entering={FadeIn.duration(duration.enter)} style={styles.chips}>
          {spirits.map((drink) => (
            <Chip
              key={drink.id}
              label={catalogueLabel(drink, i18n)}
              onPress={() => {
                setTyping(false);
                onChange({ name: catalogueLabel(drink, i18n).slice(0, 40), abvTenths: Math.round(drink.abv * 1000) });
              }}
            />
          ))}
        </Animated.View>
      ) : null}
      <Stepper
        value={pour.volume}
        min={toStep(MIX_BOUNDS.pourMl.min, unit, step)}
        max={toStep(MIX_BOUNDS.pourMl.max, unit, step)}
        step={step}
        unit={unitLabel}
        size={34}
        format={(value) => i18n.number(value, Number.isInteger(value) ? 0 : 1)}
        onChange={(volume) => onChange({ volume })}
        decreaseLabel={i18n.t("addDrink.lessVolume")}
        increaseLabel={i18n.t("addDrink.moreVolume")}
      />
      <Stepper
        value={pour.abvTenths}
        min={MIX_BOUNDS.pourAbvTenths.min}
        max={MIX_BOUNDS.pourAbvTenths.max}
        step={5}
        unit="%"
        size={34}
        format={(tenths) => i18n.number(tenths / 10, tenths % 10 === 0 ? 0 : 1)}
        onChange={(abvTenths) => onChange({ abvTenths })}
        decreaseLabel={i18n.t("addDrink.lessStrength")}
        increaseLabel={i18n.t("addDrink.moreStrength")}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  pour: { borderRadius: radius.tile, padding: 12, gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  // One under the other: side by side, the labels were cut at phone width.
  actions: { gap: 8 },
  input: { minHeight: 52, borderRadius: radius.input, borderWidth: 1.5, paddingHorizontal: 14 },
  flex: { flex: 1 },
});
