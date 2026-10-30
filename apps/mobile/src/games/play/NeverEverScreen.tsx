import { createNeverEver, mathRandom, neverEverReducer, type NeverEverAction, type NeverEverState } from "@crew/games";
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

export function NeverEverScreen({ session, content, onAgain }: GameScreenProps) {
  const g = useGameT();
  const ui = useGameUi();
  const table = useTable(session);
  const [state, dispatch] = useEngine(
    () => createNeverEver({ players: session.players.map(toEnginePlayer), level: session.level, content: content.neverEver, rng: mathRandom }),
    (s: NeverEverState, a: NeverEverAction) => neverEverReducer(s, a),
  );
  const wasted = useWastedIds(table.all);

  const shellProps = {
    gameId: session.gameId,
    players: table.all,
    activeIds: ids(state.order.players),
    ledger: state.ledger,
    onRemovePlayer: (id: string) => dispatch({ type: "removePlayer", playerId: id }),
    onAddPlayer: (p: Parameters<typeof table.add>[0]) => dispatch({ type: "addPlayer", player: table.add(p) }),
    onStop: () => dispatch({ type: "stop" }),
  };

  if (state.phase === "end" || !state.card) {
    return (
      <GameShell {...shellProps}>
        <EndScreen gameId={session.gameId} players={table.all} ledger={state.ledger} endReason={state.endReason} startedAt={session.startedAt} record={topOf(state.confessions, "records.neverEver")} onAgain={onAgain} />
      </GameShell>
    );
  }

  const reader = state.order.players[state.order.turn];
  return (
    <GameShell
      {...shellProps}
      status={`${g.t("games.neverEver.reader", { name: reader?.name ?? "" })}, ${g.plural("games.neverEver.cardsLeft", state.deck.length)}`}
      footer={<Button label={g.t("games.neverEver.next")} height={ui.action} onPress={() => dispatch({ type: "next" })} />}
    >
      <RoundTimer seconds={session.timerSeconds} roundKey={state.card.id} />
      <SwipeCard cardKey={state.card.id} either={{ label: g.t("games.neverEver.next"), onCommit: () => dispatch({ type: "next" }) }}>
        <Dealt dealKey={state.card.id}>
          <GameCard minHeight={ui.big ? 220 : 280} style={{ backgroundColor: cardColours.peach }}>
            <Text variant="h3" color={cardColours.muted}>
              {g.t("games.neverEver.prompt")}
            </Text>
            <CardText>{state.card.value}</CardText>
          </GameCard>
        </Dealt>
      </SwipeCard>
      <Text variant="label">{g.t("games.neverEver.guilty")}</Text>
      <PlayerGrid players={state.order.players} selected={new Set(state.guilty)} onPress={(id) => dispatch({ type: "toggle", playerId: id })} />
      <PenaltyList lines={state.lastPenalties} players={table.all} wasted={wasted} forfeits={content.forfeits} />
    </GameShell>
  );
}
