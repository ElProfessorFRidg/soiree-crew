import { Linking, Platform } from "react-native";
import { useT } from "@/i18n";
import { useAppStore } from "@/state/store";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { altstoreSource, currentBuild, openInAltStore } from "./updates";

/** O-12: a newer build is out; one tap downloads it. */
export function UpdateNotice() {
  const i18n = useT();
  const latest = useAppStore((state) => state.latestRelease);
  if (!latest || latest.build <= currentBuild) return null;
  return (
    <Panel tint="amber">
      <Text variant="h3">{i18n.t("updates.available", { version: latest.version ?? String(latest.build) })}</Text>
      {/* iOS: AltStore or SideStore re-signs and installs in place; without them, the IPA itself. */}
      {Platform.OS === "ios" && altstoreSource ? (
        <Button
          label={i18n.t("updates.altstore")}
          icon="arrowdn"
          height={48}
          onPress={() =>
            void openInAltStore().then((opened) => {
              if (!opened) void Linking.openURL(latest.url).catch(() => undefined);
            })
          }
        />
      ) : null}
      <Button
        label={i18n.t("updates.download")}
        icon="arrowdn"
        variant={Platform.OS === "ios" && altstoreSource ? "outline" : "primary"}
        height={48}
        onPress={() => void Linking.openURL(latest.url).catch(() => undefined)}
      />
    </Panel>
  );
}

