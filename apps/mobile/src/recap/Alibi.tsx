import { useMemo, useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import { contentFor } from "@crew/games";
import { deckLanguage } from "@/games/i18n";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { Text } from "@/ui/Text";

/** O-76: a ready-made excuse for the morning after, with someone from last night in it when possible. */
export function Alibi({ names }: { names: string[] }) {
  const i18n = useT();
  const lines = useMemo(() => {
    const all = contentFor(deckLanguage(i18n.language)).alibis;
    return names.length ? all : all.filter((line) => !line.includes("{other}"));
  }, [i18n.language, names.length]);
  const [index, setIndex] = useState(() => Math.floor(Math.random() * lines.length));
  // Changes with the line, and only once the names from last night have arrived.
  const who = names.length ? (names[index % names.length] ?? "") : "";
  const line = (lines[index % lines.length] ?? "").replaceAll("{other}", who);
  if (!lines.length) return null;
  return (
    <Panel>
      <Text variant="label">{i18n.t("morning.alibi")}</Text>
      <Text variant="h3">{line}</Text>
      {i18n.language !== deckLanguage(i18n.language) ? <Text variant="small">{i18n.t("morning.alibiLanguage")}</Text> : null}
      <View style={styles.row}>
        <Button
          label={i18n.t("morning.alibiAnother")}
          variant="secondary"
          height={48}
          style={styles.flex}
          onPress={() => {
            haptic.select();
            setIndex((i) => i + 1 + Math.floor(Math.random() * Math.max(1, lines.length - 1)));
          }}
        />
        <Button label={i18n.t("morning.alibiSend")} icon="share" height={48} style={styles.flex} onPress={() => void Share.share({ message: line }).catch(() => undefined)} />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12 },
  flex: { flex: 1 },
});
