import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, space, type } from "@crew/design-tokens";
import { Bubble } from "@/chat/Bubble";
import { Composer } from "@/chat/Composer";
import { canChange, deleteForEveryone, editMessage, markRead, purgeExpired, react, reportMessage, startChat, syncConversation } from "@/chat/engine";
import { timerLabel } from "@/chat/format";
import { releaseChatMedia } from "@/chat/media";
import { useNames } from "@/chat/names";
import { useChat, type ChatMessage } from "@/chat/store";
import { Sheet } from "@/games/ui/Sheet";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { useSession } from "@/server/session";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Button, IconButton } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { ScalePressable } from "@/ui/Pressable";
import { Text } from "@/ui/Text";
import { showToast, ToastHost } from "@/ui/Toast";

const REACTIONS = ["😂", "❤️", "🍻", "👍", "😮", "🔑"];
const REASONS = ["harassment", "inappropriate", "fake", "other"] as const;
const TYPING_SHOWN_MS = 6000;
const NO_MESSAGES: ChatMessage[] = [];

/** MSG-10: one conversation. Everything shown here was decrypted on this phone. */
export default function ConversationScreen() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
  const i18n = useT();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const name = useNames();
  const me = useSession((s) => s.session?.userId ?? "");
  const conversation = useChat((s) => s.conversations.find((c) => c.id === id));
  const messages = useChat((s) => s.messages[id] ?? NO_MESSAGES);
  const waiting = useChat((s) => Boolean(s.waiting[id]));
  const typing = useChat((s) => s.typing[id]);
  const readBy = useChat((s) => s.meta.readBy[id]);
  const keyChanged = useChat((s) => (conversation?.otherUserId ? s.meta.keyChanged[conversation.otherUserId] : undefined));
  const level = useAppStore((s) => Math.max(s.levelState?.level ?? 0, s.manualLevel ?? 0));
  const [reply, setReply] = useState<{ id: string; label: string } | null>(null);
  const [selected, setSelected] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [reporting, setReporting] = useState<ChatMessage | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [, tick] = useState(0);
  const openedAt = useRef(Date.now());

  useFocusEffect(
    useCallback(() => {
      // Someone is looking: this device may do the group's membership work right away.
      void startChat().then(() => syncConversation(id, true).catch(() => undefined));
      const timer = setInterval(() => {
        const now = Date.now();
        const expired = (useChat.getState().messages[id] ?? []).filter((m) => m.media && m.expiresAt !== undefined && m.expiresAt <= now).map((m) => m.media!.blob);
        if (expired.length) releaseChatMedia(expired);
        purgeExpired(now);
        tick((n) => n + 1);
        void syncConversation(id).catch(() => undefined);
      }, 20_000);
      return () => clearInterval(timer);
    }, [id]),
  );
  useEffect(() => {
    markRead(id);
  }, [id, messages.length]);
  // Leaving the conversation deletes the decrypted voice notes and videos written for the player.
  useEffect(
    () => () => releaseChatMedia((useChat.getState().messages[id] ?? []).flatMap((m) => (m.media ? [m.media.blob] : []))),
    [id],
  );

  const members = useMemo(() => (conversation?.members ?? []).filter((m) => m !== me).map((m) => ({ id: m, name: name(m) })), [conversation, me, name]);
  const mentionNames = useMemo(() => members.map((m) => m.name), [members]);
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(i18n.locale);
    const list = q.length >= 2 ? messages.filter((m) => m.body?.toLocaleLowerCase(i18n.locale).includes(q)) : messages;
    return [...list].reverse();
  }, [messages, query, i18n.locale]);

  const preview = (m: ChatMessage) => (m.deleted ? i18n.t("chat.deleted") : m.media ? (m.media.kind === "voice" ? i18n.t("chat.voicePreview") : m.media.kind === "video" ? i18n.t("chat.videoPreview") : i18n.t("chat.photoPreview")) : (m.body ?? ""));
  const lastMine = [...messages].reverse().find((m) => m.senderId === me && m.kind !== "timer");
  const readers = lastMine ? Object.entries(readBy ?? {}).filter(([user, upTo]) => user !== me && (byId.get(upTo)?.at ?? 0) >= lastMine.at).length : 0;
  const statusOf = (m: ChatMessage): string | null => {
    if (m.status === "sending") return i18n.t("chat.sending");
    if (m.status === "failed") return i18n.t("chat.failed");
    if (m.id !== lastMine?.id) return null;
    return readers ? i18n.t("chat.read") : i18n.t("chat.sent");
  };
  const typingNames = Object.entries(typing ?? {})
    .filter(([, at]) => Date.now() - at < TYPING_SHOWN_MS)
    .map(([user]) => name(user));

  if (!conversation) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.bg, paddingTop: insets.top + 54, paddingHorizontal: space.screenX }]}>
        <Text>{i18n.t("chat.notFound")}</Text>
      </View>
    );
  }

  const subtitle = conversation.disappearSeconds ? i18n.t("chat.encryptedTimer", { timer: timerLabel(conversation.disappearSeconds, i18n) }) : i18n.t("chat.encrypted");

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.screen, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: theme.line }]}>
        <IconButton icon="back" accessibilityLabel={i18n.t("common.back")} onPress={() => (router.canGoBack() ? router.back() : router.replace("/messages"))} />
        <View style={styles.flex}>
          <Text variant="h3" accessibilityRole="header">
            {conversation.title}
          </Text>
          <View style={styles.lockRow}>
            <Icon name="lock" size={12} color={theme.textMuted} />
            <Text variant="small" style={styles.flex}>
              {subtitle}
            </Text>
          </View>
        </View>
        <IconButton
          icon="search"
          accessibilityLabel={i18n.t("chat.searchHere")}
          onPress={() => {
            setSearching((s) => !s);
            setQuery("");
          }}
        />
        <IconButton icon="more" accessibilityLabel={i18n.t("chat.info")} onPress={() => router.push({ pathname: "/chat/info", params: { id } })} />
      </View>

      {searching ? (
        <View style={styles.searchBox}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder={i18n.t("chat.searchHerePlaceholder")}
            placeholderTextColor={theme.textMuted}
            accessibilityLabel={i18n.t("chat.searchHere")}
            style={[styles.search, type.body, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
          />
        </View>
      ) : null}

      {keyChanged && conversation.otherUserId ? (
        <ScalePressable onPress={() => router.push({ pathname: "/chat/safety", params: { userId: conversation.otherUserId!, conversationId: id } })} style={styles.notice}>
          <Panel tint="amber">
            <Text variant="small">{i18n.t("chat.keyChanged", { name: conversation.title })}</Text>
          </Panel>
        </ScalePressable>
      ) : null}
      {waiting ? (
        <View style={styles.notice}>
          <Panel>
            <Text variant="small">{i18n.t("chat.waiting")}</Text>
          </Panel>
        </View>
      ) : null}

      <FlatList
        inverted
        data={shown}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          typingNames.length ? (
            <Text variant="small" style={styles.typing}>
              {i18n.plural("chat.typing", typingNames.length, { name: typingNames[0]! })}
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          <Text variant="small" align="center" style={styles.empty}>
            {query ? i18n.t("chat.noResults") : i18n.t("chat.emptyConversation")}
          </Text>
        }
        renderItem={({ item, index }) => {
          const mine = item.senderId === me;
          const older = shown[index + 1];
          const showName = conversation.kind !== "direct" && !mine && older?.senderId !== item.senderId;
          const target = item.reply ? byId.get(item.reply) : undefined;
          return (
            <Bubble
              message={item}
              mine={mine}
              senderName={item.kind === "timer" ? (mine ? null : name(item.senderId)) : showName ? name(item.senderId) : null}
              replyTo={target ? { name: name(target.senderId), text: preview(target) } : null}
              mentionNames={mentionNames}
              status={mine ? statusOf(item) : null}
              highlighted={item.id === focus}
              fresh={item.at > openedAt.current}
              myReaction={item.reactions[me]}
              onReactionPress={(emoji) => {
                if (conversation.readOnly) return;
                haptic.select();
                react(id, item.id, emoji);
              }}
              onLongPress={() => {
                if (item.deleted || item.kind === "timer") return;
                haptic.select();
                setSelected(item);
              }}
            />
          );
        }}
      />

      {conversation.readOnly ? (
        <View style={[styles.readOnly, { borderTopColor: theme.line, paddingBottom: insets.bottom + 14 }]}>
          <Text variant="small" align="center">
            {conversation.kind === "party" ? i18n.t("chat.archived") : i18n.t("chat.readOnly")}
          </Text>
        </View>
      ) : waiting ? null : (
        <View style={{ paddingBottom: insets.bottom + 10 }}>
          <Composer conversationId={id} members={members} reply={reply} onClearReply={() => setReply(null)} big={level >= 2} />
        </View>
      )}

      <Sheet visible={Boolean(selected)} title={i18n.t("chat.actions")} onClose={() => setSelected(null)}>
        {selected ? (
          <>
            {!conversation.readOnly ? (
              <View style={styles.reactionRow}>
                {REACTIONS.map((emoji) => (
                  <ScalePressable
                    key={emoji}
                    accessibilityRole="button"
                    accessibilityLabel={emoji}
                    onPress={() => {
                      haptic.select();
                      react(id, selected.id, emoji);
                      setSelected(null);
                    }}
                    style={[styles.reaction, { backgroundColor: selected.reactions[me] === emoji ? theme.amber : theme.surfaceRaised }]}
                  >
                    <Text variant="h2">{emoji}</Text>
                  </ScalePressable>
                ))}
              </View>
            ) : null}
            {!conversation.readOnly ? (
              <Button
                label={i18n.t("chat.reply")}
                variant="secondary"
                height={48}
                onPress={() => {
                  setReply({ id: selected.id, label: i18n.t("chat.replyingTo", { name: name(selected.senderId), text: preview(selected) }) });
                  setSelected(null);
                }}
              />
            ) : null}
            {canChange(selected) && selected.kind === "text" ? (
              <Button
                label={i18n.t("chat.edit")}
                variant="secondary"
                height={48}
                onPress={() => {
                  setEditing({ id: selected.id, body: selected.body ?? "" });
                  setSelected(null);
                }}
              />
            ) : null}
            {canChange(selected) ? (
              <Button
                label={i18n.t("chat.deleteForAll")}
                variant="danger"
                height={48}
                onPress={() => {
                  haptic.heavy();
                  deleteForEveryone(id, selected.id);
                  setSelected(null);
                }}
              />
            ) : null}
            {selected.senderId !== me ? (
              <Button
                label={i18n.t("chat.report")}
                variant="outline"
                height={48}
                onPress={() => {
                  setReporting(selected);
                  setSelected(null);
                }}
              />
            ) : null}
          </>
        ) : null}
      </Sheet>

      <Sheet
        visible={Boolean(editing)}
        title={i18n.t("chat.edit")}
        onClose={() => setEditing(null)}
        footer={
          <Button
            label={i18n.t("common.save")}
            height={52}
            onPress={() => {
              if (editing && editing.body.trim()) editMessage(id, editing.id, editing.body.trim());
              setEditing(null);
            }}
          />
        }
      >
        <TextInput
          value={editing?.body ?? ""}
          onChangeText={(body) => setEditing((e) => (e ? { ...e, body } : e))}
          multiline
          autoFocus
          accessibilityLabel={i18n.t("chat.edit")}
          style={[styles.search, type.body, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
        />
        <Text variant="small">{i18n.t("chat.editNote")}</Text>
      </Sheet>

      <Sheet visible={Boolean(reporting)} title={i18n.t("chat.reportTitle")} onClose={() => setReporting(null)}>
        <Text>{i18n.t("chat.reportBody")}</Text>
        {REASONS.map((reason) => (
          <Button
            key={reason}
            label={i18n.t(`chat.reason.${reason}`)}
            variant="secondary"
            height={48}
            onPress={() => {
              const message = reporting;
              setReporting(null);
              if (!message) return;
              void reportMessage(id, message.id, reason)
                .then(() => showToast({ message: i18n.t("chat.reported") }))
                .catch(() => showToast({ tone: "danger", message: i18n.t("chat.reportFailed") }));
            }}
          />
        ))}
        <Button label={i18n.t("chat.cancel")} variant="outline" height={48} onPress={() => setReporting(null)} />
      </Sheet>
      <ToastHost bottomOffset={insets.bottom + 120} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  lockRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  list: { paddingHorizontal: space.screenX, paddingVertical: 12, gap: 10 },
  typing: { paddingTop: 4 },
  empty: { paddingVertical: 40, transform: [{ scaleY: -1 }] },
  notice: { paddingHorizontal: space.screenX, paddingTop: 10 },
  searchBox: { paddingHorizontal: space.screenX, paddingTop: 10, gap: 6 },
  search: { minHeight: 48, borderRadius: radius.input, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 },
  readOnly: { paddingTop: 14, paddingHorizontal: space.screenX, borderTopWidth: 1 },
  reactionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between" },
  reaction: { width: 48, height: 48, borderRadius: radius.button, alignItems: "center", justifyContent: "center" },
});
