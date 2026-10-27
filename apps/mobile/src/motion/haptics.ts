import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { play } from "./sounds";

// One meaning per vibration (DESIGN.md §5, haptics). Haptics never carry information alone:
// iOS silences them in Low Power Mode, so every event also has a visible change.

function run(effect: () => Promise<void>): void {
  if (Platform.OS === "web") return;
  effect().catch(() => {
    // A device without a vibration motor is not an error worth surfacing.
  });
}

export const haptic = {
  select: () => run(() => Haptics.selectionAsync()),
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
  holdTick: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)),
};
