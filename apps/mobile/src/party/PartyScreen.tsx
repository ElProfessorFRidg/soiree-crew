import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { POISONING_CARD_THRESHOLD, type UiLevel } from "@crew/bac";
import { duration, palette, size, space } from "@crew/design-tokens";
import type { BacUnit } from "@crew/units";
import { lastDrink, logDrink, logWater } from "@/drinks/actions";
import { offerUndo } from "@/drinks/undoToast";
import { againLabel, alternateUnit, bacText, unitCycle } from "@/drinks/display";
import { defaultPreset, presetFromEntry } from "@/drinks/presets";
import { useT, type Translator } from "@/i18n";
import { formatClock, formatDuration } from "@/i18n/format";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { useLiveBac, useNow, useUiLevel, type LiveBac } from "@/state/hooks";
import { useAppStore } from "@/state/store";
import { submit } from "@/sync/engine";
import { useTheme } from "@/theme";
import { Button, IconButton } from "@/ui/Button";
import { Panel, Row, Segmented, Tag } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Numeral, Text } from "@/ui/Text";
import { AddDrinkButton } from "./AddDrinkButton";
import { CrewStrip } from "./CrewStrip";
import { SosBanner } from "@/crew/SosBanner";
import { useEco } from "@/power/eco";
import { TravelPrompt } from "@/travel/TravelPrompt";
import { VaultPrompt } from "@/vault/VaultPrompt";
import { useLiveParty, type PartyMood } from "@/server/crewData";
import { useVenueData } from "@/server/venueData";
import { RollingNumber } from "./RollingNumber";

function greetingKey(hour: number) {
  if (hour < 5) return "greeting.lateNight" as const;
  if (hour < 11) return "greeting.morning" as const;
  if (hour < 17) return "greeting.afternoon" as const;
  if (hour < 21) return "greeting.apero" as const;
  return "greeting.evening" as const;
}

/** Drinks and water of the current night (QOL-02: a night lasts until the day boundary). */
function useTonight(now: number) {
  const drinks = useAppStore((state) => state.drinks);
  const water = useAppStore((state) => state.water);
  const boundary = useAppStore((state) => state.preferences.dayBoundaryHour);
  return useMemo(() => {
    const start = new Date(now);
    if (start.getHours() < boundary) start.setDate(start.getDate() - 1);
    start.setHours(boundary, 0, 0, 0);
    const from = start.getTime();
    return {
      drinks: drinks.filter((d) => d.consumedAt >= from),
      water: water.filter((w) => w.at >= from),
    };
  }, [drinks, water, boundary, now]);
}

/** ADP-08: says why the app looks calmer. */
function EcoNotice() {
  const i18n = useT();
  const eco = useEco((state) => state.eco);
  if (!eco) return null;
  return <Tag label={i18n.t("party.eco")} icon="battery" tone="amber" />;
}

/** JOY-04: the mood picked for the party tints the top of the screen, nothing more. */
const MOOD_COLOURS: Record<PartyMood, string> = {
  party: palette.avatar[0]!,
  birthday: palette.avatar[5]!,
  champagne: palette.avatar[6]!,
  sunset: palette.avatar[3]!,
  costume: palette.avatar[4]!,
  wine: palette.avatar[4]!,
  fire: palette.avatar[5]!,
  night: palette.avatar[2]!,
  home: palette.avatar[1]!,
  tropical: palette.avatar[1]!,
};

function MoodBand() {
  const insets = useSafeAreaInsets();
  const live = useLiveParty();
  if (!live) return null;
  const colour = MOOD_COLOURS[live.party.mood as PartyMood] ?? palette.avatar[0]!;
  return <View pointerEvents="none" style={[styles.moodBand, { top: insets.top, backgroundColor: colour }]} />;
}

