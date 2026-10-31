import { useState } from "react";
import { useT } from "@/i18n";
import { AccountForm, type AccountMode } from "@/crew/AccountForm";
import { ServerAddress, ServerLine, ServerSheet } from "@/crew/ServerChoice";
import { officialServer } from "@/crew/servers";
import { usePendingInvite } from "@/server/pendingInvite";
import { normaliseServerUrl } from "@/server/session";
import { Panel } from "@/ui/controls";
import { Text } from "@/ui/Text";

/**
 * O-02: the account, the way the Crew tab asks for it. The official server is already picked, a
 * pseudo is enough; "J'ai déjà un compte" signs in with a password or a code from another phone,
 * and the server line at the bottom changes the server for another public or a private one.
 */
export function AccountStep({ mode, onModeChange }: { mode: AccountMode; onModeChange: (mode: AccountMode) => void }) {
  const i18n = useT();
  // QOL-05: an invite link opened before the account exists names the server to use.
  const pending = usePendingInvite((state) => state.invite);
  const [server, setServer] = useState<string | null>(() => (pending ? normaliseServerUrl(pending.server) : null) ?? officialServer());
  const [choosing, setChoosing] = useState(false);
  return (
    <>
      <Text variant="h1">{mode === "create" ? i18n.t("onboarding.accountTitle") : i18n.t("onboarding.signInTitle")}</Text>
      {!server ? (
        <Panel>
          <Text muted>{i18n.t("arrival.noOfficialServer")}</Text>
          <ServerAddress onPick={setServer} />
        </Panel>
      ) : null}
      <AccountForm intent={null} server={server} mode={mode} onModeChange={onModeChange} autoFocus={false} />
      <ServerLine server={server} onChange={() => setChoosing(true)} />
      <ServerSheet visible={choosing} current={server} onPick={setServer} onClose={() => setChoosing(false)} />
    </>
  );
}
