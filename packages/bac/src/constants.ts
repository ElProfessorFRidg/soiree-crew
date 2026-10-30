// Every default below is traced to research/bac.md §2.1.3. Changing one changes
// what people read before deciding how to get home, so it needs a source.

export const ETHANOL_DENSITY_G_PER_ML = 0.789;

export const DEFAULT_R_MALE = 0.7;
export const DEFAULT_R_FEMALE = 0.6;
export const R_MIN = 0.4;
export const R_MAX = 0.8;

/** Central elimination rate, g/L/h. */
export const BETA_CENTRAL = 0.15;
/** Elimination rate after a meal, g/L/h. */
export const BETA_FED = 0.2;
/**
 * O-85: elimination after a light meal (a snack), g/L/h. Half way between fasted and fed, inside
 * the published 0.15-0.20 range (research/bac.md S8, S13); not calibrated on its own curve.
 */
export const BETA_LIGHT = 0.175;
/** Slow end of the published range, used for every driving estimate. */
export const BETA_SAFE = 0.1;

/** Michaelis constant, g/L. Makes elimination taper near zero instead of stopping with a corner. */
export const KM = 0.05;

/** Absorption half-life when food is unknown. Deliberately fast so peaks are never under-estimated. */
export const ABSORPTION_HALF_LIFE_FASTED_MIN = 6;
export const ABSORPTION_HALF_LIFE_FED_MIN = 40;
/** O-85: a light meal, between the two calibrated values and inside the 15-20 min of S11. */
export const ABSORPTION_HALF_LIFE_LIGHT_MIN = 20;

/** Below this the app shows 0.00 in every unit. */
export const ZERO_BAC = 0.005;
/** Grams of ethanol still in the gut below which absorption is considered over. */
export const ZERO_GUT_GRAMS = 0.1;

export const STEP_MS = 15_000;
/** Projections stop here even at extreme levels (T3b clears after 41 h). */
export const MAX_HORIZON_MS = 96 * 3_600_000;

/** Trend dead band, g/L/h. */
export const TREND_DEAD_BAND = 0.02;
