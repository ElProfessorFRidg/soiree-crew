import { Linking, Platform } from "react-native";
import type { Translator } from "@/i18n";
import { showToast } from "@/ui/Toast";

/**
 * A refused permission, in words. Once the system stops asking (canAskAgain false), only the
 * settings can turn it back on, so the toast opens them; a browser keeps it in the site settings.
 */
export function showPermissionDenied(i18n: Translator, message: string, canAskAgain: boolean): void {
  if (Platform.OS === "web") {
    showToast({ tone: "danger", message: `${message} ${i18n.t("common.permissionWeb")}` });
    return;
  }
  showToast({
    tone: "danger",
    message,
    ...(canAskAgain ? {} : { action: { label: i18n.t("common.openSettings"), onPress: () => void Linking.openSettings() } }),
  });
}

export function openAppSettings(): void {
  if (Platform.OS !== "web") void Linking.openSettings();
}
