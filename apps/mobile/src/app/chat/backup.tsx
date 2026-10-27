import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { backupNow, createRecoveryKey, hasRecoveryKey, restoreBackup, turnOffBackup } from "@/chat/backup";
import { releaseHeld, updateMeta } from "@/chat/engine";
import { useChat } from "@/chat/store";
import { Field } from "@/crew/Field";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { haptic } from "@/motion/haptics";
import { fetchFriends, type FriendsList } from "@/server/profileData";
import { useAppStore } from "@/state/store";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Panel, Row, Switch, Tag } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Numeral, Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { vaultClosed } from "@/vault/vault";

/** MSG-08 and ADP-10: the encrypted backup and its recovery key, then the messages held overnight. */
export default function ChatBackupScreen() {
  const i18n = useT();
  const hourCycle = useAppStore((s) => s.preferences.hourCycle);
  const meta = useChat((s) => s.meta);
  const conversations = useChat((s) => s.conversations);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [friends, setFriends] = useState<FriendsList["friends"]>([]);
  const closed = vaultClosed();

  useFocusEffect(
    useCallback(() => {
      void hasRecoveryKey().then(setHasKey);
      void fetchFriends()
        .then((f) => setFriends(f.friends))
        .catch(() => undefined);
    }, []),
  );

  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await work();
      haptic.confirmed();
      showToast({ message: done });
    } catch {
      showToast({ tone: "danger", message: i18n.t("crew.offline") });
    } finally {
      setBusy(false);
    }
  };

  const guarded = meta.settings.guarded;
  const titleOf = (conversationId: string) => conversations.find((c) => c.id === conversationId)?.title ?? "";

  return (
    <Screen back title={i18n.t("chat.backupTitle")} withToasts>
      <Text variant="h2">{i18n.t("chat.backupHeadline")}</Text>
      <Panel>
        <Text variant="label">{i18n.t("chat.backupLabel")}</Text>
        <Text variant="small">{i18n.t("chat.backupBody")}</Text>
        {newKey ? (
          <>
            <View accessible accessibilityLabel={revealed ? newKey.split("-").join(" ") : i18n.t("chat.keyHidden")} style={styles.key}>
              <Numeral size={22} style={styles.keyText}>
                {revealed ? newKey : newKey.replace(/[0-9A-Z]/g, "•")}
              </Numeral>
            </View>
            <Button label={revealed ? i18n.t("chat.hideKey") : i18n.t("chat.showKey")} variant="secondary" icon="eye" height={44} onPress={() => setRevealed((r) => !r)} />
            <Button
              label={i18n.t("chat.keyWritten")}
              height={48}
              loading={busy}
              onPress={() =>
                void run(async () => {
                  await backupNow();
                  setNewKey(null);
                  setHasKey(true);
                }, i18n.t("chat.backupDone"))
              }
            />
          </>
        ) : hasKey ? (
          <>
            <Text variant="small">{meta.backupAt ? i18n.t("chat.lastBackup", { date: new Intl.DateTimeFormat(i18n.locale, { day: "numeric", month: "long" }).format(new Date(meta.backupAt)), time: formatClock(meta.backupAt, i18n.language, hourCycle) }) : i18n.t("chat.noBackupYet")}</Text>
            <Button label={i18n.t("chat.backupNow")} height={48} loading={busy} onPress={() => void run(backupNow, i18n.t("chat.backupDone"))} />
            <Button
              label={i18n.t("chat.backupOff")}
              variant="outline"
              height={44}
              onPress={() =>
                void run(async () => {
                  await turnOffBackup();
                  setHasKey(false);
                }, i18n.t("chat.backupStopped"))
              }
            />
          </>
        ) : hasKey === false ? (
          <Button
            label={i18n.t("chat.createKey")}
            icon="key"
            height={48}
            onPress={() =>
              void createRecoveryKey().then((k) => {
                setNewKey(k);
                setRevealed(true);
              })
            }
          />
        ) : null}
      </Panel>

      <Panel tint="danger">
        <Text variant="label">{i18n.t("chat.withoutKey")}</Text>
        <Text variant="small">{i18n.t("chat.withoutKeyBody")}</Text>
      </Panel>

      <Field label={i18n.t("chat.restoreLabel")} value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" hint={i18n.t("chat.restoreHint")} />
      <Button
        label={i18n.t("chat.restore")}
        variant="secondary"
        height={48}
        loading={busy}
        onPress={() => {
          setBusy(true);
          void restoreBackup(typed)
            .then((outcome) => {
              showToast({ ...(outcome === "ok" ? {} : { tone: "danger" as const }), message: i18n.t(`chat.restore_${outcome}`) });
              if (outcome === "ok") {
                setTyped("");
                setHasKey(true);
              }
            })
            .finally(() => setBusy(false));
        }}
      />

      <Text variant="label">{i18n.t("chat.heldTitle")}</Text>
      {meta.held.length ? (
        meta.held.map((h) => (
          <Panel key={h.id}>
            <View style={styles.heldHead}>
              <Text variant="h3" style={styles.flex}>
                {i18n.t("chat.heldFor", { name: titleOf(h.conversationId) })}
              </Text>
              <Tag tone="amber" label={formatClock(h.at, i18n.language, hourCycle)} />
            </View>
            <Text>{h.payload.t === "text" ? i18n.t("chat.quoted", { text: h.payload.body }) : i18n.t("chat.photoPreview")}</Text>
            <View style={styles.heldActions}>
              <Button label={i18n.t("chat.heldDelete")} variant="outline" height={44} style={styles.flex} onPress={() => releaseHeld(h.id, false)} />
              <Button label={closed ? i18n.t("chat.heldTomorrow") : i18n.t("chat.heldSend")} height={44} style={styles.flex} disabled={closed} onPress={() => releaseHeld(h.id, true)} />
            </View>
          </Panel>
        ))
      ) : (
        <Text variant="small">{i18n.t("chat.heldNone")}</Text>
      )}

      <Text variant="label">{i18n.t("chat.guardTitle")}</Text>
      <Text variant="small">{closed ? i18n.t("chat.guardLocked") : i18n.t("chat.guardBody")}</Text>
      <View>
        {friends.map((f, index) => (
          <Row
            key={f.userId}
            title={f.name}
            leading={<Avatar personId={f.userId} name={f.name} size={32} />}
            trailing={
              <Switch
                value={guarded.includes(f.userId)}
                disabled={closed}
                accessibilityLabel={i18n.t("chat.guardFor", { name: f.name })}
                onValueChange={(on) => updateMeta((m) => ({ ...m, settings: { ...m.settings, guarded: on ? [...m.settings.guarded, f.userId] : m.settings.guarded.filter((u) => u !== f.userId) } }))}
              />
            }
            last={index === friends.length - 1}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  key: { alignItems: "center", paddingVertical: 8 },
  keyText: { letterSpacing: 1, textAlign: "center" },
  heldHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  heldActions: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
});
