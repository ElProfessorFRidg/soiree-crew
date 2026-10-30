import {
  ABSORPTION_HALF_LIFE_FASTED_MIN,
  ABSORPTION_HALF_LIFE_FED_MIN,
  ABSORPTION_HALF_LIFE_LIGHT_MIN,
  BETA_CENTRAL,
  BETA_FED,
  BETA_LIGHT,
  BETA_SAFE,
  ETHANOL_DENSITY_G_PER_ML,
  KM,
  STEP_MS,
  ZERO_BAC,
  ZERO_GUT_GRAMS,
} from "./constants";

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
/** A dose older than this has left the gut to machine precision, even with food. */
const DOSE_WINDOW_MS = 24 * HOUR_MS;
/** A meal logged with a drink keeps elimination at the fed rate for this long. */
const FED_WINDOW_MS = 6 * HOUR_MS;

/** O-85: what was in the stomach. Unknown counts as "none", so a peak is never under-estimated. */
export type FoodLevel = "none" | "light" | "full";
export const FOOD_LEVELS: readonly FoodLevel[] = ["none", "light", "full"];

export interface DrinkIntake {
  id: string;
  volumeMl: number;
  /** Alcohol by volume as a fraction: 0.05 for a 5 % beer. */
  abv: number;
  /** UTC epoch milliseconds. */
  consumedAt: number;
  /** Older entries carry only this switch: true reads as a full meal. */
  withFood?: boolean;
  /** Wins over `withFood` when set. */
  food?: FoodLevel;
}

/** The food level of a drink, from the level when known, else from the old switch. */
export function foodOf(drink: Pick<DrinkIntake, "food" | "withFood">): FoodLevel {
  return drink.food ?? (drink.withFood ? "full" : "none");
}

const FOOD_RANK: Record<FoodLevel, 0 | 1 | 2> = { none: 0, light: 1, full: 2 };
const HALF_LIFE_MIN: Record<FoodLevel, number> = {
  none: ABSORPTION_HALF_LIFE_FASTED_MIN,
  light: ABSORPTION_HALF_LIFE_LIGHT_MIN,
  full: ABSORPTION_HALF_LIFE_FED_MIN,
};

/** `central` is the number the BAC shows; `safe` is the slow-elimination model behind every driving estimate. */
export type EliminationModel = "central" | "safe";

export interface BacPoint {
  at: number;
  /** g/L of blood. */
  bac: number;
  /** Grams of ethanol not absorbed yet. */
  gutGrams: number;
}

interface Dose {
  at: number;
  grams: number;
  /** Absorption rate constant, per millisecond. */
  ka: number;
  /** 0 fasted, 1 light meal, 2 full meal. */
  fed: 0 | 1 | 2;
}

export function ethanolGrams(volumeMl: number, abv: number): number {
  return volumeMl * abv * ETHANOL_DENSITY_G_PER_ML;
}

function toDoses(drinks: readonly DrinkIntake[], now: number): Dose[] {
  const seen = new Set<string>();
  const doses: Dose[] = [];
  for (const drink of drinks) {
    // A drink stamped in the future does not exist yet. Ids make retries and widget taps idempotent.
    if (drink.consumedAt > now || seen.has(drink.id)) continue;
    seen.add(drink.id);
    const grams = ethanolGrams(drink.volumeMl, drink.abv);
    if (!(grams > 0)) continue;
    const food = foodOf(drink);
    doses.push({
      at: drink.consumedAt,
      grams,
      ka: Math.LN2 / (HALF_LIFE_MIN[food] * MINUTE_MS),
      fed: FOOD_RANK[food],
    });
  }
  return doses.sort((a, b) => a.at - b.at);
}

/**
 * Integrates dC/dt = absorption(t) / Vd - beta * C / (Km + C) with RK4
 * (research/bac.md §2.1.3). Steps are cut at every dose so a bolus never lands
 * mid-step, and stretches spent at zero are skipped so long histories stay cheap.
 * The result depends only on the drink list, the profile and `now`, so the app,
 * the widgets and the server compute the same curve.
 */
export class BacSimulation {
  private readonly doses: Dose[];
  private readonly betaPerMs: number;
  private readonly fedBetaPerMs: number;
  private readonly lightBetaPerMs: number;
  private points: BacPoint[] | undefined;
  private computedUntil = Number.NEGATIVE_INFINITY;

  constructor(
    drinks: readonly DrinkIntake[],
    private readonly distributionVolumeL: number,
    readonly now: number,
    model: EliminationModel = "central",
  ) {
    this.doses = toDoses(drinks, now);
    this.betaPerMs = (model === "safe" ? BETA_SAFE : BETA_CENTRAL) / HOUR_MS;
    this.fedBetaPerMs = (model === "safe" ? BETA_SAFE : BETA_FED) / HOUR_MS;
    this.lightBetaPerMs = (model === "safe" ? BETA_SAFE : BETA_LIGHT) / HOUR_MS;
  }

