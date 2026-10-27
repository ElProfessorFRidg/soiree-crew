import { useEffect, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useFrameCallback, useReducedMotion, useSharedValue, type SharedValue } from "react-native-reanimated";
import type { PartyMood } from "@/server/crewData";
import { useEco } from "@/power/eco";
import { useTheme } from "@/theme";

/** At most this many bubbles alive, as motion.md §3.4 budgets. */
const SLOTS = 40;
/** The field updates at 30 Hz at most; Reanimated would otherwise follow the display. */
const FRAME_MS = 1000 / 30;
const CALM: readonly PartyMood[] = ["wine", "sunset", "home", "champagne"];

interface Bubble {
  bornAt: number;
  x: number;
  size: number;
  life: number;
  sway: number;
  alpha: number;
}

/**
 * MOT-02: the night's bubbles. Every drink the crew logs releases a few micro-bubbles from the
 * bottom, so a quiet crew leaves the ground still. Slate on slate, never amber, never a glow.
 * Nothing runs while no bubble is alive; off in eco mode, with Reduce Motion and at levels 2 and 3,
 * where only the time-of-night lightness step stays.
 */
export function BubbleField({ drinks, mood, level }: { drinks: number; mood: PartyMood; level: number }) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const eco = useEco((state) => state.eco);
  const still = reduceMotion || eco || level >= 2;

  const clock = useSharedValue(0);
  const bubbles = useSharedValue<Bubble[]>([]);
  const lastFrame = useSharedValue(0);
  const callback = useFrameCallback((frame) => {
    "worklet";
    if (frame.timestamp - lastFrame.value < FRAME_MS) return;
    lastFrame.value = frame.timestamp;
    clock.value = Date.now();
  }, false);

  const seen = useRef<number | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const before = seen.current;
    seen.current = drinks;
    // The first value is the state on arrival, not new activity.
    if (before === null || drinks <= before || still) return;
    const calm = CALM.includes(mood);
    const now = Date.now();
    const fresh: Bubble[] = [];
    for (let d = 0; d < Math.min(drinks - before, 3); d++) {
      const count = 3 + Math.floor(Math.random() * 4);
      const origin = 0.15 + Math.random() * 0.7;
      for (let i = 0; i < count; i++) {
        fresh.push({
          bornAt: now + i * 140 + d * 400,
          x: (origin + (Math.random() - 0.5) * 0.12) * width,
          size: 2 + Math.random() * 4,
          life: (calm ? 9_000 : 6_000) + Math.random() * 2_000,
          sway: calm ? 0 : 4 + Math.random() * 6,
          alpha: 0.25 + Math.random() * 0.25,
        });
      }
    }
    const alive = bubbles.value.filter((b) => b.bornAt + b.life > now);
    bubbles.value = [...alive, ...fresh].slice(-SLOTS);
    clock.value = now;
    callback.setActive(true);
    const until = Math.max(...bubbles.value.map((b) => b.bornAt + b.life)) - now;
    if (stopTimer.current) clearTimeout(stopTimer.current);
    // Back to a static frame once the last bubble is gone: no frame callback keeps running.
    stopTimer.current = setTimeout(() => callback.setActive(false), until + 100);
  }, [drinks, mood, still, width, bubbles, clock, callback]);

  useEffect(() => {
    if (!still) return;
    callback.setActive(false);
    bubbles.value = [];
  }, [still, callback, bubbles]);

  useEffect(
    () => () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
    },
    [],
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <NightShade />
      {still
        ? null
        : Array.from({ length: SLOTS }, (_, i) => (
            <Dot key={i} index={i} bubbles={bubbles} clock={clock} height={height} colour={theme.surface2} />
          ))}
    </View>
  );
}

function Dot({ index, bubbles, clock, height, colour }: { index: number; bubbles: SharedValue<Bubble[]>; clock: SharedValue<number>; height: number; colour: string }) {
  const style = useAnimatedStyle(() => {
    const b = bubbles.value[index];
    if (!b) return { opacity: 0 };
    const t = (clock.value - b.bornAt) / b.life;
    if (t < 0 || t > 1) return { opacity: 0 };
    const fade = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 1;
    return {
      opacity: b.alpha * fade,
      width: b.size,
      height: b.size,
      borderRadius: b.size / 2,
      transform: [{ translateX: b.x + Math.sin(t * Math.PI * 4) * b.sway }, { translateY: height * (1 - t) }],
    };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: colour }, style]} />;
}

/**
 * The ground gets a touch lighter early in the evening and deepest at 3 am, within 2 % lightness.
 * It is a still overlay that changes once a minute, so it costs no frames.
 */
function NightShade() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const { shade, lift } = nightShade(now.getHours() + now.getMinutes() / 60);
  return (
    <>
      {lift > 0 ? <View style={[StyleSheet.absoluteFill, { backgroundColor: "#FFFFFF", opacity: lift }]} /> : null}
      {shade > 0 ? <View style={[StyleSheet.absoluteFill, { backgroundColor: "#000000", opacity: shade }]} /> : null}
    </>
  );
}

/** Lightness offset by hour: +2 % at 8 pm, 0 at 11 pm, -2 % at 3 am, back up towards dawn. */
export function nightShade(hour: number): { shade: number; lift: number } {
  // Hours since 8 pm, wrapping past midnight.
  const h = (hour - 20 + 24) % 24;
  let offset: number;
  if (h <= 3) offset = 0.02 * (1 - h / 3);
  else if (h <= 7) offset = -0.02 * ((h - 3) / 4);
  else if (h <= 11) offset = -0.02 + 0.03 * ((h - 7) / 4);
  else offset = 0;
  return { shade: offset < 0 ? -offset : 0, lift: offset > 0 ? offset : 0 };
}

const styles = StyleSheet.create({
  dot: { position: "absolute", left: 0, top: 0 },
});
