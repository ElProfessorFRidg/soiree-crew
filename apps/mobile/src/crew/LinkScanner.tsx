import { CameraView, useCameraPermissions } from "expo-camera";
import { askPermission } from "@/system/askPermission";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { radius } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";
import { OpenSettingsButton } from "@/system/OpenSettingsButton";

/** MSG-11: what the signed-in phone shows and the new one scans: the server and a one-time code. */
export const linkValue = (url: string, code: string) => `soireecrew-link:1:${url}|${code}`;

export function parseLink(data: string): { url: string; code: string } | null {
  const m = /^soireecrew-link:1:(https?:\/\/[^|\s]+)\|([A-Z0-9]{10})$/.exec(data.trim());
  return m ? { url: m[1]!, code: m[2]! } : null;
}

/**
 * A button that opens the camera and reads QR codes until `parse` accepts one. Used to link a phone
 * (MSG-11) and to join a crew from its invite QR (O-36).
 */
export function QrScanner<T>({ label, hint, parse, onScan }: { label: string; hint?: string; parse: (data: string) => T | null; onScan: (value: T) => void }) {
  const i18n = useT();
  const [open, setOpen] = useState(false);
  const [permission, , readPermission] = useCameraPermissions();
  const done = useRef(false);
  if (!open) {
    return (
      <Button
        label={label}
        icon="x:scan"
        variant="secondary"
        height={44}
        onPress={() => {
          done.current = false;
          // The explanation, then the system prompt, the first time only (askPermission).
          void askPermission("camera", "scan").then(async (answer) => {
            if (answer.declined) return;
            await readPermission();
            setOpen(true);
          });
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
              const value = parse(data);
              if (value === null || done.current) return;
              done.current = true;
              haptic.confirmed();
              setOpen(false);
              onScan(value);
            }}
          />
        </View>
      ) : permission && !permission.canAskAgain ? (
        <OpenSettingsButton />
      ) : null}
      {hint ? (
        <Text variant="small" align="center">
          {hint}
        </Text>
      ) : null}
      <Button label={i18n.t("chat.cancel")} variant="outline" height={44} onPress={() => setOpen(false)} />
    </View>
  );
}

/** Scans the code shown on the phone already signed in, and fills the server and the code. */
export function LinkScanner({ onLink }: { onLink: (link: { url: string; code: string }) => void }) {
  const i18n = useT();
  return <QrScanner label={i18n.t("account.scanLink")} parse={parseLink} onScan={onLink} />;
}

const styles = StyleSheet.create({
  frame: { width: "100%", aspectRatio: 1, borderRadius: radius.card, overflow: "hidden" },
});
