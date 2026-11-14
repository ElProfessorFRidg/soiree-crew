import { createContext, useContext } from "react";
import { useWindowDimensions } from "react-native";
import { contentLayout } from "./pure/layout";

export const SidebarWidthContext = createContext(0);

export function useContentLayout() {
  const { width, height } = useWindowDimensions();
  const sidebar = useContext(SidebarWidthContext);
  return contentLayout(width, height, sidebar);
}
