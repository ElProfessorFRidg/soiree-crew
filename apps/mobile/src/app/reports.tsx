import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { fetchReports, markReportHandled, type CrewReport } from "@/server/profileData";
import { useAppStore } from "@/state/store";
import { Button } from "@/ui/Button";
import { Panel, Tag } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

const REASON_KEYS = {
  harassment: "people.reasonHarassment",
  fake: "people.reasonFake",
  inappropriate: "people.reasonInappropriate",
  other: "people.reasonOther",
} as const;

/** COM-08: what members reported in this crew, for its admins. Reporters stay anonymous. */
export default function ReportsScreen() {
  const { crewId } = useLocalSearchParams<{ crewId: string }>();
  const i18n = useT();
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const [reports, setReports] = useState<CrewReport[] | null>(null);
  const load = useCallback(() => {
    void fetchReports(crewId)
      .then((data) => setReports(data.reports))
      .catch(() => showToast({ tone: "danger", message: i18n.t("crew.offline") }));
  }, [crewId, i18n]);
  useEffect(load, [load]);
  const when = (at: number) => `${new Intl.DateTimeFormat(i18n.locale, { day: "numeric", month: "short" }).format(new Date(at))}, ${formatClock(at, i18n.language, hourCycle)}`;

  return (
    <Screen back title={i18n.t("people.reports")} withToasts>
      {reports && reports.length === 0 ? <Text>{i18n.t("people.reportsEmpty")}</Text> : null}
      {reports?.map((r) => (
        <Panel key={r.id}>
          <Text variant="h3">
            {i18n.t(`people.reportAbout.${r.targetKind}`)}, {i18n.t(REASON_KEYS[r.reason])}
          </Text>
          <Text variant="small">{when(r.at)}</Text>
          {r.note ? <Text>{r.note}</Text> : null}
          <View>
            {r.handledAt ? (
              <Tag label={i18n.t("people.handled")} tone="ok" />
            ) : (
              <Button label={i18n.t("people.markHandled")} variant="outline" height={40} onPress={() => void markReportHandled(crewId, r.id).then(load).catch(() => undefined)} />
            )}
          </View>
        </Panel>
      ))}
    </Screen>
  );
}
