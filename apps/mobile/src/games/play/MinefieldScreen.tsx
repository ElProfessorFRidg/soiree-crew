import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { duration, palette, radius, scaled } from "@crew/design-tokens";
import { GRID_SIDE, GRID_TILES, createMinefield, hiddenTiles, mathRandom, minefieldReducer, minesLeft, touchingMines } from "@crew/games";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { ScalePressable } from "@/ui/Pressable";
import { Numeral, Text } from "@/ui/Text";
import { useEngine, useGameUi, useWastedIds } from "../hooks";
import { useGameT } from "../i18n";
import { toEnginePlayer } from "../store";
import { EndScreen, topOf } from "../ui/EndScreen";
import { GameShell } from "../ui/GameShell";
import { Tremble } from "../ui/motion";
import { PenaltyList } from "../ui/PenaltyList";
import { PlayerGrid } from "../ui/PlayerGrid";
import { ids, useTable, type GameScreenProps } from "./common";

export function MinefieldScreen({ session, content, onAgain }: GameScreenProps) {
  const g = useGameT();
  const ui = useGameUi();
  const theme = useTheme();
  const table = useTable(session);
  const [state, dispatch] = useEngine(() => createMinefield({ players: session.players.map(toEnginePlayer), level: session.level, rng: mathRandom }), minefieldReducer);
  const wasted = useWastedIds(table.all);

  useEffect(() => {
    if (state.phase === "boom") haptic.heavy();
  }, [state.phase, state.lastTile]);

  const shellProps = {
    gameId: session.gameId,
    players: table.all,
    activeIds: ids(state.order.players),
    ledger: state.ledger,
    onRemovePlayer: (id: string) => dispatch({ type: "removePlayer", playerId: id }),
    onAddPlayer: (p: Parameters<typeof table.add>[0]) => dispatch({ type: "addPlayer", player: table.add(p) }),
    onStop: () => dispatch({ type: "endGame" }),
  };

  if (state.phase === "end") {
    return (
      <GameShell {...shellProps}>
        <EndScreen gameId={session.gameId} players={table.all} ledger={state.ledger} endReason={state.endReason} startedAt={session.startedAt} record={topOf(state.bestTurn, "records.minefield")} onAgain={onAgain} />
      </GameShell>
    );
  }

  const player = state.order.players[state.order.turn];
  const { grid } = state;
  const showNumbers = state.level === "normal";
  const gridOver = state.phase === "gridEnd";
  const canTap = state.phase === "reveal" || state.phase === "decide";

  const risk =
    state.level === "extreme"
      ? `${g.t("games.minefield.minesHidden")}, ${g.plural("games.minefield.tiles", hiddenTiles(grid))}`
      : `${g.plural("games.minefield.mines", minesLeft(grid))}, ${g.plural("games.minefield.tiles", hiddenTiles(grid))}`;

  let prompt = "";
  if (state.phase === "reveal") prompt = state.tilesThisTurn > 0 ? g.t("games.minefield.openTwo") : g.t("games.minefield.openTile");
  else if (state.phase === "decide") prompt = g.t("games.minefield.decide");
  else if (state.phase === "give") prompt = ui.big ? g.plural("games.minefield.giveAll", state.sipsToGive, { name: player?.name ?? "" }) : g.plural("games.minefield.give", state.sipsToGive, { name: player?.name ?? "" });
  else if (state.phase === "boom") prompt = g.t("games.minefield.boom");
  else if (gridOver) prompt = g.t("games.minefield.gridEnd");

  let footer = null;
  if (state.phase === "decide") footer = <Button label={g.t("games.minefield.stop")} height={ui.action} onPress={() => dispatch({ type: "stop" })} />;
  else if (state.phase === "boom") footer = <Button label={g.t("games.minefield.continue")} height={ui.action} onPress={() => dispatch({ type: "continue" })} />;
  else if (gridOver) footer = <Button label={g.t("games.minefield.nextGrid")} height={ui.action} onPress={() => dispatch({ type: "nextGrid" })} />;

  const status = state.grids !== null ? g.t("games.minefield.grid", { number: state.gridNumber, total: state.grids }) : undefined;

  return (
    <GameShell {...shellProps} status={status} footer={footer} fab="top">
      <View style={styles.head}>
        <Text variant="h2">{g.t("games.minefield.turnOf", { name: player?.name ?? "" })}</Text>
        <Text variant="small" accessibilityLiveRegion="polite">
          {risk}
        </Text>
      </View>

      <View style={styles.grid} accessibilityRole="none">
        {Array.from({ length: GRID_TILES }, (_, index) => {
          const open = grid.revealed[index] ?? false;
          const mine = grid.mines.includes(index);
          // At the end of a grid the mines nobody hit are shown one after another.
          const unveiled = open || (gridOver && mine);
          const row = Math.floor(index / GRID_SIDE) + 1;
          const column = (index % GRID_SIDE) + 1;
          const count = touchingMines(grid, index);
          const state_ = !unveiled ? g.t("games.minefield.tileClosed") : mine ? g.t("games.minefield.tileMine") : showNumbers ? g.plural("games.minefield.tileSafe", count) : g.t("games.minefield.tileSafeNoCount");
          const bg = !unveiled ? theme.surfaceRaised : mine ? (open ? theme.danger : palette.tint.dangerBg) : theme.ok;
          const mineDelay = gridOver && mine && !open ? scaled(grid.mines.indexOf(index) * 160) : 0;
          return (
            <Tremble key={`${state.gridNumber}-${index}`} trigger={state.phase === "boom" && state.lastTile === index ? index : null} calm={ui.calmMotion} style={styles.cellWrap}>
              <ScalePressable
                pressedScale={0.92}
                disabled={!canTap || open}
                accessibilityLabel={`${g.t("games.minefield.tile", { row, column })}, ${state_}`}
                onPress={() => {
                  haptic.select();
                  dispatch({ type: "reveal", index });
                }}
                style={[styles.cell, { backgroundColor: bg }]}
              >
                {unveiled ? (
                  <Animated.View entering={mineDelay ? FadeIn.delay(mineDelay).duration(duration.pop) : ZoomIn.duration(duration.pop).easing(easings.out)}>
                    {mine ? (
                      <Icon name="x" size={ui.big ? 30 : 24} color={open ? palette.accent.onAccent : palette.tint.dangerText} strokeWidth={2.6} />
                    ) : showNumbers && count > 0 ? (
                      <Numeral size={ui.big ? 34 : 28} color={palette.accent.onAccent}>
                        {String(count)}
                      </Numeral>
                    ) : (
                      <Icon name="check" size={ui.big ? 28 : 22} color={palette.accent.onAccent} />
                    )}
                  </Animated.View>
                ) : null}
              </ScalePressable>
            </Tremble>
          );
        })}
      </View>

      <Text variant="h3" accessibilityLiveRegion="polite">
        {prompt}
      </Text>

      {state.phase === "give" ? (
        <PlayerGrid
          players={state.order.players.filter((p) => p.id !== player?.id)}
          onPress={(id) => dispatch(ui.big ? { type: "give", playerId: id, all: true } : { type: "give", playerId: id })}
          counts={Object.fromEntries(state.given.map((line) => [line.playerId, line.sips]))}
        />
      ) : null}

      <PenaltyList lines={state.lastPenalties} players={table.all} wasted={wasted} forfeits={content.forfeits} />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  head: { gap: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cellWrap: { width: "18%", flexGrow: 1, aspectRatio: 1 },
  cell: { flex: 1, borderRadius: radius.buttonSmall, alignItems: "center", justifyContent: "center" },
});
