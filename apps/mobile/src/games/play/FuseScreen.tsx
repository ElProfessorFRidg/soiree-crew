import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { duration, palette } from "@crew/design-tokens";
import { createFuse, fuseEscalation, fuseHolder, fuseReducer, fuseTickInterval, mathRandom } from "@crew/games";
import { haptic } from "@/motion/haptics";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Switch } from "@/ui/controls";
import { ScalePressable } from "@/ui/Pressable";
import { Text } from "@/ui/Text";
import { useEngine, useGameUi, useOnBackground, useTicker, useWastedIds } from "../hooks";
import { useGameT } from "../i18n";
import { toEnginePlayer } from "../store";
import { Burst } from "../ui/Burst";
import { EndScreen, topOf } from "../ui/EndScreen";
import { GameShell } from "../ui/GameShell";
import { GameIcon } from "../ui/GameIcon";
import { useShake } from "../ui/motion";
import { PenaltyList } from "../ui/PenaltyList";
import { PlayerGrid } from "../ui/PlayerGrid";
import { cardColours, ids, useTable, type GameScreenProps } from "./common";

const BOMB = 180;
const RESUME_COUNT_MS = 2_100;

export function FuseScreen({ session, content, onAgain }: GameScreenProps) {
  const g = useGameT();
  const ui = useGameUi();
  const theme = useTheme();
  const table = useTable(session);
  const [state, dispatch] = useEngine(
    () => createFuse({ players: session.players.map(toEnginePlayer), level: session.level, content: content.fusePrompts, rng: mathRandom }),
    fuseReducer,
  );
  const wasted = useWastedIds(table.all);
  // Phone left on the table: suggested when the phone's owner is at adaptive level 2 or 3 (dropped phones).
  const [tableStyle, setTableStyle] = useState(ui.big);
  const [picking, setPicking] = useState(false);
  const [resuming, setResuming] = useState(false);
  const burning = state.phase === "burning";
  const escalation = fuseEscalation(state);

  useTicker(burning, (delta) => dispatch({ type: "tick", deltaMs: delta }));
  // A call or a locked screen pauses the fuse; nobody gains from it, the holder keeps the bomb.
  useOnBackground(() => dispatch({ type: "pause" }));

  // Tick haptics, faster as the danger grows (never from the real fuse).
  const escalationRef = useRef(escalation);
  escalationRef.current = escalation;
  useEffect(() => {
    if (!burning) return;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      haptic.select();
      timer = setTimeout(loop, fuseTickInterval(state.level, escalationRef.current, mathRandom));
    };
    timer = setTimeout(loop, fuseTickInterval(state.level, escalationRef.current, mathRandom));
    return () => clearTimeout(timer);
  }, [burning, state.level]);

  useEffect(() => {
    if (state.phase === "exploded") haptic.heavy();
  }, [state.phase]);

  // Colour warms in three steps on the escalation ratio: cream, amber, coral.
  const step = useSharedValue(0);
  useEffect(() => {
    step.value = withTiming(state.phase === "exploded" ? 3 : escalation > 0.66 ? 2 : escalation > 0.33 ? 1 : 0, { duration: 400 });
  }, [escalation, state.phase, step]);
  const discColour = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(step.value, [0, 1, 2, 3], [palette.dark.text, palette.accent.amber, cardColours.coral, palette.semantic.danger]),
  }));
  const shake = useShake(Math.max(0, (escalation - 0.5) * 2), burning && !ui.calmMotion);

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
        <EndScreen gameId={session.gameId} players={table.all} ledger={state.ledger} endReason={state.endReason} startedAt={session.startedAt} record={topOf(state.bestStreaks, "records.fuse")} onAgain={onAgain} />
      </GameShell>
    );
  }

  const holder = fuseHolder(state);
  const nextPlayer = state.order.players[(state.order.turn + 1) % Math.max(1, state.order.players.length)];
  const freePass = state.level === "extreme" && !ui.big;
  const pass = (targetId?: string) => {
    haptic.select();
    dispatch(targetId ? { type: "pass", targetId } : { type: "pass" });
    setPicking(false);
  };
  const resume = () => {
    setResuming(true);
    setTimeout(() => {
      setResuming(false);
      dispatch({ type: "resume" });
    }, RESUME_COUNT_MS);
  };

  let footer = null;
  if (state.phase === "idle") footer = <Button label={g.t("games.fuse.light")} height={ui.action} onPress={() => dispatch({ type: "light" })} />;
  else if (state.phase === "exploded") footer = <Button label={g.t("games.fuse.nextRound")} height={ui.action} onPress={() => dispatch({ type: "nextRound" })} />;
  else if (state.phase === "paused") footer = <Button label={g.t("games.fuse.resume")} height={ui.action} loading={resuming} onPress={resume} />;
  else if (burning && !tableStyle) {
    footer = freePass ? (
      <Button label={g.t("games.fuse.pickTarget")} height={ui.action} onPress={() => setPicking(true)} />
    ) : (
      <Button label={g.t("games.fuse.pass", { name: nextPlayer?.name ?? "" })} height={ui.action} fontSize={18} onPress={() => pass()} />
    );
  }

  const status = state.rounds !== null ? g.t("shell.round", { round: state.round, rounds: state.rounds }) : g.t("shell.roundOpen", { round: state.round });

  return (
    <GameShell {...shellProps} status={status} helpHidden={burning} footer={footer} fab="top">
      <View style={[styles.prompt, { backgroundColor: palette.dark.text }]}>
        <Text variant="small" color={cardColours.muted}>
          {g.t("games.fuse.prompt")}
        </Text>
        <Text variant="h2" color={palette.accent.onAccent}>
          {state.prompt ?? ""}
        </Text>
      </View>

      <View style={styles.arena}>
        <Animated.View style={[styles.bomb, discColour, shake]} accessible accessibilityLabel={g.t("games.fuse.bomb")}>
          <GameIcon game="fuse" size={84} color={palette.accent.onAccent} />
        </Animated.View>
        {state.phase === "exploded" ? <Burst size={BOMB} calm={ui.calmMotion} /> : null}
      </View>

      <Animated.View key={`${holder?.id}-${state.phase}`} entering={FadeIn.duration(duration.toggle)}>
        <Text variant="h1" align="center" accessibilityLiveRegion="assertive" style={tableStyle ? styles.huge : null}>
          {state.phase === "exploded"
            ? g.t("games.fuse.boom", { name: holder?.name ?? "" })
            : state.phase === "paused"
              ? g.t("games.fuse.paused")
              : g.t("games.fuse.holder", { name: holder?.name ?? "" })}
        </Text>
      </Animated.View>

      {burning && tableStyle ? (
        <ScalePressable
          accessibilityLabel={g.t("games.fuse.pass", { name: nextPlayer?.name ?? "" })}
          onPress={() => (freePass ? setPicking(true) : pass())}
          pressedScale={0.98}
          style={[styles.passZone, { backgroundColor: theme.amber }]}
        >
          <Text variant="h2" color={palette.accent.onAccent} align="center">
            {freePass ? g.t("games.fuse.pickTarget") : g.t("games.fuse.pass", { name: nextPlayer?.name ?? "" })}
          </Text>
        </ScalePressable>
      ) : null}

      {burning && picking ? <PlayerGrid players={state.order.players.filter((p) => p.id !== holder?.id)} onPress={(id) => pass(id)} /> : null}

      {state.phase === "exploded" ? <PenaltyList lines={state.lastPenalties} players={table.all} wasted={wasted} forfeits={content.forfeits} /> : null}

      {state.phase === "idle" ? (
        <View style={styles.switchRow}>
          <Text style={styles.flex}>{g.t("games.fuse.tableStyle")}</Text>
          <Switch value={tableStyle} onValueChange={setTableStyle} accessibilityLabel={g.t("games.fuse.tableStyle")} />
        </View>
      ) : null}
    </GameShell>
  );
}

const styles = StyleSheet.create({
  prompt: { borderRadius: 18, padding: 16, gap: 4 },
  arena: { height: 260, alignItems: "center", justifyContent: "center" },
  bomb: { width: BOMB, height: BOMB, borderRadius: BOMB / 2, alignItems: "center", justifyContent: "center" },
  huge: { fontSize: 40, lineHeight: 44 },
  passZone: { minHeight: 180, borderRadius: 24, alignItems: "center", justifyContent: "center", padding: 20 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
});
