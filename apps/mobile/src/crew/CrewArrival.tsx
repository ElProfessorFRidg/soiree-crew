import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { space } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { usePendingInvite } from "@/server/pendingInvite";
import { normaliseServerUrl } from "@/server/session";
import { Panel, Segmented } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { AccountSheet, type ArrivalIntent } from "./AccountSheet";
import { CreateCrewForm, JoinByCode } from "./AddCrew";
import { PublicCrewList } from "./PublicCrewList";
import { ServerAddress, ServerLine, ServerSheet } from "./ServerChoice";
import { officialServer } from "./servers";

type Tab = "find" | "create" | "code";

/**
 * The signed-out Crew tab: find a public crew, create one, or come in with a code. The official
 * server is already picked; the account is asked only at the moment of joining or creating.
 * A build without an official server asks for an address first, in the same layout.
 */
export function CrewArrival() {
  const i18n = useT();
  // QOL-05: an invite link opened before the account exists names its server and its code.
  const pending = usePendingInvite((state) => state.invite);
  const [server, setServer] = useState<string | null>(() => (pending ? normaliseServerUrl(pending.server) : null) ?? officialServer());
  const [tab, setTab] = useState<Tab>(pending ? "code" : "find");
  const [choosing, setChoosing] = useState(false);
  const [intent, setIntent] = useState<ArrivalIntent | null>(null);

  // The invite may be read from storage after the first render, or opened while this screen shows.
  useEffect(() => {
    if (!pending) return;
    const url = normaliseServerUrl(pending.server);
    if (url) setServer(url);
    setTab("code");
  }, [pending]);

  return (
    <View style={styles.page}>
      {!server ? (
        <Panel>
          <Text muted>{i18n.t("arrival.noOfficialServer")}</Text>
          <ServerAddress onPick={setServer} />
        </Panel>
      ) : null}
      <Segmented
        accessibilityLabel={i18n.t("crew.connectTitle")}
        value={tab}
        items={[
          { value: "find", label: i18n.t("arrival.tabFind") },
          { value: "create", label: i18n.t("arrival.tabCreate") },
          { value: "code", label: i18n.t("arrival.tabCode") },
        ]}
        onChange={setTab}
      />
      {tab === "find" ? <PublicCrewList server={server} onJoin={(crew) => setIntent({ kind: "join", crewId: crew.id, crewName: crew.name })} /> : null}
      {tab === "create" ? (
        <CreateCrewForm
          disabled={!server}
          onSubmit={(draft) => {
            setIntent({ kind: "create", draft });
            return false;
          }}
        />
      ) : null}
      {tab === "code" ? (
        <JoinByCode
          key={pending?.code ?? "typed"}
          initialCode={pending?.code}
          disabled={!server}
          onSubmit={(code, linkServer) => {
            // A share link names its server: the account goes there, whatever was picked.
            const fromLink = linkServer ? normaliseServerUrl(linkServer) : null;
            if (fromLink) setServer(fromLink);
            setIntent({ kind: "code", code });
          }}
        />
      ) : null}
      <ServerLine server={server} onChange={() => setChoosing(true)} />
      <ServerSheet visible={choosing} current={server} onPick={setServer} onClose={() => setChoosing(false)} />
      <AccountSheet intent={intent} server={server} onClose={() => setIntent(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.sectionGap },
});
