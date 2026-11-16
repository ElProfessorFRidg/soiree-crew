import { useState } from "react";
import { AccountForm, type AccountMode } from "@/crew/AccountForm";
import { officialServer } from "@/crew/servers";
import { useT } from "@/i18n";
import { ApiError } from "@/server/api";
import { failureMessage } from "@/server/errors";
import { useSession } from "@/server/session";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { Sheet } from "@/ui/Sheet";
import { SkeletonRows } from "@/ui/Skeleton";
import { Text } from "@/ui/Text";

/** Missing accounts, loading and server failures have distinct, recoverable states. */
export function ProfileLoadState({ connected, loading, error, onRetry }: { connected: boolean; loading: boolean; error: unknown; onRetry: () => Promise<void> }) {
  const i18n = useT();
  const server = useSession((state) => state.session?.url) ?? officialServer();
  const [accountMode, setAccountMode] = useState<AccountMode | null>(null);
  const expired = error instanceof ApiError && error.failure.kind === "http" && error.failure.status === 401;
  if (loading) return <SkeletonRows rows={3} />;
  return <>
    <Panel>
      <Text>{!connected ? i18n.t("people.accountRequired") : failureMessage(error, i18n)}</Text>
      {!connected ? <>
        <Text variant="small">{i18n.t("account.guestHint")}</Text>
        <Button label={i18n.t("account.guestCreate")} onPress={() => setAccountMode("create")} />
        <Button label={i18n.t("account.guestSignIn")} variant="outline" onPress={() => setAccountMode("signin")} />
      </> : <>
        <Button label={i18n.t("common.retry")} variant="secondary" onPress={() => void onRetry().catch(() => undefined)} />
        {expired ? <Button label={i18n.t("crew.signIn")} onPress={() => setAccountMode("signin")} /> : null}
      </>}
    </Panel>
    <Sheet visible={accountMode !== null} title={i18n.t(accountMode === "signin" ? "crew.signIn" : "account.guestCreate")} onClose={() => setAccountMode(null)}>
      <AccountForm intent={null} server={server} mode={accountMode ?? "signin"} onModeChange={setAccountMode} />
    </Sheet>
  </>;
}
