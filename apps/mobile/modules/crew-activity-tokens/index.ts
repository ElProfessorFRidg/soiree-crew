import { requireNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

export type TokenEvent = { activityId: string; token: string; startedAt: number };
type TokenModule = {
  startPushActivity(attributesJson: string, stateJson: string): Promise<string | null>;
  addListener(event: "onToken" | "onStartToken", callback: (event: any) => void): { remove(): void };
  listPushActivities(): Promise<{activityId: string; startedAt: number}[]>;
  updatePushActivity(id: string, state: string): Promise<boolean>;
  endPushActivity(id: string): Promise<boolean>;
};

/** Existing ActivityKit push tokens are replayed on every app launch. */
export function observeActivityTokens(onToken: (event: TokenEvent) => void): () => void {
  if (Platform.OS !== "ios") return () => undefined;
  let native: TokenModule;
  try { native = requireNativeModule<TokenModule>("CrewActivityTokens"); }
  catch { return () => undefined; }
  // Expo's EventEmitter calls startObserving("onToken") natively when the first
  // listener is attached, which triggers the module's OnStartObserving handler.
  const listener = native.addListener("onToken", onToken);
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

export function observeStartTokens(onToken: (token: string) => void): () => void {
  if (Platform.OS !== "ios") return () => undefined;
  try { const listener = requireNativeModule<TokenModule>("CrewActivityTokens").addListener("onStartToken", (event: {token:string}) => onToken(event.token)); return () => listener.remove(); }
  catch { return () => undefined; }
}
export async function listPushActivities(): Promise<{activityId:string;startedAt:number}[]> {
  if (Platform.OS !== "ios") return [];
  try { return await requireNativeModule<TokenModule>("CrewActivityTokens").listPushActivities(); } catch { return []; }
}
export async function updatePushActivity(id:string, state:Record<string,unknown>): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try { return await requireNativeModule<TokenModule>("CrewActivityTokens").updatePushActivity(id, JSON.stringify(state)); } catch { return false; }
}
export async function endPushActivity(id:string): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try { return await requireNativeModule<TokenModule>("CrewActivityTokens").endPushActivity(id); } catch { return false; }
}
