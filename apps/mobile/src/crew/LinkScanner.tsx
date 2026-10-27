import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { radius } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { Button } from "@/ui/Button";

/** MSG-11: what the signed-in phone shows and the new one scans: the server and a one-time code. */
export const linkValue = (url: string, code: string) => `soireecrew-link:1:${url}|${code}`;

export function parseLink(data: string): { url: string; code: string } | null {
  const m = /^soireecrew-link:1:(https?:\/\/[^|\s]+)\|([A-Z0-9]{10})$/.exec(data.trim());
  return m ? { url: m[1]!, code: m[2]! } : null;
}

/** Scans the code shown on the phone already signed in, and fills the server and the code. */
export function LinkScanner({ onLink }: { onLink: (link: { url: string; code: string }) => void }) {
  const i18n = useT();
  const [open, setOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const done = useRef(false);
  if (!open) {
    return (
      <Button
        label={i18n.t("account.scanLink")}
        icon="x:scan"
        variant="secondary"
        height={44}
        onPress={() => {
          done.current = false;
          setOpen(true);
          if (!permission?.granted) void requestPermission();
        }}
      />
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {permission?.granted ? (
        <View style={styles.frame}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => {
              const link = parseLink(data);
              if (!link || done.current) return;
              done.current = true;
              haptic.confirmed();
              setOpen(false);
              onLink(link);
            }}
          />
        </View>
      ) : null}
      <Button label={i18n.t("chat.cancel")} variant="outline" height={44} onPress={() => setOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%", aspectRatio: 1, borderRadius: radius.card, overflow: "hidden" },
});
