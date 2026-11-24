import { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Platform, Settings } from "react-native";
import * as Clipboard from "expo-clipboard";
import { officialServer } from "@/crew/servers";
import { useT } from "@/i18n";
import { recentNetworkDiagnostics, recentPublicProbes, savedNetworkDiagnostics, type NetworkDiagnostic } from "@/server/diagnosticLog";
import { formatNetworkFailure } from "@/server/serverDiagnostics";
import { useSession } from "@/server/session";
import { currentBuild, currentVersion } from "@/system/updates";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { diagnosticFeatureLabel, serverOrigin } from "@/ui/pure/diagnosticCodes";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

function startupReport(key: string): string | null {
  if (Platform.OS !== "ios") return null;
  const value: unknown = Settings.get(key);
  return typeof value === "string" && value.startsWith("SC_STARTUP v1\n") ? value.slice(0, 8000) : null;
}

export default function DiagnosticLogScreen() {
  const i18n = useT();
  const session = useSession((state) => state.session);
  const params = useLocalSearchParams<{ server?: string }>();
  const server = serverOrigin(typeof params.server === "string" ? params.server : session?.url ?? officialServer());
  const accountId = session?.userId ?? null;
  const [log, setLog] = useState<{ server: string | null; accountId: string | null; api: NetworkDiagnostic[]; probes: string[] }>();
  const [fallback, setFallback] = useState<{ server: string | null; accountId: string | null; text: string } | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    setFallback(null);
    void Promise.all([savedNetworkDiagnostics(server, accountId), recentPublicProbes(server)]).then(([api, probes]) => {
      if (active) setLog({ server, accountId, api, probes });
    });
    return () => { active = false; };
  }, [server, accountId]));
  const selected = log?.server === server && log.accountId === accountId ? log : null;
  const api = selected?.api ?? recentNetworkDiagnostics(server, accountId).reverse();
  const probes = selected?.probes ?? [];
  const startup = startupReport("CrewStartupLastReport");
  const previous = startupReport("CrewStartupPreviousIncomplete");
  const copy = async () => {
    const text = ["SC_DIAGNOSTIC_LOG", `App: ${currentVersion} (${currentBuild})`, `Server: ${server ?? "none"}`,
      ...api.map(formatNetworkFailure), ...probes,
      ...(startup ? ["", i18n.t("diagnostics.startupLog"), startup] : []),
      ...(previous ? ["", i18n.t("diagnostics.previousStartup"), previous] : []),
    ].join("\n");
    try {
      if (await Clipboard.setStringAsync(text)) {
        setFallback(null);
        showToast({ message: i18n.t("diagnostics.copied") });
        return;
      }
    } catch { /* The journal remains selectable when the clipboard is unavailable. */ }
    setFallback({ server, accountId, text });
  };

  return <Screen back withToasts title={i18n.t("diagnostics.journal")}>
    {server ? <Text variant="small" selectable>{server}</Text> : null}
    <Button variant="secondary" label={i18n.t("diagnostics.copy")} onPress={() => void copy()} />
    {fallback?.server === server && fallback.accountId === accountId ? <Panel>
      <Text accessibilityRole="alert">{i18n.t("diagnostics.copyFallback")}</Text>
      <Text variant="small" selectable>{fallback.text}</Text>
    </Panel> : null}
    <Panel>
      <Text variant="h3">{i18n.t("diagnostics.history")}</Text>
      {api.map((entry, index) => {
        const label = diagnosticFeatureLabel(entry.feature);
        return <Text key={index} variant="small" selectable>{label ? `${i18n.t(label)}\n` : ""}{formatNetworkFailure(entry)}</Text>;
      })}
      {selected && !api.length ? <Text muted>{i18n.t("diagnostics.nothing")}</Text> : null}
    </Panel>
    {probes.length ? <Panel>
      <Text variant="h3">{i18n.t("diagnostics.localLog")}</Text>
      {[...probes].reverse().map((line, index) => <Text key={index} variant="small" selectable>{line}</Text>)}
    </Panel> : null}
    {startup ? <Panel>
      <Text variant="h3">{i18n.t("diagnostics.startupLog")}</Text>
      <Text variant="small" selectable>{startup}</Text>
    </Panel> : null}
    {previous ? <Panel>
      <Text variant="h3">{i18n.t("diagnostics.previousStartup")}</Text>
      <Text variant="small" selectable>{previous}</Text>
    </Panel> : null}
  </Screen>;
}
