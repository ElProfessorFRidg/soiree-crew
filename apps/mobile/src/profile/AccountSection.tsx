import QRCode from "react-native-qrcode-svg";
import { palette } from "@crew/design-tokens";
import { linkValue } from "@/crew/LinkScanner";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { Field } from "@/crew/Field";
import { useT, type Translator } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { exportMyData } from "./exportData";
import { api, ApiError } from "@/server/api";
import { serverMessage } from "@/server/errors";
import { useCrewData } from "@/server/crewData";
import { forgetChat } from "@/chat/engine";
import { saveSession, useSession } from "@/server/session";
import { clearAccountHistory, useAppStore } from "@/state/store";
import { Button } from "@/ui/Button";
import { Panel, Row } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { guarded } from "@/vault/vault";

/** Wipes everything this phone holds about the user, then sends them back to the age gate. */
async function wipeDevice(): Promise<void> {
  const userId = useSession.getState().session?.userId;
  if (userId) await forgetChat(userId);
  await saveSession(null);
  useCrewData.setState({ crews: [], parties: [], live: {} });
  useAppStore.setState({
    ageConfirmedAt: null,
    profile: null,
    drinks: [],
    water: [],
    customDrinks: [],
    outbox: [],
    manualLevel: null,
    levelState: null,
    syncCursor: null,
    uploadedToServerAt: null,
    accountUserId: null,
    vault: [],
  });
  await AsyncStorage.multiRemove(["crew-app-v1", "crew-data-v1"]);
}

/** O-07: deletes the account on the server, then everything on this phone. */
export async function deleteAccount(i18n: Translator): Promise<void> {
  const remote = useSession.getState().session ? api("/v1/me", { method: "DELETE" }) : Promise.resolve();
  try {
    await remote;
    await wipeDevice();
    showToast({ message: i18n.t("account.deleted") });
    router.replace("/onboarding");
  } catch {
    showToast({ tone: "danger", message: i18n.t("crew.offline") });
  }
}

interface DeviceSession {
  id: string;
  deviceLabel: string;
  lastSeenAt: number;
  current: boolean;
}

/** SEC-07: every signed-in device, and remote sign-out for the others. */
function Devices() {
  const i18n = useT();
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const load = useCallback(() => {
    void api<{ sessions: DeviceSession[] }>("/v1/sessions")
      .then((data) => setSessions(data.sessions))
      .catch(() => undefined);
  }, []);
  useEffect(load, [load]);
  const when = (at: number) =>
    `${new Intl.DateTimeFormat(i18n.locale, { day: "numeric", month: "short" }).format(new Date(at))}, ${formatClock(at, i18n.language, hourCycle)}`;
  if (sessions.length === 0) return null;
  return (
    <View>
      <Text variant="label">{i18n.t("account.devices")}</Text>
      {sessions.map((s, index) => (
        <Row
          key={s.id}
          title={s.current ? i18n.t("account.thisDevice") : s.deviceLabel || "?"}
          subtitle={s.current ? s.deviceLabel : i18n.t("account.lastSeen", { when: when(s.lastSeenAt) })}
          trailing={
            s.current ? null : (
              <Button
                label={i18n.t("account.signOutDevice")}
                variant="outline"
                height={36}
                onPress={() =>
                  void api(`/v1/sessions/${s.id}`, { method: "DELETE" })
                    .then(() => {
                      showToast({ message: i18n.t("account.signedOutDevice") });
                      load();
                    })
                    .catch(() => showToast({ tone: "danger", message: i18n.t("crew.offline") }))
                }
              />
            )
          }
          last={index === sessions.length - 1}
        />
      ))}
    </View>
  );
}

