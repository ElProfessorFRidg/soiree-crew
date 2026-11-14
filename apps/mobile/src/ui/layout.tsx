import { createContext, useContext } from "react";
import { Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSegments } from "expo-router";
import { contentLayout, screenSpacing } from "./pure/layout";

export const SidebarWidthContext = createContext(0);

export function useContentLayout() {
  const { width, height } = useWindowDimensions();
  const sidebar = useContext(SidebarWidthContext);
  return contentLayout(width, height, sidebar);
}

export function useScreenSpacing(options: { footer?: boolean; keyboard?: boolean } = {}) {
  const layout = useContentLayout();
  const insets = useSafeAreaInsets();
  const segments = useSegments() as string[];
  return screenSpacing({ ...layout, ...options, insets, tabbed: segments[0] === "(tabs)", nativeTabs: Platform.OS === "ios" && !Platform.isPad });
}
