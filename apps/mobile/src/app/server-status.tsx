import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Platform, Settings, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useT } from "@/i18n";
import { officialServer, otherPublicServers } from "@/crew/servers";
import { Field } from "@/crew/Field";
import { normaliseServerUrl, useSession } from "@/server/session";
import { failureMessage } from "@/server/errors";
import { diagnosticWait, inspectServer, formatServerDiagnostic, type ServerDiagnosticReport, type DiagnosticCheck } from "@/server/serverDiagnostics";
import { recentNetworkDiagnostics } from "@/server/diagnosticLog";
import { serverOrigin } from "@/ui/pure/diagnosticCodes";
import { currentBuild, currentVersion } from "@/system/updates";
import { extraString } from "@/system/extra";
import { Screen } from "@/ui/Screen";
import { Button } from "@/ui/Button";
import { Panel, Row } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

/** Local, credential-free reachability checks remain available before onboarding or sign-in. */
export default function ServerStatusScreen() {
  const i18n = useT();
  const session = useSession((state) => state.session);
  const params = useLocalSearchParams<{ server?: string }>();
  const requested = typeof params.server === "string" ? normaliseServerUrl(params.server) : null;
  const ciServer = useMemo(() => {
    if (Platform.OS !== "ios") return null;
    const value: unknown = Settings.get("ciDiagnosticServer");
    if (typeof value !== "string") return null;
    const url = normaliseServerUrl(value);
    return url && ["127.0.0.1", "localhost"].includes(new URL(url).hostname) ? url : null;
  }, []);
  const configured = officialServer();
  const [address, setAddress] = useState(() => ciServer ?? requested ?? session?.url ?? configured ?? "");
  const selected = useMemo(() => normaliseServerUrl(address), [address]);
  const [savedReport, setReport] = useState<ServerDiagnosticReport | null>(null);
  const [reportContext, setReportContext] = useState<object | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [visible, setVisible] = useState(40);
  const [, tick] = useState(0);
  const sequence = useRef(0);
  const context = useMemo(() => ({ session, selected }), [session, selected]);
  const report = reportContext === context ? savedReport : null;
  const latest = useRef(context);
  latest.current = context;
  useEffect(() => {
    sequence.current += 1;
    setReport(null); setReportContext(null); setProblem(null); setBusy(false); setVisible(40);
    return () => { sequence.current += 1; };
  }, [context]);
  useEffect(() => { setAddress(ciServer ?? requested ?? session?.url ?? configured ?? ""); }, [ciServer, requested, session?.url, session?.userId, configured]);
  useEffect(() => { const timer = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(timer); }, []);
  const run = useCallback(async () => {
    if (!context.selected) { setProblem(`${i18n.t(address.trim() ? "crew.serverInvalid" : "diagnostics.noServer")} (${address.trim() ? "SC_CFG_02" : "SC_CFG_01"})`); return; }
    const id = ++sequence.current;
    const current = () => sequence.current === id && latest.current === context;
    setBusy(true); setProblem(null); setReport(null); setReportContext(context);
    try {
      const found = await inspectServer(context.selected, context.session, current, setReport);
      if (current()) setReport({ ...found, checks: [...found.checks] });
    } catch (error) { if (current()) setProblem(failureMessage(error, i18n)); }
    finally { if (current()) { setBusy(false); tick((n) => n + 1); } }
  }, [context, i18n, address]);
  // CI supplies only a process launch argument pointing to its loopback HTTP fixture.
  const ciStarted = useRef(false);
  useEffect(() => { if (ciServer && !ciStarted.current) { ciStarted.current = true; void run(); } }, [ciServer, run]);
  const wait = selected ? Math.ceil(diagnosticWait(selected) / 1000) : 0;
  const sameAccountServer = !!session && selected === serverOrigin(session.url);
  const history = recentNetworkDiagnostics(selected, session?.userId ?? null);
  const choices = [...new Set([session?.url, configured, ...otherPublicServers()].filter((url): url is string => !!url))];
  const label = (check: DiagnosticCheck) => ["health", "info", "session", "operator"].includes(check.id) ? i18n.t(`diagnostics.${check.id}` as "diagnostics.health") : check.id === "ready" ? i18n.t("diagnostics.readiness") : check.path;
  const stateLabel = (state: DiagnosticCheck["state"]) => i18n.t(`diagnostics.${({ ok: "ok", failed: "failed", unsupported: "unsupported", "not-run": "notRun" } as const)[state]}`);
  const copy = async () => {
    if (!report) return;
    await Clipboard.setStringAsync(formatServerDiagnostic(report, { version: currentVersion, build: currentBuild, channel: extraString("releaseChannel"), target: extraString("iosTarget") }, history));
    showToast({ message: i18n.t("diagnostics.copied") });
  };
  const catalog = report?.authorized ? report.operator : null;
  const permissionKnown = report?.checks.some((check) => check.id === "session" && check.state === "ok") ?? false;
  const routes = (catalog?.routes ?? []).filter((route) => `${route.method} ${route.path} ${route.state}`.toLowerCase().includes(filter.toLowerCase().trim()));
  const routeStates = { available: "available", unavailable: "unavailable", retired: "retired", "update-required": "update" } as const;
  return <Screen back title={i18n.t("diagnostics.title")} withToasts>
    <Text muted>{i18n.t("diagnostics.intro")}</Text>
    <Panel>
      <Field label={i18n.t("diagnostics.server")} value={address} onChangeText={setAddress} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      {choices.length > 1 ? <View style={styles.choices}>{choices.map((url) => <Button key={url} label={new URL(url).host} variant="secondary" onPress={() => setAddress(url)} />)}</View> : null}
      {session && selected !== serverOrigin(session.url) ? <Text variant="small">{i18n.t("diagnostics.different")}</Text> : null}
      <Button label={busy ? i18n.t("diagnostics.running") : wait > 0 ? i18n.t("diagnostics.cooldown", { seconds: wait }) : i18n.t("diagnostics.run")} loading={busy} disabled={busy || wait > 0} onPress={() => void run()} />
      {problem ? <Text accessibilityRole="alert">{problem}</Text> : null}
    </Panel>
    {report ? <Panel>{report.checks.map((check, index) => <Row key={check.id} title={label(check)} subtitle={`${stateLabel(check.state)} · ${check.code}${check.httpStatus ? ` · HTTP ${check.httpStatus}` : ""} · ${check.durationMs} ms`} last={index === report.checks.length - 1} />)}</Panel> : null}
    {!report?.native ? <Text variant="small" muted>{i18n.t("diagnostics.nativeUnavailable")}</Text> : null}
    {!session ? <Text muted>{i18n.t("diagnostics.guest")}</Text> : null}
    {sameAccountServer && !catalog && !busy ? <Panel>
      <Text variant="h3">{i18n.t("diagnostics.operator")}</Text>
      <Text>{i18n.t(report && !permissionKnown ? "diagnostics.permissionUnknown" : "diagnostics.restricted")}</Text>
      {permissionKnown ? <Text variant="small" muted>{i18n.t("diagnostics.enable")}</Text> : null}
      <Button variant="secondary" label={i18n.t("diagnostics.copyAccount")} onPress={() => void Clipboard.setStringAsync(session!.userId).then(() => showToast({ message: i18n.t("common.copied") })).catch((error) => setProblem(failureMessage(error, i18n)))} />
    </Panel> : null}
    {catalog ? <>
      <Panel>
        <Text variant="h3">{i18n.t("diagnostics.operator")}</Text>
        <Text selectable>API {catalog.apiVersion} · {catalog.revision ?? "?"} · {catalog.readiness.code}</Text>
        <Text variant="small">{i18n.t("diagnostics.providers")}</Text>
        {Object.entries(catalog.services).map(([key, configured]) => <Row key={key} title={({ appleSignIn: "Apple", ai: "AI", iosPush: "APNs", androidPush: "FCM" } as Record<string, string>)[key]!} subtitle={i18n.t(configured ? "diagnostics.configured" : "diagnostics.notConfigured")} />)}
      </Panel>
      <Text variant="h3">{i18n.t("diagnostics.routes")} ({catalog.routes.length})</Text>
      <Text variant="small" muted>{i18n.t("diagnostics.routeHint")}</Text>
      <Field label={i18n.t("diagnostics.filter")} value={filter} onChangeText={(value) => { setFilter(value); setVisible(40); }} autoCapitalize="none" autoCorrect={false} />
      <Panel>{routes.slice(0, visible).map((route, index) => {
        const tested = route.method === "GET" ? report?.checks.find((c) => c.path === route.path && c.source === "api") : undefined;
        return <Row key={`${route.method} ${route.path}`} title={`${route.method} ${route.path}`} subtitle={`${i18n.t(`diagnostics.${routeStates[route.state]}`)} · ${tested ? `${stateLabel(tested.state)} ${tested.code}` : i18n.t("diagnostics.notRun")}`} last={index === Math.min(visible, routes.length) - 1} />;
      })}</Panel>
      <Text variant="small">{Math.min(visible, routes.length)} / {routes.length}</Text>
      {visible < routes.length ? <Button variant="secondary" label={i18n.t("diagnostics.more")} onPress={() => setVisible((count) => count + 40)} /> : null}
    </> : null}
    <Panel>
      <Text variant="h3">{i18n.t("diagnostics.history")}</Text>
      {history.length ? history.map((entry, index) => <Text key={index} variant="small" selectable>{entry.method} {entry.feature} · {entry.code}{entry.status ? ` · HTTP ${entry.status}` : ""}{entry.requestId ? ` · ${entry.requestId}` : ""}</Text>) : <Text muted>{i18n.t("diagnostics.nothing")}</Text>}
    </Panel>
    <Text variant="small" muted>{i18n.t("diagnostics.reportPrivacy")}</Text>
    <Button variant="secondary" label={i18n.t("diagnostics.copy")} disabled={!report} onPress={() => void copy().catch((error) => setProblem(failureMessage(error, i18n)))} />
  </Screen>;
}

const styles = StyleSheet.create({ choices: { gap: 8 } });