/** O-01: an optional email and password, to sign in again without another phone. */
function Credentials() {
  const i18n = useT();
  const [state, setState] = useState<{ hasPassword: boolean; email: string | null } | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void api<{ hasPassword: boolean; email: string | null }>("/v1/me/credentials")
      .then((data) => {
        setState(data);
        setEmail(data.email ?? "");
      })
      .catch(() => undefined);
  }, []);
  if (!state) return null;

  const save = () => {
    setBusy(true);
    setError(null);
    api<{ hasPassword: boolean; email: string | null }>("/v1/me/credentials", {
      method: "PUT",
      body: { email: email.trim() || null, password, ...(state.hasPassword ? { currentPassword: current } : {}) },
    })
      .then((data) => {
        setState(data);
        setOpen(false);
        setCurrent("");
        setPassword("");
        showToast({ message: i18n.t("account.credentialsSaved") });
      })
      .catch((err) => {
        if (err instanceof ApiError && err.failure.kind === "http") {
          setError(
            err.failure.code === "credentials_invalid"
              ? i18n.t("account.credentialsWrong")
              : err.failure.code === "email_taken"
                ? i18n.t("crew.emailTaken")
                : serverMessage(err.failure.code, i18n),
          );
        } else setError(i18n.t("crew.offline"));
      })
      .finally(() => setBusy(false));
  };

  const emailOk = email.trim() === "" || /^\S+@\S+\.\S+$/.test(email.trim());
  return (
    <View style={{ gap: 8 }}>
      <Text variant="label">{i18n.t("account.credentials")}</Text>
      <Text variant="small">
        {state.email ? i18n.t("account.credentialsEmail", { email: state.email }) : state.hasPassword ? i18n.t("account.credentialsSet") : i18n.t("account.credentialsNone")}
      </Text>
      {open ? (
        <>
          <Field
            label={i18n.t("crew.email")}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            maxLength={254}
          />
          {state.hasPassword ? (
            <Field
              label={i18n.t("account.currentPassword")}
              value={current}
              onChangeText={setCurrent}
              secureTextEntry
              autoCapitalize="none"
              textContentType="password"
              autoComplete="current-password"
              maxLength={200}
            />
          ) : null}
          <Field
            label={i18n.t("account.newPassword")}
            hint={i18n.t("crew.passwordHint")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
            autoComplete="new-password"
            maxLength={200}
            error={error}
          />
          <Button
            label={i18n.t("account.credentialsSave")}
            height={44}
            loading={busy}
            disabled={!emailOk || password.length < 10 || (state.hasPassword && current.length === 0)}
            onPress={save}
          />
        </>
      ) : (
        <Button
          label={state.hasPassword ? i18n.t("account.credentialsChange") : i18n.t("account.credentialsAdd")}
          variant="secondary"
          height={44}
          onPress={() => setOpen(true)}
        />
      )}
    </View>
  );
}

export function AccountSection() {
  const i18n = useT();
  const session = useSession((state) => state.session);
  const [transfer, setTransfer] = useState<string | null>(null);

  const onDelete = () => {
    Alert.alert(i18n.t("account.deleteTitle"), i18n.t("account.deleteBody"), [
      { text: i18n.t("account.deleteKeep"), style: "cancel" },
      {
        text: i18n.t("account.deleteConfirm"),
        style: "destructive",
        onPress: () => {
          if (!guarded({ kind: "deleteAccount" }, () => void deleteAccount(i18n))) showToast({ message: i18n.t("vault.queued") });
        },
      },
    ]);
  };

  return (
    <Panel>
      <Text variant="label">{i18n.t("account.title")}</Text>
      {session ? (
        <>
          <Text>{i18n.t("account.signedInAs", { name: session.displayName, username: session.username })}</Text>
          <Text variant="small">{i18n.t("account.server", { url: session.url })}</Text>
          {transfer ? (
            <View style={{ alignItems: "center", gap: 8 }}>
              {/* MSG-11: the new phone scans this; typing the code still works. */}
              <View style={{ padding: 12, borderRadius: 12, backgroundColor: palette.dark.text }}>
                <QRCode value={linkValue(session.url, transfer)} size={168} backgroundColor={palette.dark.text} color={palette.accent.onAccent} />
              </View>
              <Text variant="h3">{i18n.t("account.transferCode", { code: transfer })}</Text>
              <Text variant="small">{i18n.t("account.linkHistory")}</Text>
            </View>
          ) : null}
          <Button
            label={i18n.t("account.addDevice")}
            variant="secondary"
            height={44}
            onPress={() =>
              api<{ code: string }>("/v1/sessions/transfer-code", { method: "POST" })
                .then(({ code }) => setTransfer(code))
                .catch(() => showToast({ tone: "danger", message: i18n.t("crew.offline") }))
            }
          />
          <Credentials />
          <Devices />
          <Button
            label={i18n.t("account.export")}
            variant="outline"
            height={44}
            accessibilityHint={i18n.t("account.exportHint")}
            onPress={() =>
              void exportMyData()
                .then(() => showToast({ message: i18n.t("account.exportReady") }))
                .catch(() => showToast({ tone: "danger", message: i18n.t("crew.offline") }))
            }
          />
          <Button
            label={i18n.t("account.signOut")}
            variant="outline"
            height={44}
            onPress={() => {
              // The session ends on the server too; if it can't be reached, the token dies with the phone's copy.
              void api("/v1/sessions/current", { method: "DELETE" }).catch(() => undefined);
              const userId = useSession.getState().session?.userId;
              // Chat keys and history are tied to this session's device: they go with it.
              if (userId) void forgetChat(userId);
              clearAccountHistory();
              useCrewData.setState({ crews: [], parties: [], live: {} });
              void saveSession(null);
            }}
          />
        </>
      ) : (
        <Text variant="small">{i18n.t("account.notConnected")}</Text>
      )}
      <Button label={i18n.t("account.delete")} variant="danger" height={44} onPress={onDelete} />
    </Panel>
  );
}
