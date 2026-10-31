import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { FoodLevel } from "@crew/bac";
import { duration, radius, space } from "@crew/design-tokens";
import { catalogueDrink, search } from "@crew/fuzzy";
import { drinkVolumeUnit, formatVolume, type VolumeUnit } from "@crew/units";
import { Field } from "@/crew/Field";
import { logDrink } from "@/drinks/actions";
import {
  GROUP_OF_KIND,
  genericAt,
  presetFromCatalogue,
  presetFromLine,
  learnSpelling,
  readOrder,
  searchCatalogue,
  SIZED_KINDS,
  withHousePint,
} from "@/drinks/catalogue";
import { CustomDrinkEditor } from "@/drinks/CustomDrinkEditor";
import { DrinkThumb } from "@/drinks/DrinkThumb";
import { readParts, recipeText } from "@/drinks/mixedGlass";
import { moveCustomDrink, removeCustomDrink, restoreCustomDrink, saveCustomDrink, sortedCustomDrinks, type CustomDrinkDraft } from "@/drinks/customDrinks";
import { eveningFood } from "@/drinks/food";
import { FoodPicker } from "@/drinks/FoodPicker";
import { drinkLabel, drinkWithArticle, sizeAndStrength } from "@/drinks/display";
import { GroupDetail, type GroupChoice } from "@/drinks/GroupDetail";
import { useHousePintHere } from "@/drinks/housePint";
import { HousePintRow } from "@/drinks/HousePintRow";
import { keepInMyDrinks } from "@/drinks/keep";
import { SuggestionCard, type Suggestion } from "@/drinks/OrderSuggestions";
import { offerUndo } from "@/drinks/undoToast";
import { presetFromCustom, presetsFor, type CustomDrink, type DrinkPreset } from "@/drinks/presets";
import { createTranslator, useT, type Translator } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { useNow } from "@/state/hooks";
import { useAppStore } from "@/state/store";
import { api } from "@/server/api";
import { useCrewData } from "@/server/crewData";
import { useTheme } from "@/theme";
import { Button, IconButton } from "@/ui/Button";
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
import { CUSTOM_ICONS } from "@/drinks/customOrder";

const MINUTE_MS = 60_000;
/** O-22: a forgotten drink goes back this far at most; older ones are edited from the history. */
const MAX_MINUTES_AGO = 12 * 60;

function volumeText(preset: DrinkPreset, unit: VolumeUnit, i18n: Translator): string {
  if (preset.abv === 0) return i18n.t("drinks.softSub");
  const suffix = unit === "us_fl_oz" ? "oz" : unit;
  return `${formatVolume(preset.volumeMl, unit, i18n.locale)} ${suffix}`;
}

type Selection = { type: "preset"; index: number } | { type: "custom"; id: string };
type Editing = { mode: "new"; prefill?: CustomDrinkDraft; replaceKey?: string } | { mode: "edit"; drink: CustomDrink } | null;

/** What a tile logs before anything is changed: its own size, and the bar's house pint on draught. */
function initialChoice(tile: DrinkPreset, houseAbv: number | null): GroupChoice {
  return { brandId: null, volumeMl: tile.volumeMl, abv: withHousePint(tile, houseAbv).abv, keep: false, sizeTouched: SIZED_KINDS.has(tile.kind) };
}

/** Route params: `new` opens "Nouvelle boisson" (with values to start from), `edit` a saved drink. */
type Params = { new?: string; edit?: string; name?: string; volumeMl?: string; abv?: string; icon?: string; replaceKey?: string };

function prefillFrom(params: Params): CustomDrinkDraft | undefined {
  const volumeMl = Number(params.volumeMl);
  const abv = Number(params.abv);
  if (!params.name || !Number.isFinite(volumeMl) || !Number.isFinite(abv)) return undefined;
  const icon = CUSTOM_ICONS.find((name) => name === params.icon);
  return { name: params.name, volumeMl, abv, ...(icon ? { icon } : {}) };
}

