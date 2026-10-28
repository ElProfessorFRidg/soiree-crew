import { useCallback } from "react";
import { useT } from "@/i18n";
import { useCrewData } from "@/server/crewData";
import { useSession } from "@/server/session";
import { useChat } from "./store";

/** Display names for chat senders: crew nicknames first, then the name a direct chat carries. */
export function useNames(): (userId: string) => string {
  const i18n = useT();
  const crews = useCrewData((s) => s.crews);
  const conversations = useChat((s) => s.conversations);
  const session = useSession((s) => s.session);
  return useCallback(
    (userId: string) => {
      // Signed out, an undefined id must not match the missing session.
      if (session && userId === session.userId) return session.displayName;
      for (const crew of crews) {
        const member = crew.members.find((m) => m.id === userId);
        if (member) return member.nickname || member.displayName;
      }
      return conversations.find((c) => c.otherUserId === userId)?.title || i18n.t("chat.someone");
    },
    [crews, conversations, session, i18n],
  );
}

/** "24 h", "7 j": the disappearing timer as the segmented control and the header show it. */
export const TIMER_CHOICES = [0, 3600, 6 * 3600, 86_400, 7 * 86_400] as const;
