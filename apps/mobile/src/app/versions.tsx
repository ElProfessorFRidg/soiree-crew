import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, View } from "react-native";
import { useT } from "@/i18n";
import { altstoreSource, currentBuild, currentVersion, releaseChannel } from "@/system/updates";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Panel, Segmented, Tag } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { versionsFromSource, type ReleaseChannel } from "@/ui/pure/releaseHistory";

export default function VersionsScreen() {
  const i18n = useT();
  const theme = useTheme();
  const [source, setSource] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [channel, setChannel] = useState<ReleaseChannel>(releaseChannel);
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
  const versions = versionsFromSource(source, channel);
  return (
    <Screen back title={i18n.t("updates.versions")} withToasts onRefresh={load}>
      <Text variant="small">{i18n.t("updates.installed", { version: currentVersion, build: currentBuild })}</Text>
      <Segmented accessibilityLabel={i18n.t("updates.channel")} value={channel} items={(["public", "preview"] as const).map((value) => ({ value, label: i18n.t(`updates.${value}`) }))} onChange={(value) => { setChannel(value); setShown(10); }} />
      <Text variant="small">{i18n.t("updates.historyHint")}</Text>
      {loading ? <ActivityIndicator color={theme.amber} /> : null}
      {failed ? <Panel><Text>{i18n.t("updates.historyFailed")}</Text><Button variant="secondary" label={i18n.t("common.retry")} onPress={() => void load()} /></Panel> : null}
      {!loading && !failed && versions.length === 0 ? <Text>{i18n.t("updates.historyEmpty")}</Text> : null}
      {versions.slice(0, shown).map((version) => (
        <Panel key={`${version.version}-${version.build}`}>
          <View style={styles.heading}>
            <Text variant="h2" style={styles.title}>{version.version}</Text>
            <Tag label={`#${version.build}`} />
          </View>
          <Text variant="small">{[version.date && new Date(version.date).toLocaleDateString(i18n.locale), version.size > 0 && `${(version.size / 1048576).toLocaleString(i18n.locale, { maximumFractionDigits: 1 })} MB`, version.minOS && i18n.t("updates.minimumOS", { version: version.minOS })].filter(Boolean).join(" · ")}</Text>
          {version.notes ? <Text>{version.notes}</Text> : null}
          <Button label={i18n.t("updates.download")} accessibilityLabel={`${i18n.t("updates.download")} ${version.version} (${version.build})`} icon="arrowdn" variant="secondary" onPress={() => void Linking.openURL(version.url).catch(() => showToast({ tone: "danger", message: i18n.t("updates.unavailable") }))} />
        </Panel>
      ))}
      {shown < versions.length ? <Button label={i18n.t("updates.moreVersions")} variant="outline" onPress={() => setShown((n) => n + 10)} /> : null}
    </Screen>
  );
}
const styles = StyleSheet.create({ heading: { flexDirection: "row", alignItems: "center", gap: 12 }, title: { flex: 1 } });
