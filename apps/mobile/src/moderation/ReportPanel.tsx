import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Field } from "@/crew/Field";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { report, type ReportKind, type ReportReason } from "@/server/profileData";
import { Button } from "@/ui/Button";
import { Chip, Panel } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { showFailure } from "@/server/errors";

export const REPORT_REASONS: {
  value: ReportReason;
  key: "people.reasonHarassment" | "people.reasonFake" | "people.reasonInappropriate" | "people.reasonPersonalData" | "people.reasonOther";
}[] = [
  { value: "harassment", key: "people.reasonHarassment" },
  { value: "inappropriate", key: "people.reasonInappropriate" },
  { value: "personalData", key: "people.reasonPersonalData" },
  { value: "fake", key: "people.reasonFake" },
  { value: "other", key: "people.reasonOther" },
];

/** "Fake profile" only makes sense for a profile. */
const reasonsFor = (kind: ReportKind) => REPORT_REASONS.filter((r) => r.value !== "fake" || kind === "profile");

/**
 * COM-08, O-77: report a profile, a party, a bar, a review, a photo, a line of the night or a crew
 * card. Crew content reaches the crew's admins, public content the server's moderators; the toast
 * says which. `compact` is the small entry point that sits on an item in a list.
 */
export function ReportPanel({ targetKind, targetId, compact }: { targetKind: ReportKind; targetId: string; compact?: boolean }) {
  const i18n = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  if (!open) {
    return (
      <Button
        label={i18n.t("people.report")}
        accessibilityLabel={`${i18n.t("people.report")}, ${i18n.t(`people.reportAbout.${targetKind}`)}`}
        icon="flag"
        iconSize={compact ? 16 : 22}
        variant="outline"
        height={compact ? 36 : 44}
        style={compact ? styles.compact : undefined}
        onPress={() => setOpen(true)}
      />
    );
  }
  return (
    <Panel>
      <Text variant="h3">{i18n.t("people.reportWhy")}</Text>
      <View style={styles.chips}>
        {reasonsFor(targetKind).map((r) => (
          <Chip key={r.value} label={i18n.t(r.key)} selected={reason === r.value} onPress={() => setReason(r.value)} />
        ))}
      </View>
      <Field label={i18n.t("people.reportNote")} value={note} onChangeText={setNote} maxLength={300} multiline />
      <View style={styles.row}>
        <Button label={i18n.t("people.blockKeep")} variant="outline" height={48} style={styles.flex} onPress={() => setOpen(false)} />
        <Button
          label={i18n.t("people.reportSend")}
          variant="danger"
          height={48}
          style={styles.flex}
          disabled={!reason}
          loading={sending}
          onPress={() => {
            if (!reason) return;
            setSending(true);
            void report({ targetKind, targetId, reason, ...(note.trim() ? { note: note.trim() } : {}) })
              .then((res) => {
                haptic.confirmed();
                showToast({ message: i18n.t(res.to === "operator" ? "people.reportSentOperator" : "people.reportSent") });
                setOpen(false);
                setReason(null);
                setNote("");
              })
              .catch(showFailure(i18n))
              .finally(() => setSending(false));
          }}
        />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
  compact: { alignSelf: "flex-start" },
});
