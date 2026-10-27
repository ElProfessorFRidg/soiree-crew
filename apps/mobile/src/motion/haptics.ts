import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { useAppStore } from "@/state/store";
import { play } from "./sounds";

// One meaning per vibration (DESIGN.md §5, haptics). Haptics never carry information alone:
// iOS silences them in Low Power Mode, so every event also has a visible change.

/**
 * MOT-15, the capability matrix (MOTION.md): iOS has every style on any iPhone with a Taptic Engine.
 * Android before API 29 has no amplitude control, so selection ticks and rigid taps are too faint
 * or missing there: they fall back to a light or heavy impact, which every vibrator can play.
 */
const oldAndroid = Platform.OS === "android" && typeof Platform.Version === "number" && Platform.Version < 29;

function run(effect: () => Promise<void>, fallback?: () => Promise<void>): void {
  if (Platform.OS === "web" || !useAppStore.getState().hapticsOn) return;
  (oldAndroid && fallback ? fallback : effect)().catch(() => {
    // A device without a vibration motor is not an error worth surfacing.
  });
}

const light = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const heavyImpact = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

export const haptic = {
  select: () => run(() => Haptics.selectionAsync(), light),
  drinkAdded: () => {
    play("pour");
    run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },
  water: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  confirmed: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  heavy: () => {
    play("crown");
    run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  },
  /** JOY-05: a round bought, glasses together. */
  cheers: () => {
    play("clink");
    run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  holdTick: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid), heavyImpact),
};
