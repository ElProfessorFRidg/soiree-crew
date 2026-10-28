import { Platform } from "react-native";

/** Image sharing needs the native share sheet and a view capture; the web build has neither, so the buttons hide there. */
export const canShareImages = Platform.OS !== "web";
