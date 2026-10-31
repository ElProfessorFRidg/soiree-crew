import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming, ZoomIn } from "react-native-reanimated";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { duration, scaled } from "@crew/design-tokens";
import { breathRatio, countryRules } from "@crew/units";
import { bacText } from "@/drinks/display";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { easings } from "@/motion/easing";
import { RollingNumber } from "@/party/RollingNumber";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Panel, Tag } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Text } from "@/ui/Text";

// O-01 (Bienvenue): what the app does, shown rather than listed. Three cards, each built its own
// way (a figure, faces, icons) so they never read as a grid of identical tiles (SLOP-08).

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** A night drawn small: the estimate rises after the drinks, then comes back down to zero. */
const CURVE = "M4 50 C 18 50, 22 14, 38 12 S 70 26, 88 40 S 108 50, 116 50";
const CURVE_LENGTH = 150;
const SAMPLE_BAC = 0.42;

function MiniCurve({ color, zeroColor, delay }: { color: string; zeroColor: string; delay: number }) {
  const theme = useTheme();
  const drawn = useSharedValue(0);
  useEffect(() => {
    drawn.value = withDelay(scaled(delay), withTiming(1, { duration: duration.rise, easing: easings.out }));
  }, [drawn, delay]);
  const stroke = useAnimatedProps(() => ({ strokeDashoffset: CURVE_LENGTH * (1 - drawn.value) }));
  const dot = useAnimatedStyle(() => ({ opacity: drawn.value > 0.95 ? 1 : 0 }));
  return (
    <View>
      <Svg width={120} height={56} viewBox="0 0 120 56">
        <Line x1={4} y1={50} x2={116} y2={50} stroke={theme.line} strokeWidth={1.5} />
        <AnimatedPath d={CURVE} stroke={color} strokeWidth={2.5} strokeLinecap="round" fill="none" strokeDasharray={`${CURVE_LENGTH} ${CURVE_LENGTH}`} animatedProps={stroke} />
      </Svg>
      <Animated.View style={[styles.zeroDot, dot]} pointerEvents="none">
        <Svg width={10} height={10}>
          <Circle cx={5} cy={5} r={4} fill={zeroColor} />
        </Svg>
      </Animated.View>
    </View>
  );
}

/**
 * The estimate as the Party screen shows it: a figure in the person's unit, the time it is back to
 * zero, and the curve. Sample numbers, so it says so. `accent` is off where the real BAC is already
 * the amber figure of the screen (one amber figure per screen, DESIGN.md §1).
 */
export function EstimatePreview({ accent, delay = 0, sample = false }: { accent: boolean; delay?: number; sample?: boolean }) {
  const i18n = useT();
  const theme = useTheme();
  const preferences = useAppStore((state) => state.preferences);
  const ratio = breathRatio(countryRules(preferences.legalCountry));
  const [value, setValue] = useState(0);
  // The figure rolls up once the card is in place, like after a drink.
  useEffect(() => {
    const timer = setTimeout(() => setValue(SAMPLE_BAC), scaled(delay + duration.enter));
    return () => clearTimeout(timer);
  }, [delay]);
  const shown = bacText(SAMPLE_BAC, preferences.bacUnit, ratio, i18n);
  const back = new Date();
  back.setHours(2, 40, 0, 0);
  const time = formatClock(back.getTime(), i18n.language, preferences.hourCycle);
  const color = accent ? theme.amber : theme.text;
  return (
    <Panel>
      <View style={styles.estimate} accessible accessibilityLabel={`${i18n.t("onboarding.cardEstimate")}. ${shown.value} ${shown.unit}. ${i18n.t("onboarding.cardEstimateBack", { time })}`}>
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <Text variant="h3" style={styles.shrink}>
              {i18n.t("onboarding.cardEstimate")}
            </Text>
            {sample ? <Tag label={i18n.t("firstRun.sample")} /> : null}
          </View>
          <View style={styles.figure}>
            <RollingNumber value={value} format={(v) => bacText(v, preferences.bacUnit, ratio, i18n).value} size={44} color={color} />
            <Text variant="h3">{shown.unit}</Text>
          </View>
          <Text variant="small">{i18n.t("onboarding.cardEstimateBack", { time })}</Text>
        </View>
        <MiniCurve color={accent ? theme.amber : theme.textMuted} zeroColor={theme.ok} delay={delay + duration.enter} />
      </View>
    </Panel>
  );
}

