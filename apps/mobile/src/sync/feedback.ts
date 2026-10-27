import { useEffect } from "react";
import { drinkWithArticle } from "@/drinks/display";
import { serverMessage } from "@/server/errors";
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
      if (mutation.kind === "drink.add") return drinkWithArticle(mutation.drink, i18n);
      return i18n.t("errors.change");
    };
    const reason = (code: RejectionReason): string => serverMessage(code, i18n);

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
        showToast({ message: i18n.plural("errors.offline", event.queued), durationMs: 4_000 });
      } else if (event.type === "slow") {
        showToast({ message: i18n.t("errors.slow"), durationMs: 4_000 });
      }
    });
  }, [i18n]);
}
