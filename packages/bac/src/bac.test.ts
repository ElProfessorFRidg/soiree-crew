import { describe, expect, it } from "vitest";
import {
  BacSimulation,
  distributionFactor,
  distributionVolume,
  estimateBac,
  estimateDriving,
  ethanolGrams,
  isVaultLocked,
  nextUiLevel,
  type BodyProfile,
  type DrinkIntake,
} from "./index";

// Reference cases from research/bac.md §2.7. Tolerance: 0.005 g/L, 3 minutes.
const H = 3_600_000;
const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 24, 20, 0);
const G_TOL = 0.005;
const TIME_TOL_MS = 3 * MIN;

const man80: BodyProfile = { weightKg: 80, bodyModel: "male" };
const woman60: BodyProfile = { weightKg: 60, bodyModel: "female" };
const man70: BodyProfile = { weightKg: 70, bodyModel: "male" };

let seq = 0;
function drink(hours: number, volumeMl: number, abv: number, extra: Partial<DrinkIntake> = {}): DrinkIntake {
  seq += 1;
  return { id: `d${seq}`, volumeMl, abv, consumedAt: T0 + hours * H, ...extra };
}
const pint = (h: number, extra?: Partial<DrinkIntake>) => drink(h, 500, 0.05, extra);
const wine = (h: number, extra?: Partial<DrinkIntake>) => drink(h, 125, 0.12, extra);

function sim(drinks: DrinkIntake[], profile: BodyProfile, now = T0 + 200 * H, model: "central" | "safe" = "central") {
  return new BacSimulation(drinks, distributionVolume(profile), now, model);
}

function peakOf(s: BacSimulation, from: number, to: number) {
  let best = { bac: 0, at: from };
  for (const p of s.sample(from, to, 15_000)) if (p.bac > best.bac) best = { bac: p.bac, at: p.at };
  return best;
}

function firstBelow(s: BacSimulation, threshold: number, after: number, to: number): number {
  for (const p of s.sample(after, to, 15_000)) if (p.bac < threshold) return p.at;
  return Number.NaN;
}

function expectTime(actual: number, hours: number) {
  expect(Math.abs(actual - (T0 + hours * H))).toBeLessThanOrEqual(TIME_TOL_MS);
}

describe("doses", () => {
  it("computes grams of ethanol with density 0.789", () => {
    expect(ethanolGrams(250, 0.05)).toBeCloseTo(9.86, 2);
    expect(ethanolGrams(500, 0.05)).toBeCloseTo(19.73, 2);
    expect(ethanolGrams(568, 0.04)).toBeCloseTo(17.93, 2);
    expect(ethanolGrams(40, 0.4)).toBeCloseTo(12.62, 2);
  });
});

describe("T1: man 80 kg, one 50 cl 5 % beer", () => {
  const s = sim([pint(0)], man80);
  it("follows the absorption curve", () => {
    expect(s.bacAt(T0 + 0.25 * H)).toBeCloseTo(0.263, 2);
    expect(Math.abs(s.bacAt(T0 + 1 * H) - 0.23)).toBeLessThan(G_TOL);
    expect(Math.abs(s.bacAt(T0 + 2 * H) - 0.115)).toBeLessThan(G_TOL);
    expect(Math.abs(s.bacAt(T0 + 3 * H) - 0.031)).toBeLessThan(G_TOL);
  });
  it("peaks at 0.284 g/L after 25 min", () => {
    const peak = peakOf(s, T0, T0 + 2 * H);
    expect(Math.abs(peak.bac - 0.284)).toBeLessThan(G_TOL);
    expectTime(peak.at, 25 / 60);
  });
  it("is back to zero at 3.78 h and stays at zero 24 h later", () => {
    const e = estimateBac([pint(0)], man80, T0 + 1 * H);
    expect(e.backToZeroAt).not.toBeNull();
    expectTime(e.backToZeroAt!, 3.78);
    expect(s.bacAt(T0 + 24 * H)).toBe(0);
  });
});

