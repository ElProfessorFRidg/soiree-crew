import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** QOL-05: an invite link opened before the account exists waits here, then is accepted once connected. */
interface PendingInvite {
  invite: { code: string; server: string } | null;
}

export const usePendingInvite = create<PendingInvite>()(
  persist((): PendingInvite => ({ invite: null }), { name: "crew-pending-invite", storage: createJSONStorage(() => AsyncStorage) }),
);
