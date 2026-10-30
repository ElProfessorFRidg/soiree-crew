import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { FoodLevel } from "@crew/bac";
import { duration, radius, space } from "@crew/design-tokens";
import { parseOrder, search } from "@crew/fuzzy";
import { drinkVolumeUnit, formatVolume, type VolumeUnit } from "@crew/units";
import { Field } from "@/crew/Field";
import { logDrink } from "@/drinks/actions";
import { CustomDrinkEditor } from "@/drinks/CustomDrinkEditor";
import { moveCustomDrink, removeCustomDrink, restoreCustomDrink, saveCustomDrink, sortedCustomDrinks } from "@/drinks/customDrinks";
import { eveningFood } from "@/drinks/food";
import { FoodPicker } from "@/drinks/FoodPicker";
import { drinkLabel, drinkWithArticle } from "@/drinks/display";
import { offerUndo } from "@/drinks/undoToast";
import { presetFromCustom, presetsFor, type CustomDrink, type DrinkPreset } from "@/drinks/presets";
import { createTranslator, useT, type Translator } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { haptic } from "@/motion/haptics";
import { useNow } from "@/state/hooks";
import { useAppStore } from "@/state/store";
import { api } from "@/server/api";
import { useCrewData } from "@/server/crewData";
import { useTheme } from "@/theme";
import { Button, IconButton } from "@/ui/Button";
import { Chip } from "@/ui/controls";
import { hasNativeTimePicker, TimePicker } from "@/ui/native/TimePicker";
import { Stepper } from "@/ui/Stepper";
import { Icon } from "@/ui/Icon";
import { ScalePressable } from "@/ui/Pressable";
import { Text } from "@/ui/Text";
import { showToast, ToastHost } from "@/ui/Toast";
import { addPhotos } from "@/photos/uploads";
import { useLiveParty } from "@/server/crewData";
import { showFailure } from "@/server/errors";
import { showPermissionDenied } from "@/system/permissions";


const MINUTE_MS = 60_000;
/** O-22: a forgotten drink goes back this far at most; older ones are edited from the history. */
const MAX_MINUTES_AGO = 12 * 60;

function volumeText(preset: DrinkPreset, unit: VolumeUnit, i18n: Translator): string {
  if (preset.abv === 0) return i18n.t("drinks.softSub");
  const suffix = unit === "us_fl_oz" ? "oz" : unit;
  return `${formatVolume(preset.volumeMl, unit, i18n.locale)} ${suffix}`;
}

type Selection = { type: "preset"; index: number } | { type: "custom"; id: string };
type Editing = { mode: "new" } | { mode: "edit"; drink: CustomDrink } | null;

