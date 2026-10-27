import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { duration, palette } from "@crew/design-tokens";
import { createLocalTransport, createQuickDraw, mathRandom, quickDrawReducer, timeLeftMs } from "@crew/games";
import { haptic } from "@/motion/haptics";
import { useTheme } from "@/theme";
import { Button, IconButton } from "@/ui/Button";
import { ScalePressable } from "@/ui/Pressable";
import { Numeral, Text } from "@/ui/Text";
import { useEngine, useGameUi, useTicker, useWastedIds } from "../hooks";
import { useGameT, type GameMessageKey } from "../i18n";
import { toEnginePlayer } from "../store";
import { DrawingCanvas } from "../ui/DrawingCanvas";
import { EndScreen, topOf } from "../ui/EndScreen";
import { GameShell } from "../ui/GameShell";
import { PenaltyList } from "../ui/PenaltyList";
import { PlayerGrid } from "../ui/PlayerGrid";
import { cardColours, ids, useTable, type GameScreenProps } from "./common";

const COLOURS: readonly { colour: string; name: GameMessageKey }[] = [
  { colour: palette.accent.onAccent, name: "games.quickDraw.colourInk" },
  { colour: "#C2412E", name: "games.quickDraw.colourCoral" },
  { colour: "#2F6F8F", name: "games.quickDraw.colourWater" },
  { colour: "#3E7D4C", name: "games.quickDraw.colourMint" },
  { colour: "#B57A0F", name: "games.quickDraw.colourAmber" },
];

