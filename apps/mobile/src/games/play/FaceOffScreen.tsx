import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { duration, palette } from "@crew/design-tokens";
import { createFaceOff, faceOffReducer, handValue, mathRandom, type PlayingCard } from "@crew/games";
import { haptic } from "@/motion/haptics";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { Text } from "@/ui/Text";
import { useEngine, useGameUi, useWastedIds } from "../hooks";
import { useGameT } from "../i18n";
import { toEnginePlayer } from "../store";
import { EndScreen, topOf } from "../ui/EndScreen";
import { GameShell } from "../ui/GameShell";
import { FlipCard } from "../ui/motion";
import { PenaltyList } from "../ui/PenaltyList";
import { PlayingCardFace, cardName } from "../ui/PlayingCardFace";
import { cardColours, ids, useTable, type GameScreenProps } from "./common";

export function FaceOffScreen({ session, content, onAgain }: GameScreenProps) {
  const g = useGameT();
  const ui = useGameUi();
  const table = useTable(session);
  const [state, dispatch] = useEngine(() => createFaceOff({ players: session.players.map(toEnginePlayer), level: session.level, rng: mathRandom }), faceOffReducer);
  const wasted = useWastedIds(table.all);
  const [faceUp, setFaceUp] = useState(false);
  const [turning, setTurning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const shellProps = {
    gameId: session.gameId,
    players: table.all,
    activeIds: ids(state.players),
    ledger: state.ledger,
    onRemovePlayer: (id: string) => dispatch({ type: "removePlayer", playerId: id }),
    onStop: () => dispatch({ type: "stop" }),
  };

  if (state.phase === "end") {
    return (
      <GameShell {...shellProps}>
        <EndScreen gameId={session.gameId} players={table.all} ledger={state.ledger} endReason={state.endReason} startedAt={session.startedAt} record={topOf(state.roundsLost, "records.faceOff")} onAgain={onAgain} />
      </GameShell>
    );
  }

  const [top, bottom] = state.players;
  const reveal = () => {
    haptic.select();
    dispatch({ type: "reveal" });
    setFaceUp(true);
  };
  const next = () => {
    // Cards turn face down first; new hands are dealt only once they are hidden.
    setFaceUp(false);
    setTurning(true);
    timer.current = setTimeout(() => {
      dispatch({ type: "next" });
      setTurning(false);
    }, duration.flip + 30);
  };

  const result = state.result;
  const line = result ? (result.loserId ? g.t("games.faceOff.loses", { name: table.nameOf(result.loserId), gap: result.gap }) : g.t("games.faceOff.tie")) : "";

  const hand = (cards: readonly PlayingCard[], back: string) => (
    <View style={styles.hand}>
      {cards.map((card, i) => (
        <FlipCard
          key={i}
          flipped={faceUp}
          style={[styles.card, { height: ui.big ? 170 : 150 }]}
          front={
            <View style={[styles.back, { backgroundColor: back }]}>
              <Icon name="dice" size={44} color={palette.accent.onAccent} />
            </View>
          }
          back={<PlayingCardFace card={card} g={g} label={cardName(card, g, (rank, suit) => g.t("games.tollRoad.card", { rank, suit }))} size={cards.length > 2 ? 52 : 72} />}
        />
      ))}
    </View>
  );

  const footer = (
    <Button
      label={state.phase === "hidden" ? g.t("games.faceOff.flip") : g.t("games.faceOff.nextRound")}
      height={ui.action}
      disabled={turning}
      onPress={state.phase === "hidden" ? reveal : next}
    />
  );

  return (
    <GameShell {...shellProps} status={g.t("shell.round", { round: state.round, rounds: state.rounds })} footer={footer} fab="bottom">
      {/* The top player sits across the table: their half is upside down. */}
      <View style={styles.flipped}>
        <Text variant="h3" align="center">
          {top?.name}
        </Text>
        {hand(state.hands[0], cardColours.mint)}
        {faceUp && state.hands[0].length > 1 ? (
          <Text variant="small" align="center">
            {g.t("games.faceOff.total", { total: handValue(state.hands[0]) })}
          </Text>
        ) : null}
      </View>
      <Text variant="h2" align="center" accessibilityLiveRegion="polite" style={styles.result}>
        {faceUp ? line : ""}
      </Text>
      <View style={styles.side}>
        {faceUp && state.hands[1].length > 1 ? (
          <Text variant="small" align="center">
            {g.t("games.faceOff.total", { total: handValue(state.hands[1]) })}
          </Text>
        ) : null}
        {hand(state.hands[1], cardColours.water)}
        <Text variant="h3" align="center">
          {bottom?.name}
        </Text>
      </View>
      {faceUp ? <PenaltyList lines={state.lastPenalties} players={table.all} wasted={wasted} forfeits={content.forfeits} /> : null}
    </GameShell>
  );
}

const styles = StyleSheet.create({
  flipped: { transform: [{ rotate: "180deg" }], gap: 10 },
  side: { gap: 10 },
  hand: { flexDirection: "row", justifyContent: "center", gap: 10 },
  card: { width: 104 },
  back: { flex: 1, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  result: { minHeight: 30 },
});