describe("T2: woman 60 kg, three wines at 0, 0.5, 1 h", () => {
  const drinks = [wine(0), wine(0.5), wine(1)];
  const s = sim(drinks, woman60);
  it("matches the reference curve", () => {
    expect(Math.abs(s.bacAt(T0 + 1 * H) - 0.521)).toBeLessThan(G_TOL);
    expect(Math.abs(s.bacAt(T0 + 3 * H) - 0.581)).toBeLessThan(G_TOL);
    expect(Math.abs(s.bacAt(T0 + 6 * H) - 0.187)).toBeLessThan(G_TOL);
  });
  it("peaks at 0.783 g/L at 84 min", () => {
    const peak = peakOf(s, T0, T0 + 4 * H);
    expect(Math.abs(peak.bac - 0.783)).toBeLessThan(G_TOL);
    expectTime(peak.at, 84 / 60);
  });
  it("crosses 0.5 at 3.59 h, 0.2 at 5.90 h and zero at 8.42 h", () => {
    expectTime(firstBelow(s, 0.5, T0 + 2 * H, T0 + 12 * H), 3.59);
    expectTime(firstBelow(s, 0.2, T0 + 2 * H, T0 + 12 * H), 5.9);
    expectTime(estimateBac(drinks, woman60, T0 + 2 * H).backToZeroAt!, 8.42);
  });
  it("T2-safe: the driving card uses the slow model", () => {
    const now = T0 + 2 * H;
    expectTime(estimateDriving(drinks, woman60, now, 0.5).underLimitAt!, 5.32);
    expectTime(estimateDriving(drinks, woman60, now, 0.2).underLimitAt!, 8.77);
  });
  it("O-87: no verdict while still rising, and a peak just under the limit is too close to call", () => {
    // Right after the third glass the curve still climbs to its 0.78 peak (84 min).
    expect(estimateDriving(drinks, woman60, T0 + 1 * H, 0.5).rising).toBe(true);
    expect(estimateDriving(drinks, woman60, T0 + 2 * H, 0.5).rising).toBe(false);
    // A limit just above the peak: neither "under the limit" nor a countdown.
    const near = estimateDriving(drinks, woman60, T0 + 2 * H, 0.85);
    expect(near.tooCloseToCall).toBe(true);
    // Far above the peak: nothing to call.
    const far = estimateDriving(drinks, woman60, T0 + 2 * H, 1.5);
    expect([far.rising, far.tooCloseToCall, far.underLimitAt]).toEqual([false, false, null]);
  });
});

describe("T3: man 70 kg, ten shots every 12 min", () => {
  const drinks = Array.from({ length: 10 }, (_, i) => drink((i * 12) / 60, 40, 0.4));
  const s = sim(drinks, man70);
  it("peaks at 2.251 g/L at 132 min", () => {
    const peak = peakOf(s, T0, T0 + 5 * H);
    expect(Math.abs(peak.bac - 2.251)).toBeLessThan(G_TOL);
    expectTime(peak.at, 132 / 60);
  });
  it("comes down at the reference times", () => {
    expectTime(firstBelow(s, 1.2, T0 + 3 * H, T0 + 30 * H), 9.57);
    expectTime(firstBelow(s, 0.5, T0 + 3 * H, T0 + 30 * H), 14.52);
    expectTime(estimateBac(drinks, man70, T0 + 3 * H).backToZeroAt!, 19.36);
  });
});

describe("T3b: very high BAC never caps and never stops at 24 h", () => {
  const drinks = Array.from({ length: 12 }, (_, i) => drink((i * 15) / 60, 500, 0.06));
  const s = sim(drinks, man70);
  it("peaks above 5 g/L and clears after 41 h", () => {
    const peak = peakOf(s, T0, T0 + 8 * H);
    expect(Math.abs(peak.bac - 5.31)).toBeLessThan(0.01);
    expectTime(peak.at, 194 / 60);
    expectTime(firstBelow(s, 3.0, T0 + 4 * H, T0 + 60 * H), 18.96);
    expectTime(estimateBac(drinks, man70, T0 + 4 * H).backToZeroAt!, 41.06);
  });
});

