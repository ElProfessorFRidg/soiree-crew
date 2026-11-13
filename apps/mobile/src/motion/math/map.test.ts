import { describe, expect, it } from "vitest";
import { fitRegion, unproject } from "./map";

describe("map regions", () => {
  it("keeps nearby venues across the antimeridian in one local view", () => {
    const result = fitRegion(
      [
        { lat: -17.7134, lng: 179.8 },
        { lat: -17.714, lng: -179.8 },
      ],
      390,
      360,
    );

    expect(Math.abs(result.center.lng)).toBeGreaterThan(179);
    expect(result.zoom).toBeGreaterThan(8);
  });

  it("wraps longitude and clamps latitude after a long pan", () => {
    const west = unproject(-1_000_000, -1_000_000, 12);
    const east = unproject(1_000_000, 1_000_000, 12);

    expect(west.lng).toBeGreaterThanOrEqual(-180);
    expect(west.lng).toBeLessThan(180);
    expect(east.lng).toBeGreaterThanOrEqual(-180);
    expect(east.lng).toBeLessThan(180);
    expect(Math.abs(west.lat)).toBeLessThan(86);
    expect(Math.abs(east.lat)).toBeLessThan(86);
  });
});
