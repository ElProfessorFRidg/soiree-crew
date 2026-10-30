import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { radius, type } from "@crew/design-tokens";
import { MAX_BODY } from "@crew/mls";
import { useT } from "@/i18n";
import { showPermissionDenied } from "@/system/permissions";
import { haptic } from "@/motion/haptics";
import { useTheme } from "@/theme";
import { Button, IconButton } from "@/ui/Button";
import { Chip } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { ScalePressable } from "@/ui/Pressable";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { sendText, sendTyping } from "./engine";
import { clip } from "./format";
import { sendPhoto, sendVoice, VideoTooLarge } from "./media";
import { useDraft } from "@/state/drafts";

/** Shorter than this, a press on the record button was a slip, not a voice note. */
const MIN_VOICE_MS = 700;
const MAX_VOICE_MS = 3 * 60_000;

interface Props {
  conversationId: string;
  members: { id: string; name: string }[];
  reply: { id: string; label: string } | null;
  onClearReply: () => void;
  /** Adaptive level 2 or 3: the record button takes the whole width (MSG-10). */
  big: boolean;
}

export function Composer({ conversationId, members, reply, onClearReply, big }: Props) {
  const i18n = useT();
  const theme = useTheme();
  // QOL-07: an unsent message survives the app being killed, per conversation.
  const [draft, setDraft, clearDraft] = useDraft(`chat:${conversationId}`);
  const [recording, setRecording] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  // "@ma" at the end of the draft offers the members whose name starts that way.
  const mentionQuery = /(?:^|\s)@([^\s@]*)$/.exec(draft)?.[1];
  const suggestions = mentionQuery === undefined ? [] : members.filter((m) => m.name.toLocaleLowerCase(i18n.locale).startsWith(mentionQuery.toLocaleLowerCase(i18n.locale))).slice(0, 5);

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    const mentions = members.filter((m) => body.includes(`@${m.name}`)).map((m) => m.id);
    const outcome = sendText(conversationId, body, { ...(reply ? { reply: reply.id } : {}), mentions });
    haptic.confirmed();
    clearDraft();
    onClearReply();
    if (outcome === "held") showToast({ message: i18n.t("chat.heldToast") });
  };

  const photo = async () => {
    try {
      const n = await sendPhoto(conversationId, "library", reply?.id);
      if (n < 0) showPermissionDenied(i18n, i18n.t("chat.photoPermission"), n === -1);
      if (n > 0) onClearReply();
    } catch (error) {
      showToast({ tone: "danger", message: i18n.t(error instanceof VideoTooLarge ? "chat.videoTooBig" : "chat.mediaFailed") });
    }
  };

  // Refs, not state: the timer and the permission prompt outlive the render that started them.
  const holding = useRef(false);
  const startedAt = useRef<number | null>(null);

  const stopRecording = async (keep: boolean) => {
    holding.current = false;
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    const started = startedAt.current;
    startedAt.current = null;
    setRecording(null);
    if (started === null) return;
    await recorder.stop().catch(() => undefined);
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    const duration = Date.now() - started;
    const uri = recorder.uri;
    if (!keep || duration < MIN_VOICE_MS || !uri) {
      if (keep && duration < MIN_VOICE_MS) showToast({ message: i18n.t("chat.holdToRecord") });
      return;
    }
    haptic.confirmed();
    try {
      await sendVoice(conversationId, uri, duration, reply?.id);
      onClearReply();
    } catch {
      showToast({ tone: "danger", message: i18n.t("chat.mediaFailed") });
    }
  };

  const startRecording = async () => {
    holding.current = true;
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      holding.current = false;
      showPermissionDenied(i18n, i18n.t("chat.micPermission"), permission.canAskAgain);
      return;
    }
    // The prompt took the finger away: the press is over, so nothing records.
    if (!holding.current) return;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    if (!holding.current) {
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      return;
    }
    recorder.record();
    haptic.select();
    const started = Date.now();
    startedAt.current = started;
    setRecording(started);
    setElapsed(0);
    ticker.current = setInterval(() => {
      const ms = Date.now() - started;
      setElapsed(ms);
      if (ms >= MAX_VOICE_MS) void stopRecording(true);
    }, 200);
  };

  // Leaving the conversation mid-recording turns the microphone off.
  useEffect(
    () => () => {
      if (startedAt.current !== null) void stopRecording(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const recordButton = (
    <ScalePressable
      accessibilityRole="button"
      accessibilityLabel={i18n.t("chat.recordVoice")}
      accessibilityHint={i18n.t("chat.holdToRecord")}
      onPressIn={() => void startRecording()}
      onPressOut={() => void stopRecording(true)}
      pressedScale={0.96}
      style={[big ? styles.bigRecord : styles.mic, { backgroundColor: recording !== null ? theme.danger : big ? theme.amber : theme.surfaceRaised }]}
    >
      <Icon name="mic" size={big ? 32 : 22} color={big || recording !== null ? theme.onAccent : theme.text} />
      {big ? (
        <Text variant="h3" color={theme.onAccent}>
          {recording !== null ? clip(elapsed) : i18n.t("chat.holdToRecord")}
        </Text>
      ) : null}
    </ScalePressable>
  );

  return (
    <View style={[styles.bar, { borderTopColor: theme.line, backgroundColor: theme.bg }]}>
      {reply ? (
        <View style={[styles.reply, { borderLeftColor: theme.amber }]}>
          <Text variant="small" style={styles.flex}>
            {reply.label}
          </Text>
          <IconButton icon="x" accessibilityLabel={i18n.t("chat.cancelReply")} onPress={onClearReply} />
        </View>
      ) : null}
      {suggestions.length ? (
        <View style={styles.suggestions}>
          {suggestions.map((m) => (
            <Chip key={m.id} label={`@${m.name}`} onPress={() => setDraft(draft.replace(/@([^\s@]*)$/, `@${m.name} `))} />
          ))}
        </View>
      ) : null}
      {recording !== null && !big ? (
        <Text variant="small" color={theme.danger}>
          {i18n.t("chat.recording", { time: clip(elapsed) })}
        </Text>
      ) : null}
      {big ? (
        <View style={styles.bigRow}>
          {recordButton}
          {draft.trim() ? <Button label={i18n.t("chat.send")} icon="send" height={56} onPress={send} /> : null}
        </View>
      ) : null}
      <View style={styles.row}>
        <IconButton icon="image" accessibilityLabel={i18n.t("chat.sendPhoto")} onPress={() => void photo()} />
        <TextInput
          value={draft}
          onChangeText={(text) => {
            setDraft(text.slice(0, MAX_BODY));
            if (text) sendTyping(conversationId);
          }}
          placeholder={i18n.t("chat.placeholder")}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={i18n.t("chat.placeholder")}
          multiline
          style={[styles.input, type.body, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
        />
        {draft.trim() ? (
          <ScalePressable accessibilityRole="button" accessibilityLabel={i18n.t("chat.send")} onPress={send} style={[styles.send, { backgroundColor: theme.amber }]}>
            <Icon name="send" color={theme.onAccent} />
          </ScalePressable>
        ) : big ? null : (
          recordButton
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 14, paddingTop: 10, gap: 8, borderTopWidth: 1 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: { flex: 1, minHeight: 52, maxHeight: 140, borderRadius: radius.input, borderWidth: 1.5, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 },
  send: { width: 52, height: 52, borderRadius: radius.button, alignItems: "center", justifyContent: "center" },
  mic: { width: 52, height: 52, borderRadius: radius.button, alignItems: "center", justifyContent: "center" },
  bigRow: { gap: 8 },
  bigRecord: { minHeight: 96, borderRadius: radius.card, alignItems: "center", justifyContent: "center", gap: 6 },
  reply: { flexDirection: "row", alignItems: "center", gap: 8, borderLeftWidth: 3, paddingLeft: 10 },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  flex: { flex: 1 },
});
