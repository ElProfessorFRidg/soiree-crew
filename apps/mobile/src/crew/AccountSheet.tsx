import { useEffect, useState } from "react";
import { useT } from "@/i18n";
import { Sheet } from "@/ui/Sheet";
import { AccountForm, type AccountMode, type ArrivalIntent } from "./AccountForm";

export type { ArrivalIntent } from "./AccountForm";

/** The account form in a sheet, over the Crew tab: opened by joining, creating or a code. */
export function AccountSheet({ intent, server, onClose }: { intent: ArrivalIntent | null; server: string | null; onClose: () => void }) {
  const i18n = useT();
  const [mode, setMode] = useState<AccountMode>("create");

  // Each new request opens on a fresh account form.
  useEffect(() => {
    if (intent) setMode("create");
  }, [intent]);

  const title = !intent
    ? ""
    : mode === "signin"
      ? i18n.t("crew.signIn")
      : intent.kind === "join"
        ? i18n.t("arrival.sheetJoin", { crew: intent.crewName })
        : intent.kind === "create"
          ? i18n.t("arrival.sheetCreate", { crew: intent.draft.name })
          : i18n.t("arrival.sheetCode");

  return (
    <Sheet visible={intent !== null} title={title} onClose={onClose}>
      <AccountForm intent={intent} server={server} mode={mode} onModeChange={setMode} />
    </Sheet>
  );
}
