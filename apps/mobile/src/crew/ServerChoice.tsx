import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { api } from "@/server/api";
import { normaliseServerUrl } from "@/server/session";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Panel, Row, Tag } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Sheet } from "@/ui/Sheet";
import { Text } from "@/ui/Text";
import { Field } from "./Field";
import { hostOf, officialServer, otherPublicServers, serverInfo, useServerInfo, type ServerInfo } from "./servers";

/** An address typed by hand: checked for https and for an answer before it is used. */
export function ServerAddress({ initial = "", onPick }: { initial?: string; onPick: (url: string) => void }) {
  const i18n = useT();
  const [address, setAddress] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const use = async () => {
    const url = normaliseServerUrl(address);
    if (!url) {
      setError(i18n.t("crew.serverInvalid"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/v1/health", { baseUrl: url, token: null });
      haptic.confirmed();
      setBusy(false);
      onPick(url);
    } catch {
      haptic.error();
      setBusy(false);
      setError(i18n.t("crew.serverUnreachable"));
    }
  };
  return (
    <View style={styles.address}>
      <Field
        label={i18n.t("crew.serverUrl")}
        placeholder={i18n.t("crew.serverUrlPlaceholder")}
        value={address}
        onChangeText={setAddress}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        textContentType="URL"
        returnKeyType="go"
        onSubmitEditing={() => void use()}
        error={error}
      />
      <Button label={i18n.t("arrival.serverUse")} variant="secondary" height={48} disabled={normaliseServerUrl(address) === null} loading={busy} onPress={() => void use()} />
    </View>
  );
}

/** "Serveur : name · Changer" at the bottom of the Crew tab. Without `onChange`, it only says where the account lives. */
export function ServerLine({ server, onChange }: { server: string | null; onChange?: () => void }) {
  const i18n = useT();
  const theme = useTheme();
  const info = useServerInfo(server);
  const line = i18n.t("arrival.serverLine", { name: server ? (info?.name ?? hostOf(server)) : i18n.t("arrival.serverNone") });
  if (!onChange) {
    return (
      <View style={styles.line}>
        <Icon name="shield" size={16} color={theme.textMuted} />
        <Text variant="small" style={styles.shrink}>
          {line}
        </Text>
      </View>
    );
  }
  const change = i18n.t("arrival.serverChange");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${line}, ${change}`}
      onPress={() => {
        haptic.select();
        onChange();
      }}
      style={({ pressed }) => [styles.line, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon name="shield" size={16} color={theme.textMuted} />
      <Text variant="small" numberOfLines={1} style={styles.shrink}>
        {line}
      </Text>
      <Text variant="small">·</Text>
      <Text variant="small" color={theme.amber}>
        {change}
      </Text>
    </Pressable>
  );
}

/**
 * Where the account and the crews live: the official server first and marked as the one to take,
 * the other public servers this build knows (the ones that answer and call themselves public),
 * then a private server by its address.
 */
export function ServerSheet({ visible, current, onPick, onClose }: { visible: boolean; current: string | null; onPick: (url: string) => void; onClose: () => void }) {
  const i18n = useT();
  const theme = useTheme();
  const official = officialServer();
  const officialInfo = useServerInfo(visible ? official : null);
  const [others, setOthers] = useState<ServerInfo[]>([]);
  useEffect(() => {
    if (!visible) return;
    let live = true;
    void Promise.all(otherPublicServers().map(serverInfo)).then((list) => {
      if (live) setOthers(list.filter((s): s is ServerInfo => s !== null && s.public));
    });
    return () => {
      live = false;
    };
  }, [visible]);
  const known = [official, ...others.map((s) => s.url)];
  const own = current && !known.includes(current) ? current : "";
  const pick = (url: string) => {
    onPick(url);
    onClose();
  };
  const describe = (info: ServerInfo | null, url: string) =>
    [info?.description || hostOf(url), info?.openCrews ? i18n.plural("crew.openCrewsCount", info.openCrews) : ""].filter(Boolean).join(". ");
  const mark = (url: string) => (url === current ? <Icon name="check" color={theme.amber} /> : null);

  return (
    <Sheet visible={visible} title={i18n.t("arrival.serverSheetTitle")} onClose={onClose}>
      <Text muted>{i18n.t("arrival.serverSheetBody")}</Text>
      {official ? (
        <Panel>
          <Row
            title={officialInfo?.name ?? i18n.t("arrival.official")}
            subtitle={describe(officialInfo, official)}
            trailing={
              <View style={styles.trailing}>
                <Tag tone="amber" label={i18n.t("arrival.recommended")} />
                {mark(official)}
              </View>
            }
            onPress={() => pick(official)}
            last
          />
        </Panel>
      ) : null}
      {others.length ? (
        <View style={styles.group}>
          <Text variant="label">{i18n.t("arrival.otherServers")}</Text>
          <Panel>
            {others.map((s, index) => (
              <Row key={s.url} title={s.name} subtitle={describe(s, s.url)} trailing={mark(s.url)} onPress={() => pick(s.url)} last={index === others.length - 1} />
            ))}
          </Panel>
        </View>
      ) : null}
      <View style={styles.group}>
        <Text variant="label">{i18n.t("arrival.ownServer")}</Text>
        <Panel>
          <Text variant="small">{i18n.t("arrival.ownServerHint")}</Text>
          <ServerAddress key={own} initial={own} onPick={pick} />
        </Panel>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  address: { gap: 12 },
  line: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, paddingHorizontal: 8 },
  shrink: { flexShrink: 1 },
  trailing: { flexDirection: "row", alignItems: "center", gap: 8 },
  group: { gap: 8 },
});
