import { requireNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

type TokenEvent = { activityId: string; token: string };
type TokenModule = {
  startObserving(): void;
  addListener(event: "onToken", callback: (event: TokenEvent) => void): { remove(): void };
};

/** Existing ActivityKit push tokens are replayed on every app launch. */
export function observeActivityTokens(onToken: (event: TokenEvent) => void): () => void {
  if (Platform.OS !== "ios") return () => undefined;
  let native: TokenModule;
  try { native = requireNativeModule<TokenModule>("CrewActivityTokens"); }
  catch { return () => undefined; }
  const listener = native.addListener("onToken", onToken);
  native.startObserving();
  return () => listener.remove();
}
