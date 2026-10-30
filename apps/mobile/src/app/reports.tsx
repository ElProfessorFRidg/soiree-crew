import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { haptic } from "@/motion/haptics";
import { ReportItem } from "@/moderation/ReportItem";
import { decideReport, decideWorkplace, fetchCrewWorkplaceRequests, fetchReports, type CrewReport, type WorkplaceRequest } from "@/server/profileData";
import { useAppStore } from "@/state/store";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showFailure } from "@/server/errors";

/**
 * COM-08, O-77: what members reported in this crew, for its admins, with the content as it is now.
 * Taking it down sends its author the reason (statement of reasons); reporters stay anonymous.
 * TER-11: "I work here" claims waiting for an admin sit here too.
 */
export default function ReportsScreen() {
  const { crewId } = useLocalSearchParams<{ crewId: string }>();
  const i18n = useT();
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const [reports, setReports] = useState<CrewReport[] | null>(null);
  const [staff, setStaff] = useState<WorkplaceRequest[]>([]);
  const offline = showFailure(i18n);
  const load = useCallback(() => {
    void fetchReports(crewId)
      .then((data) => setReports(data.reports))
      .catch(showFailure(i18n));
    void fetchCrewWorkplaceRequests(crewId)
      .then((data) => setStaff(data.requests))
      .catch(() => setStaff([]));
  }, [crewId, i18n]);
  useEffect(load, [load]);
  const when = (at: number) => `${new Intl.DateTimeFormat(i18n.locale, { day: "numeric", month: "short" }).format(new Date(at))}, ${formatClock(at, i18n.language, hourCycle)}`;

  return (
    <Screen back title={i18n.t("people.reports")} withToasts onRefresh={async () => load()}>
      {staff.length ? (
        <Panel>
          <Text variant="label">{i18n.t("people.staffRequests")}</Text>
          {staff.map((r) => (
            <View key={`${r.venueId}-${r.userId}`} style={styles.item}>
              <Text>{i18n.t("people.staffRequestLine", { name: r.name, venue: r.venue })}</Text>
              {r.suggestedBy ? <Text variant="small">{i18n.t("people.staffSuggested", { name: r.suggestedBy })}</Text> : null}
              <View style={styles.row}>
                <Button
                  label={i18n.t("people.staffRefuse")}
                  variant="outline"
                  height={44}
                  style={styles.flex}
                  onPress={() => void decideWorkplace(r.venueId, r.userId, "rejected").then(load).catch(offline)}
                />
                <Button
                  label={i18n.t("people.staffApprove")}
                  height={44}
                  style={styles.flex}
                  onPress={() => {
                    haptic.confirmed();
                    void decideWorkplace(r.venueId, r.userId, "approved").then(load).catch(offline);
                  }}
                />
              </View>
            </View>
          ))}
        </Panel>
      ) : null}
      {reports && reports.length === 0 ? <Text>{i18n.t("people.reportsEmpty")}</Text> : null}
      {reports?.map((r) => (
        <ReportItem key={r.id} report={r} when={when(r.at)} onDecide={(decision, ground) => void decideReport(crewId, r.id, decision, ground).then(load).catch(offline)} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { gap: 6, paddingVertical: 4 },
  row: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
});
