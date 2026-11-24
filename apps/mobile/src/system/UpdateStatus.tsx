import { Platform, View } from "react-native";
import { isEnabled, reloadAsync, useUpdates } from "expo-updates";
import { useT } from "@/i18n";
import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { currentBuild, currentVersion, releaseChannel } from "./updates";

export function UpdateStatus() {
  const i18n = useT();
  const { currentlyRunning, isDownloading, isUpdatePending } = useUpdates();
  const revision = currentlyRunning.isEmbeddedLaunch || currentlyRunning.isEmergencyLaunch
    ? null
    : currentlyRunning.updateId?.slice(0, 8);
  return (
    <>
      <View style={{ gap: 4 }}>
        <Text variant="h2">{i18n.t("updates.installed", { version: currentVersion, build: currentBuild || "dev" })}</Text>
        {Platform.OS === "ios" ? (
          <Text variant="small">
            {isEnabled
              ? [i18n.t(releaseChannel === "preview" ? "updates.otaPreview" : "updates.otaProd"), revision && i18n.t("updates.otaRevision", { revision })].filter(Boolean).join(" · ")
              : i18n.t("updates.otaOff")}
          </Text>
        ) : null}
      </View>
      {isEnabled && isDownloading ? <Text variant="small">{i18n.t("updates.otaDownloading")}</Text> : null}
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
