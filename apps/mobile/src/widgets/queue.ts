import AsyncStorage from "@react-native-async-storage/async-storage";

// QOL-25: a tap on the widget is recorded without opening the app. The widget never touches the
// app's own state (the app could be alive in the background and overwrite it); it appends to this
// queue, and the app turns each entry into a real drink or water, at the time of the tap.

export const QUEUE_KEY = "crew-widget-queue";
/** Two taps closer than this are one (a glove, a shaky hand), like the double-tap guard in the app. */
const DOUBLE_TAP_MS = 3_000;

export interface WidgetTap {
  kind: "again" | "water";
  at: number;
}

export async function readQueue(): Promise<WidgetTap[]> {
  try {
    return (JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) ?? "[]") as WidgetTap[]).filter((t) => t && (t.kind === "again" || t.kind === "water") && typeof t.at === "number");
  } catch {
    return [];
  }
}

export async function pushTap(kind: WidgetTap["kind"], at = Date.now()): Promise<boolean> {
  const queue = await readQueue();
  const last = [...queue].reverse().find((t) => t.kind === kind);
  if (last && at - last.at < DOUBLE_TAP_MS) return false;
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...queue, { kind, at }].slice(-50)));
  return true;
}

/** Hands the queue over and empties it. */
export async function takeQueue(): Promise<WidgetTap[]> {
  const queue = await readQueue();
  if (queue.length) await AsyncStorage.removeItem(QUEUE_KEY);
  return queue;
}
