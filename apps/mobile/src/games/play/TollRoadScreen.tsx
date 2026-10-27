import { StyleSheet, View } from "react-native";
import { palette, radius } from "@crew/design-tokens";
import { CHECKPOINTS, createTollRoad, isCustoms, mathRandom, tollRoadReducer, type PlayingCard } from "@crew/games";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Numeral, Text } from "@/ui/Text";
import { useEngine, useGameUi, useWastedIds } from "../hooks";
import { useGameT } from "../i18n";
import { toEnginePlayer } from "../store";
import { EndScreen, topOf } from "../ui/EndScreen";
import { GameShell } from "../ui/GameShell";
import { FlipCard, usePop } from "../ui/motion";
import { PenaltyList } from "../ui/PenaltyList";
import { CardBack, PlayingCardFace, cardName } from "../ui/PlayingCardFace";
import { ids, useTable, type GameScreenProps } from "./common";
import Animated from "react-native-reanimated";

export function TollRoadScreen({ session, content, onAgain }: GameScreenProps) {
  const g = useGameT();
  const ui = useGameUi();
  const theme = useTheme();
  const table = useTable(session);
  const [state, dispatch] = useEngine(() => createTollRoad({ players: session.players.map(toEnginePlayer), level: session.level, rng: mathRandom }), tollRoadReducer);
  const wasted = useWastedIds(table.all);
  const checkpointPop = usePop(state.checkpoint);
  const name = (card: PlayingCard) => cardName(card, g, (rank, suit) => g.t("games.tollRoad.card", { rank, suit }));

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
        <EndScreen gameId={session.gameId} players={table.all} ledger={state.ledger} endReason={state.endReason} startedAt={session.startedAt} record={topOf(state.misses, "records.tollRoad")} onAgain={onAgain} />
      </GameShell>
    );
  }

  const driver = state.order.players[state.order.turn];
  const result = state.phase === "result" ? state.lastResult : null;
  const left = result ? result.from : state.current;
  const customs = isCustoms(state.checkpoint);
  // The booth the driver is at, or the one the last guess was made at.
  const shownCheckpoint = result ? result.checkpoint : state.checkpoint;

  const message = result
    ? result.arrived === "road"
      ? g.t("games.tollRoad.arrived", { name: table.nameOf(result.playerId) })
      : result.arrived === "barrier"
        ? g.t("games.tollRoad.barrier", { name: table.nameOf(result.playerId) })
        : result.hit
          ? g.t("games.tollRoad.hit")
          : g.t("games.tollRoad.miss")
    : customs
      ? g.t("games.tollRoad.promptCustoms")
      : g.t("games.tollRoad.promptRoad", { card: name(state.current) });

  const footer = result ? (
    <Button label={result.arrived ? g.t("games.tollRoad.nextDriver") : g.t("games.tollRoad.next")} height={ui.action} onPress={() => dispatch({ type: "next" })} />
  ) : customs ? (
    <View style={styles.row}>
      <Button label={g.t("games.tollRoad.red")} variant="danger" height={ui.action} style={styles.flex} onPress={() => dispatch({ type: "guess", guess: "red" })} />
      <Button label={g.t("games.tollRoad.black")} variant="secondary" height={ui.action} style={styles.flex} onPress={() => dispatch({ type: "guess", guess: "black" })} />
    </View>
  ) : (
    <View style={styles.row}>
      <Button label={g.t("games.tollRoad.higher")} icon="arrowup" height={ui.action} style={styles.flex} onPress={() => dispatch({ type: "guess", guess: "higher" })} />
      <Button label={g.t("games.tollRoad.lower")} icon="arrowdn" variant="secondary" height={ui.action} style={styles.flex} onPress={() => dispatch({ type: "guess", guess: "lower" })} />
    </View>
  );

  return (
    <GameShell {...shellProps} status={g.t("games.tollRoad.onTheRoad", { name: driver?.name ?? "" })} footer={footer} fab="top">
      <Animated.View style={[styles.booths, checkpointPop]}>
        {Array.from({ length: CHECKPOINTS }, (_, i) => {
          const passed = i < state.checkpoint && !result;
          const here = i === shownCheckpoint;
          // The current booth is inverted, not amber: the primary button keeps the screen's one accent.
          const done = passed || (result !== null && i < shownCheckpoint);
          const bg = here ? theme.text : done ? theme.ok : theme.surfaceRaised;
          const fg = here ? theme.bg : done ? palette.accent.onAccent : theme.textSoft;
          return (
            <View key={i} style={[styles.booth, { backgroundColor: bg, minHeight: ui.big ? 52 : 44 }]} accessible accessibilityLabel={isCustoms(i) ? g.t("games.tollRoad.customs") : g.t("games.tollRoad.booth", { number: i + 1 })}>
              {isCustoms(i) ? (
                <Text variant="tag" color={fg}>
                  {g.t("games.tollRoad.customs")}
                </Text>
              ) : (
                <Numeral size={22} color={fg}>
                  {String(i + 1)}
                </Numeral>
              )}
            </View>
          );
        })}
      </Animated.View>

      <Text variant="h2" accessibilityLiveRegion="polite">
        {message}
      </Text>

      <View style={styles.cards}>
        <View style={styles.cardSlot}>
          <PlayingCardFace card={left} g={g} label={name(left)} size={ui.big ? 88 : 80} />
        </View>
        <FlipCard
          flipped={result !== null}
          style={styles.cardSlot}
          front={<CardBack label={g.t("games.tollRoad.faceDown")} />}
          back={result ? <PlayingCardFace card={result.drawn} g={g} label={name(result.drawn)} size={ui.big ? 88 : 80} /> : <CardBack label={g.t("games.tollRoad.faceDown")} />}
        />
      </View>

      <PenaltyList lines={state.lastPenalties} players={table.all} wasted={wasted} forfeits={content.forfeits} />
      <Text variant="small">{g.plural("shell.penalties", driver ? (state.ledger[driver.id] ?? 0) : 0)}</Text>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  booths: { flexDirection: "row", gap: 6 },
  booth: { flex: 1, borderRadius: radius.buttonSmall - 2, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  cards: { flexDirection: "row", gap: 14, height: 230 },
  cardSlot: { flex: 1 },
  row: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});