describe("T4: food slows absorption and speeds elimination", () => {
  it("O-85: a light meal sits between an empty stomach and a full meal", () => {
    const peak = (extra: Partial<DrinkIntake>) => peakOf(sim([wine(0, extra), wine(0.5, extra), wine(1, extra)], woman60), T0, T0 + 6 * H).bac;
    const none = peak({ food: "none" });
    const light = peak({ food: "light" });
    const full = peak({ food: "full" });
    expect(light).toBeLessThan(none);
    expect(light).toBeGreaterThan(full);
    // The level wins over the old switch; the switch alone still reads as a full meal.
    expect(peak({ withFood: true, food: "none" })).toBeCloseTo(none, 6);
    expect(peak({ withFood: true })).toBeCloseTo(full, 6);
  });

  it("T4: one beer with food", () => {
    const s = sim([pint(0, { withFood: true })], man80);
    const peak = peakOf(s, T0, T0 + 3 * H);
    expect(Math.abs(peak.bac - 0.111)).toBeLessThan(G_TOL);
    expectTime(peak.at, 56 / 60);
    expectTime(estimateBac([pint(0, { withFood: true })], man80, T0 + H).backToZeroAt!, 5.08);
  });
  it("T4b: three wines with food", () => {
    const drinks = [wine(0, { withFood: true }), wine(0.5, { withFood: true }), wine(1, { withFood: true })];
    const s = sim(drinks, woman60);
    const peak = peakOf(s, T0, T0 + 5 * H);
    expect(Math.abs(peak.bac - 0.467)).toBeLessThan(G_TOL);
    expectTime(peak.at, 135 / 60);
    expectTime(firstBelow(s, 0.2, T0 + 3 * H, T0 + 10 * H), 4.7);
  });
});

describe("T6: multi-day trip splits into independent episodes", () => {
  const day1 = [pint(0), pint(0.5), pint(1), pint(1.5)];
  const day2 = [pint(24), pint(24.5)];
  it("day 1 peaks at 1.131 g/L and is zero before day 2", () => {
    const s = sim([...day1, ...day2], man80);
    const peak = peakOf(s, T0, T0 + 6 * H);
    expect(Math.abs(peak.bac - 1.131)).toBeLessThan(G_TOL);
    expectTime(peak.at, 115 / 60);
    expect(s.bacAt(T0 + 23.99 * H)).toBe(0);
  });
  it("day 2 is identical to day 2 computed alone", () => {
    const both = sim([...day1, ...day2], man80);
    const alone = sim(day2.map((d) => ({ ...d, id: `${d.id}-alone` })), man80);
    for (let h = 24; h < 30; h += 0.25) {
      expect(both.bacAt(T0 + h * H)).toBeCloseTo(alone.bacAt(T0 + h * H), 9);
    }
    expect(Math.abs(peakOf(both, T0 + 24 * H, T0 + 27 * H).bac - 0.568)).toBeLessThan(G_TOL);
  });
});

describe("T8 and T9: late logging and future drinks", () => {
  it("T8: a drink logged late gives the same curve as one logged on time", () => {
    const onTime = sim([wine(0), wine(0.5), wine(1)], woman60, T0 + 3 * H);
    const late = sim([wine(0), wine(1), wine(0.5)], woman60, T0 + 3 * H);
    for (let h = 0; h <= 3; h += 0.1) expect(late.bacAt(T0 + h * H)).toBeCloseTo(onTime.bacAt(T0 + h * H), 12);
  });
  it("T9: a drink stamped in the future is ignored", () => {
    const now = T0 + 1 * H;
    const base = estimateBac([pint(0)], man80, now);
    const withFuture = estimateBac([pint(0), drink(1 + 10 / 60, 500, 0.05)], man80, now);
    expect(withFuture).toEqual(base);
  });
  it("counts a drink sent twice only once", () => {
    const d = pint(0);
    expect(estimateBac([d, d], man80, T0 + H)).toEqual(estimateBac([d], man80, T0 + H));
  });
});

