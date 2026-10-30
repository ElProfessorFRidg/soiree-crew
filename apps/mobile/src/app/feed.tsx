import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { duration, radius, type } from "@crew/design-tokens";
import { useCrewLabels } from "@/crew/names";
import { useT, type Translator } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { useCrewData } from "@/server/crewData";
import { showFailure } from "@/server/errors";
import { useSession } from "@/server/session";
import {
  commentOnFeed,
  deleteFeedComment,
  FEED_REACTIONS,
  fetchFeed,
  markFeedSeen,
  REACTION_EMOJI,
  reactToFeed,
  useFeedPulse,
  type FeedComment,
  type FeedEntry,
  type FeedLine,
  type FeedReaction,
  type FeedSocial,
} from "@/server/socialData";
import { RelativeTime } from "@/ui/RelativeTime";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button, IconButton } from "@/ui/Button";
import { Chip, Tag } from "@/ui/controls";
import { Icon, type AnyIconName } from "@/ui/Icon";
import { ScalePressable } from "@/ui/Pressable";
import { Screen } from "@/ui/Screen";
import { SkeletonRows } from "@/ui/Skeleton";
import { Text } from "@/ui/Text";
import { EmptyState } from "@/ui/EmptyState";

type Line = FeedLine & FeedSocial;

const ICONS: Record<FeedLine["kind"], AnyIconName> = {
  checkins: "pin",
  photos: "camera",
  party: "glass",
  poll: "cal",
  takeover: "crown",
  cheat: "flag",
  joined: "users",
  quote: "chat",
  reactions: "star",
};

/** « Jade », « Jade et Malik », « Jade, Malik et 2 autres ». */
function people(ids: string[], nameOf: (id: string) => string, i18n: Translator): string {
  const names = ids.map(nameOf);
  if (names.length === 0) return i18n.t("feed.someone");
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return i18n.t("feed.two", { a: names[0]!, b: names[1]! });
  return i18n.plural("feed.many", names.length - 2, { a: names[0]!, b: names[1]! });
}

/** The words a comment is made of, with each @mention of a crew mate marked. */
function mentionParts(text: string, mentions: string[], labelOf: (id: string) => string): { text: string; mention: boolean }[] {
  const tags = mentions.map((id) => `@${labelOf(id)}`).sort((a, b) => b.length - a.length);
  const parts: { text: string; mention: boolean }[] = [];
  let rest = text;
  while (rest) {
    let best: { at: number; tag: string } | null = null;
    for (const tag of tags) {
      const at = rest.indexOf(tag);
      if (at >= 0 && (!best || at < best.at)) best = { at, tag };
    }
    if (!best) {
      parts.push({ text: rest, mention: false });
      break;
    }
    if (best.at > 0) parts.push({ text: rest.slice(0, best.at), mention: false });
    parts.push({ text: best.tag, mention: true });
    rest = rest.slice(best.at + best.tag.length);
  }
  return parts;
}

/**
 * N-31: a comment box with @mentions. Typing « @ » and a few letters offers the crew mates whose
 * name starts that way; picking one writes « @Name » and remembers who it is.
 */
