import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import { duration, radius } from "@crew/design-tokens";
import { createVerdict, mathRandom, verdictReducer, voterCount } from "@crew/games";
import { easings } from "@/motion/easing";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";
import { useEngine, useGameUi, useWastedIds } from "../hooks";
import { useGameT } from "../i18n";
import { toEnginePlayer } from "../store";
import { EndScreen, topOf } from "../ui/EndScreen";
import { GameShell } from "../ui/GameShell";
import { Dealt } from "../ui/motion";
import { PenaltyList } from "../ui/PenaltyList";
import { PlayerGrid } from "../ui/PlayerGrid";
import { RoundTimer } from "../ui/RoundTimer";
import { SwipeCard } from "../ui/SwipeCard";
import { CardText, GameCard, cardColours, ids, useTable, type GameScreenProps } from "./common";

export function VerdictScreen({ session, content, onAgain }: GameScreenProps) {
  const g = useGameT();
  const ui = useGameUi();
  const theme = useTheme();
  const table = useTable(session);
  const [state, dispatch] = useEngine(
    () => createVerdict({ players: session.players.map(toEnginePlayer), level: session.level, content: content.verdict, rng: mathRandom }),
    verdictReducer,
  );
  const wasted = useWastedIds(table.all);
  const total = state.votes[0] + state.votes[1];
  const share = total === 0 ? 0.5 : state.votes[0] / total;
  const bar = useAnimatedStyle(() => ({ width: withTiming(`${share * 100}%`, { duration: duration.progress, easing: easings.out }) }), [share]);

  const shellProps = {
    gameId: session.gameId,
    players: table.all,
    activeIds: ids(state.players),
    ledger: state.ledger,
    onRemovePlayer: (id: string) => dispatch({ type: "removePlayer", playerId: id }),
    onAddPlayer: (p: Parameters<typeof table.add>[0]) => dispatch({ type: "addPlayer", player: table.add(p) }),
    onStop: () => dispatch({ type: "stop" }),
  };

  if (state.phase === "end" || !state.card || !state.pair) {
    return (
      <GameShell {...shellProps}>
        <EndScreen gameId={session.gameId} players={table.all} ledger={state.ledger} endReason={state.endReason} startedAt={session.startedAt} record={topOf(state.verdicts, "records.verdict")} onAgain={onAgain} />
      </GameShell>
    );
  }

  const [a, b] = state.pair;
  const pairPlayers = [a, b].map((id) => state.players.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
  const counts = { [a]: state.votes[0], [b]: state.votes[1] };
  const left = voterCount(state) - total;
  const voting = state.phase === "vote";
  const outcome =
    state.phase === "result"
      ? state.lastPenalties.length === 0
        ? g.t("games.verdict.noVotes")
        : state.lastPenalties.length === 2
          ? g.t("games.verdict.tie")
          : g.t("games.verdict.guilty", { name: table.nameOf(state.lastPenalties[0]?.playerId) })
      : null;

  return (
    <GameShell
      {...shellProps}
      footer={
        voting ? (
          <Button label={g.t("games.verdict.close")} height={ui.action} onPress={() => dispatch({ type: "close" })} />
        ) : (
          <Button label={g.t("games.verdict.next")} height={ui.action} onPress={() => dispatch({ type: "next" })} />
        )
      }
    >
      <RoundTimer seconds={session.timerSeconds} roundKey={state.card.id} paused={!voting} />
      {/* MOT-06: once the verdict is in, the card can be swiped away; never during the vote. */}
      <SwipeCard
        cardKey={`${state.card.id}-${state.phase}`}
        either={voting ? undefined : { label: g.t("games.verdict.next"), onCommit: () => dispatch({ type: "next" }) }}
      >
        <Dealt dealKey={state.card.id}>
          <GameCard minHeight={ui.big ? 160 : 190} style={{ backgroundColor: cardColours.mint }}>
            <Text variant="h3" color={cardColours.muted}>
              {g.t("games.verdict.prompt")}
            </Text>
            <CardText>{state.card.value}</CardText>
          </GameCard>
        </Dealt>
      </SwipeCard>
      <PlayerGrid
        players={pairPlayers}
        counts={counts}
        onPress={voting ? (id) => dispatch({ type: "vote", side: id === a ? 0 : 1, delta: 1 }) : undefined}
        onMinus={voting ? (id) => dispatch({ type: "vote", side: id === a ? 0 : 1, delta: -1 }) : undefined}
        minusLabel={(name) => g.t("games.verdict.removeVote", { name })}
        disabled={voting && left <= 0 ? new Set([a, b]) : undefined}
        accessibilityLabel={(p) => `${p.name}, ${g.plural("games.verdict.votes", counts[p.id] ?? 0)}`}
      />
      <View style={[styles.track, { backgroundColor: theme.surfaceRaised }]}>
        <Animated.View style={[styles.fill, { backgroundColor: theme.text }, bar]} />
      </View>
      {voting ? <Text variant="small">{g.plural("games.verdict.votesLeft", left)}</Text> : null}
      {outcome ? (
        <Text variant="h2" accessibilityLiveRegion="polite">
          {outcome}
        </Text>
      ) : null}
      {state.phase === "result" ? <PenaltyList lines={state.lastPenalties} players={table.all} wasted={wasted} forfeits={content.forfeits} /> : null}
    </GameShell>
  );
}

const styles = StyleSheet.create({
  track: { height: 14, borderRadius: radius.pill, overflow: "hidden" },
  fill: { height: "100%" },
});
