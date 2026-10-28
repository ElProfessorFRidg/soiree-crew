import { useEffect } from "react";
import { drinkWithArticle } from "@/drinks/display";
import { serverMessage } from "@/server/errors";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { showToast } from "@/ui/Toast";
import { onSyncEvent } from "./engine";
import type { Mutation, RejectionReason } from "./types";

/** Rejections that land within this window (a queue flushing after the network returns) make one message (SYNC-06). */
const GROUP_MS = 700;

/** Success stays silent (motion and haptics confirm it); every failure surfaces with its reason (SYNC-07). */
export function useSyncFeedback(): void {
  const i18n = useT();

  useEffect(() => {
    const action = (mutation: Mutation): string => {
      if (mutation.kind === "drink.add") return drinkWithArticle(mutation.drink, i18n);
      return i18n.t("errors.change");
    };
    const reason = (code: RejectionReason): string => serverMessage(code, i18n);
    const capital = (text: string): string => text.charAt(0).toLocaleUpperCase(i18n.locale) + text.slice(1);

    let rejected: { mutation: Mutation; reason: RejectionReason }[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    const report = () => {
      timer = null;
      const batch = rejected;
      rejected = [];
      if (!batch.length) return;
      const [only] = batch;
      const message =
        batch.length === 1 && only
          ? i18n.t("errors.rejected", { action: action(only.mutation), reason: reason(only.reason) })
          : [
              i18n.plural("errors.rejectedMany", batch.length),
              ...batch.map((item) => i18n.t("errors.rejectedLine", { action: capital(action(item.mutation)), reason: reason(item.reason) })),
            ].join("\n");
      showToast({ tone: "danger", message, durationMs: 6_000 + 2_000 * Math.min(batch.length, 4) });
    };

    const stop = onSyncEvent((event) => {
      if (event.type === "accepted" && event.mutation.kind === "drink.add") {
        haptic.confirmed();
      } else if (event.type === "rejected") {
        // The rollback plays now, so the haptic does too; only the words wait for the rest of the batch.
        if (!rejected.length) haptic.error();
        rejected.push({ mutation: event.mutation, reason: event.reason });
        if (timer) clearTimeout(timer);
        timer = setTimeout(report, GROUP_MS);
      } else if (event.type === "offline") {
        showToast({ message: i18n.plural("errors.offline", event.queued), durationMs: 4_000 });
      } else if (event.type === "slow") {
        showToast({ message: i18n.t("errors.slow"), durationMs: 4_000 });
      }
    });
    return () => {
      stop();
      if (timer) clearTimeout(timer);
      report();
    };
  }, [i18n]);
}
