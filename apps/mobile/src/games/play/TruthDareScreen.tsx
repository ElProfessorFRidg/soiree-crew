import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { duration } from "@crew/design-tokens";
import { createTruthDare, fillCard, mathRandom, truthDareReducer, type TruthDareCard } from "@crew/games";
import { haptic } from "@/motion/haptics";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Numeral, Text } from "@/ui/Text";
import { useEngine, useGameUi, useWastedIds } from "../hooks";
import { useGameT } from "../i18n";
import { toEnginePlayer } from "../store";
import { EndScreen, topOf } from "../ui/EndScreen";
import { GameShell } from "../ui/GameShell";
import { FlipCard } from "../ui/motion";
import { PenaltyList } from "../ui/PenaltyList";
import { RoundTimer } from "../ui/RoundTimer";
import { CardTag, CardText, GameCard, cardColours, ids, useTable, type GameScreenProps } from "./common";

export function TruthDareScreen({ session, content, onAgain }: GameScreenProps) {
  const g = useGameT();
  const ui = useGameUi();
  const theme = useTheme();
  const table = useTable(session);
  const [state, dispatch] = useEngine(
    () => createTruthDare({ players: session.players.map(toEnginePlayer), level: session.level, content: content.truthDare, rng: mathRandom }),
    truthDareReducer,
  );
  const wasted = useWastedIds(table.all);
  // The card keeps its last face while it turns back, and nobody can pick again until it is down.
  const shown = useRef<TruthDareCard | null>(null);
  if (state.current) shown.current = state.current;
  const [turning, setTurning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

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
        <EndScreen gameId={session.gameId} players={table.all} ledger={state.ledger} endReason={state.endReason} startedAt={session.startedAt} record={topOf(state.refusals, "records.truthDare")} onAgain={onAgain} />
      </GameShell>
    );
  }

  const finish = (action: { type: "done" } | { type: "refuse" }) => {
    dispatch(action);
    setTurning(true);
    timer.current = setTimeout(() => setTurning(false), duration.flip);
  };
  const choose = (kind: "truth" | "dare") => {
    haptic.select();
    dispatch({ type: "choose", kind });
  };

  const card = shown.current;
  const player = state.current ? state.current.playerId : state.order.players[state.order.turn]?.id;
  const footer =
    state.phase === "card" ? (
      <View style={styles.row}>
        <Button label={g.t("games.truthDare.refuse")} variant="secondary" height={ui.action} style={styles.flex} onPress={() => finish({ type: "refuse" })} />
        <Button label={g.t("games.truthDare.done")} height={ui.action} style={styles.flex} onPress={() => finish({ type: "done" })} />
      </View>
    ) : (
      <View style={styles.row}>
        <Button label={g.t("games.truthDare.truth")} variant="water" height={ui.action} style={styles.flex} disabled={turning} onPress={() => choose("truth")} />
        <Button label={g.t("games.truthDare.dare")} height={ui.action} style={styles.flex} disabled={turning} onPress={() => choose("dare")} />
      </View>
    );

  return (
    <GameShell {...shellProps} status={g.t("games.truthDare.turnOf", { name: table.nameOf(player) })} footer={footer} fab="top">
      <RoundTimer seconds={session.timerSeconds} roundKey={state.turns} paused={state.phase !== "card"} />
      <FlipCard
        flipped={state.phase === "card"}
        style={{ height: ui.big ? 320 : 380 }}
        front={
          <View style={[styles.front, { backgroundColor: theme.surfaceRaised }]}>
            <Numeral size={54}>{g.t("games.truthDare.truth")}</Numeral>
            <Text variant="small">{g.t("games.truthDare.or")}</Text>
            <Numeral size={54}>{g.t("games.truthDare.dare")}</Numeral>
          </View>
        }
        back={
          card ? (
            <GameCard style={[styles.back, { backgroundColor: card.kind === "truth" ? cardColours.water : cardColours.amber }]}>
              <CardTag label={card.kind === "truth" ? g.t("games.truthDare.truth") : g.t("games.truthDare.dare")} colour={theme.text} />
              <CardText>{fillCard(card.item.value, { player: table.nameOf(card.playerId), other: table.nameOf(card.otherId) })}</CardText>
              <Text variant="small" color={cardColours.muted}>
                {table.nameOf(card.playerId)}
              </Text>
            </GameCard>
          ) : (
            <View />
          )
        }
      />
      <PenaltyList lines={state.lastPenalties} players={table.all} wasted={wasted} forfeits={content.forfeits} />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  front: { flex: 1, borderRadius: 24, alignItems: "center", justifyContent: "center", gap: 6 },
  back: { flex: 1 },
});