export function QuickDrawScreen({ session, content, onAgain }: GameScreenProps) {
  const g = useGameT();
  const ui = useGameUi();
  const theme = useTheme();
  const table = useTable(session);
  const [state, dispatch] = useEngine(
    () => createQuickDraw({ players: session.players.map(toEnginePlayer), level: session.level, content: content.drawWords, rng: mathRandom }),
    quickDrawReducer,
  );
  const wasted = useWastedIds(table.all);
  // One phone today: the local transport. An online transport replaces it for several phones (O-63).
  const transport = useMemo(() => createLocalTransport(), []);
  const [colour, setColour] = useState(COLOURS[0]?.colour ?? palette.accent.onAccent);
  const [peek, setPeek] = useState(false);
  const drawing = state.phase === "drawing";

  useTicker(drawing, (delta) => dispatch({ type: "tick", deltaMs: delta }), 200);
  useEffect(() => {
    // A new drawer starts on a blank canvas, with the word hidden.
    if (state.phase === "ready") {
      transport.send({ type: "clear" });
      setPeek(false);
    }
    if (state.phase === "found") haptic.confirmed();
    if (state.phase === "timeUp") haptic.error();
  }, [state.phase, state.turnsPlayed, transport]);

  const shellProps = {
    gameId: session.gameId,
    players: table.all,
    activeIds: ids(state.order.players),
    ledger: state.ledger,
    onRemovePlayer: (id: string) => dispatch({ type: "removePlayer", playerId: id }),
    onAddPlayer: (p: Parameters<typeof table.add>[0]) => dispatch({ type: "addPlayer", player: table.add(p) }),
    onStop: () => dispatch({ type: "stop" }),
  };

  if (state.phase === "end") {
    return (
      <GameShell {...shellProps}>
        <EndScreen gameId={session.gameId} players={table.all} ledger={state.ledger} endReason={state.endReason} startedAt={session.startedAt} record={topOf(state.scores, "records.quickDraw")} onAgain={onAgain} />
      </GameShell>
    );
  }

  const drawer = state.order.players[state.order.turn];
  const seconds = Math.ceil(timeLeftMs(state) / 1000);
  let footer = null;
  if (state.phase === "ready") footer = <Button label={g.t("games.quickDraw.start")} height={ui.action} disabled={!peek} onPress={() => dispatch({ type: "start" })} />;
  else if (state.phase === "found" || state.phase === "timeUp") footer = <Button label={g.t("games.quickDraw.next")} height={ui.action} onPress={() => dispatch({ type: "next" })} />;

  return (
    <GameShell {...shellProps} status={g.t("games.quickDraw.drawerTurn", { name: drawer?.name ?? "" })} footer={footer} fab="top" scroll={!drawing}>
      {state.phase === "ready" ? (
        <>
          <ScalePressable
            accessibilityLabel={g.t("games.quickDraw.peek")}
            onPress={() => setPeek((p) => !p)}
            style={[styles.word, { backgroundColor: peek ? palette.dark.text : theme.surfaceRaised, minHeight: ui.big ? 160 : 140 }]}
          >
            {peek ? (
              <>
                <Text variant="small" color={cardColours.muted}>
                  {g.t("games.quickDraw.word")}
                </Text>
                <Numeral size={state.word.length > 16 ? 34 : 46} color={palette.accent.onAccent}>
                  {state.word}
                </Numeral>
              </>
            ) : (
              <Text variant="h3" color={theme.textSoft}>
                {g.t("games.quickDraw.peek")}
              </Text>
            )}
          </ScalePressable>
          {peek && state.swapsLeft > 0 ? <Button label={g.t("games.quickDraw.swap")} variant="secondary" height={ui.secondary} onPress={() => dispatch({ type: "swapWord" })} /> : null}
        </>
      ) : null}

      {state.phase !== "ready" ? (
        <>
          <View style={styles.timerRow}>
            <Numeral size={34} color={seconds <= 10 && drawing ? theme.danger : theme.text}>
              {g.t("shell.timeLeft", { seconds })}
            </Numeral>
            <View style={styles.tools}>
              <IconButton icon="undo" accessibilityLabel={g.t("games.quickDraw.undo")} onPress={() => transport.send({ type: "undo" })} />
              <Button label={g.t("games.quickDraw.clear")} variant="secondary" height={44} onPress={() => transport.send({ type: "clear" })} />
            </View>
          </View>
          <DrawingCanvas transport={transport} colour={colour} width={ui.big ? 0.022 : 0.016} enabled={drawing} accessibilityLabel={g.t("games.quickDraw.canvas")} height={ui.big ? 240 : state.order.players.length > 4 ? 260 : 320} />
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
                style={[styles.swatch, { width: ui.big ? 56 : 44, height: ui.big ? 56 : 44, backgroundColor: item.colour, borderColor: colour === item.colour ? theme.text : "transparent" }]}
              >
                <View />
              </ScalePressable>
            ))}
          </View>
        </>
      ) : null}

      {drawing ? (
        <>
          <Text variant="h3">{g.t("games.quickDraw.whoFound")}</Text>
          <PlayerGrid players={state.order.players.filter((p) => p.id !== drawer?.id)} onPress={(id) => dispatch({ type: "found", guesserId: id })} />
        </>
      ) : null}

      {state.phase === "found" || state.phase === "timeUp" ? (
        <Animated.View entering={FadeIn.duration(duration.enter)} style={styles.block}>
          <Text variant="h2">
            {state.phase === "found" ? g.t("games.quickDraw.found", { name: table.nameOf(state.guesserId) }) : g.t("games.quickDraw.timeUp")}
          </Text>
          <Text>{g.t("games.quickDraw.itWas", { word: state.word })}</Text>
          <PenaltyList lines={state.lastPenalties} players={table.all} wasted={wasted} forfeits={content.forfeits} />
        </Animated.View>
      ) : null}
    </GameShell>
  );
}

const styles = StyleSheet.create({
  word: { borderRadius: 24, alignItems: "center", justifyContent: "center", gap: 6, padding: 20 },
  timerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  tools: { flexDirection: "row", alignItems: "center", gap: 8 },
  colours: { flexDirection: "row", gap: 10, justifyContent: "center" },
  swatch: { borderRadius: 999, borderWidth: 3 },
  block: { gap: 10 },
});