function CrewCard({ delay }: { delay: number }) {
  const i18n = useT();
  const theme = useTheme();
  const names = i18n.t("onboarding.cardCrewNames").split(",").map((n) => n.trim());
  return (
    <Panel>
      <View style={styles.crew} accessible accessibilityLabel={`${i18n.t("onboarding.cardCrew")}. ${i18n.t("onboarding.cardCrewBody")}`}>
        <View style={styles.faces}>
          {names.map((name, index) => (
            <Animated.View
              key={name}
              entering={ZoomIn.delay(scaled(delay + duration.enter + index * 120)).duration(duration.pop).easing(easings.out)}
              style={index ? styles.overlap : undefined}
            >
              <Avatar personId={`sample-${index}`} name={name} size={36} ring={theme.surface} />
            </Animated.View>
          ))}
        </View>
        <View style={styles.flex}>
          <Text variant="h3">{i18n.t("onboarding.cardCrew")}</Text>
          <Text variant="small">{i18n.t("onboarding.cardCrewBody")}</Text>
        </View>
      </View>
    </Panel>
  );
}

function GamesCard({ delay }: { delay: number }) {
  const i18n = useT();
  const theme = useTheme();
  // The die rolls once when the card lands; nothing loops (DESIGN.md §5).
  const turn = useSharedValue(0);
  useEffect(() => {
    turn.value = withDelay(scaled(delay + duration.enter), withTiming(1, { duration: duration.flip, easing: easings.out }));
  }, [turn, delay]);
  const roll = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));
  return (
    <Panel>
      <View style={styles.games} accessible accessibilityLabel={`${i18n.t("onboarding.cardGames")}. ${i18n.t("onboarding.cardGamesBody")}`}>
        <View style={styles.flex}>
          <Text variant="h3">{i18n.t("onboarding.cardGames")}</Text>
          <Text variant="small">{i18n.t("onboarding.cardGamesBody")}</Text>
        </View>
        <View style={styles.icons}>
          <Animated.View style={roll}>
            <Icon name="dice" size={28} color={theme.text} />
          </Animated.View>
          <Icon name="wine" size={28} color={theme.water} />
        </View>
      </View>
    </Panel>
  );
}

/** The three cards of the welcome screen, landing one after the other. */
export function ValueCards() {
  const enter = (index: number) => FadeInDown.delay(scaled(index * 140)).duration(duration.enter).easing(easings.out);
  return (
    <View style={styles.cards}>
      <Animated.View entering={enter(0)}>
        <EstimatePreview accent delay={0} />
      </Animated.View>
      <Animated.View entering={enter(1)}>
        <CrewCard delay={140} />
      </Animated.View>
      <Animated.View entering={enter(2)}>
        <GamesCard delay={280} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cards: { gap: 10 },
  flex: { flex: 1, gap: 4 },
  shrink: { flexShrink: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  estimate: { flexDirection: "row", alignItems: "center", gap: 12 },
  figure: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginVertical: 2 },
  zeroDot: { position: "absolute", right: 0, bottom: 1 },
  crew: { flexDirection: "row", alignItems: "center", gap: 14 },
  faces: { flexDirection: "row" },
  overlap: { marginLeft: -10 },
  games: { flexDirection: "row", alignItems: "center", gap: 14 },
  icons: { flexDirection: "row", gap: 10 },
});
