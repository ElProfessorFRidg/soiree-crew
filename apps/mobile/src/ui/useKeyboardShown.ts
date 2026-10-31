import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Whether the keyboard is up. A footer that rides above it must drop the home-indicator inset then:
 * the keyboard already covers that area, and keeping it leaves the button floating far above the
 * keys (and above iOS's "Done" bar of the number pad). iOS says it before the keyboard moves, so the
 * footer moves with it; Android only after.
 */
export function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const show = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hide = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const subscriptions = [Keyboard.addListener(show, () => setShown(true)), Keyboard.addListener(hide, () => setShown(false))];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);
  return shown;
}
