import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { duration, palette, radius, size, space } from "@crew/design-tokens";
import { GAME_LEVELS, GRIBOUILLE_MIN_PLAYERS, isGribouilleLanguage, type GameLevel, type GribouilleLanguage, type GribouilleView } from "@crew/games";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { useCrewData } from "@/server/crewData";
import { ApiError } from "@/server/api";
import { onLiveHint } from "@/server/liveHints";
import { gribouille, type OpenRoom } from "@/server/gribouilleData";
import { useSession } from "@/server/session";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button, IconButton } from "@/ui/Button";
import { Copyable } from "@/ui/Copyable";
import { Row, Segmented } from "@/ui/controls";
import { inputText } from "@/ui/inputText";
import { ScalePressable } from "@/ui/Pressable";
import { showToast } from "@/ui/Toast";
import { Numeral, Text } from "@/ui/Text";
import { useGameUi } from "../hooks";
import { useGameT, type GameMessageKey } from "../i18n";
import type { TablePlayer } from "../store";
import { DrawingCanvas } from "../ui/DrawingCanvas";
import { GameShell } from "../ui/GameShell";
import { useGribouilleRoom } from "./useGribouilleRoom";

const RULES: readonly GameMessageKey[] = ["games.quickDraw.online.rule1", "games.quickDraw.online.rule2", "games.quickDraw.online.rule3"];

const COLOURS: readonly { colour: string; name: GameMessageKey }[] = [
  { colour: palette.accent.onAccent, name: "games.quickDraw.colourInk" },
  { colour: "#C2412E", name: "games.quickDraw.colourCoral" },
  { colour: "#2F6F8F", name: "games.quickDraw.colourWater" },
  { colour: "#3E7D4C", name: "games.quickDraw.colourMint" },
  { colour: "#B57A0F", name: "games.quickDraw.colourAmber" },
];

const ERRORS: Record<string, GameMessageKey> = {
  not_found: "games.quickDraw.online.errNotFound",
  started: "games.quickDraw.online.errStarted",
  full: "games.quickDraw.online.errFull",
};

function useErrorText() {
  const g = useGameT();
  return (error: unknown): string => {
    const code = error instanceof ApiError && error.failure.kind === "http" ? error.failure.code : "";
    return g.t(ERRORS[code] ?? "games.quickDraw.online.errGeneric");
  };
}

/** O-63 online: the entry (create, join with a code, a lobby of my crew), then the room. */
export function GribouilleScreen() {
  const [view, setView] = useState<GribouilleView | null>(null);
  const me = useSession((s) => s.session?.userId ?? "");
  if (!view) return <Entry onEnter={setView} />;
  return <Room key={view.id} initial={view} me={me} onLeft={() => setView(null)} />;
}

