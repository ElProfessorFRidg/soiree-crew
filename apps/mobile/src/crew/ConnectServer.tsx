import Constants from "expo-constants";
import { LinkScanner } from "./LinkScanner";
import { PublicServers } from "./PublicServers";
import { useRef, useState, type ComponentRef } from "react";
import { View, type TextInput } from "react-native";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { api, ApiError } from "@/server/api";
import { normaliseServerUrl, saveSession } from "@/server/session";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Panel, Segmented } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { Field } from "./Field";
import { deviceName } from "@/server/device";
import { usePendingInvite } from "@/server/pendingInvite";
import { serverMessage } from "@/server/errors";

interface AccountResponse {
  user: { id: string; username: string; displayName: string };
  token: string;
}

/** First crew step: server address, then a new account or the code from another phone (ADR 0002). */
export function ConnectServer() {
  const i18n = useT();
  const theme = useTheme();
  // An invite's server first, else the public server this build was made for.
  const [address, setAddress] = useState(() => usePendingInvite.getState().invite?.server ?? ((Constants.expoConfig?.extra?.defaultServerUrl as string | null | undefined) || ""));
  const [mode, setMode] = useState<"create" | "password" | "claim">("create");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [login, setLogin] = useState("");
  const [error, setError] = useState<{ field: "url" | "username" | "email" | "password" | "code" | "form"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const usernameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const withCredentials = email.trim().length > 0 || password.length > 0;

  const submit = async () => {
    const url = normaliseServerUrl(address);
    if (!url) {
      setError({ field: "url", message: i18n.t("crew.serverInvalid") });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/v1/health", { baseUrl: url, token: null });
    } catch {
      setBusy(false);
      setError({ field: "url", message: i18n.t("crew.serverUnreachable") });
      return;
    }
    try {
      const deviceLabel = deviceName();
      const body =
        mode === "create"
          ? await api<AccountResponse>("/v1/accounts", {
              baseUrl: url,
              token: null,
              method: "POST",
              body: {
                username: username.trim().toLowerCase(),
                displayName: displayName.trim(),
                deviceLabel,
                ...(withCredentials ? { email: email.trim(), password } : {}),
              },
            })
          : mode === "password"
            ? await api<AccountResponse>("/v1/sessions/password", {
                baseUrl: url,
                token: null,
                method: "POST",
                body: { login: login.trim(), password, deviceLabel },
              })
            : await api<AccountResponse>("/v1/sessions/claim", {
              baseUrl: url,
              token: null,
              method: "POST",
              body: { code: code.trim().toUpperCase(), deviceLabel },
            });
      haptic.confirmed();
      await saveSession({ url, token: body.token, userId: body.user.id, username: body.user.username, displayName: body.user.displayName });
    } catch (err) {
      haptic.error();
      if (err instanceof ApiError && err.failure.kind === "http") {
        if (err.failure.code === "username_taken") setError({ field: "username", message: i18n.t("crew.usernameTaken") });
        else if (err.failure.code === "email_taken") setError({ field: "email", message: i18n.t("crew.emailTaken") });
        else if (err.failure.code === "credentials_invalid") setError({ field: "password", message: i18n.t("crew.credentialsInvalid") });
        else if (mode === "create" && withCredentials && err.failure.status === 400) setError({ field: "email", message: i18n.t("crew.credentialsHint") });
        else if (err.failure.code === "code_invalid" || err.failure.status === 400)
          setError(
            mode === "claim"
              ? { field: "code", message: i18n.t("crew.transferInvalid") }
              : { field: "username", message: i18n.t("crew.usernameHint") },
          );
        else setError({ field: "form", message: serverMessage(err.failure.code, i18n) });
      } else setError({ field: "form", message: i18n.t("crew.offline") });
    } finally {
      setBusy(false);
    }
  };

  const credentialsReady = !withCredentials || (/^\S+@\S+\.\S+$/.test(email.trim()) && password.length >= 10);
  const ready =
    normaliseServerUrl(address) !== null &&
    (mode === "create"
      ? /^[a-z0-9_.]{3,24}$/.test(username.trim().toLowerCase()) && displayName.trim().length > 0 && credentialsReady
      : mode === "password"
        ? login.trim().length >= 3 && password.length > 0
        : code.trim().length === 10);

  return (
    <View style={{ gap: 16 }}>
      <Text muted>{i18n.t("crew.connectBody")}</Text>
      <PublicServers selected={address} onPick={setAddress} />
      <Field
        label={i18n.t("crew.serverUrl")}
        placeholder={i18n.t("crew.serverUrlPlaceholder")}
        value={address}
        onChangeText={setAddress}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        textContentType="URL"
        returnKeyType="next"
        onSubmitEditing={() => (mode === "create" ? usernameRef.current?.focus() : undefined)}
        error={error?.field === "url" ? error.message : null}
      />
      <Segmented
        accessibilityLabel={i18n.t("crew.connectTitle")}
        value={mode}
        items={[
          { value: "create", label: i18n.t("crew.createAccount") },
          { value: "password", label: i18n.t("crew.signIn") },
          { value: "claim", label: i18n.t("crew.signInCode") },
        ]}
        onChange={setMode}
      />
      <Panel>
        {mode === "create" ? (
          <>
            <Field
              ref={usernameRef}
              label={i18n.t("crew.username")}
              hint={i18n.t("crew.usernameHint")}
              value={username}
              onChangeText={(text) => setUsername(text.toLowerCase())}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              autoComplete="username-new"
              maxLength={24}
              returnKeyType="next"
              onSubmitEditing={() => nameRef.current?.focus()}
              error={error?.field === "username" ? error.message : null}
            />
            <Field
              ref={nameRef}
              label={i18n.t("crew.displayName")}
              value={displayName}
              onChangeText={setDisplayName}
              textContentType="givenName"
              autoComplete="given-name"
              maxLength={40}
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
            <Text variant="small">{i18n.t("crew.credentialsHint")}</Text>
            <Field
              ref={emailRef}
              label={i18n.t("crew.email")}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              maxLength={254}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              error={error?.field === "email" ? error.message : null}
            />
            <Field
              ref={passwordRef}
              label={i18n.t("crew.password")}
              hint={i18n.t("crew.passwordHint")}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="new-password"
              maxLength={200}
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
            />
          </>
        ) : mode === "password" ? (
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
              error={error?.field === "password" ? error.message : null}
            />
            <Text variant="small">{i18n.t("crew.forgotPassword")}</Text>
          </>
        ) : (
          <>
            <Text variant="small">{i18n.t("crew.haveAccount")}</Text>
            <LinkScanner
              onLink={(link) => {
                setAddress(link.url);
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
              error={error?.field === "code" ? error.message : null}
            />
          </>
        )}
      </Panel>
      {error?.field === "form" ? <Text color={theme.danger}>{error.message}</Text> : null}
      <Button
        label={mode === "create" ? i18n.t("crew.createAccount") : i18n.t("crew.signIn")}
        height={56}
        disabled={!ready}
        loading={busy}
        onPress={() => void submit()}
      />
    </View>
  );
}
