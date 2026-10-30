import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, runOnJS, useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Path, Text as SvgText } from "react-native-svg";
import { duration, palette, scaled } from "@crew/design-tokens";
import { WHEEL_SPIN_MS, createWheel, wheelReducer } from "@crew/games";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";
import { useEngine, useGameUi, useWastedIds } from "../hooks";
import { useGameT } from "../i18n";
import { toEnginePlayer } from "../store";
import { EndScreen, topOf } from "../ui/EndScreen";
import { GameShell } from "../ui/GameShell";
import { PenaltyList } from "../ui/PenaltyList";
import { ids, useTable, type GameScreenProps } from "./common";

const SIZE = 300;
const R = SIZE / 2;
/** Shorter spin at adaptive levels 2 and 3: no long sequences (DESIGN.md §6). */
const CALM_SPIN_MS = 2_400;

function point(angleDeg: number, radius: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: R + radius * Math.cos(a), y: R + radius * Math.sin(a) };
}

function segmentPath(index: number, count: number): string {
  const size = 360 / count;
  const a = point(index * size, R);
  const b = point((index + 1) * size, R);
  return `M${R} ${R}L${a.x} ${a.y}A${R} ${R} 0 ${size > 180 ? 1 : 0} 1 ${b.x} ${b.y}Z`;
}

export function WheelScreen({ session, content, onAgain }: GameScreenProps) {
  const g = useGameT();
  const ui = useGameUi();
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const table = useTable(session);
  const [state, dispatch] = useEngine(() => createWheel({ players: session.players.map(toEnginePlayer), level: session.level }), wheelReducer);
  const wasted = useWastedIds(table.all);
  const rotation = useSharedValue(state.rotationDeg);
  const fade = useSharedValue(1);
  const count = state.players.length;

  // The wheel animates to the engine's target; the loser is read only when the animation reports it stopped.
  useEffect(() => {
    if (state.phase !== "spinning") return;
    const settle = () => dispatch({ type: "settle" });
    if (reduceMotion) {
      fade.value = withSequence(
        withTiming(0.2, { duration: duration.toggle }),
        withTiming(1, { duration: duration.toggle }, (done) => {
          if (done) runOnJS(settle)();
        }),
      );
      rotation.value = state.targetDeg;
      return;
    }
    rotation.value = withTiming(state.targetDeg, { duration: scaled(ui.calmMotion ? CALM_SPIN_MS : WHEEL_SPIN_MS), easing: easings.spin }, (done) => {
      if (done) runOnJS(settle)();
    });
  }, [state.phase, state.targetDeg, reduceMotion, ui.calmMotion, dispatch, rotation, fade]);

  // A detent click each time the pointer crosses into a new slice (MOT-07).
  useAnimatedReaction(
    () => Math.floor((((360 - (rotation.value % 360)) % 360) + 360) % 360 / (360 / Math.max(1, count))),
    (current, previous) => {
      if (previous !== null && current !== previous) runOnJS(haptic.select)();
    },
    [count],
  );

  useEffect(() => {
    if (state.phase === "result") haptic.heavy();
  }, [state.phase]);

  const wheelStyle = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ rotate: `${rotation.value}deg` }] }));

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
        <EndScreen gameId={session.gameId} players={table.all} ledger={state.ledger} endReason={state.endReason} startedAt={session.startedAt} record={topOf(state.losses, "records.wheel")} onAgain={onAgain} />
      </GameShell>
    );
  }

  const colours = palette.avatar;
  const spinning = state.phase === "spinning";
  const footer = <Button label={g.t("games.wheel.spin")} height={ui.action} disabled={spinning} onPress={() => dispatch({ type: "spin" })} />;

  return (
    <GameShell {...shellProps} status={g.t("shell.roundOpen", { round: state.round })} helpHidden={spinning} footer={footer} fab="top">
      <View style={styles.stage}>
        <Animated.View style={[styles.wheel, wheelStyle]} accessible accessibilityLabel={g.t("games.wheel.wheel", { count })}>
          <Svg width={SIZE} height={SIZE}>
            {state.players.map((player, i) => {
              const size = 360 / count;
              const mid = point(i * size + size / 2, R * 0.64);
              // Odd counts would put the same colour side by side at the wrap: the last slice skips one.
              const colour = colours[(i === count - 1 && count % colours.length === 1 ? i + 1 : i) % colours.length] ?? palette.accent.amber;
              return [
                <Path key={`s${player.id}`} d={segmentPath(i, count)} fill={colour} stroke={theme.bg} strokeWidth={2} />,
                <SvgText key={`t${player.id}`} x={mid.x} y={mid.y + 5} fontSize={count > 8 ? 12 : 15} fontFamily="Archivo-Bold" fill={palette.accent.onAccent} textAnchor="middle">
                  {player.name.length > 10 ? `${player.name.slice(0, 9)}.` : player.name}
                </SvgText>,
              ];
            })}
          </Svg>
          <View style={[styles.hub, { backgroundColor: theme.bg }]} />
        </Animated.View>
        <View style={[styles.pointer, { borderTopColor: theme.text }]} />
      </View>

      {state.phase === "result" && state.resultId ? (
        <Animated.View entering={FadeIn.duration(duration.enter)} style={styles.result}>
          <Text variant="h2" align="center" accessibilityLiveRegion="assertive">
            {g.t("games.wheel.picked", { name: table.nameOf(state.resultId) })}
          </Text>
          <PenaltyList lines={state.lastPenalties} players={table.all} wasted={wasted} forfeits={content.forfeits} />
        </Animated.View>
      ) : spinning ? (
        <Text variant="small" align="center">
          {g.t("games.wheel.spinning")}
        </Text>
      ) : null}
    </GameShell>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: "center", paddingTop: 18 },
  wheel: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  hub: { position: "absolute", width: 60, height: 60, borderRadius: 30 },
  pointer: {
    position: "absolute",
    top: 4,
    width: 0,
    height: 0,
    borderLeftWidth: 14,
    borderRightWidth: 14,
    borderTopWidth: 26,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  result: { gap: 12 },
});
