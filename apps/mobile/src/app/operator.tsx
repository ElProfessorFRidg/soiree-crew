import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { useT } from "@/i18n";
import { decideClaim, fetchOperatorClaims, type PendingClaim } from "@/server/placeData";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { SkeletonRows } from "@/ui/Skeleton";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

/** COM-11: the server operator checks who claims a venue page (a call, the website) and decides. */
export default function OperatorScreen() {
  const i18n = useT();
  const [claims, setClaims] = useState<PendingClaim[] | null>(null);
  const load = useCallback(() => {
    void fetchOperatorClaims()
      .then((r) => setClaims(r.claims))
      .catch(() => setClaims([]));
  }, []);
  useFocusEffect(load);
  const decide = (id: string, decision: "approved" | "rejected") =>
    void decideClaim(id, decision)
      .then(load)
      .catch(() => showToast({ tone: "danger", message: i18n.t("crew.offline") }));

  return (
    <Screen back title={i18n.t("place.operatorTitle")} withToasts onRefresh={async () => load()}>
      {!claims ? <SkeletonRows /> : null}
      {claims && !claims.length ? <Text>{i18n.t("place.operatorEmpty")}</Text> : null}
      {claims?.map((c) => (
        <Panel key={c.id}>
          <Text variant="h3">{c.place}</Text>
          {c.address ? <Text variant="small">{c.address}</Text> : null}
          <Text>{i18n.t("place.operatorBy", { name: c.by, role: c.role })}</Text>
          <Text>{c.contact}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button label={i18n.t("place.operatorReject")} variant="outline" height={44} style={{ flex: 1 }} onPress={() => decide(c.id, "rejected")} />
            <Button label={i18n.t("place.operatorApprove")} height={44} style={{ flex: 1 }} onPress={() => decide(c.id, "approved")} />
          </View>
        </Panel>
      ))}
    </Screen>
  );
}
