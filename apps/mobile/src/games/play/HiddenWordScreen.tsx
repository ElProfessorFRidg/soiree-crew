import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { duration, palette } from "@crew/design-tokens";
import { alivePlayers, cardFor, createHiddenWord, hiddenWordReducer, mathRandom, revealPlayer, type HiddenWordAction, type HiddenWordState, type Random } from "@crew/games";
import { haptic } from "@/motion/haptics";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { ScalePressable } from "@/ui/Pressable";
import { Numeral, Text } from "@/ui/Text";
import { useEngine, useGameUi, useWastedIds } from "../hooks";
import { useGameT } from "../i18n";
import { toEnginePlayer } from "../store";
import { EndScreen } from "../ui/EndScreen";
import { GameShell } from "../ui/GameShell";
import { FlipCard } from "../ui/motion";
import { PenaltyList } from "../ui/PenaltyList";
import { PlayerGrid } from "../ui/PlayerGrid";
import { RoundTimer } from "../ui/RoundTimer";
import { cardColours, ids, useTable, type GameScreenProps } from "./common";

/** Odd One Out (O-61) and Moles (O-62): one pass-the-phone screen, two rule sets in the engine. */
export function HiddenWordScreen({ session, content, onAgain }: GameScreenProps) {
  const g = useGameT();
  const ui = useGameUi();
  const theme = useTheme();
  const table = useTable(session);
  const mode = session.gameId === "doubleAgent" ? "doubleAgent" : "impostor";
  const [state, dispatch] = useEngine(
    () => createHiddenWord({ mode, players: session.players.map(toEnginePlayer), level: session.level, content: content.wordPairs, rng: mathRandom }),
    (s: HiddenWordState, a: HiddenWordAction, rng: Random) => hiddenWordReducer(s, a, rng, content.wordPairs),
  );
  const wasted = useWastedIds(table.all);
  const alive = alivePlayers(state);

  const shellProps = {
    gameId: session.gameId,
    players: table.all,
    activeIds: ids(state.players),
    ledger: state.ledger,
    onRemovePlayer: (id: string) => dispatch({ type: "removePlayer", playerId: id }),
    onAddPlayer: (p: Parameters<typeof table.add>[0]) => dispatch({ type: "addPlayer", player: table.add(p) }),
    onStop: () => dispatch({ type: "stop" }),
  };

  if (state.phase === "end") {
    return (
      <GameShell {...shellProps}>
        <EndScreen gameId={session.gameId} players={table.all} ledger={state.ledger} endReason={state.endReason} startedAt={session.startedAt} record={null} onAgain={onAgain} />
      </GameShell>
    );
  }

  const holder = revealPlayer(state);
  const last = state.revealIndex >= state.players.length - 1;
  const [crewWord, otherWord] = state.pair;
  const hidden = state.players.filter((p) => state.roles[p.id] !== "crew");
  const hiddenNames = hidden.map((p) => p.name).join(", ");

  let outcome: string | null = null;
  if (state.lastAccused) {
    const name = table.nameOf(state.lastAccused.playerId);
    if (mode === "impostor") outcome = state.lastAccused.role === "impostor" ? g.t("games.impostor.caught", { name }) : g.t("games.impostor.wrong", { name });
    else outcome = state.lastAccused.role === "agent" ? g.t("games.doubleAgent.moleOut", { name }) : g.t("games.doubleAgent.innocentOut", { name });
  }

  let footer = null;
  if (state.phase === "reveal") {
    footer = (
      <Button
        label={last ? g.t("games.hiddenWord.hideLast") : g.t("games.hiddenWord.hideAndPass")}
        height={ui.action}
        disabled={!state.seen}
        onPress={() => {
          haptic.select();
          dispatch({ type: "pass" });
        }}
      />
    );
  } else if (state.phase === "discuss") {
    footer = <Button label={g.t("games.hiddenWord.startVote")} height={ui.action} onPress={() => dispatch({ type: "startVote" })} />;
  } else if (state.phase === "lastGuess") {
    footer = (
      <View style={styles.row}>
        <Button label={g.t("games.impostor.guessWrong")} variant="secondary" height={ui.action} style={styles.flex} onPress={() => dispatch({ type: "guess", correct: false })} />
        <Button label={g.t("games.impostor.guessRight")} height={ui.action} style={styles.flex} onPress={() => dispatch({ type: "guess", correct: true })} />
      </View>
    );
  } else if (state.phase === "roundEnd") {
    footer = <Button label={g.t("games.hiddenWord.nextRound")} height={ui.action} onPress={() => dispatch({ type: "nextRound" })} />;
  }

  return (
    <GameShell {...shellProps} status={g.t("shell.roundOpen", { round: state.round })} footer={footer} fab={state.phase === "reveal" ? "none" : "bottom"}>
      {state.phase === "reveal" && holder ? (
        <>
          <Text variant="h2">{g.t("games.hiddenWord.passTo", { name: holder.name })}</Text>
          <ScalePressable
            pressedScale={0.99}
            accessibilityLabel={g.t("games.hiddenWord.tapToSee")}
            onPress={() => dispatch(state.peeking ? { type: "hide" } : { type: "peek" })}
          >
            <FlipCard
              key={holder.id}
              flipped={state.peeking}
              style={{ height: ui.big ? 260 : 300 }}
              front={
                <View style={[styles.face, { backgroundColor: theme.surfaceRaised }]}>
                  <Numeral size={64} color={theme.textSoft}>
                    ?
                  </Numeral>
                  <Text variant="h3" color={theme.textSoft}>
                    {g.t("games.hiddenWord.tapToSee")}
                  </Text>
                </View>
              }
              // The word only exists on screen while its player looks at it.
              back={state.peeking ? <WordFace state={state} playerId={holder.id} /> : <View style={[styles.face, { backgroundColor: palette.dark.text }]} />}
            />
          </ScalePressable>
        </>
      ) : null}

      {state.phase === "discuss" || state.phase === "vote" ? (
        <>
          {outcome ? (
            <Animated.View entering={FadeIn.duration(duration.enter)} style={styles.block}>
              <Text variant="h2">{outcome}</Text>
              <PenaltyList lines={state.lastPenalties} players={table.all} wasted={wasted} forfeits={content.forfeits} />
            </Animated.View>
          ) : null}
          {mode === "doubleAgent" ? <Text variant="small">{g.plural("games.doubleAgent.stillIn", alive.length)}</Text> : null}
          {state.phase === "discuss" ? (
            <>
              <Text>{g.t("games.hiddenWord.discuss")}</Text>
              <RoundTimer seconds={session.timerSeconds} roundKey={`${state.round}-${state.eliminated.length}`} />
            </>
          ) : (
            <>
              <Text variant="h3">{g.t("games.hiddenWord.voteHint")}</Text>
              <PlayerGrid players={alive} onPress={(id) => dispatch({ type: "accuse", playerId: id })} />
            </>
          )}
        </>
      ) : null}

      {state.phase === "lastGuess" ? (
        <>
          <Text variant="h2">{outcome}</Text>
          <Text variant="h3">{g.t("games.impostor.lastGuess", { name: table.nameOf(state.lastAccused?.playerId) })}</Text>
        </>
      ) : null}

      {state.phase === "roundEnd" && state.outcome ? (
        <Animated.View entering={FadeIn.duration(duration.enter)} style={styles.block}>
          {outcome ? <Text variant="h3">{outcome}</Text> : null}
          <Text variant="h1">
            {mode === "impostor"
              ? state.outcome.winner === "impostor"
                ? g.t("games.impostor.intruderWins")
                : g.t("games.impostor.crewWins")
              : state.outcome.winner === "agents"
                ? g.t("games.doubleAgent.molesWin", { names: hiddenNames })
                : g.t("games.doubleAgent.othersWin")}
          </Text>
          {mode === "impostor" ? <Text>{g.t("games.impostor.intruderWas", { name: hiddenNames })}</Text> : null}
          <Text>{g.t("games.hiddenWord.theWord", { word: crewWord })}</Text>
          {mode === "doubleAgent" ? <Text>{g.t("games.doubleAgent.moleWord", { word: otherWord })}</Text> : null}
          <PenaltyList lines={state.lastPenalties} players={table.all} wasted={wasted} forfeits={content.forfeits} />
        </Animated.View>
      ) : null}
    </GameShell>
  );
}

/** Every card has the same colour, whatever the role: the colour never gives a mole away. */
function WordFace({ state, playerId }: { state: HiddenWordState; playerId: string }) {
  const g = useGameT();
  const card = cardFor(state, playerId);
  return (
    <View style={[styles.face, { backgroundColor: palette.dark.text }]}>
      {card.word ? (
        <>
          <Text variant="small" color={cardColours.muted}>
            {g.t("games.hiddenWord.yourWord")}
          </Text>
          <Numeral size={card.word.length > 12 ? 36 : 52} color={palette.accent.onAccent}>
            {card.word}
          </Numeral>
        </>
      ) : (
        <>
          <Text variant="h3" color={palette.accent.onAccent} align="center">
            {g.t("games.hiddenWord.noWord")}
          </Text>
          {card.hint ? (
            <Text color={cardColours.muted} align="center">
              {g.t("games.hiddenWord.category", { category: card.hint })}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  face: { flex: 1, borderRadius: 24, alignItems: "center", justifyContent: "center", gap: 10, padding: 20 },
  row: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  block: { gap: 10 },
});
