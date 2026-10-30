import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { ReportItem, reasonKey } from "@/moderation/ReportItem";
import { decideClaim, fetchOperatorClaims, type PendingClaim } from "@/server/placeData";
import { decideAppeal, decideOperatorReport, fetchOperatorReports, type Appeal, type CrewReport } from "@/server/profileData";
import { useAppStore } from "@/state/store";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { SkeletonRows } from "@/ui/Skeleton";
import { Text } from "@/ui/Text";
import { showFailure } from "@/server/errors";

/**
 * COM-11: the server operator checks who claims a venue page (a call, the website) and decides.
 * COM-08: the operator also moderates public content (reviews, their photos, strangers' profiles),
 * which gives strikes, and answers contests against those decisions (DSA internal complaints).
 */
export default function OperatorScreen() {
  const i18n = useT();
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const [claims, setClaims] = useState<PendingClaim[] | null>(null);
  const [reports, setReports] = useState<CrewReport[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const offline = showFailure(i18n);
  const load = useCallback(() => {
    void fetchOperatorClaims()
      .then((r) => setClaims(r.claims))
      .catch(() => setClaims([]));
    void fetchOperatorReports()
      .then((r) => {
        setReports(r.reports);
        setAppeals(r.appeals);
      })
      .catch(() => undefined);
  }, []);
  useFocusEffect(load);
  const decide = (id: string, decision: "approved" | "rejected") =>
    void decideClaim(id, decision)
      .then(load)
      .catch(offline);
  const when = (at: number) => `${new Intl.DateTimeFormat(i18n.locale, { day: "numeric", month: "short" }).format(new Date(at))}, ${formatClock(at, i18n.language, hourCycle)}`;
  const nothing = claims !== null && !claims.length && !reports.length && !appeals.length;

  return (
    <Screen back title={i18n.t("place.operatorTitle")} withToasts onRefresh={async () => load()}>
      {!claims ? <SkeletonRows /> : null}
      {nothing ? <Text>{i18n.t("place.operatorEmpty")}</Text> : null}
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

      {reports.length ? <Text variant="label">{i18n.t("people.reports")}</Text> : null}
      {reports.map((r) => (
        <ReportItem key={r.id} report={r} when={when(r.at)} onDecide={(decision, ground) => void decideOperatorReport(r.id, decision, ground).then(load).catch(offline)} />
      ))}

      {appeals.length ? <Text variant="label">{i18n.t("people.appeals")}</Text> : null}
      {appeals.map((a) => (
        <Panel key={a.id}>
          <Text variant="h3">
            {a.name}, {i18n.t(`people.reportAbout.${a.targetKind as CrewReport["targetKind"]}`)}
          </Text>
          <Text variant="small">
            {when(a.at)}, {i18n.t("people.noticeGround", { ground: i18n.t(reasonKey(a.ground)) })}
          </Text>
          {a.excerpt ? <Text variant="small">{a.excerpt}</Text> : null}
          <Text>{a.appeal}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button label={i18n.t("people.appealConfirm")} variant="outline" height={44} style={{ flex: 1 }} onPress={() => void decideAppeal(a.id, "confirmed").then(load).catch(offline)} />
            <Button label={i18n.t("people.appealReverse")} height={44} style={{ flex: 1 }} onPress={() => void decideAppeal(a.id, "reversed").then(load).catch(offline)} />
          </View>
        </Panel>
      ))}
    </Screen>
  );
}
