import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { duration, themes } from "@crew/design-tokens";
import { easings } from "@/motion/easing";

/** Same picture, colour and width as the native splash (app.json, expo-splash-screen). */
const SPLASH_IMAGE = require("../../assets/splash-icon.png") as number;
const SPLASH_WIDTH = 120;

/**
 * MOT-10, animated launch: a copy of the native splash sits on top when the app first draws, so
 * hiding the native one shows no seam; then the mark grows a little and the curtain fades into
 * the first screen. Reduce Motion: a plain fade.
 */
export function LaunchCurtain({ onShown }: { onShown: () => void }) {
  const reduceMotion = useReducedMotion();
  const [gone, setGone] = useState(false);
  const t = useSharedValue(0);

  useEffect(() => {
    onShown();
    t.value = withTiming(1, { duration: duration.launch, easing: easings.out }, (done) => {
      if (done) runOnJS(setGone)(true);
    });
    // Only once, on the first frame: the native splash goes away behind this copy.
  }, []);

  const curtain = useAnimatedStyle(() => ({ opacity: 1 - t.value }));
  const mark = useAnimatedStyle(() => (reduceMotion ? {} : { transform: [{ scale: 1 + 0.18 * t.value }] }));

  if (gone) return null;
  return (
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.curtain, curtain]}>
      <Animated.Image source={SPLASH_IMAGE} resizeMode="contain" style={[styles.mark, mark]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  curtain: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: themes.dark.bg, alignItems: "center", justifyContent: "center", zIndex: 100 },
  mark: { width: SPLASH_WIDTH, height: SPLASH_WIDTH },
});
