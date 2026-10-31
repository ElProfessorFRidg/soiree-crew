import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import type { TextInput } from "react-native";
import { useT, type Translator } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { api, ApiError } from "@/server/api";
import { deviceName } from "@/server/device";
import { failureMessage, serverMessage } from "@/server/errors";
import { usePendingInvite } from "@/server/pendingInvite";
import { saveSession } from "@/server/session";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Panel, Segmented } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import type { CrewDraft } from "./AddCrew";
import { Field } from "./Field";
import { crewErrorMessage } from "./invite";
import { LinkScanner } from "./LinkScanner";

/** What the person was doing when the app asked for an account: it carries on right after. */
export type ArrivalIntent = { kind: "join"; crewId: string; crewName: string } | { kind: "create"; draft: CrewDraft } | { kind: "code"; code: string };

interface AccountResponse {
  user: { id: string; username: string; displayName: string };
  token: string;
}

type Way = "password" | "code";
type Problem = { field: "username" | "login" | "password" | "code" | "form"; message: string };

const USERNAME = /^[a-z0-9_.]{3,24}$/;

/** Joins, creates or accepts on the new account, before the app switches to it. Returns the crew's name when known. */
async function carryOn(intent: ArrivalIntent, baseUrl: string, token: string): Promise<string | null> {
  const call = { baseUrl, token, method: "POST" as const };
  if (intent.kind === "join") {
    await api(`/v1/crews/${intent.crewId}/join`, call);
    return intent.crewName;
  }
  if (intent.kind === "create") {
    const { name, kind, open, category } = intent.draft;
    await api("/v1/crews", { ...call, body: { name, kind, open, ...(category ? { category } : {}) } });
    return name;
  }
  await api(`/v1/invites/${encodeURIComponent(intent.code)}/accept`, call);
  return null;
}

function doneMessage(intent: ArrivalIntent, crewName: string | null, i18n: Translator): string {
  if (intent.kind === "create") return i18n.t("arrival.created", { crew: crewName ?? "" });
  return crewName ? i18n.t("arrival.joined", { crew: crewName }) : i18n.t("join.joined");
}

export type AccountMode = "create" | "signin";

/**
 * The account, asked only when it is needed: a pseudo and nothing else (email and password are
 * optional and live in Moi). "J'ai déjà un compte" signs in with an email and a password or with
 * the code shown on another phone (ADR 0002). Without an intent (the arrival flow) it only makes
 * or opens the account; with one, it carries on with the crew right after.
 */