describe("T10 to T12: distribution factor", () => {
  it("T12: Watson and Forrest formulas", () => {
    expect(distributionFactor({ weightKg: 80, bodyModel: "male", heightCm: 180, ageYears: 30 })).toBeCloseTo(0.716, 3);
    expect(distributionFactor({ weightKg: 60, bodyModel: "female", heightCm: 165 })).toBeCloseTo(0.663, 3);
    expect(distributionFactor({ weightKg: 90, bodyModel: "female", heightCm: 160 })).toBeCloseTo(0.501, 3);
    expect(distributionFactor({ weightKg: 250, bodyModel: "female", heightCm: 120 })).toBe(0.4);
  });
  it("T11: height protects people with a high BMI", () => {
    const drinks = [pint(0), pint(0.5), pint(1)];
    const noHeight = sim(drinks, { weightKg: 107, bodyModel: "male" });
    const withHeight = sim(drinks, { weightKg: 107, bodyModel: "male", heightCm: 175 });
    expect(Math.abs(peakOf(noHeight, T0, T0 + 4 * H).bac - 0.597)).toBeLessThan(G_TOL);
    expect(Math.abs(peakOf(withHeight, T0, T0 + 4 * H).bac - 0.73)).toBeLessThan(G_TOL);
  });
});

describe("estimates", () => {
  it("reports a rising trend and the upcoming peak", () => {
    const e = estimateBac([pint(0)], man80, T0 + 5 * MIN);
    expect(e.trend).toBe("rising");
    expect(e.peak!.at).toBeGreaterThan(T0 + 5 * MIN);
  });
  it("reports a falling trend and the past peak", () => {
    const e = estimateBac([pint(0)], man80, T0 + 2 * H);
    expect(e.trend).toBe("falling");
    expect(Math.abs(e.peak!.bac - 0.284)).toBeLessThan(G_TOL);
  });
  it("never says under the limit while the BAC is still rising past it", () => {
    const drinks = Array.from({ length: 4 }, (_, i) => drink((i * 5) / 60, 40, 0.4));
    const now = T0 + 20 * MIN;
    const d = estimateDriving(drinks, man80, now, 0.5);
    expect(d.underLimitAt).not.toBeNull();
    expect(d.underLimitAt!).toBeGreaterThan(now + H);
  });
  it("treats a zero limit as back to zero", () => {
    const d = estimateDriving([pint(0)], man80, T0 + H, 0);
    expect(d.overLimitNow).toBe(true);
    expect(d.tooCloseToCall).toBe(false);
    expect(d.underLimitAt).not.toBeNull();
  });
  it("has nothing to say with no drinks", () => {
    const e = estimateBac([], man80, T0);
    expect(e).toMatchObject({ bac: 0, trend: "steady", peak: null, backToZeroAt: null });
    expect(estimateDriving([], man80, T0, 0.5).underLimitAt).toBeNull();
  });
});

describe("T13 and T14: adaptive levels and vault", () => {
  it("T13: moves up at once, down with hysteresis and a minimum hold", () => {
    let state = nextUiLevel(null, 0.3, T0);
    expect(state.level).toBe(0);
    state = nextUiLevel(state, 0.52, T0 + MIN);
    expect(state.level).toBe(1);
    state = nextUiLevel(state, 0.45, T0 + 20 * MIN);
    expect(state.level).toBe(1);
    state = nextUiLevel(state, 0.39, T0 + 5 * MIN);
    expect(state.level).toBe(1);
    state = nextUiLevel(state, 0.39, T0 + 12 * MIN);
    expect(state.level).toBe(0);
    expect(nextUiLevel(null, 1.3, T0).level).toBe(3);
  });
  it("T14: the vault locks on the projected peak", () => {
    const drinks = Array.from({ length: 10 }, (_, i) => drink((i * 12) / 60, 40, 0.4));
    const now = T0 + 0.6 * H;
    const e = estimateBac(drinks, man70, now);
    const nextHourPeak = Math.max(...new BacSimulation(drinks, distributionVolume(man70), now).sample(now, now + H, MIN).map((p) => p.bac));
    expect(e.bac).toBeLessThan(0.8);
    expect(isVaultLocked(e.bac, nextHourPeak)).toBe(true);
  });
});
