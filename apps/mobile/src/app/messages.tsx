import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { avatarColor, palette, radius } from "@crew/design-tokens";
import { refreshConversations, startChat } from "@/chat/engine";
import { whenShort } from "@/chat/format";
import { useNames } from "@/chat/names";
import { unreadCount, useChat, type ChatMessage, type Conversation } from "@/chat/store";
import { Field } from "@/crew/Field";
import { useT } from "@/i18n";
import { useSession } from "@/server/session";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Avatar, initials } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Panel, Row, Tag } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { SkeletonRows } from "@/ui/Skeleton";
import { Text } from "@/ui/Text";

/** Groups get a rounded square, people a circle, as in the prototype. */
function ConversationMark({ conversation }: { conversation: Conversation }) {
  if (conversation.kind === "direct") return <Avatar personId={conversation.otherUserId ?? conversation.id} name={conversation.title} />;
  return (
    <View style={[styles.square, { backgroundColor: avatarColor(conversation.id) }]}>
      <Text variant="h3" color={palette.accent.onAccent} style={styles.squareText}>
        {initials(conversation.title)}
      </Text>
    </View>
  );
}

/** MSG-01: every conversation of this person, newest first; MSG-09: search runs here, on the phone. */
export default function MessagesScreen() {
  const i18n = useT();
  const theme = useTheme();
  const name = useNames();
  const me = useSession((s) => s.session?.userId ?? "");
  const hourCycle = useAppStore((s) => s.preferences.hourCycle);
  const { ready, problem, conversations, messages, meta } = useChat();
  const [query, setQuery] = useState("");

  useFocusEffect(
    useCallback(() => {
      void startChat();
    }, []),
  );

  const preview = (c: Conversation): string => {
    if (c.readOnly && c.kind === "party") return i18n.t("chat.archived");
    const last = [...(messages[c.id] ?? [])].reverse().find((m) => m.kind !== "timer");
    if (!last) return c.kind === "direct" ? i18n.t("chat.sayHello") : i18n.t("chat.noMessages");
    const text = last.deleted
      ? i18n.t("chat.deleted")
      : last.media
        ? last.media.kind === "voice"
          ? i18n.t("chat.voicePreview")
          : last.media.kind === "video"
            ? i18n.t("chat.videoPreview")
            : i18n.t("chat.photoPreview")
        : (last.body ?? "");
    return c.kind === "direct" || last.senderId === me ? text : i18n.t("chat.fromName", { name: name(last.senderId), text });
  };

  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(i18n.locale);
    if (q.length < 2) return null;
    const found: { conversation: Conversation; message: ChatMessage }[] = [];
    for (const c of conversations) {
      for (const m of messages[c.id] ?? []) if (!m.deleted && m.body?.toLocaleLowerCase(i18n.locale).includes(q)) found.push({ conversation: c, message: m });
    }
    return found.sort((a, b) => b.message.at - a.message.at).slice(0, 50);
  }, [query, conversations, messages, i18n.locale]);

  const held = meta.held;
  const firstHeld = held[0] ? conversations.find((c) => c.id === held[0]!.conversationId) : undefined;

  return (
    <Screen back title={i18n.t("chat.title")} onRefresh={() => refreshConversations().then(() => startChat())}>
      <Field label={i18n.t("chat.search")} value={query} onChangeText={setQuery} placeholder={i18n.t("chat.searchPlaceholder")} returnKeyType="search" />

      {results ? (
        results.length ? (
          <View>
            {results.map(({ conversation, message }, index) => (
              <Row
                key={`${conversation.id}-${message.id}`}
                title={conversation.title}
                subtitle={message.body}
                leading={<Icon name="search" color={theme.textMuted} />}
                trailing={<Text variant="small">{whenShort(message.at, i18n, hourCycle)}</Text>}
                onPress={() => router.push({ pathname: "/chat/[id]", params: { id: conversation.id, focus: message.id } })}
                last={index === results.length - 1}
              />
            ))}
          </View>
        ) : (
          <Text variant="small">{i18n.t("chat.noResults")}</Text>
        )
      ) : null}

      {!results && problem && !conversations.length ? (
        <Panel tint="danger">
          <Text>{problem === "offline" ? i18n.t("chat.offline") : i18n.t("chat.serverProblem")}</Text>
          <Button label={i18n.t("common.retry")} variant="secondary" height={44} onPress={() => void startChat()} />
        </Panel>
      ) : null}

      {!results && !ready && !conversations.length ? <SkeletonRows /> : null}

      {!results ? (
        <View>
          {conversations.map((c, index) => {
            const unread = unreadCount(c.id, me);
            const last = c.lastAt ?? (messages[c.id]?.at(-1)?.at ?? null);
            return (
              <Row
                key={c.id}
                title={c.title}
                subtitle={preview(c)}
                leading={<ConversationMark conversation={c} />}
                trailing={
                  <View style={styles.side}>
                    {last ? <Text variant="small">{whenShort(last, i18n, hourCycle)}</Text> : null}
                    {unread ? <Tag tone="amber" label={i18n.number(unread)} /> : null}
                  </View>
                }
                onPress={() => router.push({ pathname: "/chat/[id]", params: { id: c.id } })}
                last={index === conversations.length - 1 && !held.length}
              />
            );
          })}
          {held.length ? (
            <Row
              title={i18n.plural("chat.heldCount", held.length)}
              subtitle={firstHeld ? i18n.t("chat.heldFor", { name: firstHeld.title }) : undefined}
              leading={<Icon name="clock" color={theme.amber} />}
              trailing={<Button label={i18n.t("chat.see")} variant="secondary" height={40} onPress={() => router.push("/chat/backup")} />}
              last
            />
          ) : null}
        </View>
      ) : null}

      {!results && ready && !conversations.length && !problem ? <Text>{i18n.t("chat.empty")}</Text> : null}

      {!results ? (
        <View style={styles.actions}>
          <Button label={i18n.t("chat.newDirect")} icon="chat" variant="secondary" height={48} onPress={() => router.push("/chat/new")} />
          <Button label={i18n.t("chat.backupTitle")} icon="lock" variant="outline" height={48} onPress={() => router.push("/chat/backup")} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  square: { width: 38, height: 38, borderRadius: radius.buttonSmall, alignItems: "center", justifyContent: "center" },
  squareText: { fontSize: 14, lineHeight: 17 },
  side: { alignItems: "flex-end", gap: 4 },
  actions: { gap: 10 },
});
