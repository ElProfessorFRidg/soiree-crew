import { useEffect } from "react";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { showToast } from "@/ui/Toast";
import { onSyncEvent } from "./engine";
import type { Mutation, RejectionReason } from "./types";

/** Success stays silent (motion and haptics confirm it); every failure surfaces with its reason (SYNC-07). */
export function useSyncFeedback(): void {
  const i18n = useT();

  useEffect(() => {
    const action = (mutation: Mutation): string => {
      if (mutation.kind === "drink.add") return i18n.t(`drinks.${mutation.drink.kind}`);
      return i18n.t("common.save");
    };
    const reason = (code: RejectionReason): string =>
      code === "future_drink" ? i18n.t("errors.futureDrink") : code;

    return onSyncEvent((event) => {
      if (event.type === "accepted" && event.mutation.kind === "drink.add") {
        haptic.confirmed();
      } else if (event.type === "rejected") {
        haptic.error();
        showToast({
          tone: "danger",
          message: i18n.t("errors.rejected", { action: action(event.mutation), reason: reason(event.reason) }),
          durationMs: 8_000,
        });
      } else if (event.type === "offline") {
        showToast({ message: i18n.t("errors.offline", { count: event.queued }), durationMs: 4_000 });
      } else if (event.type === "slow") {
        showToast({ message: i18n.t("errors.slow"), durationMs: 4_000 });
      }
    });
  }, [i18n]);
}
