import { afterEach, describe, expect, it } from "vitest";
import { duration, scaled, setMotionScale, spring, springOf, type SpringConfig } from "./index";

const ratio = (c: SpringConfig) => c.damping / (2 * Math.sqrt(c.stiffness * c.mass));

describe("motion time scale (MOT-14)", () => {
  afterEach(() => setMotionScale(1));

  it("scales durations and numbers alike", () => {
    setMotionScale(2);
    expect(duration.flip).toBe(1100);
    expect(scaled(120)).toBe(240);
  });

  it("slows springs without changing their shape", () => {
    const base = springOf({ mass: 1, stiffness: 260, damping: 32 }, 1);
    setMotionScale(2);
    const slow = spring.settle;
    // Natural frequency halves, damping ratio stays.
    expect(Math.sqrt(slow.stiffness / slow.mass)).toBeCloseTo(Math.sqrt(base.stiffness) / 2);
    expect(ratio(slow)).toBeCloseTo(ratio(base));
  });

  it("keeps routine springs free of overshoot (MOT-01)", () => {
    expect(ratio(spring.settle)).toBeGreaterThanOrEqual(0.98);
    expect(ratio(spring.snap)).toBeGreaterThanOrEqual(0.98);
    expect(ratio(spring.signature)).toBeLessThan(1);
  });
});
