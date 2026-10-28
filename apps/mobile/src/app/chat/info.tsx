import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {  } from "react-native";
import { View } from "react-native";
import { CIPHERSUITE } from "@crew/mls";
import { setDisappearing, updateMeta } from "@/chat/engine";
import { timerLabel } from "@/chat/format";
import { TIMER_CHOICES, useNames } from "@/chat/names";
import { useChat } from "@/chat/store";
import { useT } from "@/i18n";
import { api } from "@/server/api";
import { leaveCrew, respondToParty } from "@/server/crewData";
import { guarded } from "@/vault/vault";
import { useSession } from "@/server/session";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Panel, Row, Segmented, Switch, Tag } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { showFailure } from "@/server/errors";
import { confirmAction } from "@/ui/confirm";

/** MSG-12, MSG-06, MSG-10: who is in the conversation, its timer, my receipts and typing, the group's key state. */
export default function ConversationInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const i18n = useT();
  const name = useNames();
  const me = useSession((s) => s.session?.userId ?? "");
  const conversation = useChat((s) => s.conversations.find((c) => c.id === id));
  const meta = useChat((s) => s.meta);
  const [devices, setDevices] = useState<{ expected: number; inGroup: number } | null>(null);

  useEffect(() => {
    void api<{ expected: unknown[]; inGroup: unknown[] }>(`/v1/conversations/${id}/roster`)
      .then((r) => setDevices({ expected: r.expected.length, inGroup: r.inGroup.length }))
      .catch(() => undefined);
  }, [id]);

  if (!conversation) return <Screen back title={i18n.t("chat.info")}>{null}</Screen>;
  const others = conversation.members.filter((m) => m !== me);
  const setting = (key: "readReceipts" | "typing", value: boolean) => updateMeta((m) => ({ ...m, settings: { ...m.settings, [key]: value } }));

  return (
    <Screen back title={conversation.title} withToasts>
      {others.some((u) => meta.keyChanged[u]) ? (
        <Panel tint="amber">
          {others
            .filter((u) => meta.keyChanged[u])
            .map((u) => (
              <Text key={u} variant="small">
                {i18n.t("chat.keyChanged", { name: name(u) })}
              </Text>
            ))}
        </Panel>
      ) : null}

      <Text variant="label">{i18n.t("chat.safetyTitle")}</Text>
      <View>
        {others.map((u, index) => {
          const verified = meta.verified[u] && meta.verified[u] === meta.knownKeys[u];
          return (
            <Row
              key={u}
              title={name(u)}
              subtitle={verified ? i18n.t("chat.verified") : i18n.t("chat.notVerified")}
              leading={<Avatar personId={u} name={name(u)} />}
              trailing={meta.keyChanged[u] ? <Tag tone="amber" label={i18n.t("chat.keyNew")} /> : undefined}
              onPress={() => router.push({ pathname: "/chat/safety", params: { userId: u, conversationId: id } })}
              last={index === others.length - 1}
            />
          );
        })}
      </View>

      <Text variant="label">{i18n.t("chat.disappearing")}</Text>
      <Segmented
        items={TIMER_CHOICES.map((s) => ({ value: s, label: timerLabel(s, i18n) }))}
        value={conversation.disappearSeconds as (typeof TIMER_CHOICES)[number]}
        accessibilityLabel={i18n.t("chat.disappearing")}
        onChange={(seconds) => {
          if (conversation.readOnly) return;
          void setDisappearing(id, seconds).catch(showFailure(i18n));
        }}
      />

      <View>
        <Row title={i18n.t("chat.readReceipts")} trailing={<Switch value={meta.settings.readReceipts} onValueChange={(v) => setting("readReceipts", v)} accessibilityLabel={i18n.t("chat.readReceipts")} />} />
        <Row
          title={i18n.t("chat.quiet")}
          trailing={
            <Switch
              value={Boolean(meta.quiet?.includes(id))}
              accessibilityLabel={i18n.t("chat.quiet")}
              onValueChange={(on) => updateMeta((m) => ({ ...m, quiet: on ? [...(m.quiet ?? []), id] : (m.quiet ?? []).filter((q) => q !== id) }))}
            />
          }
        />
        <Row title={i18n.t("chat.typingSwitch")} trailing={<Switch value={meta.settings.typing} onValueChange={(v) => setting("typing", v)} accessibilityLabel={i18n.t("chat.typingSwitch")} />} last />
      </View>

      <Panel>
        <Text variant="label">{i18n.t("chat.keyState")}</Text>
        <Text variant="small">{i18n.t("chat.keyStateBody", { suite: CIPHERSUITE, epoch: conversation.epoch ?? 0 })}</Text>
        {devices ? <Text variant="small">{i18n.t("chat.keyStateDevices", { inGroup: devices.inGroup, expected: devices.expected })}</Text> : null}
      </Panel>

      <Panel>
        <Text variant="label">{i18n.t("chat.report")}</Text>
        <Text variant="small">{i18n.t("chat.reportHow")}</Text>
      </Panel>
      <Button label={i18n.t("chat.backupTitle")} icon="lock" variant="outline" height={48} onPress={() => router.push("/chat/backup")} />
      {conversation.kind !== "direct" && !conversation.readOnly ? (
        <Button
          label={conversation.kind === "crew" ? i18n.t("chat.leaveCrew") : i18n.t("chat.leaveParty")}
          variant="danger"
          height={48}
          onPress={() =>
            void confirmAction({
              title: conversation.kind === "crew" ? i18n.t("crew.leaveConfirm", { crew: conversation.title }) : i18n.t("chat.leavePartyConfirm"),
              confirmLabel: i18n.t("crew.leave"),
              cancelLabel: i18n.t("crew.leaveKeep"),
            }).then((ok) => {
              if (!ok) return;
              // Leaving the crew or the party is what takes this phone out of the group (MLS remove).
              if (conversation.kind === "crew" && conversation.crewId) {
                const ran = guarded({ kind: "leaveCrew", crewId: conversation.crewId, crewName: conversation.title }, () => void leaveCrew(conversation.crewId!).catch(() => undefined));
                if (!ran) showToast({ message: i18n.t("vault.queued") });
              } else if (conversation.partyId) void respondToParty(conversation.partyId, "declined").catch(() => undefined);
              router.back();
            })
          }
        />
      ) : null}
    </Screen>
  );
}
