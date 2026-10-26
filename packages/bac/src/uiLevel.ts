/** Adaptive drunk UI level (ADP-01). 0 Fresh, 1 Tipsy, 2 Loaded, 3 Wasted. */
export type UiLevel = 0 | 1 | 2 | 3;

/** Entry thresholds in g/L of blood, research/bac.md §2.5. */
export const UI_LEVEL_ENTRY = [0, 0.5, 0.8, 1.2] as const;
/** A level is left only this far below its entry threshold. */
export const UI_LEVEL_HYSTERESIS = 0.1;
/** And only after being held this long, so a retro-logged drink never makes the screen flicker. */
export const UI_LEVEL_MIN_HOLD_MS = 10 * 60_000;

/** Above this projected value, sensitive actions wait for the next morning (ADP-06). */
export const VAULT_THRESHOLD = 0.8;
/** Drinks above this estimate earn nothing on leaderboards (RANK-07). */
export const DANGER_CAP = 1.2;
/** From here the crew sees the alcohol poisoning card. */
export const POISONING_CARD_THRESHOLD = 2.0;

export interface UiLevelState {
  level: UiLevel;
  /** When the current level was entered. */
  since: number;
}

function levelFor(bac: number): UiLevel {
  if (bac >= UI_LEVEL_ENTRY[3]) return 3;
  if (bac >= UI_LEVEL_ENTRY[2]) return 2;
  if (bac >= UI_LEVEL_ENTRY[1]) return 1;
  return 0;
}

/** Moves up at once, moves down one level at a time with hysteresis and a minimum hold. */
export function nextUiLevel(previous: UiLevelState | null, bac: number, now: number): UiLevelState {
  const target = levelFor(bac);
  if (!previous) return { level: target, since: now };
  if (target > previous.level) return { level: target, since: now };
  if (target === previous.level) return previous;

  const exitBelow = UI_LEVEL_ENTRY[previous.level] - UI_LEVEL_HYSTERESIS;
  const heldLongEnough = now - previous.since >= UI_LEVEL_MIN_HOLD_MS;
  if (bac < exitBelow && heldLongEnough) {
    return { level: (previous.level - 1) as UiLevel, since: now };
  }
  return previous;
}

/**
 * The level actually used by the UI. The user may pick a higher or a lower one;
 * the next-morning vault ignores this and follows the estimate.
 */
export function effectiveUiLevel(estimated: UiLevel, manual: UiLevel | null): UiLevel {
  return manual ?? estimated;
}

export function isVaultLocked(bacNow: number, projectedPeakNextHour: number): boolean {
  return Math.max(bacNow, projectedPeakNextHour) >= VAULT_THRESHOLD;
}
