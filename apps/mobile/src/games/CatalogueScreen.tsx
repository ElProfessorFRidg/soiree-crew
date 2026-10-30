import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { FlatList, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, ScrollView } from "react-native";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette, radius, space, scaled } from "@crew/design-tokens";
import { filterGames, lockReason, typicalMinutes, type CatalogueFilter, type GameDefinition } from "@crew/games";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { flyHero, HeroSource } from "@/motion/hero";
import { useTheme } from "@/theme";
import { Button, IconButton } from "@/ui/Button";
import { Chip, Segmented } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Numeral, Text } from "@/ui/Text";
import { useGameUi } from "./hooks";
import { useGameT } from "./i18n";
import { useT } from "@/i18n";
import { useGamesStore } from "./store";
import { refreshCrewCards } from "./crewCards";
import { useCrewData } from "@/server/crewData";
import { GameIcon } from "./ui/GameIcon";

const GAP = 12;
const FILTERS: readonly CatalogueFilter[] = ["all", "single_device", "multi_device"];

function Dot({ active }: { active: boolean }) {
  const theme = useTheme();
  // Read on the JS thread: the worklet gets a number, not a call (MOT-14 scale).
  const ms = scaled(250);
  const style = useAnimatedStyle(() => ({ width: withTiming(active ? 18 : 6, { duration: ms, easing: easings.out }) }), [active, ms]);
  return <Animated.View style={[styles.dot, { backgroundColor: active ? theme.amber : theme.lineStrong }, style]} />;
}

