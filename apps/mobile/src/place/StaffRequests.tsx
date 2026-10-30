import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useT } from "@/i18n";
import { showFailure } from "@/server/errors";
import { decideWorkplace, fetchPlaceWorkplaceRequests, type WorkplaceRequest } from "@/server/profileData";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { Text } from "@/ui/Text";

/** TER-11, COM-11: the venue's owner confirms who works there, whichever crew pinned the bar. */
export function StaffRequests({ venueId }: { venueId: string }) {
  const i18n = useT();
  const [requests, setRequests] = useState<WorkplaceRequest[]>([]);
  const load = useCallback(() => {
    void fetchPlaceWorkplaceRequests(venueId)
      .then((r) => setRequests(r.requests))
      .catch(() => setRequests([]));
  }, [venueId]);
  useEffect(load, [load]);
  if (!requests.length) return null;
  const decide = (r: WorkplaceRequest, decision: "approved" | "rejected") => void decideWorkplace(r.venueId, r.userId, decision).then(load).catch(showFailure(i18n));
  return (
    <Panel>
      <Text variant="label">{i18n.t("place.ownerStaff")}</Text>
      {requests.map((r) => (
        <View key={`${r.venueId}-${r.userId}`} style={styles.item}>
          <Text>{i18n.t("people.staffRequestLine", { name: r.name, venue: r.venue })}</Text>
          <View style={styles.row}>
            <Button label={i18n.t("people.staffRefuse")} variant="outline" height={44} style={styles.flex} onPress={() => decide(r, "rejected")} />
            <Button label={i18n.t("people.staffApprove")} height={44} style={styles.flex} onPress={() => decide(r, "approved")} />
          </View>
        </View>
      ))}
    </Panel>
  );
}

const styles = StyleSheet.create({
  item: { gap: 6 },
  row: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
});
