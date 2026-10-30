import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { palette } from "@crew/design-tokens";
import { bigDeckReducer, cardsLeft, createBigDeck, fillCard, mathRandom, type BigDeckKind } from "@crew/games";
import { haptic } from "@/motion/haptics";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { ScalePressable } from "@/ui/Pressable";
import { Text } from "@/ui/Text";
import { useEngine, useGameUi, useWastedIds } from "../hooks";
import { useGameT } from "../i18n";
import { toEnginePlayer } from "../store";
import { EndScreen } from "../ui/EndScreen";
import { GameShell } from "../ui/GameShell";
import { Dealt } from "../ui/motion";
import { PenaltyList } from "../ui/PenaltyList";
import { PlayerGrid } from "../ui/PlayerGrid";
import { RoundTimer } from "../ui/RoundTimer";
import { SwipeCard } from "../ui/SwipeCard";
import { CardTag, CardText, GameCard, cardColours, ids, useTable, type GameScreenProps } from "./common";

const KIND_COLOUR: Record<BigDeckKind, string> = { dare: cardColours.amber, rule: cardColours.water, vote: cardColours.mint, minigame: cardColours.lavender };
const KIND_LABEL = { dare: "games.bigDeck.kindDare", rule: "games.bigDeck.kindRule", vote: "games.bigDeck.kindVote", minigame: "games.bigDeck.kindMinigame" } as const;

export function BigDeckScreen({ session, content, onAgain }: GameScreenProps) {
  const g = useGameT();
  const ui = useGameUi();
  const theme = useTheme();
  const table = useTable(session);
  const [state, dispatch] = useEngine(
    () => createBigDeck({ players: session.players.map(toEnginePlayer), level: session.level, content: content.bigDeck, rng: mathRandom }),
    bigDeckReducer,
  );
  const wasted = useWastedIds(table.all);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [ruleBreak, setRuleBreak] = useState(false);

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
      <GameShell {...shellProps} fab="top">
        <EndScreen gameId={session.gameId} players={table.all} ledger={state.ledger} endReason={state.endReason} startedAt={session.startedAt} record={null} onAgain={onAgain} />
      </GameShell>
    );
  }

  const current = state.current;
  const drawer = current ? current.playerId : state.order.players[state.order.turn]?.id;
  const names = { player: table.nameOf(current?.playerId), other: table.nameOf(current?.otherId) };
  const togglePick = (id: string) => setPicked((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));
  const resolveKind = current?.card.kind;

  const footer = !current ? (
    <Button label={g.t("games.bigDeck.draw")} height={ui.action} onPress={() => dispatch({ type: "draw" })} />
  ) : resolveKind === "dare" ? (
    <View style={styles.row}>
      <Button label={g.t("games.bigDeck.refuse")} variant="secondary" height={ui.action} style={styles.flex} onPress={() => dispatch({ type: "refuse" })} />
      <Button label={g.t("games.bigDeck.done")} height={ui.action} style={styles.flex} onPress={() => dispatch({ type: "done" })} />
    </View>
  ) : resolveKind === "rule" ? (
    <Button label={g.t("games.bigDeck.ruleNoted")} height={ui.action} onPress={() => dispatch({ type: "done" })} />
  ) : (
    <Button
      label={g.t("games.bigDeck.confirm")}
      height={ui.action}
      disabled={picked.size === 0}
      onPress={() => {
        dispatch({ type: "designate", playerIds: [...picked] });
        setPicked(new Set());
      }}
    />
  );

  return (
    <GameShell {...shellProps} status={`${g.t("games.bigDeck.turnOf", { name: table.nameOf(drawer) })}, ${g.plural("games.bigDeck.cardsLeft", cardsLeft(state))}`} fab="top" footer={footer}>
      <RoundTimer seconds={session.timerSeconds} roundKey={state.deck.length} paused={!current} />
      {state.activeRule ? (
        <Panel tint="water">
          <Text variant="label" color={palette.tint.waterText}>
            {g.t("games.bigDeck.activeRule")}
          </Text>
          <Text color={palette.tint.waterText}>{fillCard(state.activeRule.card.text, { player: table.nameOf(state.activeRule.playerId), other: table.nameOf(state.activeRule.otherId) })}</Text>
          {ruleBreak ? (
            <>
              <Text variant="h3">{g.t("games.bigDeck.whoBroke")}</Text>
              <PlayerGrid
                players={state.order.players}
                onPress={(id) => {
                  dispatch({ type: "ruleBroken", playerId: id });
                  setRuleBreak(false);
                }}
              />
            </>
          ) : (
            <Button label={g.t("games.bigDeck.brokeRule")} variant="secondary" height={ui.secondary} onPress={() => setRuleBreak(true)} />
          )}
        </Panel>
      ) : null}

      {current ? (
        // MOT-06: a dare goes right when done, left when refused; a rule either way once noted.
        // Votes and mini-games need someone picked first, so their card stays put.
        <SwipeCard
          cardKey={state.deck.length}
          right={resolveKind === "dare" ? { label: g.t("games.bigDeck.done"), onCommit: () => dispatch({ type: "done" }) } : undefined}
          left={resolveKind === "dare" ? { label: g.t("games.bigDeck.refuse"), onCommit: () => dispatch({ type: "refuse" }) } : undefined}
          either={resolveKind === "rule" ? { label: g.t("games.bigDeck.ruleNoted"), onCommit: () => dispatch({ type: "done" }) } : undefined}
        >
          <Dealt dealKey={state.deck.length}>
            <GameCard minHeight={ui.big ? 300 : 340}>
              <CardTag label={g.t(KIND_LABEL[current.card.kind])} colour={KIND_COLOUR[current.card.kind]} />
              <CardText>{fillCard(current.card.text, names)}</CardText>
              <Text variant="small" color={cardColours.muted}>
                {table.nameOf(current.playerId)}
              </Text>
            </GameCard>
          </Dealt>
        </SwipeCard>
      ) : (
        <ScalePressable
          accessibilityLabel={g.t("games.bigDeck.draw")}
          onPress={() => {
            haptic.select();
            dispatch({ type: "draw" });
          }}
          style={[styles.deck, { backgroundColor: theme.surfaceRaised, minHeight: ui.big ? 220 : 300 }]}
        >
          <Icon name="dice" size={64} color={theme.textMuted} />
          <Text variant="h3" color={theme.textSoft}>
            {g.t("games.bigDeck.tapToDraw")}
          </Text>
        </ScalePressable>
      )}

      {current && (resolveKind === "vote" || resolveKind === "minigame") ? (
        <>
          <Text variant="h3">{g.t("games.bigDeck.whoPays")}</Text>
          <PlayerGrid players={state.order.players} selected={picked} onPress={togglePick} />
        </>
      ) : null}

      <PenaltyList lines={state.lastPenalties} players={table.all} wasted={wasted} forfeits={content.forfeits} />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  deck: { borderRadius: 24, alignItems: "center", justifyContent: "center", gap: 14 },
});
