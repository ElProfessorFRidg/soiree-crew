import { router } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import { avatarColor, palette, radius, space } from "@crew/design-tokens";
import { unreadCount, useChat, type Conversation } from "@/chat/store";
import { useT, type Translator } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { haptic } from "@/motion/haptics";
import { respondToParty, type Crew, type Party } from "@/server/crewData";
import { useSession } from "@/server/session";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { initials } from "@/ui/Avatar";
import { Button, IconButton } from "@/ui/Button";
import { Panel, Row, Segmented, Tag } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { LiveDot } from "@/ui/LiveDot";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { addPartyToCalendar } from "./calendar";
import { CrewCard } from "./CrewCard";
import { crewErrorMessage } from "./invite";
import { moodIcon } from "./moods";
import { RadarSection } from "./RadarSection";

export function partyWhen(party: Party, i18n: Translator, hourCycle: "h12" | "h23"): string {
  const day = new Intl.DateTimeFormat(i18n.locale, { weekday: "long", day: "numeric", month: "long" }).format(new Date(party.startsAt));
  return `${day}, ${formatClock(party.startsAt, i18n.language, hourCycle)}`;
}

/** MSG-01: every unread message across conversations, muted ones left out; for the chat button's badge. */
export function useUnreadTotal(): number {
  const conversations = useChat((s) => s.conversations);
  // Subscribed so the total follows new messages and reads; unreadCount reads the same store.
  useChat((s) => s.messages);
  const quiet = useChat((s) => s.meta.quiet);
  useChat((s) => s.meta.lastRead);
  const me = useSession((s) => s.session?.userId ?? "");
  return conversations.reduce((total, c) => total + (quiet?.includes(c.id) ? 0 : unreadCount(c.id, me)), 0);
}

/** The next night of this crew I am going to: going or not in one tap, the calendar, the party. */
function NextParty({ crew, upcoming }: { crew: Crew; upcoming: Party[] }) {
  const i18n = useT();
  const theme = useTheme();
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const [next, ...later] = upcoming;
  const title = (party: Party) => party.name || i18n.t(`newParty.moods.${party.mood}`);
  return (
    <View style={styles.block}>
      <Text variant="label">{i18n.t("crewHub.nextParty")}</Text>
      {next ? (
        <Panel>
          <View style={styles.titleRow}>
            {next.live ? <LiveDot size={10} /> : <Icon name={moodIcon(next.mood)} color={theme.amber} />}
            <View style={styles.flex}>
              <Text variant="h3">{title(next)}</Text>
              <Text variant="small">{partyWhen(next, i18n, hourCycle)}</Text>
            </View>
            {!next.live && Platform.OS !== "web" ? (
              <IconButton icon="cal" accessibilityLabel={i18n.t("crew.addToCalendar")} onPress={() => void addPartyToCalendar(next, crew.name, i18n)} />
            ) : null}
          </View>
          <Segmented<"going" | "declined" | "invited">
            accessibilityLabel={title(next)}
            value={next.myResponse}
            items={[
              { value: "going", label: i18n.t("crew.going") },
              { value: "declined", label: i18n.t("crew.declined") },
            ]}
            onChange={(response) => {
              if (response === "invited") return;
              haptic.select();
              respondToParty(next.id, response).catch((error: unknown) => showToast({ tone: "danger", message: crewErrorMessage(error, i18n) }));
            }}
          />
          <Button label={i18n.t("crewHub.openParty")} variant="outline" height={44} onPress={() => router.push({ pathname: "/live", params: { id: next.id } })} />
        </Panel>
      ) : (
        <Text muted>{i18n.t("crewHub.noParty")}</Text>
      )}
      {later.length ? (
        <View>
          {later.map((party, index) => (
            <Row
              key={party.id}
              title={title(party)}
              subtitle={partyWhen(party, i18n, hourCycle)}
              leading={party.live ? <LiveDot size={10} /> : <Icon name={moodIcon(party.mood)} color={theme.textMuted} />}
              trailing={
                !party.live && Platform.OS !== "web" ? (
                  <IconButton icon="cal" accessibilityLabel={i18n.t("crew.addToCalendar")} onPress={() => void addPartyToCalendar(party, crew.name, i18n)} />
                ) : (
                  <Icon name="chev" color={theme.textMuted} />
                )
              }
              onPress={() => router.push({ pathname: "/live", params: { id: party.id } })}
              last={index === later.length - 1}
            />
          ))}
        </View>
      ) : null}
      <Button label={i18n.t("crew.newParty")} icon="plus" height={56} onPress={() => router.push({ pathname: "/new-party", params: { crewId: crew.id } })} />
    </View>
  );
}

