import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Field } from "@/crew/Field";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { report, type ReportReason } from "@/server/profileData";
import { Button } from "@/ui/Button";
import { Chip, Panel } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { showFailure } from "@/server/errors";

const REASONS: { value: ReportReason; key: "people.reasonHarassment" | "people.reasonFake" | "people.reasonInappropriate" | "people.reasonOther" }[] = [
  { value: "harassment", key: "people.reasonHarassment" },
  { value: "fake", key: "people.reasonFake" },
  { value: "inappropriate", key: "people.reasonInappropriate" },
  { value: "other", key: "people.reasonOther" },
];

/** COM-08: report a profile, a party or a bar to the crew's admins. */
export function ReportPanel({ targetKind, targetId }: { targetKind: "profile" | "party" | "venue"; targetId: string }) {
  const i18n = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  if (!open) return <Button label={i18n.t("people.report")} icon="flag" variant="outline" height={44} onPress={() => setOpen(true)} />;
  return (
    <Panel>
      <Text variant="h3">{i18n.t("people.reportWhy")}</Text>
      <View style={styles.chips}>
        {REASONS.map((r) => (
          <Chip key={r.value} label={i18n.t(r.key)} selected={reason === r.value} onPress={() => setReason(r.value)} />
        ))}
      </View>
      <Field label={i18n.t("people.reportNote")} value={note} onChangeText={setNote} maxLength={300} multiline />
      <Button
        label={i18n.t("people.reportSend")}
        variant="danger"
        height={48}
        disabled={!reason}
        loading={sending}
        onPress={() => {
          if (!reason) return;
          setSending(true);
          void report({ targetKind, targetId, reason, ...(note.trim() ? { note: note.trim() } : {}) })
            .then(() => {
              haptic.confirmed();
              showToast({ message: i18n.t("people.reportSent") });
              setOpen(false);
              setReason(null);
              setNote("");
            })
            .catch(showFailure(i18n))
            .finally(() => setSending(false));
        }}
      />
    </Panel>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
