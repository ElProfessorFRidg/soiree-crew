import { useState } from "react";
import type { UiLanguage } from "@crew/units";
import { StyleSheet, View } from "react-native";
import { Field } from "@/crew/Field";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { ReportPanel } from "@/moderation/ReportPanel";
import { addQuote, removeQuote, voteQuote, type Recap } from "@/server/recapData";
import { newId } from "@/state/store";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Chip, Panel } from "@/ui/controls";
import { ScalePressable } from "@/ui/Pressable";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { showFailure } from "@/server/errors";

const NB = " ";
/** Each language's own quotation marks. */
const QUOTES: Record<UiLanguage, [string, string]> = {
  fr: [`«${NB}`, `${NB}»`],
  en: ["“", "”"],
  es: ["«", "»"],
  it: ["«", "»"],
  pt: ["«", "»"],
  ru: ["«", "»"],
  de: ["„", "“"],
};

/** N-23: lines of the night, voted with a tap (ring and count), best first. */
export function Quotes({ recap, me, onChange }: { recap: Recap; me: string | undefined; onChange: () => void }) {
  const i18n = useT();
  const theme = useTheme();
  const [text, setText] = useState("");
  const [saidBy, setSaidBy] = useState<string | null>(null);
  const offline = showFailure(i18n);
  const quote = (s: string) => {
    const [open, close] = QUOTES[i18n.language];
    return `${open}${s}${close}`;
  };
  const nameOf = (id: string | null) => recap.participants.find((p) => p.userId === id)?.name ?? i18n.t("recap.quoteNobody");

  return (
    <View style={styles.wrap}>
      <Text variant="label">{i18n.t("recap.quoteTitle")}</Text>
      {recap.quotes.length === 0 ? <Text variant="small">{i18n.t("recap.quoteEmpty")}</Text> : null}
      {recap.quotes.map((q, index) => (
        <Panel key={q.id} tint={index === 0 && q.votes > 0 ? "amber" : undefined}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text variant="h3">{quote(q.text)}</Text>
              <Text variant="small">{nameOf(q.saidBy)}</Text>
            </View>
            <ScalePressable
              accessibilityRole="button"
              accessibilityLabel={i18n.t("recap.quoteVote")}
              accessibilityState={{ selected: q.mine }}
              onPress={() => {
                haptic.select();
                void voteQuote(q.id).then(onChange).catch(offline);
              }}
              style={[styles.vote, { borderColor: q.mine ? theme.amber : theme.line, backgroundColor: q.mine ? theme.amber : "transparent" }]}
            >
              <Text variant="h3" color={q.mine ? theme.bg : theme.text}>
                {i18n.number(q.votes)}
              </Text>
            </ScalePressable>
          </View>
          {q.addedBy === me || q.saidBy === me ? (
            <Button label={i18n.t("recap.quoteRemove")} variant="outline" height={32} onPress={() => void removeQuote(q.id).then(onChange).catch(offline)} />
          ) : null}
          {/* COM-08, O-77: a line someone else added can go to the crew's admins. */}
          {q.addedBy !== me ? <ReportPanel targetKind="quote" targetId={q.id} compact /> : null}
        </Panel>
      ))}
      <Field label={i18n.t("recap.quoteAdd")} placeholder={i18n.t("recap.quotePlaceholder")} value={text} onChangeText={setText} maxLength={200} />
      <Text variant="small">{i18n.t("recap.quoteWho")}</Text>
      <View style={styles.chips}>
        <Chip label={i18n.t("recap.quoteNobody")} selected={saidBy === null} onPress={() => setSaidBy(null)} />
        {recap.participants.map((p) => (
          <Chip key={p.userId} label={p.name} selected={saidBy === p.userId} onPress={() => setSaidBy(p.userId)} />
        ))}
      </View>
      <Button
        label={i18n.t("recap.quoteAdd")}
        variant="secondary"
        height={44}
        disabled={text.trim().length < 2}
        onPress={() =>
          void addQuote(recap.party.id, { id: newId(), text: text.trim(), saidBy })
            .then(() => {
              haptic.confirmed();
              setText("");
              setSaidBy(null);
              onChange();
            })
            .catch(offline)
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
  vote: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