/** Groups get a rounded square, as in the messages list. */
function ConversationMark({ conversation }: { conversation: Conversation }) {
  return (
    <View style={[styles.square, { backgroundColor: avatarColor(conversation.id) }]}>
      <Text variant="h3" color={palette.accent.onAccent} style={styles.squareText}>
        {initials(conversation.title)}
      </Text>
    </View>
  );
}

/** The crew's chat and its parties' chats, with what is unread; new direct chats start from here too. */
function CrewDiscussions({ crewId }: { crewId: string }) {
  const i18n = useT();
  const theme = useTheme();
  const conversations = useChat((s) => s.conversations);
  useChat((s) => s.messages);
  useChat((s) => s.meta.lastRead);
  const quiet = useChat((s) => s.meta.quiet);
  const me = useSession((s) => s.session?.userId ?? "");
  const list = conversations
    .filter((c) => c.crewId === crewId && (c.kind === "crew" || (c.kind === "party" && !c.readOnly)))
    .sort((a, b) => (a.kind === "crew" ? -1 : b.kind === "crew" ? 1 : (b.lastAt ?? 0) - (a.lastAt ?? 0)));
  return (
    <View style={styles.block}>
      <Text variant="label">{i18n.t("crewHub.discussions")}</Text>
      {list.length ? (
        <View>
          {list.map((c, index) => {
            const unread = quiet?.includes(c.id) ? 0 : unreadCount(c.id, me);
            return (
              <Row
                key={c.id}
                title={c.title}
                subtitle={c.kind === "crew" ? i18n.t("crewHub.crewChat") : i18n.t("crewHub.partyChat")}
                leading={<ConversationMark conversation={c} />}
                trailing={
                  <View style={styles.side}>
                    {unread ? <Tag tone="amber" label={i18n.plural("crewHub.unread", unread)} /> : null}
                    <Icon name="chev" color={theme.textMuted} />
                  </View>
                }
                accessibilityLabel={unread ? `${c.title}, ${i18n.plural("crewHub.unread", unread)}` : c.title}
                onPress={() => router.push({ pathname: "/chat/[id]", params: { id: c.id } })}
                last={index === list.length - 1}
              />
            );
          })}
        </View>
      ) : (
        <Text muted>{i18n.t("crewHub.noDiscussion")}</Text>
      )}
      <View style={styles.pair}>
        <Button label={i18n.t("crewHub.newDiscussion")} icon="plus" variant="secondary" height={44} style={styles.flex} onPress={() => router.push("/chat/new")} />
        <Button label={i18n.t("crewHub.allDiscussions")} icon="chat" variant="outline" height={44} style={styles.flex} onPress={() => router.push("/messages")} />
      </View>
    </View>
  );
}

/** The selected crew's page: its radar, next night, chats, then the crew card itself. */
export function CrewPage({ crew, upcoming }: { crew: Crew; upcoming: Party[] }) {
  return (
    <View style={styles.page}>
      <RadarSection crewId={crew.id} />
      <NextParty crew={crew} upcoming={upcoming} />
      <CrewDiscussions crewId={crew.id} />
      <CrewCard crew={crew} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.sectionGap },
  block: { gap: space.blockGap },
  flex: { flex: 1 },
  pair: { flexDirection: "row", gap: 10 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  side: { flexDirection: "row", alignItems: "center", gap: 8 },
  square: { width: 38, height: 38, borderRadius: radius.buttonSmall, alignItems: "center", justifyContent: "center" },
  squareText: { fontSize: 14, lineHeight: 17 },
});
