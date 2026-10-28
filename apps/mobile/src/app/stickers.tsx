import * as Sharing from "expo-sharing";
import { useLocalSearchParams } from "expo-router";
import { useRef, useState, type ComponentRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { avatarColor, palette } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { useCrewData } from "@/server/crewData";
import { initials } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Chip } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { canShareImages } from "@/system/share";

/** The crew's catchphrases: the moments a sticker answers in a chat. */
const LINES = ["stickers.lines.cheers", "stickers.lines.lastOne", "stickers.lines.whoComes", "stickers.lines.home", "stickers.lines.myRound", "stickers.lines.water"] as const;
/** WhatsApp wants 512 x 512 with a transparent background; this view is drawn at 256 and captured at 2x. */
const SIDE = 256;

/** JOY-10: stickers made from the crew's faces and the night's lines, shared as images to any chat app. */
export default function StickersScreen() {
  const { crewId } = useLocalSearchParams<{ crewId?: string }>();
  const i18n = useT();
  const crews = useCrewData((s) => s.crews);
  const crew = crews.find((c) => c.id === crewId) ?? crews[0];
  const [person, setPerson] = useState(crew?.members[0]?.id ?? null);
  const [line, setLine] = useState<(typeof LINES)[number]>(LINES[0]);
  const [busy, setBusy] = useState(false);
  const sticker = useRef<ComponentRef<typeof View>>(null);
  const member = crew?.members.find((m) => m.id === person);

  const share = async () => {
    if (!sticker.current) return;
    setBusy(true);
    try {
      const uri = await captureRef(sticker, { format: "png", width: 512, height: 512, result: Platform.OS === "web" ? "data-uri" : "tmpfile" });
      haptic.confirmed();
      if (Platform.OS !== "web" && (await Sharing.isAvailableAsync())) await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: i18n.t("stickers.share") });
      else throw new Error("unavailable");
    } catch {
      showToast({ tone: "danger", message: i18n.t("recap.shareFailed") });
    } finally {
      setBusy(false);
    }
  };

  if (!crew || !member) {
    return (
      <Screen back title={i18n.t("stickers.title")}>
        <Text>{i18n.t("crew.noCrew")}</Text>
      </Screen>
    );
  }
  const name = member.nickname ?? member.displayName;
  return (
    <Screen
      back
      title={i18n.t("stickers.title")}
      withToasts
      footer={canShareImages ? <Button label={i18n.t("stickers.share")} icon="share" height={56} loading={busy} onPress={() => void share()} /> : undefined}
    >
      <View style={styles.center}>
        <View ref={sticker} collapsable={false} style={styles.sticker}>
          <View style={[styles.face, { backgroundColor: avatarColor(member.id) }]}>
            <Text style={styles.initials} color={palette.accent.onAccent}>
              {initials(name)}
            </Text>
          </View>
          <View style={styles.bubble}>
            <Text style={styles.line} color={palette.accent.onAccent} align="center">
              {i18n.t(line)}
            </Text>
          </View>
        </View>
      </View>
      <Text variant="label">{i18n.t("stickers.who")}</Text>
      <View style={styles.chips}>
        {crew.members.map((m) => (
          <Chip key={m.id} label={m.nickname ?? m.displayName} selected={m.id === person} onPress={() => setPerson(m.id)} />
        ))}
      </View>
      <Text variant="label">{i18n.t("stickers.what")}</Text>
      <View style={styles.chips}>
        {LINES.map((l) => (
          <Chip key={l} label={i18n.t(l)} selected={l === line} onPress={() => setLine(l)} />
        ))}
      </View>
      <Text variant="small">{i18n.t("stickers.howTo")}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center" },
  sticker: { width: SIDE, height: SIDE, alignItems: "center", justifyContent: "center", backgroundColor: "transparent" },
  face: { width: 170, height: 170, borderRadius: 85, alignItems: "center", justifyContent: "center", borderWidth: 6, borderColor: "#FFFFFF" },
  initials: { fontSize: 64, lineHeight: 74, fontWeight: "800" },
  bubble: { position: "absolute", bottom: 8, backgroundColor: palette.accent.amber, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 4, borderColor: "#FFFFFF", maxWidth: SIDE - 16 },
  line: { fontSize: 22, lineHeight: 26, fontWeight: "800" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
