import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { acceptInvite } from "@/server/crewData";
import { usePendingInvite } from "@/server/pendingInvite";
import { normaliseServerUrl, useSession } from "@/server/session";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

/** QOL-05: soireecrew://join?code=...&server=... from the invite page. */
export default function JoinScreen() {
  const { code, server } = useLocalSearchParams<{ code?: string; server?: string }>();
  const i18n = useT();
  const session = useSession((state) => state.session);
  const ready = useSession((state) => state.ready);

  useEffect(() => {
    if (!ready) return;
    const url = server ? normaliseServerUrl(server) : null;
    const clean = code?.trim().toUpperCase();
    if (!clean || !url) {
      router.replace("/(tabs)/crew");
      return;
    }
    if (!session) {
      usePendingInvite.setState({ invite: { code: clean, server: url } });
      showToast({ message: i18n.t("join.connectFirst") });
      router.replace("/(tabs)/crew");
      return;
    }
    if (session.url !== url) {
      showToast({ tone: "danger", message: i18n.t("join.otherServer", { server: url }) });
      router.replace("/(tabs)/crew");
      return;
    }
    void acceptInvite(clean)
      .then(() => {
        haptic.confirmed();
        showToast({ message: i18n.t("join.joined") });
      })
      .catch(() => showToast({ tone: "danger", message: i18n.t("join.failed") }))
      .finally(() => router.replace("/(tabs)/crew"));
  }, [ready, session, code, server, i18n]);

  return (
    <Screen title={i18n.t("join.title")}>
      <Text>{i18n.t("join.accepting")}</Text>
    </Screen>
  );
}