function Composer({ crewId, itemKey, onSent }: { crewId: string; itemKey: string; onSent: () => void }) {
  const i18n = useT();
  const theme = useTheme();
  const me = useSession((state) => state.session?.userId);
  const crew = useCrewData((state) => state.crews.find((c) => c.id === crewId));
  const labels = useCrewLabels(crewId);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const query = /(?:^|\s)@([^\s@]*)$/.exec(text)?.[1];
  const suggestions =
    query === undefined
      ? []
      : (crew?.members ?? [])
          .filter((m) => m.id !== me)
          .map((m) => ({ id: m.id, label: labels.get(m.id) ?? m.displayName }))
          .filter((m) => m.label.toLocaleLowerCase().startsWith(query.toLocaleLowerCase()))
          .slice(0, 5);
  const pick = (id: string, label: string) => {
    haptic.select();
    setText((t) => `${t.slice(0, t.length - (query?.length ?? 0) - 1)}@${label} `);
    setPicked((p) => (p.includes(id) ? p : [...p, id]));
  };
  const send = () => {
    const body = text.trim();
    if (!body || sending) return;
    // Only names still written in the text count as mentions.
    const mentions = picked.filter((id) => body.includes(`@${labels.get(id) ?? ""}`));
    setSending(true);
    commentOnFeed(crewId, itemKey, body, mentions)
      .then(() => {
        haptic.confirmed();
        setText("");
        setPicked([]);
        onSent();
      })
      .catch(showFailure(i18n))
      .finally(() => setSending(false));
  };
  return (
    <Animated.View entering={FadeIn.duration(duration.enter)} style={styles.composer}>
      {suggestions.length ? (
        <View style={styles.reactions}>
          {suggestions.map((s) => (
            <Chip key={s.id} label={`@${s.label}`} onPress={() => pick(s.id, s.label)} />
          ))}
        </View>
      ) : null}
      <View style={styles.composerRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={i18n.t("feed.commentPlaceholder")}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={i18n.t("feed.comment")}
          maxLength={280}
          multiline
          autoFocus
          style={[styles.input, type.body, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
        />
        <Button label={i18n.t("feed.send")} variant="secondary" height={44} loading={sending} disabled={!text.trim()} onPress={send} />
      </View>
    </Animated.View>
  );
}

function CommentRow({ crewId, comment, canDelete, onChange }: { crewId: string; comment: FeedComment; canDelete: boolean; onChange: () => void }) {
  const i18n = useT();
  const theme = useTheme();
  const labels = useCrewLabels(crewId);
  const me = useSession((state) => state.session?.userId);
  const labelOf = (id: string) => labels.get(id) ?? "?";
  return (
    <View style={styles.comment}>
      <Avatar personId={comment.userId} name={labelOf(comment.userId)} size={26} />
      <Text style={styles.flex}>
        <Text variant="h3">{comment.userId === me ? i18n.t("crew.you") : labelOf(comment.userId)} </Text>
        {mentionParts(comment.text, comment.mentions, labelOf).map((part, index) => (
          <Text key={index} color={part.mention ? theme.amberText : undefined}>
            {part.text}
          </Text>
        ))}
      </Text>
      {canDelete ? (
        <IconButton
          icon="trash"
          size={32}
          accessibilityLabel={i18n.t("feed.deleteComment")}
          onPress={() => void deleteFeedComment(crewId, comment.id).then(onChange).catch(showFailure(i18n))}
        />
      ) : null}
    </View>
  );
}

/** Reactions, comments and the comment box under one line of the feed. */
function Social({ crewId, entry, onChange }: { crewId: string; entry: FeedSocial; onChange: () => void }) {
  const i18n = useT();
  const me = useSession((state) => state.session?.userId);
  const admin = useCrewData((state) => state.crews.find((c) => c.id === crewId)?.role === "admin");
  const [picking, setPicking] = useState(false);
  const [writing, setWriting] = useState(false);
  const [reactions, setReactions] = useState(entry.reactions);
  useEffect(() => setReactions(entry.reactions), [entry.reactions]);

  // Optimistic: the count moves at once and goes back if the server refuses.
  const toggle = (reaction: FeedReaction) => {
    haptic.select();
    setPicking(false);
    const before = reactions;
    const current = before.find((r) => r.reaction === reaction);
    const on = !current?.mine;
    const next = FEED_REACTIONS.map((r) => {
      const was = before.find((x) => x.reaction === r);
      if (r !== reaction) return was;
      const count = (was?.count ?? 0) + (on ? 1 : -1);
      return count > 0 ? { reaction: r, count, mine: on } : undefined;
    }).filter((r): r is NonNullable<typeof r> => r !== undefined);
    setReactions(next);
    reactToFeed(crewId, entry.key, reaction, on)
      .then(onChange)
      .catch((error: unknown) => {
        setReactions(before);
        showFailure(i18n)(error);
      });
  };

  return (
    <View style={styles.social}>
      <View style={styles.reactions}>
        {reactions.map((r) => (
          <Chip
            key={r.reaction}
            label={`${REACTION_EMOJI[r.reaction]} ${i18n.number(r.count)}`}
            selected={r.mine}
            onPress={() => toggle(r.reaction)}
          />
        ))}
        <IconButton icon={picking ? "x" : "plus"} size={36} accessibilityLabel={i18n.t("feed.react")} onPress={() => setPicking((on) => !on)} />
        <IconButton icon="chat" size={36} accessibilityLabel={i18n.t("feed.comment")} onPress={() => setWriting((on) => !on)} />
      </View>
      {picking ? (
        <Animated.View entering={FadeIn.duration(duration.enter)} style={styles.reactions}>
          {FEED_REACTIONS.map((r) => (
            <ScalePressable key={r} accessibilityLabel={i18n.t(`feed.reactionNames.${r}`)} onPress={() => toggle(r)} style={styles.emoji}>
              <Text variant="h2">{REACTION_EMOJI[r]}</Text>
            </ScalePressable>
          ))}
        </Animated.View>
      ) : null}
      {entry.comments.map((comment) => (
        <CommentRow key={comment.id} crewId={crewId} comment={comment} canDelete={comment.userId === me || admin} onChange={onChange} />
      ))}
      {writing ? (
        <Composer
          crewId={crewId}
          itemKey={entry.key}
          onSent={() => {
            setWriting(false);
            onChange();
          }}
        />
      ) : null}
    </View>
  );
}

/** N-31: what the crew did lately, a few grouped lines per night, with reactions and comments. */
export default function FeedScreen() {
  const { crewId } = useLocalSearchParams<{ crewId: string }>();
  const i18n = useT();
  const theme = useTheme();
  const myName = useSession((state) => state.session?.displayName);
  const me = useSession((state) => state.session?.userId);
  const labels = useCrewLabels(crewId);
  const pulse = useFeedPulse((state) => (crewId ? (state[crewId] ?? 0) : 0));
  const [items, setItems] = useState<FeedEntry[] | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const load = useCallback(
    () =>
      fetchFeed(crewId)
        .then((data) => {
          setItems(data.items);
          // The markers were seen with this load: they clear now, the highlight stays until the next one.
          if (data.unseenMentions > 0) void markFeedSeen(crewId).catch(() => undefined);
        })
        .catch(() => setItems((list) => list ?? [])),
    [crewId],
  );
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  // Someone reacted or wrote while the feed is open.
  useEffect(() => {
    if (pulse) void load();
  }, [pulse, load]);

  const nameOf = (id: string | null) => {
    if (!id) return "?";
    // My own name, not "you": every line is a third-person sentence.
    const label = labels.get(id);
    if (id === me && !label) return myName ?? "?";
    return label ?? "?";
  };
  const line = (item: Line): { title: string; onPress?: () => void } => {
    switch (item.kind) {
      case "checkins":
        return { title: i18n.t("feed.checkins", { who: people(item.userIds, nameOf, i18n), venue: item.venueName }) };
      case "photos":
        return {
          title: i18n.plural("feed.photos", item.count, { who: people(item.userIds, nameOf, i18n), party: item.partyName }),
          onPress: () => router.push({ pathname: "/album", params: { partyId: item.partyId } }),
        };
      case "party":
        return { title: i18n.t("feed.party", { who: nameOf(item.by), name: item.name }) };
      case "poll":
        return { title: i18n.t("feed.poll", { who: nameOf(item.by), title: item.title }), onPress: () => router.push({ pathname: "/polls", params: { crewId } }) };
      case "takeover":
        return { title: i18n.t("feed.takeover", { who: nameOf(item.userId), venue: item.venueName }) };
      case "cheat":
        return { title: i18n.t("feed.cheat", { who: nameOf(item.userId), venue: item.venueName }) };
      case "joined":
        return { title: i18n.plural("feed.joined", item.userIds.length, { who: people(item.userIds, nameOf, i18n) }) };
      case "quote":
        return { title: i18n.t("feed.quote", { text: item.text, who: item.saidBy ? nameOf(item.saidBy) : i18n.t("feed.someone") }) };
      case "reactions":
        return {
          title: i18n.plural("feed.reactions", item.count, { party: item.partyName }),
          onPress: () => router.push({ pathname: "/recap", params: { id: item.partyId } }),
        };
    }
  };

  const head = ({ icon, title, at, mentionsMe, onPress, trailing }: { icon: AnyIconName; title: string; at: number; mentionsMe: boolean; onPress?: () => void; trailing?: AnyIconName }) => (
    <ScalePressable pressedScale={0.99} disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? "button" : "text"} accessibilityLabel={title} style={styles.head}>
      <Icon name={icon} color={theme.textMuted} />
      <View style={styles.flex}>
        <Text>{title}</Text>
        <View style={styles.meta}>
          <RelativeTime at={at} />
          {/* N-31: the in-app marker for a mention of me. */}
          {mentionsMe ? <Tag label={i18n.t("feed.mentionedYou")} tone="amber" /> : null}
        </View>
      </View>
      {trailing ? <Icon name={trailing} color={theme.textMuted} /> : null}
    </ScalePressable>
  );

  const renderLine = (item: Line) => {
    const { title, onPress } = line(item);
    return (
      <View key={item.key} style={[styles.item, { borderBottomColor: theme.line }]}>
        {head({ icon: ICONS[item.kind], title, at: item.at, mentionsMe: item.mentionsMe, onPress, trailing: onPress ? "chev" : undefined })}
        <Social crewId={crewId} entry={item} onChange={() => void load()} />
      </View>
    );
  };

  return (
    <Screen back title={i18n.t("feed.title")} onRefresh={load} withToasts>
      {items === null ? <SkeletonRows /> : null}
      {items?.length === 0 ? <EmptyState icon="flame" text={i18n.t("feed.empty")} /> : null}
      {items?.map((item) => {
        if (item.kind !== "digest") return renderLine(item);
        // N-31: a run of the same thing reads as one line; open it to see each one.
        const expanded = open.has(item.key);
        const title = i18n.plural(`feed.digest.${item.of}`, item.count, { who: people(item.userIds, nameOf, i18n) });
        return (
          <View key={item.key} style={[styles.item, { borderBottomColor: theme.line }]}>
            {head({
              icon: ICONS[item.of],
              title,
              at: item.at,
              mentionsMe: item.mentionsMe || item.items.some((i) => i.mentionsMe),
              trailing: expanded ? "arrowup" : "arrowdn",
              onPress: () => {
                haptic.select();
                setOpen((set) => {
                  const next = new Set(set);
                  if (next.has(item.key)) next.delete(item.key);
                  else next.add(item.key);
                  return next;
                });
              },
            })}
            <Social crewId={crewId} entry={item} onChange={() => void load()} />
            {expanded ? (
              <Animated.View entering={FadeIn.duration(duration.enter)} style={[styles.nested, { borderLeftColor: theme.line }]}>
                {item.items.map(renderLine)}
              </Animated.View>
            ) : null}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  item: { paddingVertical: 12, gap: 8, borderBottomWidth: 1 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  social: { gap: 8, paddingLeft: 34 },
  reactions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  emoji: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  comment: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  composer: { gap: 8 },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: radius.input, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 10 },
  nested: { marginLeft: 10, paddingLeft: 12, borderLeftWidth: 2 },
});
