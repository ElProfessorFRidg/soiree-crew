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

interface AccountResponse {
  user: { id: string; username: string; displayName: string };
  token: string;
}

/** First crew step: server address, then a new account or the code from another phone (ADR 0002). */
export function ConnectServer() {
  const i18n = useT();
  const theme = useTheme();
  const [address, setAddress] = useState("");
  const [mode, setMode] = useState<"create" | "claim">("create");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<{ field: "url" | "username" | "code" | "form"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const usernameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);

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
              body: { username: username.trim().toLowerCase(), displayName: displayName.trim(), deviceLabel },
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
        else if (err.failure.code === "code_invalid" || err.failure.status === 400)
          setError(
            mode === "claim"
              ? { field: "code", message: i18n.t("crew.transferInvalid") }
              : { field: "username", message: i18n.t("crew.usernameHint") },
          );
        else setError({ field: "form", message: i18n.t("crew.serverError", { code: err.failure.code }) });
      } else setError({ field: "form", message: i18n.t("crew.offline") });
    } finally {
      setBusy(false);
    }
  };

  const ready = normaliseServerUrl(address) !== null && (mode === "create" ? /^[a-z0-9_.]{3,24}$/.test(username.trim().toLowerCase()) && displayName.trim().length > 0 : code.trim().length === 10);

  return (
    <View style={{ gap: 16 }}>
      <Text muted>{i18n.t("crew.connectBody")}</Text>
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
          { value: "claim", label: i18n.t("crew.signIn") },
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
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
            />
          </>
        ) : (
          <>
            <Text variant="small">{i18n.t("crew.haveAccount")}</Text>
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
