import { Platform } from "react-native";
import { useAppStore } from "@/state/store";
import { refreshWidget } from "./handler";

let timer: ReturnType<typeof setTimeout> | undefined;

/** Keeps the Android widget in step with what is logged in the app (after storage has caught up). */
export function watchWidget(): void {
  if (Platform.OS !== "android") return;
  useAppStore.subscribe((state, previous) => {
    if (state.drinks === previous.drinks && state.water === previous.water && state.lockScreenNumbers === previous.lockScreenNumbers && state.preferences === previous.preferences) return;
    clearTimeout(timer);
    timer = setTimeout(() => void refreshWidget().catch(() => undefined), 1500);
  });
}