export default function AddDrinkSheet() {
  const i18n = useT();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<Params>();
  const preferences = useAppStore((state) => state.preferences);
  const customDrinks = sortedCustomDrinks(useAppStore((state) => state.customDrinks));
  const presets = presetsFor(preferences.unitSystem);
  const unit = drinkVolumeUnit(preferences.unitSystem);
  const now = useNow(MINUTE_MS / 4);
  const here = useHousePintHere();
  const houseAbv = here?.abv ?? null;
  const pintIndex = Math.max(0, presets.findIndex((preset) => preset.kind === "pint"));
  const [selection, setSelection] = useState<Selection>({ type: "preset", index: pintIndex });
  const [detailOpen, setDetailOpen] = useState(false);
  const [choice, setChoice] = useState<GroupChoice>(() => initialChoice(presets[pintIndex]!, houseAbv));
  const [choiceTouched, setChoiceTouched] = useState(false);
  // Minutes before now. Never negative: a drink in the future does not count (O-22).
  const [minutesAgo, setMinutesAgo] = useState(0);
  // O-85: the evening's food level, changeable for this drink alone.
  const [food, setFood] = useState<FoodLevel>(() => eveningFood());
  const [editing, setEditing] = useState<Editing>(() => {
    if (params.edit) {
      const drink = useAppStore.getState().customDrinks.find((d) => d.id === params.edit);
      if (drink) return { mode: "edit", drink };
    }
    if (params.new) {
      const prefill = prefillFrom(params);
      return { mode: "new", ...(prefill ? { prefill } : {}), ...(params.replaceKey ? { replaceKey: params.replaceKey } : {}) };
    }
    return null;
  });
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const live = useLiveParty();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  // Opened from a "+" or a "Modifier": the editor scrolls into view once it is laid out.
  const scrollToEditor = useRef(Boolean(params.new || params.edit));
  const sectionY = useRef(0);

  const tile = presets[selection.type === "preset" ? selection.index : pintIndex] ?? presets[0]!;
  const group = GROUP_OF_KIND[tile.kind];

  // The house pint arrives after the sheet opens: an untouched draught tile takes it.
  useEffect(() => {
    if (!choiceTouched) setChoice(initialChoice(tile, houseAbv));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new house pint resets the choice
  }, [houseAbv]);

  const selectedCustom = selection.type === "custom" ? customDrinks.find((d) => d.id === selection.id) : undefined;
  const brand = choice.brandId ? catalogueDrink(choice.brandId) : undefined;
  const preset: DrinkPreset = selectedCustom
    ? presetFromCustom(selectedCustom)
    : brand
      ? presetFromCatalogue(brand, i18n, choice.volumeMl, choice.abv)
      : genericAt(tile, choice.volumeMl, choice.abv, presets);
  const consumedAt = now - minutesAgo * MINUTE_MS;

  const pickTile = (index: number) => {
    haptic.select();
    const same = selection.type === "preset" && selection.index === index;
    // A second tap on the open tile folds its detail away; the choice stays.
    if (same) {
      setDetailOpen((open) => !open);
      return;
    }
    setSelection({ type: "preset", index });
    setChoice(initialChoice(presets[index]!, houseAbv));
    setChoiceTouched(false);
    setDetailOpen(true);
  };
  const pickCustom = (id: string) => {
    haptic.select();
    setSelection({ type: "custom", id });
    setDetailOpen(false);
  };

  const onRemove = (drink: CustomDrink) => {
    setMenuFor(null);
    if (selection.type === "custom" && selection.id === drink.id) setSelection({ type: "preset", index: pintIndex });
    removeCustomDrink(drink);
    showToast({
      message: i18n.t("addDrink.removed"),
      durationMs: 5_000,
      action: { label: i18n.t("common.undo"), onPress: () => restoreCustomDrink(drink) },
    });
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));
  const editorLayout = (y: number) => {
    if (!scrollToEditor.current) return;
    scrollToEditor.current = false;
    // The section reports its own place in the same layout pass: read it on the next frame.
    requestAnimationFrame(() => scroll.current?.scrollTo({ y: Math.max(0, sectionY.current + y - 16), animated: true }));
  };

  return (
    <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.content, { paddingBottom: 24 }]}
      >
        <View style={styles.title}>
          <Text variant="h2" accessibilityRole="header">
            {i18n.t("addDrink.title")}
          </Text>
          <IconButton icon="x" accessibilityLabel={i18n.t("common.close")} onPress={close} />
        </View>

        <QuickType presets={[...customDrinks.map(presetFromCustom), ...presets]} consumedAt={consumedAt} food={food} houseAbv={houseAbv} unit={unit} onDone={close} />

        <View style={styles.grid} accessibilityRole="radiogroup">
          {presets.map((item, index) => {
            const on = selection.type === "preset" && selection.index === index;
            const fg = on ? theme.bg : theme.text;
            const shown = withHousePint(item, houseAbv);
            return (
              <ScalePressable
                key={item.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on, expanded: on && detailOpen }}
                accessibilityLabel={`${drinkLabel(item, i18n)}, ${volumeText(shown, unit, i18n)}`}
                onPress={() => pickTile(index)}
                style={[styles.tile, { backgroundColor: on ? theme.text : theme.surface2 }]}
              >
                <Icon name={`glass:${item.icon}`} size={26} color={on ? theme.bg : theme.amber} />
                <Text variant="tag" color={fg} align="center">
                  {drinkLabel(item, i18n)}
                </Text>
                <Text variant="tab" color={on ? theme.bg : theme.textMuted} align="center">
                  {volumeText(shown, unit, i18n)}
                </Text>
              </ScalePressable>
            );
          })}
        </View>

        {selection.type === "preset" && group === "beer" && here ? <HousePintRow key={here.venueId} here={here} /> : null}

        {selection.type === "preset" && detailOpen && group ? (
          <GroupDetail
            key={tile.id}
            group={group}
            choice={choice}
            unit={unit}
            houseAbv={houseAbv}
            onChange={(next) => {
              setChoice(next);
              setChoiceTouched(true);
            }}
          />
        ) : null}

        <Animated.View
          layout={LinearTransition.duration(duration.reorder).easing(easings.reorder)}
          onLayout={(event) => {
            sectionY.current = event.nativeEvent.layout.y;
          }}
          style={styles.section}
        >
          <Text variant="label">{i18n.t("addDrink.myDrinks")}</Text>
          {customDrinks.map((drink, index) => {
            const asPreset = presetFromCustom(drink);
            const on = selection.type === "custom" && selection.id === drink.id;
            const parts = readParts(drink);
            const recipe = parts ? recipeText(parts, unit, i18n.locale, { unnamed: i18n.t("myGlass.unnamedPour"), soft: i18n.t("myGlass.softFallback") }) : null;
            if (editing?.mode === "edit" && editing.drink.id === drink.id) {
              return (
                <View key={drink.id} onLayout={(event) => editorLayout(event.nativeEvent.layout.y)}>
                  <CustomDrinkEditor
                    unitSystem={preferences.unitSystem}
                    initial={drink}
                    onCancel={() => setEditing(null)}
                    onSave={(draft) => {
                      saveCustomDrink(draft, drink);
                      setEditing(null);
                    }}
                  />
                </View>
              );
            }
            return (
              <View key={drink.id}>
                <View style={[styles.customRow, { backgroundColor: on ? theme.text : theme.surface2 }]}>
                  <ScalePressable
                    pressedScale={0.99}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={[drink.name, sizeAndStrength(asPreset, unit, i18n), recipe].filter(Boolean).join(", ")}
                    onPress={() => pickCustom(drink.id)}
                    onLongPress={() => {
                      haptic.select();
                      setMenuFor(drink.id);
                    }}
                    style={styles.customMain}
                  >
                    <DrinkThumb drinkId={drink.id} icon={drink.icon} size={24} photoSize={44} color={on ? theme.bg : theme.amber} />
                    <View style={styles.flex}>
                      <Text variant="h3" color={on ? theme.bg : theme.text}>
                        {drink.name}
                      </Text>
                      <Text variant="small" color={on ? theme.bg : theme.textMuted}>
                        {sizeAndStrength(asPreset, unit, i18n)}
                      </Text>
                      {/* A mixed glass shows what is in it ("Whisky 4 cl, Rhum 4 cl, Cola 20 cl"). */}
                      {recipe ? (
                        <Text variant="small" color={on ? theme.bg : theme.textMuted} numberOfLines={2}>
                          {recipe}
                        </Text>
                      ) : null}
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
            <View onLayout={(event) => editorLayout(event.nativeEvent.layout.y)}>
              <CustomDrinkEditor
                unitSystem={preferences.unitSystem}
                {...(editing.prefill ? { prefill: editing.prefill } : {})}
                onCancel={() => setEditing(null)}
                onSave={(draft) => {
                  const created = saveCustomDrink(draft);
                  // Edited from the party row: the saved drink takes the old entry's place there.
                  const replaced = editing.replaceKey;
                  if (replaced) useAppStore.setState((state) => ({ hiddenRowDrinks: [...state.hiddenRowDrinks.filter((k) => k !== replaced), replaced] }));
                  setEditing(null);
                  setSelection({ type: "custom", id: created.id });
                  setDetailOpen(false);
                }}
              />
            </View>
          ) : (
            <Button label={i18n.t("addDrink.newDrink")} icon="plus" variant="outline" height={48} onPress={() => setEditing({ mode: "new" })} />
          )}
        </Animated.View>

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
      {/* ADP-09: the main action stays pinned under the thumb, never at the end of a long scroll. It names exactly what it logs. */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, borderTopColor: theme.line }]}>
        <Button
          label={i18n.t("drinkCatalogue.addExact", { drink: drinkWithArticle(preset, i18n), details: sizeAndStrength(preset, unit, i18n) })}
          height={64}
          onPress={() => {
            const drink = logDrink(preset, consumedAt, food);
            if (!drink) return;
            if (choice.keep && !selectedCustom) keepInMyDrinks(preset, i18n);
            close();
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

interface QuickTypeProps {
  presets: DrinkPreset[];
  consumedAt: number;
  food: FoodLevel;
  houseAbv: number | null;
  unit: VolumeUnit;
  onDone: () => void;
}

/**
 * ADP-05: type or dictate "2 castel", "pinte 8", "demi kro", "polia redbull" or "2 pintes et un shot";
 * typos, plurals and accents are fine. Each drink understood becomes a card with its own Add.
 */
function QuickType({ presets, consumedAt, food, houseAbv, unit, onDone }: QuickTypeProps) {
  const i18n = useT();
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const [text, setText] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [added, setAdded] = useState<string[]>([]);
  const lines = useMemo(() => (text.trim() ? readOrder(text, presets, i18n) : []), [text, presets, i18n]);
  // AI-01: when the crew turned AI on, a sentence the local parser misses can go to the server.
  const aiCrew = useCrewData((state) => state.crews.find((c) => c.aiAvailable));
  const [ai, setAi] = useState<{ text: string; items: { value: string; quantity: number }[]; minutesAgo: number | null; venue: string | null; iPay: boolean } | null>(null);
  const [asking, setAsking] = useState(false);
  const fromAi = ai !== null && ai.text === text;
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

  const suggestions = useMemo<Suggestion[]>(() => {
    const byId = new Map(presets.map((p) => [p.id, p]));
    let found: { preset: DrinkPreset; quantity: number; guess?: boolean; typed?: string | null; catalogueId?: string | null }[];
    if (fromAi) {
      found = ai.items.flatMap((item) => {
        const preset = byId.get(item.value);
        return preset ? [{ preset: withHousePint(preset, houseAbv), quantity: item.quantity }] : [];
      });
    } else if (lines.length) {
      found = lines.flatMap((line) => {
        const preset = presetFromLine(line, presets, i18n, houseAbv);
        return preset ? [{ preset, quantity: line.quantity, guess: line.guess, typed: line.typed, catalogueId: line.drink?.id ?? null }] : [];
      });
    } else if (text.trim()) {
      // Nothing read as an order: the closest brands and drinks, one of each, to tap.
      const candidates = presets.map((p) => ({ value: p.id, names: p.kind === "custom" ? [p.name ?? ""] : [drinkLabel(p, i18n), drinkLabel(p, FR), drinkLabel(p, EN)] }));
      found = [
        ...search(text, candidates, 2).flatMap((id) => {
          const preset = byId.get(id);
          return preset ? [{ preset: withHousePint(preset, houseAbv), quantity: 1 }] : [];
        }),
        ...searchCatalogue(text, i18n, 3, useAppStore.getState().preferences.legalCountry).map((drink) => ({
          preset: presetFromCatalogue(drink, i18n),
          quantity: 1,
          guess: true,
          typed: text.trim(),
          catalogueId: drink.id,
        })),
      ];
    } else {
      found = [];
    }
    return found.map((item, index) => ({ key: `${index}:${item.preset.id}:${item.preset.volumeMl}:${item.preset.abv}`, ...item }));
  }, [fromAi, ai, lines, text, presets, i18n, houseAbv]);

  const shown = suggestions.filter((s) => !added.includes(s.key)).map((s) => ({ ...s, quantity: quantities[s.key] ?? s.quantity }));

  const changeText = (next: string) => {
    setText(next);
    setAdded([]);
    if (!next.trim()) setQuantities({});
  };

  /** Logs the cards given; the sheet closes once nothing is left to add. */
  const log = (cards: Suggestion[]) => {
    let count = 0;
    let single: ReturnType<typeof logDrink> = null;
    for (const card of cards) {
      // A guess the person confirmed teaches the app their spelling.
      if (card.guess && card.typed && card.catalogueId) learnSpelling(card.typed, card.catalogueId);
      for (let n = 0; n < card.quantity; n++) {
        const drink = logDrink(card.preset, at, food, count > 0);
        if (drink) {
          count += 1;
          single = drink;
        }
      }
    }
    if (!count) return;
    const remaining = shown.filter((s) => !cards.some((c) => c.key === s.key));
    setAdded((keys) => [...keys, ...cards.map((c) => c.key)]);
    if (!remaining.length) onDone();
    if (count === 1 && single) offerUndo(single, i18n, hourCycle);
    else showToast({ message: i18n.plural("addDrink.quickAdded", count) });
  };

  return (
    <View style={styles.quick}>
      <Field
        label={i18n.t("addDrink.quick")}
        placeholder={i18n.t("addDrink.quickPlaceholder")}
        value={text}
        onChangeText={changeText}
        autoCorrect={false}
        returnKeyType="done"
        hint={text.trim() && !suggestions.length ? i18n.t("addDrink.quickNone") : i18n.t("addDrink.quickHint")}
      />
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
      {shown.map((card) => (
        <SuggestionCard
          key={card.key}
          suggestion={card}
          unit={unit}
          onQuantity={(quantity) => setQuantities((current) => ({ ...current, [card.key]: quantity }))}
          onAdd={() => log([card])}
        />
      ))}
      {shown.length > 1 ? (
        <Animated.View entering={FadeIn.duration(duration.enter).easing(easings.out)}>
          <Button label={i18n.t("drinkCatalogue.addAll")} icon="plus" height={56} onPress={() => log(shown)} />
        </Animated.View>
      ) : null}
      {aiCrew && text.trim().split(/\s+/).length >= 3 && !fromAi ? (
        <Button label={i18n.t("addDrink.aiRead")} variant="outline" height={48} loading={asking} onPress={askAi} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { paddingHorizontal: space.screenX, paddingTop: 12, borderTopWidth: 1 },
  quick: { gap: 10 },
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
  section: { gap: 16 },
  customRow: { flexDirection: "row", alignItems: "center", borderRadius: radius.tile, paddingRight: 6 },
  customMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 8 },
  menu: { flexDirection: "row", gap: 8, marginTop: 8 },
  time: { gap: 8 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  flex: { flex: 1 },
});
