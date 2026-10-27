import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { palette } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { useTheme } from "@/theme";
import { Icon } from "@/ui/Icon";
import { ScalePressable } from "@/ui/Pressable";
import { Tag } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { clip, timerLabel } from "./format";
import { openChatMedia } from "./media";
import type { ChatMedia, ChatMessage } from "./store";

const MAX_WIDTH = 270;

/** @Name in bold, the rest as typed. */
function Body({ text, names, color }: { text: string; names: string[]; color: string }) {
  if (!names.length) return <Text color={color}>{text}</Text>;
  const pattern = new RegExp(`(@(?:${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}))`, "g");
  return (
    <Text color={color}>
      {text.split(pattern).map((part, i) =>
        part.startsWith("@") && names.includes(part.slice(1)) ? (
          <Text key={i} color={color} style={styles.mention}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

function Photo({ media }: { media: ChatMedia }) {
  const i18n = useT();
  const theme = useTheme();
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    void openChatMedia(media)
      .then((u) => live && setUri(u))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [media]);
  const ratio = media.width && media.height ? media.width / media.height : 4 / 3;
  const source = uri ?? (media.thumb ? `data:image/jpeg;base64,${media.thumb}` : null);
  return (
    <View>
      {source ? (
        <Image source={{ uri: source }} blurRadius={uri ? 0 : 8} style={[styles.photo, { aspectRatio: ratio, backgroundColor: theme.surfaceRaised }]} accessibilityLabel={i18n.t("chat.photoPreview")} />
      ) : (
        <View style={[styles.photo, styles.placeholder, { aspectRatio: ratio, backgroundColor: theme.surfaceRaised }]}>
          <Icon name="image" size={40} color={theme.textMuted} />
        </View>
      )}
      <Text variant="small" style={styles.caption}>
        {failed ? i18n.t("chat.mediaGone") : i18n.t("chat.photoNote")}
      </Text>
    </View>
  );
}

function Voice({ media, tint }: { media: ChatMedia; tint: string }) {
  const i18n = useT();
  const theme = useTheme();
  const [uri, setUri] = useState<string | null>(null);
  const player = useAudioPlayer(uri ? { uri } : null);
  const status = useAudioPlayerStatus(player);
  const duration = media.durationMs ?? 0;
  const progress = duration ? Math.min(1, (status.currentTime * 1000) / duration) : 0;
  const toggle = async () => {
    if (!uri) {
      try {
        setUri(await openChatMedia(media));
      } catch {
        return;
      }
    }
    if (status.playing) player.pause();
    else {
      if (status.didJustFinish || progress >= 1) await player.seekTo(0);
      player.play();
    }
  };
  // The first tap loads the file; play once it is there.
  useEffect(() => {
    if (uri) player.play();
  }, [uri, player]);
  return (
    <ScalePressable onPress={() => void toggle()} accessibilityRole="button" accessibilityLabel={i18n.t("chat.playVoice", { time: clip(duration) })} style={styles.voice}>
      <Icon name={status.playing ? "hold" : "mic"} color={tint} />
      <View style={[styles.track, { backgroundColor: theme.line }]}>
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: theme.amber }]} />
      </View>
      <Text variant="small">{clip(duration)}</Text>
    </ScalePressable>
  );
}

interface Props {
  message: ChatMessage;
  mine: boolean;
  senderName: string | null;
  replyTo: { name: string; text: string } | null;
  mentionNames: string[];
  status: string | null;
  highlighted: boolean;
  onLongPress: () => void;
  onReactionPress: (emoji: string) => void;
  myReaction: string | undefined;
}

export function Bubble({ message, mine, senderName, replyTo, mentionNames, status, highlighted, onLongPress, onReactionPress, myReaction }: Props) {
  const i18n = useT();
  const theme = useTheme();
  if (message.kind === "timer") {
    return (
      <Text variant="small" align="center" style={styles.system}>
        {message.seconds
          ? senderName
            ? i18n.t("chat.timerSet", { name: senderName, timer: timerLabel(message.seconds, i18n) })
            : i18n.t("chat.timerSetMine", { timer: timerLabel(message.seconds, i18n) })
          : senderName
            ? i18n.t("chat.timerCleared", { name: senderName })
            : i18n.t("chat.timerClearedMine")}
      </Text>
    );
  }
  const fg = mine ? palette.accent.onAccent : theme.text;
  const bg = mine ? theme.amber : theme.surfaceRaised;
  const counts = new Map<string, number>();
  for (const e of Object.values(message.reactions)) counts.set(e, (counts.get(e) ?? 0) + 1);
  return (
    <View style={[styles.wrap, mine ? styles.right : styles.left]}>
      <ScalePressable
        onLongPress={onLongPress}
        delayLongPress={350}
        pressedScale={0.98}
        accessibilityHint={i18n.t("chat.longPressHint")}
        style={[
          styles.bubble,
          { backgroundColor: bg, borderColor: highlighted ? theme.water : "transparent" },
          mine ? styles.bubbleMine : styles.bubbleOther,
          message.media?.kind === "photo" ? styles.bubblePhoto : null,
        ]}
      >
        {senderName && !mine ? (
          <Text variant="small" color={palette.semantic.ok} style={styles.sender}>
            {senderName}
          </Text>
        ) : null}
        {replyTo ? (
          <View style={[styles.quote, { borderLeftColor: fg }]}>
            <Text variant="small" color={fg} numberOfLines={2} style={styles.quoteText}>
              {i18n.t("chat.fromName", { name: replyTo.name, text: replyTo.text })}
            </Text>
          </View>
        ) : null}
        {message.deleted ? (
          <Text color={fg} style={styles.deleted}>
            {i18n.t("chat.deleted")}
          </Text>
        ) : message.media?.kind === "photo" ? (
          <Photo media={message.media} />
        ) : message.media?.kind === "voice" ? (
          <Voice media={message.media} tint={mine ? fg : theme.amber} />
        ) : (
          <Body text={message.body ?? ""} names={mentionNames} color={fg} />
        )}
        {mine && status ? (
          <Text variant="small" color={fg} style={styles.status}>
            {status}
          </Text>
        ) : message.editedAt && !message.deleted ? (
          <Text variant="small" color={fg} style={styles.status}>
            {i18n.t("chat.edited")}
          </Text>
        ) : null}
      </ScalePressable>
      {counts.size ? (
        <View style={[styles.reactions, mine ? styles.right : styles.left]}>
          {[...counts].map(([emoji, n]) => (
            <ScalePressable key={emoji} onPress={() => onReactionPress(emoji)} accessibilityRole="button" accessibilityState={{ selected: myReaction === emoji }} accessibilityLabel={`${emoji} ${n}`}>
              <Tag label={`${emoji} ${n}`} tone={myReaction === emoji ? "amber" : "neutral"} />
            </ScalePressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4, maxWidth: MAX_WIDTH },
  left: { alignSelf: "flex-start" },
  right: { alignSelf: "flex-end" },
  bubble: { borderRadius: 18, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 2, gap: 2 },
  bubbleMine: { borderBottomRightRadius: 4 },
  bubbleOther: { borderBottomLeftRadius: 4 },
  bubblePhoto: { padding: 6, width: MAX_WIDTH },
  sender: { fontWeight: "700" },
  quote: { borderLeftWidth: 3, paddingLeft: 8, marginBottom: 4, opacity: 0.75 },
  quoteText: { fontSize: 13 },
  mention: { fontWeight: "700" },
  deleted: { opacity: 0.7 },
  status: { fontSize: 11, alignSelf: "flex-end" },
  photo: { width: "100%", borderRadius: 12 },
  placeholder: { alignItems: "center", justifyContent: "center" },
  caption: { paddingHorizontal: 6, paddingTop: 6, paddingBottom: 2 },
  voice: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 32 },
  track: { width: 140, height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%" },
  reactions: { flexDirection: "row", gap: 4 },
  system: { alignSelf: "center", paddingVertical: 4 },
});
