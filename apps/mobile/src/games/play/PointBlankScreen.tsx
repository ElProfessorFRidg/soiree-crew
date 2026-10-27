import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { duration } from "@crew/design-tokens";
import { createPointBlank, mathRandom, pointBlankReducer } from "@crew/games";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { ScalePressable } from "@/ui/Pressable";
import { Numeral, Text } from "@/ui/Text";
import { useEngine, useGameUi, useWastedIds } from "../hooks";
import { useGameT } from "../i18n";
import { toEnginePlayer } from "../store";
import { EndScreen, topOf } from "../ui/EndScreen";
import { GameShell } from "../ui/GameShell";
import { Dealt } from "../ui/motion";
import { PenaltyList } from "../ui/PenaltyList";
import { PlayerGrid } from "../ui/PlayerGrid";
import { RoundTimer } from "../ui/RoundTimer";
import { CardTag, CardText, GameCard, cardColours, ids, useTable, type GameScreenProps } from "./common";

const BEAT_MS = 700;

export function PointBlankScreen({ session, content, onAgain }: GameScreenProps) {
  const g = useGameT();
  const ui = useGameUi();
  const theme = useTheme();
  const table = useTable(session);
  const [state, dispatch] = useEngine(
    () => createPointBlank({ players: session.players.map(toEnginePlayer), level: session.level, content: content.pointBlank, rng: mathRandom }),
    pointBlankReducer,
  );
  const wasted = useWastedIds(table.all);
  const [beat, setBeat] = useState<number | null>(null);
  const [secretVisible, setSecretVisible] = useState(false);
  const [quick, setQuick] = useState<ReadonlySet<string>>(new Set());
  // A secret card stays secret unless the named player paid to hear it.
  const [heard, setHeard] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    setSecretVisible(false);
    setQuick(new Set());
    setHeard(false);
  }, [state.card?.id]);

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
        <EndScreen gameId={session.gameId} players={table.all} ledger={state.ledger} endReason={state.endReason} startedAt={session.startedAt} record={topOf(state.designations, "records.pointBlank")} onAgain={onAgain} />
      </GameShell>
    );
  }

  const countdown = () => {
    // Three firm beats, a stronger one on "Point!" (research/games.md §2.1), sound-free.
    [3, 2, 1, 0].forEach((n, i) => {
      timers.current.push(
        setTimeout(() => {
          setBeat(n);
          if (n === 0) {
            haptic.heavy();
            dispatch({ type: "startRecording" });
          } else haptic.holdTick();
        }, i * BEAT_MS),
      );
    });
    timers.current.push(setTimeout(() => setBeat(null), 4 * BEAT_MS));
  };

  const card = state.card;
  const reader = table.nameOf(state.readerId);
  const counting = beat !== null;
  let footer = null;
  if (state.phase === "idle" || state.phase === "result") {
    footer = <Button label={g.t("games.pointBlank.nextCard")} height={ui.action} onPress={() => dispatch({ type: "next" })} />;
  } else if (state.phase === "read") {
    footer = <Button label={g.t("games.pointBlank.countdown")} height={ui.action} disabled={counting} onPress={countdown} />;
  } else if (state.phase === "record") {
    footer = ui.big ? (
      <Button label={g.t("games.pointBlank.done")} height={ui.action} disabled={quick.size === 0} onPress={() => dispatch({ type: "quickResult", playerIds: [...quick] })} />
    ) : (
      <Button label={g.t("games.pointBlank.done")} height={ui.action} onPress={() => dispatch({ type: "done" })} />
    );
  } else if (state.phase === "secretChoice") {
    footer = (
      <View style={styles.row}>
        <Button label={g.t("games.pointBlank.keep")} variant="secondary" height={ui.action} style={styles.flex} onPress={() => dispatch({ type: "secretChoice", hear: false })} />
        <Button label={g.t("games.pointBlank.hear")} height={ui.action} style={styles.flex} onPress={() => {
            setHeard(true);
            dispatch({ type: "secretChoice", hear: true });
          }} />
      </View>
    );
  }

  const showText = card && (!card.secret || (state.phase === "result" && heard) || (state.phase === "secretName" && secretVisible));

  return (
    <GameShell
      {...shellProps}
      status={`${g.t("games.pointBlank.reader", { name: reader || (state.order.players[state.order.turn]?.name ?? "") })}, ${g.plural("games.pointBlank.cardsLeft", state.deck.length)}`}
      footer={footer}
      fab={state.phase === "record" ? "top" : "bottom"}
    >
      <RoundTimer seconds={session.timerSeconds} roundKey={card?.id ?? "idle"} paused={state.phase !== "read" && state.phase !== "record"} />
      {card ? (
        <Dealt dealKey={card.id}>
          <GameCard minHeight={ui.big ? 200 : 220} style={card.secret ? { backgroundColor: theme.surfaceRaised } : undefined}>
            {card.secret ? <CardTag label={g.t("games.pointBlank.secretTag")} colour={cardColours.coral} /> : null}
            {showText ? (
              card.secret && state.phase !== "result" ? (
                <Text style={styles.secretText}>{card.text}</Text>
              ) : (
                <CardText>{card.text}</CardText>
              )
            ) : state.phase === "secretName" ? (
              <ScalePressable onPress={() => setSecretVisible(true)} accessibilityLabel={g.t("games.pointBlank.tapToRead")} style={[styles.secretTap, { minHeight: ui.action }]}>
                <Text variant="h3">{g.t("games.pointBlank.tapToRead")}</Text>
              </ScalePressable>
            ) : null}
            {card.secret && secretVisible && state.phase === "secretName" ? (
              <Button label={g.t("games.pointBlank.hide")} variant="secondary" height={ui.secondary} onPress={() => setSecretVisible(false)} />
            ) : null}
          </GameCard>
        </Dealt>
      ) : null}

      {counting ? (
        <Animated.View key={beat} entering={ZoomIn.duration(duration.pop).easing(easings.out)} style={styles.beat}>
          {beat === 0 ? <Text variant="h1">{g.t("games.pointBlank.point")}</Text> : <Numeral size={120} color={theme.amber}>{String(beat)}</Numeral>}
        </Animated.View>
      ) : null}

      {state.phase === "record" && !counting ? (
        ui.big ? (
          <>
            <Text variant="h3">{g.t("games.pointBlank.quickPrompt")}</Text>
            <PlayerGrid
              players={state.order.players}
              selected={quick}
              onPress={(id) => setQuick((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id].slice(-2))))}
            />
          </>
        ) : (
          <>
            <Text variant="small">{g.t("games.pointBlank.recordHint")}</Text>
            <PlayerGrid
              players={state.order.players}
              counts={state.fingers}
              onPress={(id) => dispatch({ type: "point", playerId: id, delta: 1 })}
              onMinus={(id) => dispatch({ type: "point", playerId: id, delta: -1 })}
              minusLabel={(name) => g.t("games.pointBlank.removeFinger", { name })}
              accessibilityLabel={(p) => g.plural("games.pointBlank.fingersOn", state.fingers[p.id] ?? 0, { name: p.name })}
            />
          </>
        )
      ) : null}

      {state.phase === "secretName" ? (
        <>
          <Text variant="h3">{g.t("games.pointBlank.nameSomeone")}</Text>
          <PlayerGrid players={state.order.players} onPress={(id) => dispatch({ type: "name", playerId: id })} />
        </>
      ) : null}
      {state.phase === "secretChoice" ? <Text variant="h2">{g.t("games.pointBlank.secretChoice", { name: table.nameOf(state.namedId) })}</Text> : null}

      {state.phase === "result" ? <PenaltyList lines={state.lastPenalties} players={table.all} wasted={wasted} forfeits={content.forfeits} showNobody /> : null}
    </GameShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  beat: { alignItems: "center", justifyContent: "center", minHeight: 140 },
  secretTap: { alignItems: "center", justifyContent: "center", borderRadius: 16 },
  secretText: { fontSize: 22, lineHeight: 29, fontFamily: "Archivo-Heading" },
});
