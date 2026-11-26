import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Platform, Settings, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useT } from "@/i18n";
import { officialServer, otherPublicServers } from "@/crew/servers";
import { Field } from "@/crew/Field";
import { normaliseServerUrl, useSession } from "@/server/session";
import { ApiError } from "@/server/api";
import { failureMessage } from "@/server/errors";
import { diagnosticWait, inspectServer, formatDiagnosticCheck, formatServerDiagnostic, type ServerDiagnosticReport, type DiagnosticCheck } from "@/server/serverDiagnostics";
import { recentNetworkDiagnostics, recentPublicProbes } from "@/server/diagnosticLog";
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
  const [problem, setProblem] = useState<{ message: string; code?: string } | null>(null);
  const [copyFallback, setCopyFallback] = useState<{ context: object; text: string } | null>(null);
  const [probeLog, setProbeLog] = useState<{ server: string | null; lines: string[] } | null>(null);
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
    setReport(null); setReportContext(null); setProblem(null); setBusy(false); setVisible(40); setCopyFallback(null);
    return () => { sequence.current += 1; };
  }, [context]);
  useEffect(() => { setAddress(ciServer ?? requested ?? session?.url ?? configured ?? ""); }, [ciServer, requested, session?.url, session?.userId, configured]);
  useEffect(() => { const timer = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (busy) return;
    let active = true;
    void recentPublicProbes(selected).then((lines) => {
      if (active) setProbeLog({ server: selected, lines });
    });
    return () => { active = false; };
  }, [selected, busy]);
  const configurationIssue = selected ? undefined : address.trim() ? "SC_CFG_02" : "SC_CFG_01";
  const run = useCallback(async () => {
    if (!context.selected) {
      setProblem({ message: i18n.t(address.trim() ? "crew.serverInvalid" : "diagnostics.noServer"), code: configurationIssue });
      return;
    }
    const id = ++sequence.current;
    const current = () => sequence.current === id && latest.current === context;
    setBusy(true); setProblem(null); setCopyFallback(null); setReport(null); setReportContext(context);
    try {
      const found = await inspectServer(context.selected, context.session, current, setReport);
      if (current()) setReport({ ...found, checks: [...found.checks] });
    } catch (error) {
      if (current()) setProblem({ message: failureMessage(error, i18n), code: error instanceof ApiError ? error.diagnostic.code : "SC_UNKNOWN" });
    }
    finally { if (current()) { setBusy(false); tick((n) => n + 1); } }
  }, [context, i18n, address, configurationIssue]);
  // CI supplies only a process launch argument pointing to its loopback HTTP fixture.
  const ciStarted = useRef(false);
  useEffect(() => { if (ciServer && !ciStarted.current) { ciStarted.current = true; void run(); } }, [ciServer, run]);
  const wait = selected ? Math.ceil(diagnosticWait(selected) / 1000) : 0;
  const sameAccountServer = !!session && selected === serverOrigin(session.url);
  const history = recentNetworkDiagnostics(selected, session?.userId ?? null);
  const choices = [...new Set([session?.url, configured, ...otherPublicServers()].filter((url): url is string => !!url))];
  const label = (check: DiagnosticCheck) => ["health", "info", "session", "operator"].includes(check.id) ? i18n.t(`diagnostics.${check.id}` as "diagnostics.health") : check.id === "ready" ? i18n.t("diagnostics.readiness") : check.path;
  const stateLabel = (state: DiagnosticCheck["state"]) => i18n.t(`diagnostics.${({ ok: "ok", failed: "failed", unsupported: "unsupported", "not-run": "notRun" } as const)[state]}`);
  const localLog = probeLog && probeLog.server === selected ? probeLog.lines : [];
  const copy = async () => {
    const text = formatServerDiagnostic(report, { version: currentVersion, build: currentBuild, channel: extraString("releaseChannel"), target: extraString("iosTarget") }, history, { server: selected, issue: problem?.code ?? configurationIssue, localLog });
    try {
      if (await Clipboard.setStringAsync(text)) {
        if (latest.current === context) {
          setCopyFallback(null);
          showToast({ message: i18n.t("diagnostics.copied") });
        }
        return;
      }
    } catch { /* Show the same report as selectable text if clipboard access fails. */ }
    if (latest.current === context) setCopyFallback({ context, text });
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
      {problem ? <Text accessibilityRole="alert">{problem.message}{problem.code ? ` (${problem.code})` : ""}</Text> : null}
    </Panel>
    <Button variant="secondary" label={i18n.t("diagnostics.copy")} onPress={() => void copy()} />
    {copyFallback?.context === context ? <Panel>
      <Text accessibilityRole="alert">{i18n.t("diagnostics.copyFallback")}</Text>
      <Text variant="small" selectable>{copyFallback.text}</Text>
    </Panel> : null}
    {report ? <Panel>{report.checks.map((check, index) => <Row key={check.id} title={label(check)} subtitle={`${stateLabel(check.state)} · ${formatDiagnosticCheck(check)}`} last={index === report.checks.length - 1} />)}</Panel> : null}
    {!report?.native ? <Text variant="small" muted>{i18n.t("diagnostics.nativeUnavailable")}</Text> : null}
    {!session ? <Text muted>{i18n.t("diagnostics.guest")}</Text> : null}
    {sameAccountServer && !catalog && !busy ? <Panel>
      <Text variant="h3">{i18n.t("diagnostics.operator")}</Text>
      <Text>{i18n.t(report && !permissionKnown ? "diagnostics.permissionUnknown" : "diagnostics.restricted")}</Text>
      {permissionKnown ? <Text variant="small" muted>{i18n.t("diagnostics.enable")}</Text> : null}
      <Button variant="secondary" label={i18n.t("diagnostics.copyAccount")} onPress={() => void Clipboard.setStringAsync(session!.userId).then(() => showToast({ message: i18n.t("common.copied") })).catch((error) => setProblem({ message: failureMessage(error, i18n) }))} />
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
    <Button variant="secondary" label={i18n.t("diagnostics.journal")} onPress={() => router.push({ pathname: "/diagnostic-log", params: { server: selected ?? "" } })} />
    <Text variant="small" muted>{i18n.t("diagnostics.reportPrivacy")}</Text>
  </Screen>;
}

const styles = StyleSheet.create({ choices: { gap: 8 } });
