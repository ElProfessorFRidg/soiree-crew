import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { avatarColor, duration, scaled, spring } from "@crew/design-tokens";
import { haptic } from "@/motion/haptics";
import { easings } from "@/motion/easing";
import { badgesShown, badgesToCelebrate, type HonourBadges } from "./pure/badgeUnlocks";

/** Badges this phone already celebrated (MOT-10). Nothing here leaves the phone. */
const useBadgeSeen = create<{ seen: string[] }>()(
  persist(() => ({ seen: [] as string[] }), { name: "badges-seen-v1", storage: createJSONStorage(() => AsyncStorage) }),
);

/**
 * The badge keys to celebrate on this visit, fixed for the life of the screen: they are marked seen
 * right away, so leaving and coming back does not replay them.
 */
export function useBadgeCelebrations(crewId: string | null, viewerId: string | null, honours: readonly HonourBadges[] | null): ReadonlySet<string> {
  const [hydrated, setHydrated] = useState(() => useBadgeSeen.persist.hasHydrated());
  useEffect(() => (hydrated ? undefined : useBadgeSeen.persist.onFinishHydration(() => setHydrated(true))), [hydrated]);
  const fixed = useRef<{ crewId: string; keys: Set<string> } | null>(null);
  // Decided during the render that first shows the badges, so they mount already hidden.
  if (hydrated && crewId && honours && fixed.current?.crewId !== crewId) {
    fixed.current = { crewId, keys: new Set(badgesToCelebrate(new Set(useBadgeSeen.getState().seen), crewId, viewerId, honours)) };
  }
  useEffect(() => {
    if (!hydrated || !crewId || !honours) return;
    const shown = badgesShown(crewId, honours);
    useBadgeSeen.setState((s) => ({ seen: [...new Set([...s.seen, ...shown])].slice(-2000) }));
  }, [hydrated, crewId, honours]);
  return fixed.current?.keys ?? EMPTY;
}

const EMPTY: ReadonlySet<string> = new Set();
const PIECES = 16;

function Piece({ index, go }: { index: number; go: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(go + scaled((index % 4) * 40), withTiming(1, { duration: duration.confetti, easing: easings.out }));
  }, [go, index, t]);
  const seed = useMemo(() => ({ angle: (index / PIECES) * Math.PI * 2, reach: 26 + (index % 3) * 10, spin: ((index * 71) % 540) - 270 }), [index]);
  const style = useAnimatedStyle(() => {
    const p = t.value;
    return {
      opacity: p > 0 && p < 1 ? 1 - p : 0,
      transform: [
        { translateX: Math.cos(seed.angle) * seed.reach * p },
        { translateY: Math.sin(seed.angle) * seed.reach * p + 70 * p * p },
        { rotate: `${seed.spin * p}deg` },
      ],
    };
  });
  return <Animated.View style={[styles.piece, { backgroundColor: avatarColor(String(index)) }, style]} />;
}

interface Props {
  children: ReactNode;
  /** True for a badge this phone has not shown before. */
  celebrate: boolean;
  /** Order among the badges unlocked on this screen: they land one after the other. */
  order?: number;
  /** One heavy haptic per screen, on the first badge. */
  withHaptic?: boolean;
}

/**
 * MOT-10, DESIGN.md §5: an unlocked badge pops in on the `signature` spring with 16 pieces of
 * confetti and a heavy haptic. Reduce Motion: the badge fades in, no confetti.
 */
export function BadgeUnlock({ children, celebrate, order = 0, withHaptic = false }: Props) {
  const reduceMotion = useReducedMotion();
  const pop = useSharedValue(celebrate ? 0 : 1);
  const delay = scaled(Math.min(order, 12) * 180) + duration.enter;

  useEffect(() => {
    if (!celebrate) return;
    pop.value = reduceMotion ? withDelay(delay, withTiming(1, { duration: duration.enter })) : withDelay(delay, withSpring(1, spring.signature));
    if (!withHaptic) return;
    const timer = setTimeout(haptic.heavy, delay);
    return () => clearTimeout(timer);
  }, [celebrate, reduceMotion, delay, withHaptic, pop]);

  const style = useAnimatedStyle(() =>
    reduceMotion ? { opacity: pop.value } : { opacity: Math.min(1, pop.value * 2), transform: [{ scale: 0.3 + 0.7 * pop.value }] },
  );

  if (!celebrate) return <>{children}</>;
  return (
    <View>
      {reduceMotion ? null : (
        <View pointerEvents="none" style={styles.burst}>
          {Array.from({ length: PIECES }, (_, i) => (
            <Piece key={i} index={i} go={delay} />
          ))}
        </View>
      )}
      <Animated.View style={style}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  burst: { position: "absolute", left: "50%", top: "50%", width: 0, height: 0, alignItems: "center", justifyContent: "center" },
  piece: { position: "absolute", width: 5, height: 8, borderRadius: 1.5 },
});
