import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { UI_LEVEL_ENTRY, type UiLevel } from "@crew/bac";
import { mathRandom, type Random } from "@crew/games";
import { useLiveParty } from "@/server/crewData";
import { useSession } from "@/server/session";
import { useLiveBac, useNow, useUiLevel } from "@/state/hooks";
import type { TablePlayer } from "./store";

export interface GameUi {
  /** Adaptive level of this phone's user (A-GAMES-2): it shapes the whole game screen. */
  level: UiLevel;
  /** Levels 2 and 3: giant targets, one main action, no long-press or precise swipe (ADP-04). */
  big: boolean;
  /** Height of the main game buttons. */
  action: number;
  /** Height of secondary buttons. */
  secondary: number;
  /** Player tiles. */
  tile: number;
  /** Motion becomes stable at levels 2 and 3 (DESIGN.md §6): no shake, no long sequences. */
  calmMotion: boolean;
}

/** Computed once per game screen and shared through GameUiContext, so every tile does not run its own BAC clock. */
export function useComputedGameUi(): GameUi {
  const now = useNow(30_000);
  const live = useLiveBac(now);
  const { level } = useUiLevel(live?.estimate.bac ?? 0, now);
  return useMemo(() => {
    const big = level >= 2;
    return { level, big, action: big ? 88 : level === 1 ? 64 : 56, secondary: big ? 64 : 52, tile: big ? 88 : level === 1 ? 76 : 68, calmMotion: big };
  }, [level]);
}

export const GameUiContext = createContext<GameUi | null>(null);

const FALLBACK_UI: GameUi = { level: 0, big: false, action: 56, secondary: 52, tile: 68, calmMotion: false };

export function useGameUi(): GameUi {
  return useContext(GameUiContext) ?? FALLBACK_UI;
}

/**
 * Players whose penalties must be water or a forfeit: the phone's own user at level 3, and crew members
 * of the live party whose shared BAC is in the level 3 range. Read at display time, never stored.
 */
export function useWastedIds(players: readonly TablePlayer[]): ReadonlySet<string> {
  const ui = useGameUi();
  const userId = useSession((s) => s.session?.userId ?? null);
  const liveParty = useLiveParty();
  return useMemo(() => {
    const ids = new Set<string>();
    const members = liveParty?.live?.members ?? [];
    for (const player of players) {
      if (!player.crewMemberId) continue;
      if (player.crewMemberId === userId && ui.level === 3) ids.add(player.id);
      const member = members.find((m) => m.userId === player.crewMemberId);
      if (member?.bac != null && member.bac >= UI_LEVEL_ENTRY[3]) ids.add(player.id);
    }
    return ids;
  }, [players, userId, ui.level, liveParty]);
}

/**
 * Runs a pure game reducer. The next state is computed outside React's updater, so a random draw
 * happens once per action even when React re-runs updaters.
 */
export function useEngine<S, A>(init: () => S, reduce: (state: S, action: A, rng: Random) => S): [S, (action: A) => void] {
  const [state, setState] = useState(init);
  const ref = useRef(state);
  const dispatch = useCallback(
    (action: A) => {
      const next = reduce(ref.current, action, mathRandom);
      if (next === ref.current) return;
      ref.current = next;
      setState(next);
    },
    [reduce],
  );
  return [state, dispatch];
}

/** Longest step a timer may take: a phone that slept does not burn a fuse in one go. */
const MAX_STEP_MS = 250;

/** Calls `onTick(deltaMs)` while `active`, with real elapsed time capped per step. */
export function useTicker(active: boolean, onTick: (deltaMs: number) => void, intervalMs = 50): void {
  const callback = useRef(onTick);
  callback.current = onTick;
  useEffect(() => {
    if (!active) return;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const delta = Math.min(MAX_STEP_MS, now - last);
      last = now;
      callback.current(delta);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);
}

/** Calls `onBackground` when the app leaves the foreground (call, lock screen, app switch). */
export function useOnBackground(onBackground: () => void): void {
  const callback = useRef(onBackground);
  callback.current = onBackground;
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      if (status !== "active") callback.current();
    });
    return () => subscription.remove();
  }, []);
}
