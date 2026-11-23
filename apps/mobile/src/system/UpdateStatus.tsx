import { Platform } from "react-native";
import { channel, isEnabled, reloadAsync, useUpdates } from "expo-updates";
import { useT } from "@/i18n";
import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { currentBuild, currentVersion } from "./updates";

export function UpdateStatus() {
  const i18n = useT();
  const { currentlyRunning, isDownloading, isUpdatePending } = useUpdates();
  const revision = currentlyRunning.isEmbeddedLaunch ? null : currentlyRunning.updateId?.slice(0, 8);
  return (
    <>
      <Text variant="small" align="center">
        {Platform.OS === "ios" ? "IPA · " : null}
        {i18n.t("updates.installed", { version: currentVersion, build: currentBuild || "dev" })}
        {revision ? ` · ${i18n.t("updates.otaRevision", { revision })}` : null}
      </Text>
      {Platform.OS === "ios" && !revision ? <Text variant="small" align="center">{isEnabled ? i18n.t("updates.otaIdle", { channel: channel ?? "?" }) : i18n.t("updates.otaOff")}</Text> : null}
      {isEnabled && isDownloading ? <Text variant="small" align="center">{i18n.t("updates.otaDownloading")}</Text> : null}
      {isEnabled && isUpdatePending ? (
        <Button
          variant="secondary"
          label={i18n.t("updates.otaApply")}
          onPress={() => void reloadAsync().catch(() => showToast({ tone: "danger", message: i18n.t("updates.unavailable") }))}
        />
      ) : null}
    </>
  );
}