export default function AddDrinkSheet() {
  const i18n = useT();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const preferences = useAppStore((state) => state.preferences);
  const customDrinks = sortedCustomDrinks(useAppStore((state) => state.customDrinks));
  const presets = presetsFor(preferences.unitSystem);
  const unit = drinkVolumeUnit(preferences.unitSystem);
  const now = useNow(MINUTE_MS / 4);
  const [selection, setSelection] = useState<Selection>(() => ({
    type: "preset",
    index: Math.max(0, presets.findIndex((preset) => preset.kind === "pint")),
  }));
  // Minutes before now. Never negative: a drink in the future does not count (O-22).
  const [minutesAgo, setMinutesAgo] = useState(0);
  // O-85: the evening's food level, changeable for this drink alone.
  const [food, setFood] = useState<FoodLevel>(() => eveningFood());
  const [editing, setEditing] = useState<Editing>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const live = useLiveParty();

  const selectedCustom = selection.type === "custom" ? customDrinks.find((d) => d.id === selection.id) : undefined;
  const preset: DrinkPreset = selectedCustom
    ? presetFromCustom(selectedCustom)
    : (presets[selection.type === "preset" ? selection.index : 0] ?? presets[0]!);
  const consumedAt = now - minutesAgo * MINUTE_MS;

  const pick = (next: Selection) => {
    haptic.select();
    setSelection(next);
  };

  const onRemove = (drink: CustomDrink) => {
    setMenuFor(null);
    if (selection.type === "custom" && selection.id === drink.id) setSelection({ type: "preset", index: 0 });
    removeCustomDrink(drink);
    showToast({
      message: i18n.t("addDrink.removed"),
      durationMs: 5_000,
      action: { label: i18n.t("common.undo"), onPress: () => restoreCustomDrink(drink) },
    });
  };

  return (
    <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.content, { paddingBottom: 24 }]}
      >
        <View style={styles.title}>
          <Text variant="h2" accessibilityRole="header">
            {i18n.t("addDrink.title")}
          </Text>
          <IconButton icon="x" accessibilityLabel={i18n.t("common.close")} onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} />
        </View>

        <QuickType presets={[...customDrinks.map(presetFromCustom), ...presets]} consumedAt={consumedAt} food={food} onPick={(id) => {
          const index = presets.findIndex((p) => p.id === id);
          if (index >= 0) pick({ type: "preset", index });
          else pick({ type: "custom", id });
        }} />

        <View style={styles.grid} accessibilityRole="radiogroup">
          {presets.map((item, index) => {
            const on = selection.type === "preset" && selection.index === index;
            const fg = on ? theme.bg : theme.text;
            return (
              <ScalePressable
                key={item.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${drinkLabel(item, i18n)}, ${volumeText(item, unit, i18n)}`}
                onPress={() => pick({ type: "preset", index })}
                style={[styles.tile, { backgroundColor: on ? theme.text : theme.surface2 }]}
              >
                <Icon name={`glass:${item.icon}`} size={26} color={on ? theme.bg : theme.amber} />
                <Text variant="tag" color={fg} align="center">
                  {drinkLabel(item, i18n)}
                </Text>
                <Text variant="tab" color={on ? theme.bg : theme.textMuted} align="center">
                  {volumeText(item, unit, i18n)}
                </Text>
              </ScalePressable>
            );
          })}
        </View>

        <Text variant="label">{i18n.t("addDrink.myDrinks")}</Text>
        {customDrinks.map((drink, index) => {
          const asPreset = presetFromCustom(drink);
          const on = selection.type === "custom" && selection.id === drink.id;
          const strength = `${i18n.number(drink.abv * 100, Math.round(drink.abv * 1000) % 10 === 0 ? 0 : 1)} %`;
          if (editing?.mode === "edit" && editing.drink.id === drink.id) {
            return (
              <CustomDrinkEditor
                key={drink.id}
                unitSystem={preferences.unitSystem}
                initial={drink}
                onCancel={() => setEditing(null)}
                onSave={(draft) => {
                  saveCustomDrink(draft, drink);
                  setEditing(null);
                }}
              />
            );
          }
          return (
            <View key={drink.id}>
              <View style={[styles.customRow, { backgroundColor: on ? theme.text : theme.surface2 }]}>
                <ScalePressable
                  pressedScale={0.99}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${drink.name}, ${volumeText(asPreset, unit, i18n)}, ${strength}`}
                  onPress={() => pick({ type: "custom", id: drink.id })}
                  onLongPress={() => {
                    haptic.select();
                    setMenuFor(drink.id);
                  }}
                  style={styles.customMain}
                >
                  <Icon name={`glass:${drink.icon}`} size={24} color={on ? theme.bg : theme.amber} />
                  <View style={styles.flex}>
                    <Text variant="h3" color={on ? theme.bg : theme.text}>
                      {drink.name}
                    </Text>
                    <Text variant="small" color={on ? theme.bg : theme.textMuted}>
                      {volumeText(asPreset, unit, i18n)}, {strength}
                    </Text>
                  </View>
                </ScalePressable>
                {/* Long press is a shortcut, never the only way in (ADP-04). */}
                <IconButton
                  icon="more"
                  accessibilityLabel={i18n.t("addDrink.more", { name: drink.name })}
                  onPress={() => setMenuFor((open) => (open === drink.id ? null : drink.id))}
                />
              </View>
              {menuFor === drink.id ? (
                <Animated.View entering={FadeIn.duration(duration.enter)} style={styles.menu}>
                  <Button
                    label={i18n.t("addDrink.edit")}
                    icon="edit"
                    variant="secondary"
                    height={44}
                    style={styles.flex}
                    onPress={() => {
                      setMenuFor(null);
                      setEditing({ mode: "edit", drink });
                    }}
                  />
                  <Button label={i18n.t("addDrink.remove")} icon="trash" variant="danger" height={44} style={styles.flex} onPress={() => onRemove(drink)} />
                </Animated.View>
              ) : null}
              {/* O-21: the user's own order, one step at a time; the menu stays open to keep moving. */}
              {menuFor === drink.id && customDrinks.length > 1 ? (
                <Animated.View entering={FadeIn.duration(duration.enter)} style={styles.menu}>
                  <Button
                    label={i18n.t("addDrink.moveUp")}
                    icon="arrowup"
                    variant="outline"
                    height={44}
                    style={styles.flex}
                    disabled={index === 0}
                    onPress={() => {
                      if (moveCustomDrink(drink.id, -1)) haptic.select();
                    }}
                  />
                  <Button
                    label={i18n.t("addDrink.moveDown")}
                    icon="arrowdn"
                    variant="outline"
                    height={44}
                    style={styles.flex}
                    disabled={index === customDrinks.length - 1}
                    onPress={() => {
                      if (moveCustomDrink(drink.id, 1)) haptic.select();
                    }}
                  />
                </Animated.View>
              ) : null}
            </View>
          );
        })}
        {editing?.mode === "new" ? (
          <CustomDrinkEditor
            unitSystem={preferences.unitSystem}
            onCancel={() => setEditing(null)}
            onSave={(draft) => {
              const created = saveCustomDrink(draft);
              setEditing(null);
              setSelection({ type: "custom", id: created.id });
            }}
          />
        ) : (
          <Button label={i18n.t("addDrink.newDrink")} icon="plus" variant="outline" height={48} onPress={() => setEditing({ mode: "new" })} />
        )}

        <View style={styles.time}>
          <Text variant="label">{i18n.t("addDrink.drankAt")}</Text>
          {/* O-22: never in the future. iOS: the system time picker; elsewhere one minute per tap, faster while held. */}
          {hasNativeTimePicker ? (
            <View style={styles.timeRow}>
              <Text style={styles.flex} muted={minutesAgo !== 0}>
                {minutesAgo === 0 ? i18n.t("addDrink.noFuture") : formatClock(consumedAt, i18n.language, preferences.hourCycle)}
              </Text>
              <TimePicker
                value={consumedAt}
                min={now - MAX_MINUTES_AGO * MINUTE_MS}
                max={now}
                tintColor={theme.amber}
                onChange={(at) => {
                  haptic.select();
                  setMinutesAgo(Math.min(MAX_MINUTES_AGO, Math.max(0, Math.round((now - at) / MINUTE_MS))));
                }}
              />
            </View>
          ) : (
          <Stepper
            value={-minutesAgo}
            min={-MAX_MINUTES_AGO}
            max={0}
            editable={false}
            size={34}
            format={(offset) => formatClock(now + offset * MINUTE_MS, i18n.language, preferences.hourCycle)}
            onChange={(offset) => setMinutesAgo(-offset)}
            decreaseLabel={i18n.t("addDrink.earlier")}
            increaseLabel={i18n.t("addDrink.later")}
            boundMessage={minutesAgo === 0 ? i18n.t("addDrink.noFuture") : undefined}
          />
          )}
        </View>

        <FoodPicker value={food} onChange={setFood} hint={i18n.t("addDrink.withFoodHint")} />

        {live ? (
          // O-83: a photo of the drink goes to the party album, not to the drink itself.
          <Button
            label={i18n.t("addDrink.photo")}
            icon="camera"
            variant="outline"
            height={44}
            onPress={() =>
              void addPhotos(live.party.id, "camera")
                .then((n) => {
                  if (n > 0) showToast({ message: i18n.t("addDrink.photoAdded") });
                  else if (n === -3) showToast({ message: i18n.t("vault.queued") });
                  else if (n < 0) showPermissionDenied(i18n, i18n.t("album.denied"), n === -1);
                })
                .catch(showFailure(i18n))
            }
          />
        ) : null}
      </ScrollView>
      {/* ADP-09: the main action stays pinned under the thumb, never at the end of a long scroll. */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, borderTopColor: theme.line }]}>
        <Button
          label={i18n.t("addDrink.add", { drink: drinkWithArticle(preset, i18n) })}
          height={64}
          onPress={() => {
            const drink = logDrink(preset, consumedAt, food);
            if (!drink) return;
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)");
            offerUndo(drink, i18n, preferences.hourCycle);
          }}
        />
      </View>
      <ToastHost bottomOffset={insets.bottom + 92} />
    </View>
  );
}

