import { Platform } from "react-native";

/** A label the user recognises in the list of signed-in devices (SEC-07). No identifier. */
export function deviceName(): string {
  const constants = Platform.constants as { Model?: string; Brand?: string; systemName?: string; osVersion?: string; interfaceIdiom?: string };
  if (Platform.OS === "android") return [constants.Brand, constants.Model].filter(Boolean).join(" ") || "Android";
  if (Platform.OS === "ios") return constants.interfaceIdiom === "pad" ? "iPad" : "iPhone";
  return "Web";
}
