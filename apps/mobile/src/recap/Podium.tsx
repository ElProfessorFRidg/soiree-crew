import { useEffect, useMemo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { avatarColor, duration, radius, scaled } from "@crew/design-tokens";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { RISE_DELAYS_MS } from "@/motion/math/podium";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Icon } from "@/ui/Icon";
import { Text } from "@/ui/Text";

export interface PodiumEntry {
  userId: string;
  name: string;
  rank: number;
  value: number;
}

/** Order on screen: second, first, third. */
const SLOTS = [1, 0, 2] as const;
const HEIGHTS = [150, 110, 80];
/** Badges' confetti, a beat after the slide lands. */
const CONFETTI_DELAY_MS = 540;

/** When the crown drops, already scaled: once the winner's step is up. Read when an animation starts. */
export const podiumCrownDelay = (): number => scaled(RISE_DELAYS_MS[0]) + duration.rise;

/** The winner's crown drops once their step is up: the podium's overshoot moment (MOT-01, MOT-13). */
function Crown({ replay, still }: { replay: number; still: boolean }) {
  const theme = useTheme();
  const t = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) {
      t.value = 1;
      return;
    }
    t.value = 0;
    t.value = withDelay(podiumCrownDelay(), withTiming(1, { duration: duration.crownDrop, easing: easings.overshoot }));
  }, [replay, still, t]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, t.value * 1.6),
    transform: [{ translateY: (1 - t.value) * -60 }, { scale: 1 + (1 - t.value) * 0.5 }],
  }));
  return (
    <Animated.View style={style}>
      <Icon name="crown" size={26} color={theme.amber} />
    </Animated.View>
  );
}

function Step({ entry, place, replay, valueLabel, still, a11yLabel }: { entry: PodiumEntry; place: number; replay: number; valueLabel: string; still: boolean; a11yLabel?: string }) {
  const theme = useTheme();
  const rise = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) {
      rise.value = 1;
      return;
    }
    rise.value = 0;
    // DESIGN.md §5: third, second, then the winner (0 / 200 / 350 ms), each over `rise`, ease-out.
    rise.value = withDelay(scaled(RISE_DELAYS_MS[place] ?? 0), withTiming(1, { duration: duration.rise, easing: easings.out }));
  }, [replay, still, place, rise]);
  const style = useAnimatedStyle(() => ({ height: HEIGHTS[place]! * rise.value }));
  const label = useAnimatedStyle(() => ({ opacity: rise.value, transform: [{ translateY: (1 - rise.value) * 16 }] }));
  return (
    <View style={styles.slot} accessible={!!a11yLabel} accessibilityLabel={a11yLabel}>
      <Animated.View style={[styles.person, label]}>
        {place === 0 ? <Crown replay={replay} still={still} /> : <View style={styles.crownSpace} />}
        <Avatar personId={entry.userId} name={entry.name} size={place === 0 ? 52 : 42} ring={place === 0 ? theme.amber : undefined} />
        <Text variant="h3" align="center" numberOfLines={2}>
          {entry.name}
        </Text>
        <Text variant="small" align="center">
          {valueLabel}
        </Text>
      </Animated.View>
      <Animated.View style={[styles.step, { backgroundColor: place === 0 ? theme.amber : theme.surfaceRaised }, style]}>
        <Text variant="h2" align="center" color={place === 0 ? theme.bg : theme.text}>
          {entry.rank}
        </Text>
      </Animated.View>
    </View>
  );
}

/**
 * MOT-13 podium, on the recap and the leaderboard: steps rise, then the crown drops on the winner with
 * a heavy haptic. Reduce Motion and `calm` (UI levels 2 and 3) show the end state at once.
 */
export function Podium({
  entries,
  replay,
  valueLabel,
  calm = false,
  a11yLabel,
}: {
  entries: PodiumEntry[];
  replay: number;
  valueLabel: (entry: PodiumEntry) => string;
  calm?: boolean;
  a11yLabel?: (entry: PodiumEntry) => string;
}) {
  const reduceMotion = useReducedMotion();
  const still = reduceMotion || calm;
  useEffect(() => {
    if (entries.length && !still) {
      const timer = setTimeout(haptic.heavy, podiumCrownDelay() + duration.crownDrop);
      return () => clearTimeout(timer);
    }
  }, [entries.length, replay, still]);
  return (
    <View style={styles.podium}>
      {SLOTS.map((place) => {
        const entry = entries[place];
        return entry ? (
          <Step key={`${entry.userId}-${replay}`} entry={entry} place={place} replay={replay} valueLabel={valueLabel(entry)} still={still} a11yLabel={a11yLabel?.(entry)} />
        ) : (
          <View key={place} style={styles.slot} />
        );
      })}
    </View>
  );
}

/** DESIGN.md §5: 16 pieces. */
const PIECES = 16;

function Piece({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const seed = useMemo(() => ({ x: (index * 37) % 100, drift: ((index * 53) % 40) - 20, spin: ((index * 71) % 720) - 360, delay: (index % 7) / 10 }), [index]);
  const style = useAnimatedStyle(() => {
    const t = Math.max(0, Math.min(1, (progress.value - seed.delay) / (1 - seed.delay)));
    return {
      opacity: t > 0 && t < 1 ? 1 - t * 0.6 : 0,
      transform: [{ translateY: t * 420 - 20 }, { translateX: t * seed.drift }, { rotate: `${t * seed.spin}deg` }],
    };
  });
  return <Animated.View style={[styles.piece, { left: `${seed.x}%`, backgroundColor: avatarColor(String(index)) }, style]} />;
}

/**
 * MOT-08, MOT-13: confetti for the podium and badges, 16 pieces over 1800 ms ease-out. `delayMs`
 * lines it up with the moment it celebrates. Nothing at all under Reduce Motion or `calm`.
 */
export function Confetti({ replay, delayMs, calm = false }: { replay: number; delayMs?: number; calm?: boolean }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const off = reduceMotion || calm;
  useEffect(() => {
    if (off) return;
    progress.value = 0;
    progress.value = withDelay(delayMs ?? scaled(CONFETTI_DELAY_MS), withTiming(1, { duration: duration.confetti, easing: easings.out }));
  }, [replay, off, delayMs, progress]);
  if (off) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: PIECES }, (_, i) => (
        <Piece key={i} index={i} progress={progress} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  podium: { flexDirection: "row", alignItems: "flex-end", gap: 10, minHeight: 290 },
  slot: { flex: 1, alignItems: "stretch", gap: 8 },
  person: { alignItems: "center", gap: 4 },
  crownSpace: { height: 26 },
  step: { borderTopLeftRadius: radius.tile, borderTopRightRadius: radius.tile, justifyContent: "flex-start", paddingTop: 10, overflow: "hidden" },
  piece: { position: "absolute", top: 0, width: 8, height: 12, borderRadius: 2 },
});

/** Drops in from above after `delay`; replays when `replay` changes. Instant under Reduce Motion. */
export function DropIn({ delay, replay, children, distance = -24 }: { delay: number; replay: number; children: ReactNode; distance?: number }) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    t.value = 0;
    t.value = withDelay(scaled(delay), withTiming(1, { duration: duration.crownDrop, easing: easings.out }));
  }, [delay, replay, reduceMotion, t]);
  const style = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ translateY: (1 - t.value) * distance }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