export function AccountForm({
  intent,
  server,
  mode,
  onModeChange,
  autoFocus = true,
}: {
  intent: ArrivalIntent | null;
  server: string | null;
  mode: AccountMode;
  onModeChange: (mode: AccountMode) => void;
  autoFocus?: boolean;
}) {
  const i18n = useT();
  const theme = useTheme();
  const setMode = onModeChange;
  const [way, setWay] = useState<Way>("password");
  const [username, setUsername] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  // MSG-11: the other phone's QR names its own server, which wins over the one picked here.
  const [linkServer, setLinkServer] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  // Each new request clears what the last one said.
  useEffect(() => {
    setProblem(null);
  }, [intent]);

  const ready =
    mode === "create" ? USERNAME.test(username.trim()) : way === "password" ? login.trim().length >= 3 && password.length > 0 : code.trim().length === 10;

  const submit = async () => {
    if (!ready || busy) return;
    const url = mode === "signin" && way === "code" && linkServer ? linkServer : server;
    if (!url) {
      setProblem({ field: "form", message: i18n.t("arrival.pickServerFirst") });
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await api("/v1/health", { baseUrl: url, token: null });
    } catch {
      setBusy(false);
      haptic.error();
      setProblem({ field: "form", message: i18n.t("crew.serverUnreachable") });
      return;
    }
    let account: AccountResponse;
    const deviceLabel = deviceName();
    try {
      account =
        mode === "create"
          ? await api<AccountResponse>("/v1/accounts", {
              baseUrl: url,
              token: null,
              method: "POST",
              // One field: the pseudo is also the name the crew sees, until it is changed in Moi.
              body: { username: username.trim(), displayName: username.trim(), deviceLabel },
            })
          : way === "password"
            ? await api<AccountResponse>("/v1/sessions/password", { baseUrl: url, token: null, method: "POST", body: { login: login.trim(), password, deviceLabel } })
            : await api<AccountResponse>("/v1/sessions/claim", { baseUrl: url, token: null, method: "POST", body: { code: code.trim().toUpperCase(), deviceLabel } });
    } catch (err) {
      setBusy(false);
      haptic.error();
      if (err instanceof ApiError && err.failure.kind === "http") {
        const failure = err.failure;
        if (failure.code === "username_taken") setProblem({ field: "username", message: i18n.t("crew.usernameTaken") });
        else if (failure.code === "credentials_invalid") setProblem({ field: "password", message: i18n.t("crew.credentialsInvalid") });
        else if (mode === "signin" && way === "code" && (failure.code === "code_invalid" || failure.status === 400))
          setProblem({ field: "code", message: i18n.t("crew.transferInvalid") });
        else if (mode === "create" && failure.status === 400) setProblem({ field: "username", message: i18n.t("crew.usernameHint") });
        else setProblem({ field: "form", message: serverMessage(failure.code, i18n) });
      } else setProblem({ field: "form", message: failureMessage(err, i18n) });
      return;
    }
    // The account exists: whatever happens to the crew step, the person is signed in.
    if (!intent) {
      haptic.confirmed();
      setBusy(false);
      // Success shows no toast: the next step sliding in says it (SYNC-07).
      await saveSession({ url, token: account.token, userId: account.user.id, username: account.user.username, displayName: account.user.displayName });
      return;
    }
    let message: { tone?: "danger"; text: string };
    try {
      const crewName = await carryOn(intent, url, account.token);
      message = { text: doneMessage(intent, crewName, i18n) };
      // QOL-07: the crew name typed in "Créer" was a draft until now.
      if (intent.kind === "create") void AsyncStorage.removeItem("crew-draft:crew:name").catch(() => undefined);
    } catch (error) {
      message = { tone: "danger", text: i18n.t("arrival.afterAccountFailed", { reason: crewErrorMessage(error, i18n) }) };
    }
    if (intent.kind === "code") usePendingInvite.setState({ invite: null });
    if (message.tone) haptic.error();
    else haptic.confirmed();
    setBusy(false);
    await saveSession({ url, token: account.token, userId: account.user.id, username: account.user.username, displayName: account.user.displayName });
    showToast({ tone: message.tone, message: message.text });
  };

  return (
    <>
      {mode === "create" ? (
        <>
          <Text muted>{i18n.t("arrival.accountBody")}</Text>
          <Panel>
            <Field
              label={i18n.t("crew.username")}
              hint={i18n.t("crew.usernameHint")}
              value={username}
              onChangeText={(text) => setUsername(text.toLowerCase())}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={autoFocus}
              textContentType="username"
              autoComplete="username-new"
              maxLength={24}
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              error={problem?.field === "username" ? problem.message : null}
            />
          </Panel>
          {problem?.field === "form" ? <Text color={theme.danger}>{problem.message}</Text> : null}
          <Button label={i18n.t("arrival.accountCta")} height={56} disabled={!ready} loading={busy} onPress={() => void submit()} />
          <Button
            label={i18n.t("arrival.haveAccount")}
            variant="outline"
            height={48}
            onPress={() => {
              setProblem(null);
              setMode("signin");
            }}
          />
        </>
      ) : (
        <>
          <Segmented
            accessibilityLabel={i18n.t("crew.signIn")}
            value={way}
            items={[
              { value: "password", label: i18n.t("arrival.signInPassword") },
              { value: "code", label: i18n.t("arrival.signInCode") },
            ]}
            onChange={(next) => {
              setProblem(null);
              setWay(next);
            }}
          />
          <Panel>
            {way === "password" ? (
              <>
                <Field
                  label={i18n.t("crew.login")}
                  value={login}
                  onChangeText={setLogin}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="username"
                  autoComplete="username"
                  maxLength={254}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
                <Field
                  ref={passwordRef}
                  label={i18n.t("crew.password")}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  autoComplete="current-password"
                  maxLength={200}
                  returnKeyType="go"
                  onSubmitEditing={() => void submit()}
                  error={problem?.field === "password" ? problem.message : null}
                />
                <Text variant="small">{i18n.t("crew.forgotPassword")}</Text>
              </>
            ) : (
              <>
                <Text variant="small">{i18n.t("crew.haveAccount")}</Text>
                <LinkScanner
                  onLink={(link) => {
                    setLinkServer(link.url);
                    setCode(link.code);
                  }}
                />
                <Field
                  label={i18n.t("crew.transferCode")}
                  value={code}
                  onChangeText={(text) => setCode(text.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={10}
                  returnKeyType="go"
                  onSubmitEditing={() => void submit()}
                  error={problem?.field === "code" ? problem.message : null}
                />
              </>
            )}
          </Panel>
          {problem?.field === "form" ? <Text color={theme.danger}>{problem.message}</Text> : null}
          <Button label={i18n.t("crew.signIn")} height={56} disabled={!ready} loading={busy} onPress={() => void submit()} />
          <Button
            label={i18n.t("arrival.newAccountInstead")}
            variant="outline"
            height={48}
            onPress={() => {
              setProblem(null);
              setMode("create");
            }}
          />
        </>
      )}
    </>
  );
}