const FR = createTranslator("fr");
const EN = createTranslator("en");

/** ADP-05: type or dictate "2 pintes et un shot"; typos, plurals and accents are fine. */
function QuickType({ presets, consumedAt, food, onPick }: { presets: DrinkPreset[]; consumedAt: number; food: FoodLevel; onPick: (id: string) => void }) {
  const i18n = useT();
  const [text, setText] = useState("");
  const candidates = useMemo(
    // The user's own language first, then French and English, so any of them is understood.
    () => presets.map((p) => ({ value: p.id, names: p.kind === "custom" ? [p.name ?? ""] : [drinkLabel(p, i18n), drinkLabel(p, FR), drinkLabel(p, EN)] })),
    [presets, i18n],
  );
  const localOrder = useMemo(() => (text.trim() ? parseOrder(text, candidates) : []), [text, candidates]);
  // AI-01: when the crew turned AI on, a sentence the local parser misses can go to the server.
  const aiCrew = useCrewData((state) => state.crews.find((c) => c.aiAvailable));
  const [ai, setAi] = useState<{ text: string; items: { value: string; quantity: number }[]; minutesAgo: number | null; venue: string | null; iPay: boolean } | null>(null);
  const [asking, setAsking] = useState(false);
  const fromAi = ai !== null && ai.text === text;
  const order = fromAi ? ai.items : localOrder;
  const askAi = () => {
    if (!aiCrew) return;
    setAsking(true);
    void api<{ items: { id: string; quantity: number }[]; minutesAgo: number | null; venue: string | null; iPay: boolean }>("/v1/ai/order", {
      method: "POST",
      body: { crewId: aiCrew.id, text: text.trim(), drinks: presets.slice(0, 60).map((p) => ({ id: p.id, name: drinkLabel(p, i18n) })) },
    })
      .then((res) => setAi({ text, items: res.items.map((i) => ({ value: i.id, quantity: i.quantity })), minutesAgo: res.minutesAgo, venue: res.venue, iPay: res.iPay }))
      .catch(() => showToast({ tone: "danger", message: i18n.t("addDrink.aiFailed") }))
      .finally(() => setAsking(false));
  };
  const at = fromAi && ai.minutesAgo ? Date.now() - ai.minutesAgo * 60_000 : consumedAt;
  const suggestions = useMemo(() => (text.trim() && !order.length ? search(text, candidates, 4) : []), [text, order, candidates]);
  const byId = (id: string) => presets.find((p) => p.id === id)!;
  const summary = order.map((o) => `${o.quantity} × ${drinkLabel(byId(o.value), i18n)}`).join(", ");

  return (
    <View style={styles.quick}>
      <Field
        label={i18n.t("addDrink.quick")}
        placeholder={i18n.t("addDrink.quickPlaceholder")}
        value={text}
        onChangeText={setText}
        autoCorrect={false}
        returnKeyType="done"
        hint={text.trim() && !order.length && !suggestions.length ? i18n.t("addDrink.quickNone") : i18n.t("addDrink.quickHint")}
      />
      {order.length ? (
        <Button
          label={i18n.t("addDrink.quickAdd", { list: summary })}
          icon="plus"
          height={56}
          onPress={() => {
            let count = 0;
            for (const o of order) {
              for (let n = 0; n < o.quantity; n++) if (logDrink(byId(o.value), at, food, count > 0)) count += 1;
            }
            if (!count) return;
            haptic.drinkAdded();
            showToast({ message: i18n.plural("addDrink.quickAdded", count) });
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)");
          }}
        />
      ) : null}
      {fromAi && (ai.venue || ai.iPay || ai.minutesAgo) ? (
        <Text variant="small">
          {[
            ai.minutesAgo ? i18n.t("addDrink.aiAgo", { minutes: ai.minutesAgo }) : null,
            ai.venue ? i18n.t("addDrink.aiVenue", { venue: ai.venue }) : null,
            ai.iPay ? i18n.t("addDrink.aiPay") : null,
          ]
            .filter(Boolean)
            .join(" ")}
        </Text>
      ) : null}
      {aiCrew && text.trim().split(/\s+/).length >= 3 && !fromAi ? (
        <Button label={i18n.t("addDrink.aiRead")} variant="outline" height={48} loading={asking} onPress={askAi} />
      ) : null}
      {suggestions.length ? (
        <View style={styles.grid}>
          {suggestions.map((id) => (
            <Chip key={id} label={drinkLabel(byId(id), i18n)} onPress={() => {
              onPick(id);
              setText("");
            }} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { paddingHorizontal: space.screenX, paddingTop: 12, borderTopWidth: 1 },
  quick: { gap: 8 },
  sheet: { flex: 1 },
  content: { paddingHorizontal: space.screenX, paddingTop: 20, gap: 16 },
  title: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: {
    flexBasis: "22%",
    flexGrow: 1,
    minHeight: 84,
    borderRadius: radius.tile,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  customRow: { flexDirection: "row", alignItems: "center", borderRadius: radius.tile, paddingRight: 6 },
  customMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 14 },
  menu: { flexDirection: "row", gap: 8, marginTop: 8 },
  time: { gap: 8 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  flex: { flex: 1 },
});
