import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useT } from "@/i18n";
import { REPORT_REASONS } from "@/moderation/ReportPanel";
import type { CrewReport, ReportReason } from "@/server/profileData";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Chip, Panel, Tag } from "@/ui/controls";
import { Text } from "@/ui/Text";

export const reasonKey = (reason: ReportReason) => REPORT_REASONS.find((r) => r.value === reason)?.key ?? "people.reasonOther";

/**
 * COM-08: one report for whoever moderates it (crew admin or server operator): what it is about,
 * the content as it is now, and the decision with the reason its author will receive.
 */
export function ReportItem({ report: r, when, onDecide }: { report: CrewReport; when: string; onDecide: (decision: "upheld" | "dismissed", ground: ReportReason) => void }) {
  const i18n = useT();
  const theme = useTheme();
  const [ground, setGround] = useState<ReportReason>(r.reason);
  const decided = r.decision ?? (r.handledAt ? "dismissed" : null);
  return (
    <Panel>
      <Text variant="h3">
        {i18n.t(`people.reportAbout.${r.targetKind}`)}, {i18n.t(reasonKey(r.reason))}
      </Text>
      <Text variant="small">{when}</Text>
      {r.note ? <Text>{r.note}</Text> : null}
      {r.content ? (
        <View style={[styles.content, { borderColor: theme.line }]}>
          {r.content.authorName ? <Text variant="small">{i18n.t("people.reportBy", { name: r.content.authorName })}</Text> : null}
          {r.content.text ? <Text>{r.content.text}</Text> : null}
          {r.content.photos.length ? (
            <View style={styles.row}>
              {r.content.photos.map((url) => (
                <Image key={url} source={{ uri: url }} style={[styles.photo, { backgroundColor: theme.surfaceRaised }]} />
              ))}
            </View>
          ) : null}
        </View>
      ) : !decided ? (
        <Text variant="small">{i18n.t("people.reportGone")}</Text>
      ) : null}
      {decided ? (
        <View style={styles.row}>
          <Tag label={i18n.t(decided === "upheld" ? "people.decisionUpheld" : "people.decisionDismissed")} tone={decided === "upheld" ? "danger" : "ok"} />
        </View>
      ) : (
        <>
          <Text variant="small">{i18n.t("people.decisionGround")}</Text>
          <View style={styles.chips}>
            {REPORT_REASONS.map((reason) => (
              <Chip key={reason.value} label={i18n.t(reason.key)} selected={ground === reason.value} onPress={() => setGround(reason.value)} />
            ))}
          </View>
          <View style={styles.row}>
            <Button label={i18n.t("people.decisionKeep")} variant="outline" height={44} style={styles.flex} onPress={() => onDecide("dismissed", ground)} />
            <Button label={i18n.t("people.decisionRemove")} variant="danger" height={44} style={styles.flex} onPress={() => onDecide("upheld", ground)} />
          </View>
        </>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  flex: { flex: 1 },
  content: { gap: 6, borderLeftWidth: 3, paddingLeft: 10 },
  photo: { width: 88, height: 88, borderRadius: 10 },
});
