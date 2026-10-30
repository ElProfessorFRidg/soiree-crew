import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { foodOf, type FoodLevel } from "@crew/bac";
import { drinkVolumeUnit, formatVolume } from "@crew/units";
import { editDrink, removeDrink, restoreDrink } from "@/drinks/actions";
import { drinkLabel } from "@/drinks/display";
import { FoodPicker } from "@/drinks/FoodPicker";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { haptic } from "@/motion/haptics";
import { useNow } from "@/state/hooks";
import { useAppStore } from "@/state/store";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Stepper } from "@/ui/Stepper";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

const MINUTE_MS = 60_000;
/** A drink moves at most this far either way in one edit. */
const SHIFT_MINUTES = 12 * 60;

/**
 * O-23 and O-22: a logged drink, changed after the fact. Time to the minute (hold to go faster),
 * volume, strength and what was eaten. A change of volume, strength or time drops a friend's
 * confirmation on the server (RANK-06).
 */
export default function EditDrinkScreen() {
  const i18n = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const drink = useAppStore((state) => state.drinks.find((d) => d.id === id));
  const preferences = useAppStore((state) => state.preferences);
  const now = useNow(MINUTE_MS / 4);
  const [shift, setShift] = useState(0);
  const [volumeMl, setVolumeMl] = useState(drink?.volumeMl ?? 0);
  const [percent, setPercent] = useState(drink ? Math.round(drink.abv * 1000) / 10 : 0);
  const [food, setFood] = useState<FoodLevel>(drink ? foodOf(drink) : "none");

  if (!drink) {
    return (
      <Screen back title={i18n.t("history.editTitle")}>
        <Text>{i18n.t("history.editGone")}</Text>
      </Screen>
    );
  }

  const unit = drinkVolumeUnit(preferences.unitSystem);
  const suffix = unit === "us_fl_oz" ? "oz" : unit;
  const latest = Math.floor((now - drink.consumedAt) / MINUTE_MS);
  const consumedAt = drink.consumedAt + shift * MINUTE_MS;
  const abv = Math.round(percent * 10) / 1000;
  const changed = shift !== 0 || volumeMl !== drink.volumeMl || abv !== drink.abv || food !== foodOf(drink);
  const confirmedDetails = shift !== 0 || volumeMl !== drink.volumeMl || abv !== drink.abv;
  const back = () => (router.canGoBack() ? router.back() : router.replace("/history"));

  return (
    <Screen
      back
      title={i18n.t("history.editTitle")}
      withToasts
      footer={
        <Button
          label={i18n.t("history.save")}
          height={56}
          disabled={!changed}
          onPress={() => {
            haptic.confirmed();
            editDrink(drink, { consumedAt, volumeMl, abv, food });
            back();
          }}
        />
      }
    >
      <Text variant="h2">{drinkLabel(drink, i18n)}</Text>
      <Panel>
        <Text variant="label">{i18n.t("addDrink.drankAt")}</Text>
        <Stepper
          value={shift}
          min={-SHIFT_MINUTES}
          max={Math.max(0, Math.min(SHIFT_MINUTES, latest))}
          editable={false}
          size={34}
          format={(minutes) => formatClock(drink.consumedAt + minutes * MINUTE_MS, i18n.language, preferences.hourCycle)}
          onChange={setShift}
          decreaseLabel={i18n.t("addDrink.earlier")}
          increaseLabel={i18n.t("addDrink.later")}
          boundMessage={shift >= latest ? i18n.t("addDrink.noFuture") : undefined}
        />
      </Panel>
      <Panel>
        <Text variant="label">{i18n.t("history.volume")}</Text>
        <Stepper
          value={volumeMl}
          min={10}
          max={3000}
          step={unit === "us_fl_oz" || unit === "uk_fl_oz" ? 15 : 10}
          format={(ml) => formatVolume(ml, unit, i18n.locale)}
          unit={suffix}
          editable={false}
          size={34}
          onChange={setVolumeMl}
          decreaseLabel={i18n.t("history.less")}
          increaseLabel={i18n.t("history.more")}
        />
        <Text variant="label">{i18n.t("history.strength")}</Text>
        <Stepper
          value={percent}
          min={0}
          max={80}
          step={0.5}
          format={(p) => i18n.number(p, Number.isInteger(p) ? 0 : 1)}
          unit="%"
          size={34}
          onChange={setPercent}
          decreaseLabel={i18n.t("history.less")}
          increaseLabel={i18n.t("history.more")}
        />
      </Panel>
      <FoodPicker value={food} onChange={setFood} />
      {confirmedDetails ? <Text variant="small">{i18n.t("history.editUnconfirms")}</Text> : null}
      <View style={styles.actions}>
        <Button
          label={i18n.t("history.remove")}
          icon="trash"
          variant="outline"
          height={48}
          onPress={() => {
            haptic.select();
            removeDrink(drink);
            showToast({ message: i18n.t("history.removed"), durationMs: 5_000, action: { label: i18n.t("common.undo"), onPress: () => restoreDrink(drink) } });
            back();
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 10 },
});
