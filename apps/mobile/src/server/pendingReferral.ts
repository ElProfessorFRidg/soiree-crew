import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Translator } from "@/i18n";
import { showToast } from "@/ui/Toast";
import { failureMessage } from "./errors";
import { openReferral } from "./profileData";
import { useSession } from "./session";

/** O-43: a referral link opened before the account existed waits here, like an invite (QOL-05). */
interface PendingReferral {
  referral: { code: string; server: string } | null;
}

export const usePendingReferral = create<PendingReferral>()(
  persist((): PendingReferral => ({ referral: null }), { name: "crew-pending-referral", storage: createJSONStorage(() => AsyncStorage) }),
);

/** Sends the friend request a link asked for and says what happened. */
export function sendReferral(code: string, i18n: Translator): Promise<void> {
  return openReferral(code)
    .then((res) => {
      showToast({ message: res.friendship === "friends" ? i18n.t("people.nowFriends", { name: res.name }) : i18n.t("people.requestSent", { name: res.name }) });
    })
    .catch((error: unknown) => {
      showToast({ tone: "danger", message: failureMessage(error, i18n) });
    });
}

/** Once connected to the link's server, the waiting request goes out once. */
export function useConsumePendingReferral(i18n: Translator): void {
  const session = useSession((state) => state.session);
  const referral = usePendingReferral((state) => state.referral);
  useEffect(() => {
    if (!session || !referral) return;
    usePendingReferral.setState({ referral: null });
    if (session.url !== referral.server) return;
    void sendReferral(referral.code, i18n);
  }, [session, referral, i18n]);
}
