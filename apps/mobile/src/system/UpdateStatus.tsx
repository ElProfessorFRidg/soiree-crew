import { Platform, View } from "react-native";
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
      <View style={{ gap: 4 }}>
        <Text variant="h2">{currentVersion}</Text>
        <Text variant="small">{Platform.OS === "ios" ? "IPA · " : null}{i18n.t("updates.installed", { version: currentVersion, build: currentBuild || "dev" })}</Text>
        {revision ? <Text variant="small">{i18n.t("updates.otaRevision", { revision })}</Text> : null}
      </View>
      {Platform.OS === "ios" && !revision ? <Text variant="small">{isEnabled ? i18n.t("updates.otaIdle", { channel: channel ?? "?" }) : i18n.t("updates.otaOff")}</Text> : null}
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
