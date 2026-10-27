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
import { avatarColor, duration, radius } from "@crew/design-tokens";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
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
const STAGGER_MS = 180;

function Step({ entry, place, replay, valueLabel }: { entry: PodiumEntry; place: number; replay: number; valueLabel: string }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const rise = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    rise.value = 0;
    // Third rises first, the winner last: the podium is one of the few overshoot moments (MOT-01).
    rise.value = withDelay((2 - place) * STAGGER_MS, withTiming(1, { duration: duration.rise, easing: easings.overshoot }));
  }, [replay, reduceMotion, place, rise]);
  const style = useAnimatedStyle(() => ({ height: HEIGHTS[place]! * rise.value }));
  const label = useAnimatedStyle(() => ({ opacity: rise.value, transform: [{ translateY: (1 - rise.value) * 16 }] }));
  return (
    <View style={styles.slot}>
      <Animated.View style={[styles.person, label]}>
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

export function Podium({ entries, replay, valueLabel }: { entries: PodiumEntry[]; replay: number; valueLabel: (entry: PodiumEntry) => string }) {
  useEffect(() => {
    if (entries.length) {
      const timer = setTimeout(haptic.heavy, 2 * STAGGER_MS + duration.rise);
      return () => clearTimeout(timer);
    }
  }, [entries.length, replay]);
  return (
    <View style={styles.podium}>
      {SLOTS.map((place) => {
        const entry = entries[place];
        return entry ? <Step key={`${entry.userId}-${replay}`} entry={entry} place={place} replay={replay} valueLabel={valueLabel(entry)} /> : <View key={place} style={styles.slot} />;
      })}
    </View>
  );
}

const PIECES = 28;

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

/** MOT-08: badges drop in with confetti. Nothing at all under Reduce Motion. */
export function Confetti({ replay }: { replay: number }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    progress.value = 0;
    progress.value = withDelay(STAGGER_MS * 3, withTiming(1, { duration: duration.confetti }));
  }, [replay, reduceMotion, progress]);
  if (reduceMotion) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: PIECES }, (_, i) => (
        <Piece key={i} index={i} progress={progress} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  podium: { flexDirection: "row", alignItems: "flex-end", gap: 10, minHeight: 260 },
  slot: { flex: 1, alignItems: "stretch", gap: 8 },
  person: { alignItems: "center", gap: 4 },
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
    t.value = withDelay(delay, withTiming(1, { duration: duration.crownDrop, easing: easings.out }));
  }, [delay, replay, reduceMotion, t]);
  const style = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ translateY: (1 - t.value) * distance }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