function Entry({ onEnter }: { onEnter: (view: GribouilleView) => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const i18n = useT();
  const g = useGameT();
  const ui = useGameUi();
  const errorText = useErrorText();
  const language = useAppStore((s) => s.preferences.language);
  const crews = useCrewData((s) => s.crews);
  const [level, setLevel] = useState<GameLevel>("normal");
  const [rounds, setRounds] = useState(2);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<OpenRoom[]>([]);

  const loadOpen = useCallback(() => {
    gribouille
      .open()
      .then(setOpen)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    loadOpen();
    return onLiveHint((hint) => {
      if (hint === "gribouille.changed" || hint === "open") loadOpen();
    });
  }, [loadOpen]);

  const run = async (action: () => Promise<GribouilleView>) => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await action();
      haptic.confirmed();
      onEnter(next);
    } catch (error) {
      haptic.error();
      showToast({ message: errorText(error), tone: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const lang: GribouilleLanguage = isGribouilleLanguage(language) ? language : "en";
  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + space.screenTop, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.top}>
          <IconButton icon="back" accessibilityLabel={i18n.t("common.back")} onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/games"))} />
          <Text variant="h3" accessibilityRole="header" style={styles.flex} align="center">
            {g.t("games.quickDraw.name")}
          </Text>
          <View style={styles.spacer} />
        </View>
        <Text variant="h2">{g.t("games.quickDraw.online.lobby")}</Text>
        <Text>{g.t("games.quickDraw.online.playHint")}</Text>

        <Segmented
          accessibilityLabel={g.t("levels.label")}
          value={level}
          height={ui.big ? 56 : size.segmentedItem}
          items={GAME_LEVELS.map((item) => ({ value: item, label: g.t(`levels.${item}`) }))}
          onChange={(next) => {
            haptic.select();
            setLevel(next);
          }}
        />
        <Text variant="label">{g.t("games.quickDraw.online.roundsLabel")}</Text>
        <Segmented
          accessibilityLabel={g.t("games.quickDraw.online.roundsLabel")}
          value={rounds}
          height={ui.big ? 56 : size.segmentedItem}
          items={[1, 2, 3].map((n) => ({ value: n, label: g.plural("games.quickDraw.online.roundsValue", n) }))}
          onChange={(next) => {
            haptic.select();
            setRounds(next);
          }}
        />
        <Button
          label={g.t("games.quickDraw.online.create")}
          height={ui.action}
          loading={busy}
          onPress={() => run(() => gribouille.create({ crewId: crews[0]?.id ?? null, language: lang, level, rounds }))}
        />

        {open.length > 0 ? (
          <>
            <Text variant="label">{g.t("games.quickDraw.online.crewRooms")}</Text>
            <View>
              {open.map((room, index) => (
                <Row
                  key={room.id}
                  title={g.t("games.quickDraw.online.roomOf", { name: room.host })}
                  subtitle={`${g.t(`levels.${room.level}`)}, ${g.plural("games.quickDraw.online.playersIn", room.players)}`}
                  leading={<Avatar personId={room.id} name={room.host} />}
                  trailing={<Button label={g.t("games.quickDraw.online.join")} variant="secondary" height={44} onPress={() => run(() => gribouille.join(room.code))} />}
                  last={index === open.length - 1}
                />
              ))}
            </View>
          </>
        ) : null}

        <Text variant="label">{g.t("games.quickDraw.online.codeLabel")}</Text>
        <View style={styles.codeRow}>
          <TextInput
            value={code}
            onChangeText={(text) => setCode(text.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
            placeholder={g.t("games.quickDraw.online.codePlaceholder")}
            placeholderTextColor={theme.textMuted}
            accessibilityLabel={g.t("games.quickDraw.online.codeLabel")}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => code.length === 4 && run(() => gribouille.join(code))}
            style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
          />
          <Button label={g.t("games.quickDraw.online.join")} variant="secondary" disabled={code.length !== 4 || busy} onPress={() => run(() => gribouille.join(code))} />
        </View>
      </ScrollView>
    </View>
  );
}

function Room({ initial, me, onLeft }: { initial: GribouilleView; me: string; onLeft: () => void }) {
  const g = useGameT();
  const ui = useGameUi();
  const theme = useTheme();
  const errorText = useErrorText();
  const link = useGribouilleRoom(initial, me);
  const { room, transport } = link;
  const turn = room.turn;
  const isHost = room.hostId === me;
  const isDrawer = turn?.drawerId === me && room.phase === "drawing";
  const mine = room.players.find((p) => p.id === me);
  const nameOf = useCallback((id: string) => room.players.find((p) => p.id === id)?.name ?? "", [room.players]);
  const [colour, setColour] = useState(COLOURS[0]?.colour ?? palette.accent.onAccent);
  const [now, setNow] = useState(Date.now());
  const [guess, setGuess] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (room.phase !== "drawing") return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [room.phase]);

  // The room is gone: tell the player, then back to the entry.
  useEffect(() => {
    if (link.gone) {
      showToast({ message: g.t("games.quickDraw.online.errNotFound"), tone: "danger" });
      onLeft();
    }
  }, [link.gone, g, onLeft]);

  // A new turn, a found word: a small physical answer.
  const myFound = Boolean(mine?.guessed);
  useEffect(() => {
    if (myFound) haptic.confirmed();
  }, [myFound]);
  useEffect(() => {
    if (room.phase === "drawing" && isDrawer) haptic.select();
  }, [turn?.index, room.phase, isDrawer]);

  const tablePlayers: TablePlayer[] = useMemo(() => room.players.map((p) => ({ id: p.id, name: p.name, noAlcohol: false, guest: false, crewMemberId: p.id })), [room.players]);
  const activeIds = useMemo(() => new Set(room.players.filter((p) => !p.left).map((p) => p.id)), [room.players]);

  const leave = () => {
    void gribouille.leave(room.id).catch(() => undefined);
    onLeft();
    router.replace("/(tabs)/games");
  };

  const act = async (action: () => Promise<GribouilleView>) => {
    try {
      link.apply(await action());
    } catch (error) {
      haptic.error();
      showToast({ message: errorText(error), tone: "danger" });
      void link.refresh();
    }
  };

  const secondsLeft = turn && room.phase === "drawing" ? Math.max(0, Math.ceil((turn.startedAt + turn.timeLimitMs - (now + link.clockOffset())) / 1000)) : 0;

  const send = async () => {
    const text = guess.trim();
    if (!text || sending) return;
    setSending(true);
    setGuess("");
    try {
      const answer = await gribouille.guess(room.id, text);
      if (answer.result === "close") showToast({ message: g.t("games.quickDraw.online.closeOne") });
      void link.refresh();
    } catch (error) {
      setGuess(text);
      showToast({ message: errorText(error), tone: "danger" });
    } finally {
      setSending(false);
    }
  };

  const shell = {
    gameId: "quickDraw" as const,
    players: tablePlayers,
    activeIds,
    ledger: {},
    rules: RULES,
    playerNote: (id: string) => g.plural("games.quickDraw.points", room.players.find((p) => p.id === id)?.score ?? 0),
    onStop: leave,
  };

  // Lobby
  if (room.phase === "lobby") {
    const missing = Math.max(0, GRIBOUILLE_MIN_PLAYERS - room.players.filter((p) => p.connected).length);
    return (
      <GameShell
        {...shell}
        status={g.t("games.quickDraw.online.lobby")}
        fab="none"
        footer={
          isHost ? (
            <Button label={g.t("games.quickDraw.online.start")} height={ui.action} disabled={missing > 0} onPress={() => act(() => gribouille.start(room.id))} />
          ) : (
            <Text align="center">{g.t("games.quickDraw.online.waitHost", { name: nameOf(room.hostId) })}</Text>
          )
        }
      >
        {link.offline ? <Offline /> : null}
        <View style={[styles.codeCard, { backgroundColor: palette.dark.text }]}>
          <Text variant="small" color={palette.light.textMuted}>
            {g.t("games.quickDraw.online.shareCode")}
          </Text>
          <Copyable value={room.code}>
            <Numeral size={ui.big ? 64 : 54} color={palette.accent.onAccent}>
              {room.code}
            </Numeral>
          </Copyable>
        </View>
        <Text variant="label">{g.plural("games.quickDraw.online.playersIn", room.players.length)}</Text>
        <View>
          {room.players.map((p, index) => (
            <Row
              key={p.id}
              title={p.id === me ? `${p.name} (${g.t("games.quickDraw.online.you")})` : p.name}
              subtitle={p.connected ? undefined : g.t("games.quickDraw.online.offlineTag")}
              leading={<Avatar personId={p.id} name={p.name} faded={!p.connected} />}
              last={index === room.players.length - 1}
            />
          ))}
        </View>
        {missing > 0 ? <Text>{g.plural("games.quickDraw.online.needPlayers", missing)}</Text> : null}
        <Text variant="small">{`${g.plural("games.quickDraw.online.roundsValue", room.rounds)}, ${g.t(`levels.${room.level}`)}`}</Text>
      </GameShell>
    );
  }

  // End
  if (room.phase === "end") {
    const top = room.ranking[0];
    return (
      <GameShell {...shell} status={g.t("games.quickDraw.online.resultsTitle")} fab="top" footer={<Button label={g.t("shell.stop")} height={ui.action} onPress={leave} />}>
        {top ? (
          <Animated.View entering={FadeIn.duration(duration.enter)} style={styles.block}>
            <Text variant="h2">{g.t("games.quickDraw.online.winner", { name: top.name })}</Text>
            <Text variant="label">{g.t("games.quickDraw.online.resultsTitle")}</Text>
          </Animated.View>
        ) : null}
        <View>
          {room.ranking.map((p, index) => (
            <Row
              key={p.id}
              title={`${p.place}. ${p.name}`}
              leading={<Avatar personId={p.id} name={p.name} />}
              trailing={<Numeral size={28}>{String(p.score)}</Numeral>}
              last={index === room.ranking.length - 1}
            />
          ))}
        </View>
      </GameShell>
    );
  }

  // Drawing and reveal share one canvas, so the picture stays up between the two.
  if (!turn) return null;
  const drawerName = nameOf(turn.drawerId);
  const revealing = room.phase === "reveal";
  const found = room.players.filter((p) => p.guessed && p.id !== turn.drawerId);
  const guessing = !isDrawer && !revealing;
  const showMask = guessing && !myFound;

  let footer = null;
  if (guessing && !myFound) {
    footer = (
      <View style={styles.guessRow}>
        <TextInput
          value={guess}
          onChangeText={setGuess}
          placeholder={g.t("games.quickDraw.online.guessPlaceholder")}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={g.t("games.quickDraw.online.guessPlaceholder")}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="send"
          maxLength={40}
          onSubmitEditing={send}
          blurOnSubmit={false}
          style={[styles.input, styles.flex, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
        />
        <Button label={g.t("games.quickDraw.online.send")} height={size.input} disabled={!guess.trim() || sending} onPress={send} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <GameShell
        {...shell}
        status={isDrawer ? g.t("games.quickDraw.online.youDraw") : g.t("games.quickDraw.online.drawerLine", { name: drawerName })}
        fab="top"
        scroll={false}
        footer={footer}
      >
        {link.offline ? <Offline /> : null}
        <View key="head" style={styles.head}>
          <Text variant="small">{g.t("games.quickDraw.online.turnLine", { index: turn.index + 1, total: turn.total })}</Text>
          {revealing ? null : (
            <Numeral size={34} color={secondsLeft <= 10 ? theme.danger : theme.text}>
              {g.t("shell.timeLeft", { seconds: secondsLeft })}
            </Numeral>
          )}
        </View>

        {isDrawer && turn.word ? (
          <View key="word" style={[styles.wordCard, { backgroundColor: palette.dark.text }]}>
            <View style={styles.flex}>
              <Text variant="small" color={palette.light.textMuted}>
                {g.t("games.quickDraw.online.yourWord")}
              </Text>
              <Numeral size={turn.word.length > 16 ? 26 : 34} color={palette.accent.onAccent}>
                {turn.word}
              </Numeral>
            </View>
            {turn.swapsLeft > 0 && transport.sentCount() === 0 && found.length === 0 ? (
              <Button label={g.t("games.quickDraw.swap")} variant="secondary" height={44} onPress={() => act(() => gribouille.swap(room.id))} />
            ) : null}
          </View>
        ) : null}

        {showMask ? (
          <Text key="mask" variant="h2" align="center" style={styles.mask}>
            {turn.mask.join(" ")}
          </Text>
        ) : null}

        {guessing && myFound && turn.word ? (
          <Text key="found" variant="h3" align="center">
            {g.t("games.quickDraw.online.youFound", { word: turn.word, points: room.turn?.gained[me] ?? 0 })}
          </Text>
        ) : null}

        {revealing ? (
          <Animated.View key="reveal" entering={FadeIn.duration(duration.enter)} style={styles.block}>
            <Text variant="h2">{turn.word ? g.t("games.quickDraw.itWas", { word: turn.word }) : ""}</Text>
            <Text>{g.t(turn.endReason === "allFound" ? "games.quickDraw.online.endAllFound" : turn.endReason === "drawerGone" ? "games.quickDraw.online.endDrawerGone" : "games.quickDraw.online.endTimeUp")}</Text>
            {Object.entries(turn.gained).map(([id, points]) => (
              <Text key={id} variant="small">
                {nameOf(id)} +{points}
              </Text>
            ))}
          </Animated.View>
        ) : null}

        <DrawingCanvas
          key="canvas"
          transport={transport}
          colour={colour}
          width={ui.big ? 0.022 : 0.016}
          enabled={isDrawer}
          accessibilityLabel={g.t("games.quickDraw.canvas")}
          height={ui.big ? 240 : room.players.length > 5 ? 250 : 300}
        />

        {isDrawer ? (
          <View key="tools" style={styles.tools}>
            <View style={styles.colours}>
              {COLOURS.map((item) => (
                <ScalePressable
                  key={item.colour}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: colour === item.colour }}
                  accessibilityLabel={g.t("games.quickDraw.colour", { name: g.t(item.name) })}
                  onPress={() => {
                    haptic.select();
                    setColour(item.colour);
                  }}
                  style={[styles.swatch, { width: ui.big ? 52 : 40, height: ui.big ? 52 : 40, backgroundColor: item.colour, borderColor: colour === item.colour ? theme.text : "transparent" }]}
                >
                  <View />
                </ScalePressable>
              ))}
            </View>
            <IconButton icon="undo" accessibilityLabel={g.t("games.quickDraw.undo")} onPress={() => transport.send({ type: "undo" })} />
            <Button label={g.t("games.quickDraw.clear")} variant="secondary" height={44} onPress={() => transport.send({ type: "clear" })} />
          </View>
        ) : null}

        {isDrawer && found.length > 0 ? <Text variant="small">{found.map((p) => p.name).join(", ")}</Text> : null}
        {guessing && myFound ? <Text variant="small">{g.t("games.quickDraw.online.waitingOthers")}</Text> : null}

        {guessing ? (
          <View key="feed" style={styles.feed}>
            {room.feed.slice(-4).map((line) => (
              <Text key={line.id} variant="small" color={line.kind === "found" ? theme.ok : undefined}>
                {line.kind === "found"
                  ? g.t("games.quickDraw.online.feedFound", { name: nameOf(line.userId) })
                  : line.text
                    ? g.t("games.quickDraw.online.feedGuess", { name: nameOf(line.userId), text: line.text })
                    : g.t("games.quickDraw.online.feedHidden", { name: nameOf(line.userId) })}
              </Text>
            ))}
          </View>
        ) : null}
      </GameShell>
    </KeyboardAvoidingView>
  );
}

function Offline() {
  const g = useGameT();
  return (
    <View style={[styles.offline, { backgroundColor: palette.tint.amberBg }]} accessibilityLiveRegion="polite">
      <Text color={palette.tint.amberTextStrong}>{g.t("games.quickDraw.online.reconnecting")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: space.screenX, gap: space.sectionGap },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  spacer: { width: size.iconButton },
  codeRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { minHeight: size.input, borderRadius: radius.input, borderWidth: 1.5, paddingHorizontal: 14, ...inputText({ fontSize: 16, fontFamily: "Archivo-Medium" }) },
  codeCard: { borderRadius: 24, padding: 22, gap: 8, alignItems: "center" },
  block: { gap: 6 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  wordCard: { borderRadius: radius.card, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  mask: { letterSpacing: 2 },
  tools: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  colours: { flexDirection: "row", gap: 8, flex: 1 },
  swatch: { borderRadius: 999, borderWidth: 3 },
  feed: { gap: 2 },
  guessRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  offline: { borderRadius: radius.tile, padding: 12 },
});
