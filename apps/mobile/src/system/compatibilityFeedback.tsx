import { useEffect } from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";
import { useT } from "@/i18n";
import { takeCompatibilityNotices, useCompatibilityEvents } from "@/server/compatibilityEvents";
import { compatibilityCode, type CompatibilityNotice } from "@/ui/pure/apiCompatibility";
import { showToast, ToastHost, useToastVisible } from "@/ui/Toast";
import { checkForUpdate, currentVersion, installLatest, openInAltStore } from "./updates";

/** Compatibility affects the requested server feature; it never blocks local screens. */
export function useCompatibilityFeedback(): void {
  const i18n = useT();
  const pending = useCompatibilityEvents((state) => state.pending);
  useEffect(() => {
    if (!pending.length) return;
    const open = async (notice: CompatibilityNotice) => {
      try {
        if (notice.webUrl) { await Linking.openURL(notice.webUrl); return; }
        if (Platform.OS === "web") { globalThis.location?.reload(); return; }
        if (await openInAltStore()) return;
        const result = await checkForUpdate(true, 0);
        if (result === "newer") await installLatest();
        else showToast({ channel: "compatibility", message: i18n.t(result === "latest" ? "updates.upToDate" : "updates.unavailable", { version: currentVersion }) });
      } catch { showToast({ channel: "compatibility", message: i18n.t("updates.unavailable") }); }
    };
    for (const notice of takeCompatibilityNotices()) {
      const action = notice.webUrl || notice.reason === "update_required"
        ? { label: i18n.t(notice.webUrl ? "updates.openWeb" : Platform.OS === "web" ? "updates.reload" : "updates.install"), onPress: () => void open(notice) }
        : undefined;
      showToast({ channel: "compatibility", tone: "danger", message: i18n.t(`serverCodes.${compatibilityCode(notice.reason)}`), durationMs: 12_000, action });
    }
  }, [pending, i18n]);
}

export function CompatibilityToastHost() {
  const insets = useSafeAreaInsets();
  const visible = useToastVisible("compatibility");
  if (!visible) return null;
  const host = <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { alignItems: "center", zIndex: 1000 }]}>
    <View pointerEvents="box-none" style={{ flex: 1, width: "100%", maxWidth: 760 }}>
      <ToastHost channel="compatibility" bottomOffset={insets.bottom + 84} />
    </View>
  </View>;
  // Same native overlay as PermissionPrompt: a server failure remains visible above a sheet.
  return Platform.OS === "ios" ? <FullWindowOverlay>{host}</FullWindowOverlay> : host;
}
