import { useEffect, useRef, type ComponentRef, type ReactNode } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from "react-native-reanimated";
import { create } from "zustand";
import { duration } from "@crew/design-tokens";

/**
 * MOT-05: shared-element transitions, hand-built (measure, overlay, animate), which motion.md
 * found to be the dependable path on React Native. A source registers what it shows; the
 * navigation call asks it to fly; the target screen reports where it lands. The overlay sits
 * above the navigator, so nothing cuts between the two screens.
 */

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Flight {
  key: string;
  from: Rect;
  to: Rect | null;
  node: ReactNode;
  /** "scale" keeps the proportions (an avatar); "stretch" fills the target and fades (a card into a screen). */
  mode: "scale" | "stretch";
}

const useHero = create<{ flight: Flight | null }>(() => ({ flight: null }));

type ViewRef = ComponentRef<typeof View>;

const sources = new Map<string, { view: ViewRef | null; node: ReactNode; mode: Flight["mode"] }>();
let reduceMotion = false;
void AccessibilityInfo.isReduceMotionEnabled()
  .then((on) => {
    reduceMotion = on;
  })
  .catch(() => undefined);
AccessibilityInfo.addEventListener("reduceMotionChanged", (on) => {
  reduceMotion = on;
});

/** Starts the flight of a registered source. Call it right before navigating. Does nothing with Reduce Motion. */
export function flyHero(key: string): void {
  const source = sources.get(key);
  if (!source?.view || reduceMotion) return;
  source.view.measureInWindow((x, y, width, height) => {
    if (!width || !height) return;
    useHero.setState({ flight: { key, from: { x, y, width, height }, to: null, node: source.node, mode: source.mode } });
    // A target that never shows up must not leave a ghost on screen.
    setTimeout(() => {
      if (useHero.getState().flight?.key === key && useHero.getState().flight?.to === null) useHero.setState({ flight: null });
    }, 900);
  });
}

/** Wraps what the user taps. `node` is what flies: usually the same element without its press handling. */
export function HeroSource({ heroKey, node, mode = "scale", children }: { heroKey: string; node: ReactNode; mode?: Flight["mode"]; children: ReactNode }) {
  const ref = useRef<ViewRef>(null);
  useEffect(() => {
    sources.set(heroKey, { view: ref.current, node, mode });
    return () => {
      if (sources.get(heroKey)?.view === ref.current) sources.delete(heroKey);
    };
  });
  return (
    <View ref={ref} collapsable={false}>
      {children}
    </View>
  );
}

/** Where the flight lands. Its content stays hidden until the overlay has arrived, unless the overlay fades over it. */
export function HeroTarget({ heroKey, children, style, hide = true }: { heroKey: string; children: ReactNode; style?: object; hide?: boolean }) {
  const ref = useRef<ViewRef>(null);
  const flying = useHero((state) => hide && state.flight?.key === heroKey);
  const report = () => {
    // One frame later, once the screen is laid out where it will stay.
    requestAnimationFrame(() =>
      ref.current?.measureInWindow((x, y, width, height) => {
        const flight = useHero.getState().flight;
        if (flight?.key === heroKey && flight.to === null && width && height) useHero.setState({ flight: { ...flight, to: { x, y, width, height } } });
      }),
    );
  };
  return (
    <View ref={ref} collapsable={false} onLayout={report} style={[style, { opacity: flying ? 0 : 1 }]}>
      {children}
    </View>
  );
}

/** Mounted once above the navigator. */
export function HeroOverlay() {
  const flight = useHero((state) => state.flight);
  const progress = useSharedValue(0);
  const from = flight?.from;
  const to = flight?.to;
  const mode = flight?.mode ?? "scale";

  useEffect(() => {
    if (!to) {
      progress.value = 0;
      return;
    }
    progress.value = withTiming(1, { duration: duration.enter, easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
    const id = setTimeout(() => useHero.setState({ flight: null }), duration.enter + 40);
    return () => clearTimeout(id);
  }, [to, progress]);

  const style = useAnimatedStyle(() => {
    if (!from) return { opacity: 0 };
    const target = to ?? from;
    const p = progress.value;
    const cx = from.x + from.width / 2 + (target.x + target.width / 2 - (from.x + from.width / 2)) * p;
    const cy = from.y + from.height / 2 + (target.y + target.height / 2 - (from.y + from.height / 2)) * p;
    const sx = 1 + (target.width / from.width - 1) * p;
    const sy = mode === "scale" ? sx : 1 + (target.height / from.height - 1) * p;
    return {
      opacity: mode === "stretch" && p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1,
      transform: [{ translateX: cx - from.width / 2 }, { translateY: cy - from.height / 2 }, { scaleX: sx }, { scaleY: sy }],
    };
  });

  if (!flight || !from) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: from.width, height: from.height }, style]}>{flight.node}</Animated.View>
    </View>
  );
}
