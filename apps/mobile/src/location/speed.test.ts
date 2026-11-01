import { describe, expect, it } from "vitest";
import { isDriving, type Fix } from "./speed";

const fix = (at: number, lat: number, speed: number | null = null, accuracy: number | null = 30): Fix => ({ at, lat, lng: 2.35, accuracy, speed });
// 0.009 degree of latitude is about 1 km.
const KM = 0.009;

describe("isDriving", () => {
  it("needs two fast fixes at least 50 s apart", () => {
    expect(isDriving([fix(0, 48, 15)])).toBe(false);
    expect(isDriving([fix(0, 48, 15), fix(20_000, 48.001, 15)])).toBe(false);
    expect(isDriving([fix(0, 48, 15), fix(60_000, 48.01, 15)])).toBe(true);
  });

  it("derives the speed from the distance, minus the accuracy margins", () => {
    // 1 km in a minute, 60 km/h.
    expect(isDriving([fix(0, 48), fix(60_000, 48 + KM), fix(120_000, 48 + 2 * KM)])).toBe(true);
    // Walking pace, and a wobbly cell position that jumps 300 m with 200 m accuracy.
    expect(isDriving([fix(0, 48), fix(60_000, 48 + KM / 12), fix(120_000, 48 + KM / 6)])).toBe(false);
    expect(isDriving([fix(0, 48, null, 200), fix(60_000, 48 + 0.3 * KM, null, 200), fix(120_000, 48, null, 200)])).toBe(false);
  });

  it("stops at the last slow fix", () => {
    expect(isDriving([fix(0, 48, 15), fix(60_000, 48.01, 15), fix(120_000, 48.01, 0)])).toBe(false);
  });
});