function GameCardView({ game, width, height }: { game: GameDefinition; width: number; height: number }) {
  const g = useGameT();
  const tablePlayers = useGamesStore((s) => s.table.length);
  const durations = useGamesStore((s) => s.durations[game.id]);
  const minutes = typicalMinutes(durations ?? []);
  // No table yet (first launch): nothing is locked, the players are picked on the game sheet.
  const lock = tablePlayers > 0 ? lockReason(game, tablePlayers) : null;
  const players = game.minPlayers === game.maxPlayers ? g.plural("catalogue.players", game.minPlayers) : g.t("catalogue.playerRange", { min: game.minPlayers, max: game.maxPlayers });
  const ink = palette.accent.onAccent;
  return (
    <View style={[styles.card, { width, height, backgroundColor: game.colour }]} accessible accessibilityLabel={`${g.t(`games.${game.id}.name`)}. ${g.t(`games.${game.id}.tagline`)} ${players}.`}>
      <View style={styles.tags}>
        {game.tags.map((tag) => (
          <View key={tag} style={styles.tag}>
            <Text variant="tag" color={ink}>
              {g.t(`tags.${tag}`)}
            </Text>
          </View>
        ))}
        {lock?.kind === "needsPlayers" ? (
          <View style={[styles.tag, styles.lockTag]}>
            <Icon name="lock" size={13} color={palette.dark.text} />
            <Text variant="tag" color={palette.dark.text}>
              {g.plural("catalogue.players", lock.min)}
            </Text>
          </View>
        ) : null}
      </View>
      {/* Flat illustration block: the game's own icon, large and faint, on its colour. */}
      <View style={styles.art} pointerEvents="none">
        <GameIcon game={game.id} size={220} color={ink} />
      </View>
      <View style={styles.middle}>
        <Numeral size={game.id === "pointBlank" || game.id === "neverEver" || game.id === "truthDare" ? 48 : 56} color={ink}>
          {g.t(`games.${game.id}.name`)}
        </Numeral>
        <Text color={ink}>{g.t(`games.${game.id}.tagline`)}</Text>
      </View>
      <View style={styles.footer}>
        <View style={styles.flex}>
          <Text variant="h3" color={ink}>
            {players}
          </Text>
          {minutes !== null ? (
            <Text variant="small" color={ink}>
              {g.t("catalogue.typical", { minutes })}
            </Text>
          ) : null}
        </View>
        <View style={[styles.tag, { backgroundColor: palette.accent.onAccent }]}>
          <Text variant="tag" color={palette.dark.text}>
            {g.t("catalogue.oneDevice")}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** O-44: swipeable catalogue with pagination, filter, and a Play button for the game on screen. */
export function CatalogueScreen() {
  const i18n = useT();
  const firstCrew = useCrewData((state) => state.crews[0]?.id);
  useEffect(() => {
    // N-33: the crew's approved cards are ready before a game starts, and stay for offline nights.
    if (firstCrew) void refreshCrewCards(firstCrew).catch(() => undefined);
  }, [firstCrew]);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const g = useGameT();
  const ui = useGameUi();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [filter, setFilter] = useState<CatalogueFilter>("all");
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList<GameDefinition>>(null);
  const games = filterGames(filter);
  const cardWidth = screenWidth - space.screenX * 2;
  const cardHeight = Math.min(400, Math.max(300, screenHeight * 0.44));
  const current = games[Math.min(index, games.length - 1)];

  useEffect(() => {
    setIndex(0);
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [filter]);

  const go = (next: number) => {
    if (games.length === 0) return;
    const target = (next + games.length) % games.length;
    haptic.select();
    setIndex(target);
    list.current?.scrollToIndex({ index: target, animated: true });
  };
  // ADP-09: Play launches the card under the thumb right now, even mid-swipe, not the last settled one.
  const offset = useRef(0);
  const cardAtOffset = () => games[Math.max(0, Math.min(games.length - 1, Math.round(offset.current / (cardWidth + GAP))))];
  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / (cardWidth + GAP));
    if (next !== index) {
      haptic.select();
      setIndex(Math.max(0, Math.min(games.length - 1, next)));
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg, paddingTop: insets.top + space.screenTop }]}>
      {/* Title and position on one line, the shortcuts on their own scrolling row underneath. */}
      <View style={styles.header}>
        <Text variant="h1" accessibilityRole="header">
          {g.t("catalogue.title")}
        </Text>
        {games.length > 0 ? <Text variant="small">{g.t("catalogue.position", { index: Math.min(index, games.length - 1) + 1, count: games.length })}</Text> : null}
      </View>
      {g.language !== "fr" && g.language !== "en" ? (
        <Text variant="small" style={styles.padded}>
          {g.t("catalogue.cardsInEnglish")}
        </Text>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.headerButtons}>
        <Chip label={i18n.t("bar.title")} icon="wine" onPress={() => router.push("/bar")} />
        <Chip label={g.t("crewCards.open")} icon="edit" onPress={() => router.push("/games/cards")} />
        <Chip label={g.t("hall.open")} icon="trophy" onPress={() => router.push("/games/hall")} />
      </ScrollView>
      <View style={styles.padded}>
        <Segmented
          accessibilityLabel={g.t("catalogue.filterLabel")}
          value={filter}
          height={ui.big ? 52 : undefined}
          items={FILTERS.map((value) => ({
            value,
            label: value === "all" ? g.t("catalogue.filterAll") : value === "single_device" ? g.t("catalogue.filterOne") : g.t("catalogue.filterSeveral"),
          }))}
          onChange={(value) => {
            haptic.select();
            setFilter(value);
          }}
        />
      </View>

      {games.length === 0 ? (
        <View style={[styles.padded, styles.empty]}>
          <Text>{g.t("catalogue.emptySeveral")}</Text>
          <Button label={g.t("catalogue.filterAll")} variant="secondary" onPress={() => setFilter("all")} />
        </View>
      ) : (
        <>
          <FlatList
            ref={list}
            data={games}
            keyExtractor={(game) => game.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardWidth + GAP}
            decelerationRate="fast"
            disableIntervalMomentum
            contentContainerStyle={styles.carousel}
            ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
            getItemLayout={(_, i) => ({ length: cardWidth + GAP, offset: (cardWidth + GAP) * i, index: i })}
            onScroll={(event) => {
              offset.current = event.nativeEvent.contentOffset.x;
            }}
            scrollEventThrottle={32}
            onMomentumScrollEnd={onScrollEnd}
            onScrollEndDrag={onScrollEnd}
            style={{ flexGrow: 0 }}
            renderItem={({ item }) => (
              <HeroSource
                heroKey={`game:${item.id}`}
                mode="stretch"
                node={<View style={{ width: cardWidth, height: cardHeight, borderRadius: radius.sheet, backgroundColor: item.colour }} />}
              >
                <GameCardView game={item} width={cardWidth} height={cardHeight} />
              </HeroSource>
            )}
          />
          <View style={[styles.padded, styles.pager]}>
            <IconButton icon="back" accessibilityLabel={g.t("catalogue.previous")} onPress={() => go(index - 1)} />
            <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {games.map((game, i) => (
                <Dot key={game.id} active={i === index} />
              ))}
            </View>
            <IconButton icon="chev" accessibilityLabel={g.t("catalogue.next")} onPress={() => go(index + 1)} />
          </View>
          {current ? (
            <View style={styles.padded}>
              <Button
                label={g.t("catalogue.play")}
                icon="dice"
                height={ui.action}
                accessibilityLabel={`${g.t("catalogue.play")}, ${g.t(`games.${current.id}.name`)}`}
                onPress={() => {
                  const game = cardAtOffset() ?? current;
                  flyHero(`game:${game.id}`);
                  router.push({ pathname: "/games/[gameId]", params: { gameId: game.id } });
                }}
              />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerButtons: { gap: 8, paddingHorizontal: space.screenX, paddingVertical: 4 },
  screen: { flex: 1, gap: space.sectionGap },
  header: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: space.screenX },
  padded: { paddingHorizontal: space.screenX },
  carousel: { paddingHorizontal: space.screenX },
  card: { borderRadius: radius.sheet, padding: 22, justifyContent: "space-between", overflow: "hidden" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 24, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: "rgba(30,38,36,0.14)" },
  lockTag: { backgroundColor: palette.accent.onAccent },
  art: { position: "absolute", right: -24, top: 56, opacity: 0.16 },
  middle: { gap: 8 },
  footer: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  flex: { flex: 1 },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dots: { flexDirection: "row", gap: 5, alignItems: "center", flexShrink: 1, flexWrap: "wrap", justifyContent: "center" },
  dot: { height: 6, borderRadius: 3 },
  empty: { gap: 12 },
});
