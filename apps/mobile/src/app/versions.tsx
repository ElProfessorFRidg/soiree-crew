import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, View } from "react-native";
import { useT } from "@/i18n";
import { altstoreSource, releaseChannel } from "@/system/updates";
import { UpdateStatus } from "@/system/UpdateStatus";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Panel, Segmented, Tag } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { allowsDowngrades, changelogFromSource, versionsFromSource, type ReleaseChannel } from "@/ui/pure/releaseHistory";
import distribution from "../../store/distribution.json";

export default function VersionsScreen() {
  const i18n = useT();
  const theme = useTheme();
  const [source, setSource] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [channel, setChannel] = useState<ReleaseChannel>(releaseChannel);
  const [mode, setMode] = useState<"changes" | "downloads">("changes");
  const [shown, setShown] = useState(10);
  const load = useCallback(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    setLoading(true);
    try {
      const response = await fetch(altstoreSource ?? "https://raw.githubusercontent.com/ElProfessorFRidg/soiree-crew/altstore/source.json", { signal: controller.signal, cache: "no-cache" });
      if (!response.ok) throw new Error("source unavailable");
      setSource(await response.json());
      setFailed(false);
    } catch { setFailed(true); }
    finally { clearTimeout(timer); setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const canDownload = allowsDowngrades(source, distribution.allowDowngrades);
  const showDownloads = canDownload && mode === "downloads";
  const versions = showDownloads
    ? versionsFromSource(source, channel).map((version) => ({ ...version, kind: "download" as const }))
    : changelogFromSource(source, channel).map((version) => ({ ...version, kind: "changes" as const }));
  return (
    <Screen back title={i18n.t("updates.changelog")} withToasts onRefresh={load}>
      <Panel><UpdateStatus /></Panel>
      {canDownload ? <Segmented accessibilityLabel={i18n.t("updates.changelog")} value={mode} items={[
        { value: "changes", label: i18n.t("updates.changelog") },
        { value: "downloads", label: i18n.t("updates.downloads") },
      ]} onChange={(value) => { setMode(value); setShown(10); }} /> : null}
      <Segmented accessibilityLabel={i18n.t("updates.channel")} value={channel} items={(["public", "preview"] as const).map((value) => ({ value, label: i18n.t(`updates.${value}`) }))} onChange={(value) => { setChannel(value); setShown(10); }} />
      {showDownloads ? <Text variant="small">{i18n.t("updates.historyHint")}</Text> : null}
      {loading && source === null ? <ActivityIndicator color={theme.amber} /> : null}
      {failed ? <Panel><Text>{i18n.t("updates.historyFailed")}</Text><Button variant="secondary" label={i18n.t("common.retry")} onPress={() => void load()} /></Panel> : null}
      {!loading && !failed && versions.length === 0 ? <Text>{i18n.t("updates.historyEmpty")}</Text> : null}
      {versions.slice(0, shown).map((version) => (
        <Panel key={version.kind === "changes" && version.otaId ? version.otaId : `${version.version}-${version.build}`}>
          <View style={styles.heading}>
            <Text variant="h2" style={styles.title}>{version.version}</Text>
            <Tag label={version.kind === "changes" && version.otaId ? "OTA" : `IPA #${version.build}`} />
          </View>
          <Text variant="small">{[version.date && Number.isFinite(Date.parse(version.date)) && new Date(version.date).toLocaleDateString(i18n.locale, { day: "numeric", month: "long", year: "numeric" }), version.kind === "download" && version.size > 0 && `${(version.size / 1048576).toLocaleString(i18n.locale, { maximumFractionDigits: 1 })} MB`, version.kind === "download" && version.minOS && i18n.t("updates.minimumOS", { version: version.minOS })].filter(Boolean).join(" · ")}</Text>
          {version.notes.trim() ? (
            <View style={[styles.notes, { borderTopColor: theme.handle }]}>
              {version.notes.trim().split(/\r?\n/).filter((line) => line.trim()).map((line, index) => (
                <Text key={index}>{line.trim()}</Text>
              ))}
            </View>
          ) : null}
          {version.kind === "download" ? <Button label={i18n.t("updates.download")} accessibilityLabel={`${i18n.t("updates.download")} ${version.version} (${version.build})`} icon="arrowdn" variant="secondary" onPress={() => void Linking.openURL(version.url).catch(() => showToast({ tone: "danger", message: i18n.t("updates.unavailable") }))} /> : null}
        </Panel>
      ))}
      {shown < versions.length ? <Button label={i18n.t(showDownloads ? "updates.moreVersions" : "updates.moreChanges")} variant="outline" onPress={() => setShown((n) => n + 10)} /> : null}
    </Screen>
  );
}
const styles = StyleSheet.create({ heading: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }, title: { flexGrow: 1, flexShrink: 1 }, notes: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 8 } });
