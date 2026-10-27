import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { useT, type Translator } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { api } from "@/server/api";
import { useCrewData } from "@/server/crewData";
import { useSession } from "@/server/session";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Row } from "@/ui/controls";
import { Icon, type AnyIconName } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { SkeletonRows } from "@/ui/Skeleton";
import { Text } from "@/ui/Text";

type FeedItem =
  | { kind: "checkins"; at: number; venueName: string; userIds: string[] }
  | { kind: "photos"; at: number; partyName: string; partyId: string; userIds: string[]; count: number }
  | { kind: "party"; at: number; partyId: string; name: string; by: string }
  | { kind: "poll"; at: number; title: string; by: string }
  | { kind: "takeover"; at: number; venueName: string; userId: string }
  | { kind: "joined"; at: number; userIds: string[] }
  | { kind: "quote"; at: number; partyName: string; text: string; saidBy: string | null }
  | { kind: "reactions"; at: number; partyName: string; partyId: string; count: number };

const ICONS: Record<FeedItem["kind"], AnyIconName> = {
  checkins: "pin",
  photos: "camera",
  party: "glass",
  poll: "cal",
  takeover: "crown",
  joined: "users",
  quote: "chat",
  reactions: "star",
};

/** « Jade », « Jade et Malik », « Jade, Malik et 2 autres ». */
function people(ids: string[], nameOf: (id: string) => string, i18n: Translator): string {
  const names = ids.map(nameOf);
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return i18n.t("feed.two", { a: names[0]!, b: names[1]! });
  return i18n.plural("feed.many", names.length - 2, { a: names[0]!, b: names[1]! });
}

/** N-31: what the crew did lately, a few grouped lines per night. */
export default function FeedScreen() {
  const { crewId } = useLocalSearchParams<{ crewId: string }>();
  const i18n = useT();
  const theme = useTheme();
  const myName = useSession((state) => state.session?.displayName);
  const me = useSession((state) => state.session?.userId);
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const crew = useCrewData((state) => state.crews.find((c) => c.id === crewId));
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const load = useCallback(
    () =>
      api<{ items: FeedItem[] }>(`/v1/crews/${crewId}/feed`)
        .then((data) => setItems(data.items))
        .catch(() => setItems((list) => list ?? [])),
    [crewId],
  );
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const nameOf = (id: string | null) => {
    if (!id) return "?";
    // My own name, not "you": every line is a third-person sentence.
    const m = crew?.members.find((x) => x.id === id);
    if (id === me && !m) return myName ?? "?";
    return m?.nickname ?? m?.displayName ?? "?";
  };
  const when = (at: number) =>
    `${new Intl.DateTimeFormat(i18n.locale, { weekday: "short", day: "numeric", month: "short" }).format(new Date(at))}, ${formatClock(at, i18n.language, hourCycle)}`;
  const line = (item: FeedItem): { title: string; onPress?: () => void } => {
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

  return (
    <Screen back title={i18n.t("feed.title")} onRefresh={load}>
      {items === null ? <SkeletonRows /> : null}
      {items?.length === 0 ? <Text>{i18n.t("feed.empty")}</Text> : null}
      {items?.map((item, index) => {
        const { title, onPress } = line(item);
        return (
          <Row
            key={`${item.kind}-${item.at}-${index}`}
            title={title}
            subtitle={when(item.at)}
            leading={<Icon name={ICONS[item.kind]} color={theme.textMuted} />}
            trailing={onPress ? <Icon name="chev" color={theme.textMuted} /> : undefined}
            onPress={onPress}
            last={index === items.length - 1}
          />
        );
      })}
    </Screen>
  );
}
