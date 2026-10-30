import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useT } from "@/i18n";
import { usePendingReferral, sendReferral } from "@/server/pendingReferral";
import { normaliseServerUrl, useSession } from "@/server/session";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

/** O-43: soireecrew://befriend?code=...&server=... from someone's personal link. */
export default function BefriendScreen() {
  const { code, server } = useLocalSearchParams<{ code?: string; server?: string }>();
  const i18n = useT();
  const session = useSession((state) => state.session);
  const ready = useSession((state) => state.ready);

  useEffect(() => {
    if (!ready) return;
    const url = server ? normaliseServerUrl(server) : null;
    const clean = code?.trim().toUpperCase();
    if (!clean || !url) {
      router.replace("/friends");
      return;
    }
    if (!session) {
      usePendingReferral.setState({ referral: { code: clean, server: url } });
      showToast({ message: i18n.t("join.connectFirst") });
      router.replace("/(tabs)/crew");
      return;
    }
    if (session.url !== url) {
      showToast({ tone: "danger", message: i18n.t("join.otherServer", { server: url }) });
      router.replace("/friends");
      return;
    }
    void sendReferral(clean, i18n).finally(() => router.replace("/friends"));
  }, [ready, session, code, server, i18n]);

  return (
    <Screen title={i18n.t("people.befriendTitle")}>
      <Text>{i18n.t("people.befriendSending")}</Text>
    </Screen>
  );
}
