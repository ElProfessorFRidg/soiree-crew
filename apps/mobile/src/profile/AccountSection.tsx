import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { useT, type Translator } from "@/i18n";
import { api } from "@/server/api";
import { useCrewData } from "@/server/crewData";
import { saveSession, useSession } from "@/server/session";
import { clearAccountHistory, useAppStore } from "@/state/store";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { guarded } from "@/vault/vault";

/** Wipes everything this phone holds about the user, then sends them back to the age gate. */
async function wipeDevice(): Promise<void> {
  await saveSession(null);
  useCrewData.setState({ crews: [], parties: [], live: {} });
  useAppStore.setState({
    ageConfirmedAt: null,
    profile: null,
    drinks: [],
    water: [],
    customDrinks: [],
    outbox: [],
    manualLevel: null,
    levelState: null,
    syncCursor: null,
    uploadedToServerAt: null,
    accountUserId: null,
    vault: [],
  });
  await AsyncStorage.multiRemove(["crew-app-v1", "crew-data-v1"]);
}

/** O-07: deletes the account on the server, then everything on this phone. */
export async function deleteAccount(i18n: Translator): Promise<void> {
  const remote = useSession.getState().session ? api("/v1/me", { method: "DELETE" }) : Promise.resolve();
  try {
    await remote;
    await wipeDevice();
    showToast({ message: i18n.t("account.deleted") });
    router.replace("/onboarding");
  } catch {
    showToast({ tone: "danger", message: i18n.t("crew.offline") });
  }
}

export function AccountSection() {
  const i18n = useT();
  const session = useSession((state) => state.session);
  const [transfer, setTransfer] = useState<string | null>(null);

  const onDelete = () => {
    Alert.alert(i18n.t("account.deleteTitle"), i18n.t("account.deleteBody"), [
      { text: i18n.t("account.deleteKeep"), style: "cancel" },
      {
        text: i18n.t("account.deleteConfirm"),
        style: "destructive",
        onPress: () => {
          if (!guarded({ kind: "deleteAccount" }, () => void deleteAccount(i18n))) showToast({ message: i18n.t("vault.queued") });
        },
      },
    ]);
  };

  return (
    <Panel>
      <Text variant="label">{i18n.t("account.title")}</Text>
      {session ? (
        <>
          <Text>{i18n.t("account.signedInAs", { name: session.displayName, username: session.username })}</Text>
          <Text variant="small">{i18n.t("account.server", { url: session.url })}</Text>
          {transfer ? <Text variant="h3">{i18n.t("account.transferCode", { code: transfer })}</Text> : null}
          <Button
            label={i18n.t("account.addDevice")}
            variant="secondary"
            height={44}
            onPress={() =>
              api<{ code: string }>("/v1/sessions/transfer-code", { method: "POST" })
                .then(({ code }) => setTransfer(code))
                .catch(() => showToast({ tone: "danger", message: i18n.t("crew.offline") }))
            }
          />
          <Button
            label={i18n.t("account.signOut")}
            variant="outline"
            height={44}
            onPress={() => {
              clearAccountHistory();
              useCrewData.setState({ crews: [], parties: [], live: {} });
              void saveSession(null);
            }}
          />
        </>
      ) : (
        <Text variant="small">{i18n.t("account.notConnected")}</Text>
      )}
      <Button label={i18n.t("account.delete")} variant="danger" height={44} onPress={onDelete} />
    </Panel>
  );
}