export function PartyScreen() {
  const i18n = useT();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const preferences = useAppStore((state) => state.preferences);
  const [fastTick, setFastTick] = useState(false);
  const now = useNow(fastTick ? 5_000 : 15_000);
  const live = useLiveBac(now);
  const tonight = useTonight(now);
  const { level, manual } = useUiLevel(live?.estimate.bac ?? 0, now);
  const pendingDrink = tonight.drinks.some((d) => d.sync !== "saved");

  useEffect(() => {
    // While the BAC rises, refresh faster so the number visibly climbs after a drink.
    setFastTick(live?.estimate.trend === "rising");
  }, [live?.estimate.trend]);

  const [unitIndex, setUnitIndex] = useState(0);
  const units = live ? unitCycle(live.rules, preferences.bacUnit) : [preferences.bacUnit];
  const unit = units[unitIndex % units.length] ?? preferences.bacUnit;

  if (!live) return null;

  const again = (() => {
    const last = lastDrink();
    const preset = last ? presetFromEntry(last) : defaultPreset(preferences.unitSystem);
    return { preset, label: againLabel(preset, i18n) };
  })();

  const onAgain = () => {
    const drink = logDrink(again.preset, Date.now(), false);
    if (drink) offerUndo(drink, i18n, preferences.hourCycle);
  };
  const onWater = () => logWater();
  const flipUnit = () => {
    haptic.select();
    setUnitIndex((index) => index + 1);
  };
  const setLevel = (next: UiLevel | null) =>
    submit({ kind: "uiLevel.set", manual: next, previous: useAppStore.getState().manualLevel });

  const common: LevelProps = {
    i18n,
    live,
    unit,
    flipUnit,
    tonight,
    againLabel: again.label,
    onAgain,
    onWater,
    pendingDrink,
    level,
    manual,
    setLevel,
    now,
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <MoodBand />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.screenTop }]}
        contentInsetAdjustmentBehavior="never"
      >
        <SosBanner />
        <VaultPrompt />
        <EcoNotice />
        <TravelPrompt />
        {level === 0 ? <LevelZero {...common} /> : null}
        {level === 1 ? <LevelOne {...common} /> : null}
        {level === 2 ? <LevelTwo {...common} /> : null}
        {level === 3 ? <LevelThree {...common} /> : null}
        {live.estimate.bac >= POISONING_CARD_THRESHOLD ? <PoisoningCard live={live} i18n={i18n} /> : null}
      </ScrollView>
    </View>
  );
}

interface LevelProps {
  i18n: Translator;
  live: LiveBac;
  unit: BacUnit;
  flipUnit: () => void;
  tonight: ReturnType<typeof useTonight>;
  againLabel: string;
  onAgain: () => void;
  onWater: () => void;
  pendingDrink: boolean;
  level: UiLevel;
  manual: UiLevel | null;
  setLevel: (level: UiLevel | null) => void;
  now: number;
}

