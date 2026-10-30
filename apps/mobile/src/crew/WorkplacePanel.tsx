import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { showFailure } from "@/server/errors";
import { claimWorkplace, decideWorkplace, fetchWorkplace, withdrawWorkplace, type WorkplaceView } from "@/server/profileData";
import { Button } from "@/ui/Button";
import { Tag } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

/**
 * TER-11: "I work here" waits for a crew admin (or the venue's owner); only a confirmed claim takes
 * my territory points here to zero. Admins confirm or refuse the claims waiting at this bar here.
 */
export function WorkplacePanel({ venueId, onChanged }: { venueId: string; onChanged: () => void }) {
  const i18n = useT();
  const offline = showFailure(i18n);
  const [view, setView] = useState<WorkplaceView | null>(null);
  const load = useCallback(() => {
    void fetchWorkplace(venueId)
      .then(setView)
      .catch(() => undefined);
  }, [venueId]);
  useEffect(load, [load]);
  const refresh = () => {
    load();
    onChanged();
  };

  return (
    <View style={styles.wrap}>
      {view?.mine === "approved" ? (
        <Tag label={i18n.t("venue.workHereApproved")} tone="ok" />
      ) : view?.mine === "pending" ? (
        <View style={styles.row}>
          <Tag label={i18n.t("venue.workHerePending")} tone="amber" />
          <Button label={i18n.t("venue.workHereWithdraw")} variant="outline" height={36} onPress={() => void withdrawWorkplace(venueId).then(refresh).catch(offline)} />
        </View>
      ) : (
        <Button
          label={i18n.t("venue.workHere")}
          variant="outline"
          height={44}
          onPress={() =>
            void claimWorkplace(venueId)
              .then((res) => {
                haptic.confirmed();
                showToast({ message: i18n.t(res.status === "approved" ? "venue.workHereHint" : "venue.workHereSent") });
                refresh();
              })
              .catch(offline)
          }
        />
      )}
      {view?.staff.length ? <Text variant="small">{i18n.t("venue.staffNames", { names: view.staff.map((s) => s.name).join(", ") })}</Text> : null}
      {view?.canDecide && view.pending.length ? (
        <>
          <Text variant="label">{i18n.t("venue.staffTitle")}</Text>
          {view.pending.map((r) => (
            <View key={r.userId} style={styles.item}>
              <Text>{i18n.t("people.staffRequestLine", { name: r.name, venue: r.venue })}</Text>
              {r.suggestedBy ? <Text variant="small">{i18n.t("people.staffSuggested", { name: r.suggestedBy })}</Text> : null}
              <View style={styles.row}>
                <Button
                  label={i18n.t("people.staffRefuse")}
                  variant="outline"
                  height={40}
                  style={styles.flex}
                  onPress={() => void decideWorkplace(venueId, r.userId, "rejected").then(refresh).catch(offline)}
                />
                <Button label={i18n.t("people.staffApprove")} height={40} style={styles.flex} onPress={() => void decideWorkplace(venueId, r.userId, "approved").then(refresh).catch(offline)} />
              </View>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  item: { gap: 6 },
  flex: { flex: 1 },
});
