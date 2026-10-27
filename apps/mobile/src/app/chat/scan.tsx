import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { radius } from "@crew/design-tokens";
import { updateMeta } from "@/chat/engine";
import { qrValue } from "@/chat/format";
import { useNames } from "@/chat/names";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

/** MSG-05: scan the other phone's safety code. A match marks them verified; anything else is said plainly. */
export default function ScanSafetyScreen() {
  const { userId, expected, tag } = useLocalSearchParams<{ userId: string; expected: string; tag: string }>();
  const i18n = useT();
  const name = useNames();
  const [permission, requestPermission] = useCameraPermissions();
  const [outcome, setOutcome] = useState<"match" | "mismatch" | null>(null);
  const done = useRef(false);
  const who = name(userId);

  const onScan = (data: string) => {
    if (done.current || !data.startsWith("crew-safety:")) return;
    done.current = true;
    if (data === qrValue(expected)) {
      haptic.confirmed();
      setOutcome("match");
      updateMeta((m) => {
        const { [userId]: _seen, ...keyChanged } = m.keyChanged;
        return { ...m, verified: { ...m.verified, [userId]: tag }, keyChanged };
      });
    } else {
      haptic.error();
      setOutcome("mismatch");
    }
  };

  return (
    <Screen back title={i18n.t("chat.scanTitle")}>
      {!permission ? null : !permission.granted ? (
        <>
          <Text>{i18n.t("chat.scanPermission")}</Text>
          <Button label={i18n.t("chat.scanAllow")} height={48} onPress={() => void requestPermission()} />
        </>
      ) : outcome ? (
        <Panel tint={outcome === "match" ? "ok" : "danger"}>
          <Text>{outcome === "match" ? i18n.t("chat.scanMatch", { name: who }) : i18n.t("chat.scanMismatch", { name: who })}</Text>
          <Button
            label={outcome === "match" ? i18n.t("common.close") : i18n.t("common.retry")}
            variant="secondary"
            height={44}
            onPress={() => {
              if (outcome === "match") router.back();
              else {
                done.current = false;
                setOutcome(null);
              }
            }}
          />
        </Panel>
      ) : (
        <>
          <View style={styles.frame}>
            <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={(r) => onScan(r.data)} />
          </View>
          <Text>{i18n.t("chat.scanHow", { name: who })}</Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%", aspectRatio: 1, borderRadius: radius.card, overflow: "hidden" },
});
