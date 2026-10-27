import { useEffect, useRef, useState, type ComponentRef } from "react";
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import Svg, { Polyline } from "react-native-svg";
import { duration, palette, radius } from "@crew/design-tokens";
import { crashReducer, createCrash, mathRandom, stakeAt, stillIn } from "@crew/games";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Numeral, Text } from "@/ui/Text";
import { useEngine, useGameUi, useOnBackground, useTicker, useWastedIds } from "../hooks";
import { useGameT } from "../i18n";
import { toEnginePlayer } from "../store";
import { EndScreen, topOf } from "../ui/EndScreen";
import { GameShell } from "../ui/GameShell";
import { Tremble, useShake } from "../ui/motion";
import { PenaltyList } from "../ui/PenaltyList";
import { PlayerGrid } from "../ui/PlayerGrid";
import { ids, useTable, type GameScreenProps } from "./common";

const CHART_W = 340;
const CHART_H = 220;
const BEAT_MS = 700;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function CrashScreen({ session, content, onAgain }: GameScreenProps) {
  const g = useGameT();
  const ui = useGameUi();
  const theme = useTheme();
  const table = useTable(session);
  const [state, dispatch] = useEngine(() => createCrash({ players: session.players.map(toEnginePlayer), level: session.level }), crashReducer);
  const wasted = useWastedIds(table.all);
  const [beat, setBeat] = useState<number | null>(null);
  const trail = useRef<{ t: number; m: number }[]>([]);
  const tiles = useRef<Record<string, Rect>>({});
  const area = useRef<ComponentRef<typeof View>>(null);
  const areaOffset = useRef({ x: 0, y: 0 });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const running = state.phase === "running";
  useTicker(running, (delta) => dispatch({ type: "tick", deltaMs: delta }), 33);
  // No pausing a live curve: leaving the app calls the round off, nobody pays.
  useOnBackground(() => dispatch({ type: "cancel" }));

  const stake = stakeAt(state.level, state.multiplier);
  const lastStake = useRef(stake);
  useEffect(() => {
    // A selection tick every time the stake steps up: the steps come faster as the curve accelerates.
    if (running && stake > lastStake.current) haptic.select();
    lastStake.current = stake;
  }, [stake, running]);
  useEffect(() => {
    if (state.phase === "crashed" || state.phase === "award") haptic.heavy();
    if (state.phase === "idle") trail.current = [];
  }, [state.phase]);
  if (running) trail.current.push({ t: state.elapsedMs, m: state.multiplier });

  const shake = useShake(running && stake >= 3 ? Math.min(1, (stake - 2) / 4) : 0, running && !ui.calmMotion);

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
        <EndScreen gameId={session.gameId} players={table.all} ledger={state.ledger} endReason={state.endReason} startedAt={session.startedAt} record={topOf(state.bestExit, "records.crash")} onAgain={onAgain} />
      </GameShell>
    );
  }

  const start = () => {
    [3, 2, 1].forEach((n, i) =>
      timers.current.push(
        setTimeout(() => {
          setBeat(n);
          haptic.holdTick();
        }, i * BEAT_MS),
      ),
    );
    timers.current.push(
      setTimeout(() => {
        setBeat(null);
        dispatch({ type: "start" });
      }, 3 * BEAT_MS),
    );
  };

  /** Several players can bail out at the same instant: each new touch is matched to the tile under it. */
  const onTouches = (event: GestureResponderEvent) => {
    if (!running) return;
    for (const touch of event.nativeEvent.changedTouches ?? []) {
      // Page coordinates: locationX would be relative to whichever child the finger landed on.
      const x = touch.pageX - areaOffset.current.x;
      const y = touch.pageY - areaOffset.current.y;
      const hit = Object.entries(tiles.current).find(([, r]) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
      if (hit) exit(hit[0]);
    }
  };
  const exit = (id: string) => {
    if (!running || state.exits[id]) return;
    haptic.confirmed();
    dispatch({ type: "exit", playerId: id });
  };

  const crashed = state.phase === "crashed" || state.phase === "award";
  const lineColour = crashed ? theme.danger : theme.amber;
  const points = trail.current;
  const maxT = Math.max(6_000, (points[points.length - 1]?.t ?? 0) * 1.1);
  const maxM = Math.max(2, state.multiplier * 1.2);
  const line = points.map((p) => `${((p.t / maxT) * CHART_W).toFixed(1)},${(CHART_H - ((p.m - 1) / (maxM - 1)) * (CHART_H - 16)).toFixed(1)}`).join(" ");
  const inNow = new Set(stillIn(state).map((p) => p.id));

  let footer = null;
  if (state.phase === "idle") footer = <Button label={g.t("games.crash.start")} height={ui.action} disabled={beat !== null} onPress={start} />;
  else if (state.phase === "crashed") footer = <Button label={g.t("games.crash.next")} height={ui.action} onPress={() => dispatch({ type: "next" })} />;

  const status = state.rounds !== null ? g.t("shell.round", { round: state.round, rounds: state.rounds }) : g.t("shell.roundOpen", { round: state.round });

  return (
    <GameShell {...shellProps} status={status} helpHidden={running} fab={running ? "none" : "top"} footer={footer} scroll={!running}>
      <View style={[styles.chart, { backgroundColor: theme.surface }]} accessible accessibilityLabel={g.t("games.crash.curve", { stake })}>
        <Animated.View style={[StyleSheet.absoluteFill, shake]}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none">
            {points.length > 1 ? <Polyline points={line} stroke={lineColour} strokeWidth={4} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null}
          </Svg>
        </Animated.View>
        {/* The number stays still: players must read it (research/games.md §2.4). */}
        <View style={styles.stake}>
          <Numeral size={ui.big ? 88 : 72} color={lineColour}>
            {String(crashed ? stakeAt(state.level, state.crashPoint) : stake)}
          </Numeral>
          <Text variant="h3" color={theme.textSoft}>
            {g.t("games.crash.atStake")}
          </Text>
        </View>
        {beat !== null ? (
          <Animated.View key={beat} entering={ZoomIn.duration(duration.pop).easing(easings.out)} style={[StyleSheet.absoluteFill, styles.center]}>
            <Numeral size={110} color={theme.text}>
              {String(beat)}
            </Numeral>
          </Animated.View>
        ) : null}
      </View>

      <Text variant="h3" accessibilityLiveRegion="polite">
        {crashed
          ? inNow.size === 0
            ? g.t("games.crash.everyoneOut")
            : g.t("games.crash.crashedAt", { stake: stakeAt(state.level, state.crashPoint) })
          : running
            ? g.t("games.crash.hint")
            : ""}
      </Text>

      <View
        ref={area}
        style={styles.tiles}
        onLayout={() => area.current?.measureInWindow((x, y) => (areaOffset.current = { x, y }))}
        onStartShouldSetResponder={() => running}
        onResponderTerminationRequest={() => false}
        onResponderGrant={onTouches}
        onResponderStart={onTouches}
      >
        {state.players.map((player) => {
          const out = state.exits[player.id];
          const caught = crashed && inNow.has(player.id);
          return (
            <View
              key={player.id}
              style={styles.tileWrap}
              onLayout={(e: LayoutChangeEvent) => {
                const { x, y, width, height } = e.nativeEvent.layout;
                tiles.current[player.id] = { x, y, w: width, h: height };
              }}
            >
            <Tremble trigger={caught ? state.round : null} calm={ui.calmMotion}>
              <View
                accessible
                accessibilityRole="button"
                accessibilityLabel={out ? g.t("games.crash.exitAt", { stake: stakeAt(state.level, out.multiplier) }) : g.t("games.crash.exitFor", { name: player.name })}
                onAccessibilityTap={() => exit(player.id)}
                style={[
                  styles.tile,
                  {
                    minHeight: ui.big ? 96 : 76,
                    backgroundColor: out ? theme.text : caught ? palette.tint.dangerBg : theme.surface2,
                  },
                ]}
              >
                <Avatar personId={player.id} name={player.name} size={ui.big ? 44 : 36} />
                <View style={styles.tileText}>
                  <Text variant="h3" color={out ? theme.bg : theme.text} numberOfLines={2}>
                    {player.name}
                  </Text>
                  {out ? (
                    <Text variant="small" color={theme.bg}>
                      {g.t("games.crash.exitAt", { stake: stakeAt(state.level, out.multiplier) })}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Tremble>
            </View>
          );
        })}
      </View>

      {crashed ? <PenaltyList lines={state.lastPenalties} players={table.all} wasted={wasted} forfeits={content.forfeits} /> : null}
      {state.phase === "award" && state.award ? (
        <>
          <Text variant="h3">{g.plural("games.crash.award", state.award.sips, { name: table.nameOf(state.award.playerId) })}</Text>
          <PlayerGrid players={state.players.filter((p) => p.id !== state.award?.playerId)} onPress={(id) => dispatch({ type: "award", targetId: id })} />
        </>
      ) : null}
    </GameShell>
  );
}

const styles = StyleSheet.create({
  chart: { height: CHART_H + 30, borderRadius: radius.card + 2, overflow: "hidden" },
  stake: { position: "absolute", left: 18, top: 14, flexDirection: "row", alignItems: "flex-end", gap: 8 },
  center: { alignItems: "center", justifyContent: "center" },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" },
  tileWrap: { flexBasis: "48%", flexGrow: 1 },
  tile: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: radius.tile },
  tileText: { flex: 1, minWidth: 0 },
});
