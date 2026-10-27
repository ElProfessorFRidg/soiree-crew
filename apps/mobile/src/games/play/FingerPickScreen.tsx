import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { StyleSheet, View, type GestureResponderEvent } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { duration, palette, space, scaled } from "@crew/design-tokens";
import { createFingerPick, fingerPickReducer, type Finger } from "@crew/games";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";
import { useEngine, useGameUi, useTicker, useWastedIds } from "../hooks";
import { useGameT } from "../i18n";
import { DrinkFab } from "../ui/DrinkFab";
import { GameShell } from "../ui/GameShell";
import { PenaltyList } from "../ui/PenaltyList";
import { PlayerGrid } from "../ui/PlayerGrid";
import { ids, useTable, type GameScreenProps } from "./common";

const DISC = 86;

/** One finger: a disc in a stable colour, ripples while the phone decides, then it grows or fades. */
function FingerDisc({ finger, settling, chosen, lost }: { finger: Finger; settling: boolean; chosen: boolean; lost: boolean }) {
  const reduceMotion = useReducedMotion();
  const ripple = useSharedValue(0);
  const pick = useSharedValue(0);
  useEffect(() => {
    if (settling && !reduceMotion) ripple.value = withRepeat(withTiming(1, { duration: duration.ripple, easing: Easing.out(Easing.quad) }), -1, false);
    else ripple.value = withTiming(0, { duration: scaled(150) });
  }, [settling, reduceMotion, ripple]);
  useEffect(() => {
    pick.value = withTiming(chosen || lost ? 1 : 0, { duration: scaled(400), easing: easings.out });
  }, [chosen, lost, pick]);

  const discStyle = useAnimatedStyle(() => ({
    opacity: lost ? 1 - pick.value * 0.85 : 1,
    transform: [{ scale: reduceMotion ? 1 : chosen ? 1 + pick.value * 0.35 : 1 }],
  }));
  const rippleStyle = useAnimatedStyle(() => ({ opacity: 0.9 * (1 - ripple.value), transform: [{ scale: 0.5 + ripple.value * 1.7 }] }));
  const colour = palette.avatar[finger.slot % palette.avatar.length] ?? palette.accent.amber;
  return (
    <View pointerEvents="none" style={[styles.finger, { left: finger.x - DISC / 2, top: finger.y - DISC / 2 }]}>
      <Animated.View style={[styles.ripple, { borderColor: palette.accent.amber }, rippleStyle]} />
      <Animated.View style={[styles.disc, { backgroundColor: colour, borderColor: chosen ? palette.dark.text : "transparent" }, discStyle]} />
    </View>
  );
}

export function FingerPickScreen({ session, content }: GameScreenProps) {
  const g = useGameT();
  const ui = useGameUi();
  const theme = useTheme();
  const table = useTable(session);
  const [state, dispatch] = useEngine(() => createFingerPick(session.level), fingerPickReducer);
  const wasted = useWastedIds(table.all);
  const known = useRef(new Set<string>());

  useTicker(state.phase === "settling", () => dispatch({ type: "tick", at: Date.now() }), 100);
  useEffect(() => {
    if (state.phase === "chosen") haptic.heavy();
  }, [state.phase]);

  /**
   * Real multi-touch through the responder system: every touch has its own identifier, so each finger
   * is tracked on its own and the chosen one is a touch, never a name.
   */
  const sync = (event: GestureResponderEvent) => {
    const now = Date.now();
    const touches = event.nativeEvent.touches ?? [];
    const present = new Set<string>();
    for (const touch of touches) {
      const id = String(touch.identifier);
      present.add(id);
      if (!known.current.has(id)) {
        known.current.add(id);
        haptic.select();
        dispatch({ type: "down", id, x: touch.locationX, y: touch.locationY, at: now });
      } else dispatch({ type: "move", id, x: touch.locationX, y: touch.locationY });
    }
    for (const id of [...known.current]) {
      if (!present.has(id)) {
        known.current.delete(id);
        dispatch({ type: "up", id, at: now });
      }
    }
  };
  const liftAll = () => {
    const now = Date.now();
    for (const id of known.current) dispatch({ type: "up", id, at: now });
    known.current.clear();
  };

  const message =
    state.phase === "chosen" ? g.t("games.fingerPick.chosen") : state.phase === "settling" ? g.t("games.fingerPick.hold") : g.t("games.fingerPick.place");

  return (
    <GameShell
      gameId={session.gameId}
      players={table.all}
      activeIds={ids(table.all)}
      ledger={state.ledger}
      onStop={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/games"))}
      fab="none"
      scroll={false}
      bleed
    >
      <View style={styles.screen}>
        <View
          style={[styles.surface, { backgroundColor: theme.bg }]}
          accessible
          accessibilityLabel={g.t("games.fingerPick.surface")}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={sync}
          onResponderStart={sync}
          onResponderMove={sync}
          onResponderEnd={sync}
          onResponderRelease={sync}
          onResponderTerminate={liftAll}
        >
          <View pointerEvents="none" style={styles.overlay}>
            <Text variant="small">{g.plural("games.fingerPick.fingers", state.fingers.length)}</Text>
            <Text variant="h2" accessibilityLiveRegion="assertive">
              {message}
            </Text>
          </View>
          {state.fingers.map((finger) => (
            <FingerDisc
              key={finger.id}
              finger={finger}
              settling={state.phase === "settling"}
              chosen={state.phase === "chosen" && finger.id === state.chosenId}
              lost={state.phase === "chosen" && finger.id !== state.chosenId}
            />
          ))}
        </View>

        <View style={[styles.bar, { borderTopColor: theme.line }]}>
          {state.phase === "chosen" ? (
            <>
              {state.lastPenalties.length === 0 ? (
                <>
                  <Text variant="h3">{g.t("games.fingerPick.whose")}</Text>
                  <PlayerGrid players={table.all} onPress={(id) => dispatch({ type: "assign", playerId: id })} />
                </>
              ) : (
                <PenaltyList lines={state.lastPenalties} players={table.all} wasted={wasted} forfeits={content.forfeits} />
              )}
            </>
          ) : null}
          <View style={styles.barRow}>
            {/* O-32 sits in the bottom bar here: a floating button would catch fingers on the play area. */}
            <DrinkFab />
            <Button
              label={g.t("games.fingerPick.again")}
              variant={state.phase === "chosen" ? "primary" : "secondary"}
              height={ui.action}
              style={styles.flex}
              disabled={state.phase !== "chosen"}
              onPress={() => {
                known.current.clear();
                dispatch({ type: "reset" });
              }}
            />
          </View>
        </View>
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  surface: { flex: 1, overflow: "hidden" },
  overlay: { position: "absolute", top: 8, left: space.screenX, right: space.screenX, gap: 6 },
  finger: { position: "absolute", width: DISC, height: DISC, alignItems: "center", justifyContent: "center" },
  disc: { width: DISC, height: DISC, borderRadius: DISC / 2, borderWidth: 3 },
  ripple: { position: "absolute", width: DISC, height: DISC, borderRadius: DISC / 2, borderWidth: 3 },
  bar: { paddingHorizontal: space.screenX, paddingTop: 12, paddingBottom: 28, gap: 12, borderTopWidth: 1 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
});
