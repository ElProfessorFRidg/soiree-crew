import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { duration, radius, size, space } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { easings } from "@/motion/easing";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { Stepper } from "@/ui/Stepper";
import { Text } from "@/ui/Text";
import { strengthText } from "./display";
import { setHousePint, type HousePintHere } from "./housePint";

/** Tenths of a percent, the server's bounds (HOUSE_PINT_ABV): no tap beer under 2 % or over 14 %. */
const MIN_TENTHS = 20;
const MAX_TENTHS = 140;
const DEFAULT_TENTHS = 50;

/**
 * "La pinte ici fait 6 %": the bar's house pint, set once by anyone of the crew checked in here and
 * used by everyone's Pinte and Encore at this bar.
 */
export function HousePintRow({ here }: { here: HousePintHere }) {
  const i18n = useT();
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [tenths, setTenths] = useState(Math.round((here.abv ?? DEFAULT_TENTHS / 1000) * 1000));
  const asking = here.abv === null || editing;

  const save = (abv: number | null) => {
    setEditing(false);
    void setHousePint(here, abv, i18n);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(duration.enter).easing(easings.out)}
      layout={LinearTransition.duration(duration.reorder).easing(easings.reorder)}
      style={[styles.panel, { backgroundColor: theme.surface2 }]}
    >
      <View style={styles.head}>
        <Icon name="glass:pint" size={24} color={theme.amber} />
        <View style={styles.flex}>
          <Text variant="h3">
            {asking ? i18n.t("drinkCatalogue.housePintAsk", { venue: here.venueName }) : i18n.t("drinkCatalogue.housePint", { abv: strengthText(here.abv!, i18n) })}
          </Text>
          <Text variant="small">
            {!asking && here.byName ? i18n.t("drinkCatalogue.housePintBy", { name: here.byName }) : i18n.t("drinkCatalogue.housePintHint")}
          </Text>
        </View>
        {!asking ? (
          <Button
            label={i18n.t("drinkCatalogue.housePintChange")}
            variant="outline"
            height={size.buttonSmall + 4}
            onPress={() => {
              setTenths(Math.round(here.abv! * 1000));
              setEditing(true);
            }}
          />
        ) : null}
      </View>
      {asking ? (
        <Animated.View entering={FadeIn.duration(duration.enter).easing(easings.out)} style={styles.edit}>
          <Stepper
            value={tenths}
            min={MIN_TENTHS}
            max={MAX_TENTHS}
            step={5}
            unit="%"
            format={(value) => i18n.number(value / 10, value % 10 === 0 ? 0 : 1)}
            onChange={setTenths}
            decreaseLabel={i18n.t("addDrink.lessStrength")}
            increaseLabel={i18n.t("addDrink.moreStrength")}
          />
          <View style={styles.actions}>
            {editing ? (
              <Button label={i18n.t("addDrink.cancel")} variant="secondary" height={48} style={styles.flex} onPress={() => setEditing(false)} />
            ) : null}
            <Button label={i18n.t("drinkCatalogue.housePintSave")} height={48} style={styles.flex} onPress={() => save(tenths / 1000)} />
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: radius.card, padding: space.cardPadding, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  edit: { gap: 12 },
  actions: { flexDirection: "row", gap: 10 },
  flex: { flex: 1, minWidth: 0 },
});
