import { Platform } from "react-native";
import { useT } from "@/i18n";
import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";
import { openAppSettings } from "./permissions";

/** Shown once the system stops asking for a permission: only the settings can give it back. */
export function OpenSettingsButton() {
  const i18n = useT();
  if (Platform.OS === "web") return <Text variant="small">{i18n.t("common.permissionWeb")}</Text>;
  return <Button label={i18n.t("common.openSettings")} icon="gear" variant="outline" height={44} onPress={openAppSettings} />;
}
