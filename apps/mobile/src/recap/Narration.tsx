import { useMemo, useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { api } from "@/server/api";
import type { Recap } from "@/server/recapData";
import { useSession } from "@/server/session";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Panel, Segmented } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { narrate, TONES, type NightFacts, type Tone } from "./nightStory";

/**
 * AI-02: the night as a short story. Written from templates on the phone, or drafted by the AI when
 * the crew turned it on; either way a person reads it before publishing it to the recap.
 */
export function Narration({ recap, facts, onPublished }: { recap: Recap; facts: NightFacts; onPublished: () => void }) {
  const i18n = useT();
  const theme = useTheme();
  const me = useSession((state) => state.session?.userId);
  const [tone, setTone] = useState<Tone>("plain");
  const [variant, setVariant] = useState(0);
  const [aiText, setAiText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const language = i18n.language === "fr" ? "fr" : "en";
  const template = useMemo(() => narrate(facts, tone, language, variant), [facts, tone, language, variant]);
  const text = aiText ?? template;
  const wasThere = recap.participants.some((p) => p.userId === me);
  const published = recap.narration;
  const nameOf = (id: string) => recap.participants.find((p) => p.userId === id)?.name ?? "";

  const askAi = () => {
    setBusy(true);
    void api<{ text: string }>(`/v1/parties/${recap.party.id}/narration/draft`, { method: "POST", body: { tone, language: i18n.language, facts } })
      .then((res) => {
        haptic.select();
        setAiText(res.text);
      })
      .catch(() => showToast({ tone: "danger", message: i18n.t("narration.aiFailed") }))
      .finally(() => setBusy(false));
  };
  const publish = () => {
    setBusy(true);
    void api(`/v1/parties/${recap.party.id}/narration`, { method: "POST", body: { text, tone } })
      .then(() => {
        haptic.confirmed();
        showToast({ message: i18n.t("narration.published") });
        onPublished();
      })
      .catch(() => showToast({ tone: "danger", message: i18n.t("crew.offline") }))
      .finally(() => setBusy(false));
  };

  return (
    <Panel>
      <Text variant="label">{i18n.t("narration.title")}</Text>
      {published ? (
        <View style={styles.block}>
          <Text>{published.text}</Text>
          <Text variant="small">{i18n.t("narration.by", { name: nameOf(published.authorId) })}</Text>
        </View>
      ) : null}
      <Segmented<Tone>
        accessibilityLabel={i18n.t("narration.tone")}
        value={tone}
        items={TONES.map((t) => ({ value: t, label: i18n.t(`narration.tones.${t}`) }))}
        onChange={(next) => {
          setTone(next);
          setAiText(null);
        }}
      />
      <Text style={[styles.draft, { borderColor: theme.line }]}>{text}</Text>
      {i18n.language !== "fr" && i18n.language !== "en" && !aiText ? <Text variant="small">{i18n.t("narration.english")}</Text> : null}
      <View style={styles.row}>
        <Button
          label={i18n.t("narration.another")}
          variant="secondary"
          height={44}
          style={styles.flex}
          onPress={() => {
            setAiText(null);
            setVariant((v) => v + 1);
          }}
        />
        {recap.aiAvailable ? <Button label={i18n.t("narration.ai")} variant="secondary" height={44} style={styles.flex} loading={busy} onPress={askAi} /> : null}
      </View>
      <View style={styles.row}>
        {wasThere ? <Button label={i18n.t("narration.publish")} height={48} style={styles.flex} loading={busy} onPress={publish} /> : null}
        <Button label={i18n.t("narration.share")} icon="share" variant="outline" height={48} style={styles.flex} onPress={() => void Share.share({ message: text }).catch(() => undefined)} />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  block: { gap: 4 },
  draft: { borderWidth: 1, borderRadius: 12, padding: 12 },
  row: { flexDirection: "row", gap: 12 },
  flex: { flex: 1 },
});
