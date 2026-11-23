import { useEffect, useRef } from "react";
import { router } from "expo-router";
import { isEnabled, reloadAsync, useUpdates } from "expo-updates";
import { useT } from "@/i18n";
import { useAppStore } from "@/state/store";
import { showToast } from "@/ui/Toast";

/**
 * Tells the person about OTA fixes (docs/OTA.md): once a fix has downloaded, a toast offers
 * the restart; on the first launch that runs a new fix, a toast says so and opens What's new.
 */
export function OtaNotices() {
  const i18n = useT();
  const hydrated = useAppStore((state) => state.hydrated);
  const { currentlyRunning, isUpdatePending } = useUpdates();
  const offeredRestart = useRef(false);

  useEffect(() => {
    if (!isEnabled || !isUpdatePending || offeredRestart.current) return;
    offeredRestart.current = true;
    showToast({
      message: i18n.t("updates.otaReady"),
      durationMs: 10_000,
      action: {
        label: i18n.t("updates.otaRestart"),
        onPress: () => void reloadAsync().catch(() => showToast({ tone: "danger", message: i18n.t("updates.unavailable") })),
      },
    });
  }, [isUpdatePending, i18n]);

  const runningId = isEnabled && !currentlyRunning.isEmbeddedLaunch && !currentlyRunning.isEmergencyLaunch ? currentlyRunning.updateId ?? null : null;
  useEffect(() => {
    if (!isEnabled || !hydrated) return;
    if (useAppStore.getState().seenOtaUpdateId === runningId) return;
    useAppStore.setState({ seenOtaUpdateId: runningId });
    if (!runningId) return;
    showToast({
      message: i18n.t("updates.otaApplied", { revision: runningId.slice(0, 8) }),
      durationMs: 8_000,
      action: { label: i18n.t("updates.changelog"), onPress: () => router.push("/versions") },
    });
  }, [hydrated, runningId, i18n]);

  return null;
}