  get firstDrinkAt(): number | undefined {
    return this.doses[0]?.at;
  }

  /**
   * Integration points from the first drink until `until`, or until the BAC is
   * back to zero with nothing left to absorb and no drink after.
   */
  trace(until: number): readonly BacPoint[] {
    if (this.points && this.computedUntil >= until) return this.points;
    this.points = this.integrate(until);
    this.computedUntil = until;
    return this.points;
  }

  private integrate(until: number): BacPoint[] {
    const doses = this.doses;
    const points: BacPoint[] = [];
    const first = doses[0];
    if (!first) return points;

    let windowStart = 0;
    let nextDose = 0;
    let t = first.at;
    let c = 0;

    // `activeEnd` is exclusive. During a step only the doses started at its
    // beginning count: a dose that starts exactly at the step's end belongs to
    // the next step, otherwise RK4 would feed it into k4 and overshoot.
    const evaluate = (time: number, activeEnd: number): { gut: number; input: number; fed: 0 | 1 | 2 } => {
      let gut = 0;
      let input = 0;
      let fed: 0 | 1 | 2 = 0;
      for (let i = windowStart; i < activeEnd; i++) {
        const dose = doses[i]!;
        if (dose.at > time) break;
        const amount = dose.grams * Math.exp(-dose.ka * (time - dose.at));
        gut += amount;
        input += dose.ka * amount;
        if (dose.fed > fed && time - dose.at < FED_WINDOW_MS) fed = dose.fed;
      }
      return { gut, input: input / this.distributionVolumeL, fed };
    };

    const derivative = (time: number, conc: number): number => {
      const { input, fed } = evaluate(time, nextDose);
      const beta = fed === 2 ? this.fedBetaPerMs : fed === 1 ? this.lightBetaPerMs : this.betaPerMs;
      const positive = Math.max(conc, 0);
      return input - (beta * positive) / (KM + positive);
    };

    points.push({ at: t, bac: 0, gutGrams: evaluate(t, doses.length).gut });

    while (t < until) {
      while (nextDose < doses.length && doses[nextDose]!.at <= t) nextDose++;
      while (windowStart < nextDose && t - doses[windowStart]!.at > DOSE_WINDOW_MS) windowStart++;

      const gut = points[points.length - 1]!.gutGrams;
      if (c < ZERO_BAC && gut < ZERO_GUT_GRAMS) {
        const upcoming = doses[nextDose];
        if (!upcoming) break;
        if (upcoming.at > t + STEP_MS) {
          // Back to zero before the next drink: the next episode starts from scratch.
          c = 0;
          points.push({ at: t, bac: 0, gutGrams: 0 });
          t = upcoming.at;
          points.push({ at: t, bac: 0, gutGrams: evaluate(t, doses.length).gut });
          continue;
        }
      }

      let stepEnd = Math.min(t + STEP_MS, until);
      const upcomingAt = doses[nextDose]?.at;
      if (upcomingAt !== undefined && upcomingAt > t && upcomingAt < stepEnd) stepEnd = upcomingAt;
      const h = stepEnd - t;

      const k1 = derivative(t, c);
      const k2 = derivative(t + h / 2, c + (h / 2) * k1);
      const k3 = derivative(t + h / 2, c + (h / 2) * k2);
      const k4 = derivative(stepEnd, c + h * k3);
      c = Math.max(0, c + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4));
      t = stepEnd;
      points.push({ at: t, bac: c, gutGrams: evaluate(t, doses.length).gut });
    }
    return points;
  }

  /** BAC at one instant, g/L, interpolated between integration points. */
  bacAt(at: number): number {
    return this.pointAt(at).bac;
  }

  pointAt(at: number): BacPoint {
    const points = this.trace(at);
    const first = points[0];
    if (!first || at <= first.at) return { at, bac: 0, gutGrams: 0 };
    const last = points[points.length - 1]!;
    if (at >= last.at) return { at, bac: at === last.at ? last.bac : 0, gutGrams: at === last.at ? last.gutGrams : 0 };

    let lo = 0;
    let hi = points.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (points[mid]!.at <= at) lo = mid;
      else hi = mid;
    }
    const a = points[lo]!;
    const b = points[hi]!;
    const span = b.at - a.at;
    const f = span === 0 ? 0 : (at - a.at) / span;
    return { at, bac: a.bac + (b.bac - a.bac) * f, gutGrams: a.gutGrams + (b.gutGrams - a.gutGrams) * f };
  }

  /** Evenly spaced samples for charts and widgets. */
  sample(from: number, to: number, everyMs: number): BacPoint[] {
    this.trace(to);
    const samples: BacPoint[] = [];
    for (let at = from; at <= to; at += everyMs) samples.push(this.pointAt(at));
    return samples;
  }
}