function BacHero({ i18n, live, unit, flipUnit, size: fontSize }: LevelProps & { size: number }) {
  const theme = useTheme();
  const { estimate, ratio, rules } = live;
  const shown = bacText(estimate.bac, unit, ratio, i18n);
  const alternate = alternateUnit(rules, unit) ?? (unit === "g_per_l_blood" ? "mg_per_l_breath" : "g_per_l_blood");
  const alt = bacText(estimate.bac, alternate, ratio, i18n);
  const format = (value: number) => bacText(value, unit, ratio, i18n).value;

  return (
    <Animated.View entering={FadeIn.duration(duration.enter).easing(easings.out)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${shown.value} ${i18n.t(`units.long.${unit}`)}`}
        accessibilityHint={i18n.t("party.changeUnit")}
        onPress={flipUnit}
        style={styles.heroRow}
      >
        <RollingNumber value={estimate.bac} format={format} size={fontSize} color={theme.amber} />
        <View style={styles.heroUnit}>
          <Text variant="h3">{shown.unit}</Text>
          <Text variant="small">{i18n.t("party.alternate", { value: alt.value, unit: i18n.t(`units.long.${alternate}`) })}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function trendLine({ i18n, live, unit }: LevelProps, hourCycle: "h12" | "h23"): string {
  const { estimate, ratio } = live;
  if (estimate.bac === 0 && estimate.trend !== "rising") return i18n.t("party.atZero");
  if (estimate.trend === "rising" && estimate.peak) {
    const peak = bacText(estimate.peak.bac, unit, ratio, i18n);
    return i18n.t("party.rising", {
      value: peak.value,
      unit: peak.unit,
      time: formatClock(estimate.peak.at, i18n.language, hourCycle),
    });
  }
  return estimate.trend === "falling" ? i18n.t("party.falling") : i18n.t("party.steady");
}

function DrivingPanels(props: LevelProps) {
  const { i18n, live, now } = props;
  const theme = useTheme();
  const { estimate, driving } = live;
  const zeroTolerance = driving.limitBac === 0;

  const backToZero = estimate.backToZeroAt ? formatDuration(estimate.backToZeroAt - now, i18n.language) : "0";
  let drivingValue: string;
  let drivingColor: string;
  if (driving.underLimitAt === null || driving.underLimitAt <= now) {
    drivingValue = i18n.t("party.drivingOk");
    drivingColor = theme.ok;
  } else if (driving.tooCloseToCall && !driving.overLimitNow) {
    drivingValue = i18n.t("party.tooClose");
    drivingColor = theme.amber;
  } else {
    drivingValue = formatDuration(driving.underLimitAt - now, i18n.language);
    drivingColor = theme.danger;
  }

  return (
    <View style={styles.grid2}>
      <Panel style={styles.flex}>
        <Text variant="label">{i18n.t("party.backToZero")}</Text>
        <Numeral size={34}>{backToZero}</Numeral>
      </Panel>
      <Panel style={styles.flex}>
        <Text variant="label">{i18n.t("party.driving")}</Text>
        <Numeral size={34} color={drivingColor}>
          {drivingValue}
        </Numeral>
        {zeroTolerance && estimate.bac > 0 ? <Text variant="small">{i18n.t("party.zeroTolerance")}</Text> : null}
      </Panel>
    </View>
  );
}

function StatusRow({ i18n, tonight, pendingDrink }: LevelProps) {
  const anySaved = tonight.drinks.length + tonight.water.length > 0;
  const queued = tonight.drinks.some((d) => d.sync === "queued");
  return (
    <View style={styles.statusRow}>
      <Text variant="small">
        {i18n.plural("party.drinks", tonight.drinks.length)}, {i18n.plural("party.waters", tonight.water.length)}
      </Text>
      {pendingDrink ? (
        <Tag label={queued ? i18n.t("common.waitingNetwork") : i18n.t("common.sending")} icon="clock" />
      ) : anySaved ? (
        <Animated.View key={tonight.drinks.length} entering={FadeIn.duration(duration.enter)}>
          <Tag label={i18n.t("common.saved")} tone="ok" icon="check" />
        </Animated.View>
      ) : null}
    </View>
  );
}

function LevelPicker({ i18n, level, setLevel }: LevelProps) {
  const note = i18n.t(`party.levelNote${level}` as const);
  return (
    <View style={styles.block}>
      <Segmented
        accessibilityLabel={i18n.t("party.levelPicker")}
        value={level}
        items={([0, 1, 2, 3] as const).map((value) => ({ value, label: String(value) }))}
        onChange={(value) => {
          haptic.select();
          setLevel(value);
        }}
      />
      <Text variant="small">{note}</Text>
    </View>
  );
}

/** HUB-01: the venue I'm checked in at, its boss, and the live leaderboard one tap away. */
function CurrentVenueRow({ i18n }: { i18n: Translator }) {
  const theme = useTheme();
  const live = useLiveParty();
  const open = useVenueData((state) => state.openCheckIn);
  const venue = useVenueData((state) => {
    if (!open) return undefined;
    for (const crew of Object.values(state.byCrew)) {
      const found = crew.venues.find((v) => v.id === open.venueId);
      if (found) return found;
    }
    return undefined;
  });
  return (
    <>
      {venue ? (
        <Row
          title={venue.name}
          subtitle={venue.bossName ? i18n.t("bars.boss", { name: venue.bossName }) : i18n.t("bars.noBoss")}
          leading={<Icon name="crown" color={theme.amber} />}
          trailing={<Icon name="chev" color={theme.textMuted} />}
          onPress={() => router.push({ pathname: "/venue", params: { id: venue.id } })}
        />
      ) : null}
      {live ? (
        <Row
          title={i18n.t("ranking.title")}
          leading={<Icon name="trophy" color={theme.textMuted} />}
          trailing={<Icon name="chev" color={theme.textMuted} />}
          onPress={() => router.push({ pathname: "/leaderboard", params: { crewId: live.party.crewId } })}
        />
      ) : null}
      {live ? (
        <Row
          title={i18n.t("money.open")}
          leading={<Icon name="euro" color={theme.textMuted} />}
          trailing={<Icon name="chev" color={theme.textMuted} />}
          onPress={() => router.push("/money")}
        />
      ) : null}
      {live ? (
        <Row
          title={i18n.t("items.open")}
          leading={<Icon name="check" color={theme.textMuted} />}
          trailing={<Icon name="chev" color={theme.textMuted} />}
          onPress={() => router.push({ pathname: "/items", params: { partyId: live.party.id } })}
        />
      ) : null}
      {live ? (
        <Row
          title={i18n.t("album.open")}
          leading={<Icon name="camera" color={theme.textMuted} />}
          trailing={<Icon name="chev" color={theme.textMuted} />}
          onPress={() => router.push({ pathname: "/album", params: { partyId: live.party.id } })}
        />
      ) : null}
      {live ? (
        <Row
          title={i18n.t("whereTo.open")}
          leading={<Icon name="pin" color={theme.textMuted} />}
          trailing={<Icon name="chev" color={theme.textMuted} />}
          onPress={() => router.push({ pathname: "/where-to", params: { id: live.party.id } })}
        />
      ) : null}
      {live ? (
        <Row
          title={i18n.t("goingHome.open")}
          leading={<Icon name="home" color={theme.textMuted} />}
          trailing={<Icon name="chev" color={theme.textMuted} />}
          onPress={() => router.push({ pathname: "/home", params: { id: live.party.id } })}
        />
      ) : null}
    </>
  );
}

function PartyTitle({ i18n }: { i18n: Translator }) {
  const theme = useTheme();
  const current = useLiveParty();
  if (!current) return <Text variant="h3">{i18n.t("party.tonight")}</Text>;
  return (
    <View style={styles.titleRow}>
      {/* The live dot only shows while a party is really live (DESIGN.md §5). */}
      <View style={[styles.liveDot, { backgroundColor: theme.ok }]} />
      <Text variant="h3" style={styles.flex}>
        {current.party.name}
      </Text>
    </View>
  );
}

function LevelZero(props: LevelProps) {
  const { i18n, now } = props;
  const theme = useTheme();
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  return (
    <>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text variant="small">{i18n.t(greetingKey(new Date(now).getHours()))}</Text>
          <PartyTitle i18n={i18n} />
        </View>
        <IconButton icon="clock" accessibilityLabel={i18n.t("party.history")} onPress={() => router.push("/history")} />
      </View>
      <BacHero {...props} size={124} />
      <Text>{trendLine(props, hourCycle)}</Text>
      <DrivingPanels {...props} />
      <Text variant="disclaimer">{i18n.t("party.notice")}</Text>
      <View style={styles.actions}>
        <AddDrinkButton label={props.againLabel} pending={props.pendingDrink} onPress={props.onAgain} height={size.partyAction} />
        <Button
          label=""
          icon="glass"
          variant="secondary"
          height={size.partyAction}
          style={styles.square}
          accessibilityLabel={i18n.t("party.otherDrink")}
          onPress={() => router.push("/add-drink")}
        />
        <Button
          label=""
          icon="drop"
          variant="water"
          height={size.partyAction}
          style={styles.square}
          accessibilityLabel={i18n.t("party.water")}
          onPress={props.onWater}
        />
      </View>
      <StatusRow {...props} />
      <CrewStrip />
      <View>
        <CurrentVenueRow i18n={i18n} />
        <Row
          title={i18n.t("curve.open")}
          leading={<Icon name="x:curve" color={theme.textMuted} />}
          trailing={<Icon name="chev" color={theme.textMuted} />}
          onPress={() => router.push("/curve")}
        />
        <Row
          title={i18n.t("party.history")}
          leading={<Icon name="clock" color={theme.textMuted} />}
          trailing={<Icon name="chev" color={theme.textMuted} />}
          onPress={() => router.push("/history")}
        />
        <Row
          title={i18n.t("limits.open")}
          leading={<Icon name="x:target" color={theme.textMuted} />}
          trailing={<Icon name="chev" color={theme.textMuted} />}
          onPress={() => router.push("/limits")}
        />
        <Row
          title={i18n.t("party.sos")}
          leading={<Icon name="alert" color={palette.tint.dangerText} />}
          trailing={<Icon name="chev" color={theme.textMuted} />}
          onPress={() => router.push("/sos")}
          last
        />
      </View>
      <LevelPicker {...props} />
    </>
  );
}

function LevelOne(props: LevelProps) {
  const { i18n } = props;
  const theme = useTheme();
  const rising = props.live.estimate.trend === "rising";
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const unitLabel = i18n.t(`units.${props.unit}`);
  return (
    <>
      <View style={styles.header}>
        <Text variant="h3" style={styles.flex}>
          {i18n.t("party.tonight")}
        </Text>
        <Tag label={i18n.t("party.level", { level: 1 })} tone="amber" />
      </View>
      <BacHero {...props} size={140} />
      <CrewStrip big />
      <Text style={{ fontSize: 18, lineHeight: 24 }}>
        {rising ? `${unitLabel}. ${i18n.t("party.stillRising")}` : trendLine(props, hourCycle)}
      </Text>
      <Text variant="disclaimer">{i18n.t("party.notice")}</Text>
      <View style={styles.actions}>
        <AddDrinkButton
          label={props.againLabel}
          pending={props.pendingDrink}
          onPress={props.onAgain}
          height={72}
          fontSize={20}
          iconSize={26}
        />
      </View>
      <View style={styles.grid2}>
        <Button label={i18n.t("party.waterShort")} icon="drop" variant="water" height={64} fontSize={18} iconSize={24} style={styles.flex} onPress={props.onWater} />
        <Button
          label={i18n.t("party.otherShort")}
          icon="glass"
          variant="secondary"
          height={64}
          fontSize={18}
          iconSize={24}
          style={styles.flex}
          onPress={() => router.push("/add-drink")}
        />
      </View>
      <StatusRow {...props} />
      <Row
        title={i18n.t("party.history")}
        trailing={<Icon name="chev" size={22} color={theme.textMuted} />}
        onPress={() => router.push("/history")}
      />
      <Button label={i18n.t("party.sos")} icon="alert" variant="danger" height={60} fontSize={18} onPress={() => router.push("/sos")} />
      <LevelPicker {...props} />
    </>
  );
}

function LevelTwo(props: LevelProps) {
  const { i18n, live, unit } = props;
  const theme = useTheme();
  return (
    <>
      <View style={styles.header}>
        <Numeral size={72} color={theme.amber}>
          {bacText(live.estimate.bac, unit, live.ratio, i18n).value}
        </Numeral>
        <Text variant="h3">{i18n.t(`units.${unit}`)}</Text>
        <View style={styles.flex} />
        <Tag label={i18n.t("party.level", { level: 2 })} tone="amber" />
      </View>
      <Text variant="disclaimer">{i18n.t("party.notice")}</Text>
      <View style={styles.bigGrid}>
        <Button
          label={i18n.t("party.drinkShort")}
          icon="plus"
          iconSize={34}
          fontSize={20}
          vertical
          height={140}
          style={styles.bigCell}
          onPress={props.onAgain}
          accessibilityLabel={props.againLabel}
        />
        <Button label={i18n.t("party.waterShort")} icon="drop" iconSize={34} fontSize={20} vertical height={140} variant="water" style={styles.bigCell} onPress={props.onWater} />
        <Button
          label={i18n.t("party.otherShort")}
          icon="glass"
          iconSize={34}
          fontSize={20}
          vertical
          height={140}
          variant="secondary"
          style={styles.bigCell}
          onPress={() => router.push("/add-drink")}
        />
        <Button label={i18n.t("party.sos")} icon="alert" iconSize={34} fontSize={20} vertical height={140} variant="danger" style={styles.bigCell} onPress={() => router.push("/sos")} />
      </View>
      <StatusRow {...props} />
      <LevelPicker {...props} />
    </>
  );
}

function LevelThree(props: LevelProps) {
  const { i18n } = props;
  return (
    <>
      <Text style={styles.levelThreeTitle}>{i18n.t("party.howHome")}</Text>
      <Button
        label={i18n.t("party.ride")}
        icon="car"
        iconSize={30}
        fontSize={24}
        height={104}
        variant="secondary"
        onPress={() => void Linking.openURL("https://m.uber.com/ul/")}
      />
      <Button label={i18n.t("party.water")} icon="drop" iconSize={30} fontSize={24} height={size.levelThreeTarget} variant="water" onPress={props.onWater} />
      <Button label={i18n.t("party.sos")} icon="alert" iconSize={30} fontSize={24} height={size.levelThreeTarget} variant="danger" onPress={() => router.push("/sos")} />
      <Button label={i18n.t("party.addAnyway")} variant="outline" height={56} onPress={props.onAgain} />
      <LevelPicker {...props} />
    </>
  );
}

function PoisoningCard({ live, i18n }: { live: LiveBac; i18n: Translator }) {
  const number = live.rules.emergency.ambulance ?? live.rules.emergency.primary;
  return (
    <Panel tint="danger">
      <Text variant="h3" color={palette.tint.dangerTextStrong}>
        {i18n.t("party.poisoningTitle")}
      </Text>
      <Text color={palette.tint.dangerText}>{i18n.t("party.poisoningBody", { number })}</Text>
      <Button label={i18n.t("party.callEmergency", { number })} icon="phone" variant="danger" onPress={() => void Linking.openURL(`tel:${number}`)} />
    </Panel>
  );
}

const styles = StyleSheet.create({
  moodBand: { position: "absolute", left: 0, right: 0, height: 4, zIndex: 2, opacity: 0.9 },
  screen: { flex: 1 },
  content: {
    paddingHorizontal: space.screenX,
    paddingBottom: 140,
    gap: 14,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
  block: { gap: space.blockGap },
  heroRow: { flexDirection: "row", alignItems: "flex-end", gap: 12, flexWrap: "wrap" },
  heroUnit: { paddingBottom: 14, gap: 2, flexShrink: 1 },
  grid2: { flexDirection: "row", gap: 10 },
  actions: { flexDirection: "row", gap: 10 },
  square: { width: size.partyAction, paddingHorizontal: 0 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  bigGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  bigCell: { flexBasis: "47%", flexGrow: 1 },
  levelThreeTitle: { fontSize: 20, lineHeight: 26, fontFamily: "Archivo-Bold" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
});
