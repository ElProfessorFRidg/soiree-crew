import { requireNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

type TokenEvent = { activityId: string; token: string };
type TokenModule = {
  startObserving(): void;
  startPushActivity(attributesJson: string, stateJson: string): Promise<string | null>;
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

/** Creates a remotely updatable Live Activity; unlike the package default, requests a push token. */
export async function startPushActivity(
  attributes: Record<string, unknown>,
  state: Record<string, unknown>,
): Promise<string | null> {
  if (Platform.OS !== "ios") return null;
  const native = requireNativeModule<TokenModule>("CrewActivityTokens");
  return native.startPushActivity(JSON.stringify(attributes), JSON.stringify(state));
}
