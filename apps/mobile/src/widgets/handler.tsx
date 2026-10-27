import { Platform } from "react-native";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { NIGHT_WIDGET, NightWidget, readSnapshot } from "./NightWidget";
import { pushTap } from "./queue";

/** Headless task: Android asks for the widget when it is added, resized or due for an update. */
export async function widgetTaskHandler({ widgetInfo, widgetAction, clickAction, renderWidget }: WidgetTaskHandlerProps): Promise<void> {
  if (widgetInfo.widgetName !== NIGHT_WIDGET || widgetAction === "WIDGET_DELETED") return;
  if (widgetAction === "WIDGET_CLICK" && (clickAction === "AGAIN" || clickAction === "WATER")) await pushTap(clickAction === "AGAIN" ? "again" : "water");
  renderWidget(<NightWidget snapshot={await readSnapshot()} />);
}

/** From the app: a drink or water was logged, so the widget on the home screen follows at once. */
export async function refreshWidget(): Promise<void> {
  if (Platform.OS !== "android") return;
  const { requestWidgetUpdate } = await import("react-native-android-widget");
  const snapshot = await readSnapshot();
  await requestWidgetUpdate({ widgetName: NIGHT_WIDGET, renderWidget: () => <NightWidget snapshot={snapshot} /> });
}
