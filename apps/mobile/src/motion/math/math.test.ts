import { describe, expect, it } from "vitest";
import { pointAlong, polylineLength } from "./path";
import { crownDelayMs, leaderChanged, RISE_DELAYS_MS, splitPodium } from "./podium";
import { swipeDecision, swipeLabelOpacity, swipeTilt } from "./swipe";
import { takeoversBetween } from "./takeover";
import { clampWindow, domainAt, FULL_WINDOW, isZoomed, MAX_CHART_ZOOM, pinchWindow, rubberWindow, screenAt, visibleRange } from "./zoom";

describe("chart window (O-24)", () => {
  it("clamps zoom and keeps both ends in view", () => {
    expect(clampWindow({ zoom: 0.5, offset: -0.2 })).toEqual(FULL_WINDOW);
    expect(clampWindow({ zoom: 20, offset: 0.99 })).toEqual({ zoom: MAX_CHART_ZOOM, offset: 1 - 1 / MAX_CHART_ZOOM });
    expect(clampWindow({ zoom: 2, offset: 0.7 })).toEqual({ zoom: 2, offset: 0.5 });
  });

  it("keeps the point under the fingers while pinching", () => {
    const start = { zoom: 1, offset: 0 };
    const next = pinchWindow(start, 2, 0.5, 0.5);
    expect(next.zoom).toBeCloseTo(2);
    expect(domainAt(next, 0.5)).toBeCloseTo(0.5);
    // Fingers moving left pan the chart with them.
    const panned = pinchWindow({ zoom: 4, offset: 0.25 }, 1, 0.5, 0.25);
    expect(domainAt(panned, 0.25)).toBeCloseTo(domainAt({ zoom: 4, offset: 0.25 }, 0.5));
  });

  it("resists past the bounds instead of stopping dead", () => {
    const over = rubberWindow({ zoom: 12, offset: 0 });
    expect(over.zoom).toBeGreaterThan(MAX_CHART_ZOOM);
    expect(over.zoom).toBeLessThan(MAX_CHART_ZOOM + 0.25);
    const left = rubberWindow({ zoom: 2, offset: -1 });
    expect(left.offset).toBeLessThan(0);
    expect(left.offset).toBeGreaterThan(-0.08);
  });

  it("maps screen and domain both ways and names the visible range", () => {
    const window = { zoom: 4, offset: 0.5 };
    expect(screenAt(window, domainAt(window, 0.3))).toBeCloseTo(0.3);
    expect(visibleRange(window, 0, 800)).toEqual({ from: 400, to: 600 });
    expect(isZoomed(FULL_WINDOW)).toBe(false);
    expect(isZoomed(window)).toBe(true);
  });
});

describe("podium (MOT-13)", () => {
  const row = (userId: string, rank: number, value: number) => ({ userId, rank, value });

  it("puts the first three scorers up and leaves the rest in the list", () => {
    const rows = [row("a", 1, 9), row("b", 2, 7), row("c", 3, 4), row("d", 4, 2)];
    const { podium, rest } = splitPodium(rows);
    expect(podium.map((r) => r.userId)).toEqual(["a", "b", "c"]);
    expect(rest.map((r) => r.userId)).toEqual(["d"]);
  });

  it("needs two scorers, and nobody with zero stands on it", () => {
    expect(splitPodium([row("a", 1, 3), row("b", 2, 0)]).podium).toEqual([]);
    expect(splitPodium([row("a", 1, 3), row("b", 2, 1), row("c", 3, 0)]).podium.map((r) => r.userId)).toEqual(["a", "b"]);
  });

  it("raises third, second, then the winner, and drops the crown after", () => {
    expect([RISE_DELAYS_MS[2], RISE_DELAYS_MS[1], RISE_DELAYS_MS[0]]).toEqual([0, 200, 350]);
    expect(crownDelayMs(800)).toBe(1150);
  });

  it("only calls a new leader after a first answer", () => {
    expect(leaderChanged(null, "a")).toBe(false);
    expect(leaderChanged("a", "a")).toBe(false);
    expect(leaderChanged("a", "b")).toBe(true);
    expect(leaderChanged("a", null)).toBe(false);
  });
});

describe("venue takeovers on the map (MOT-09)", () => {
  it("finds venues whose crown changed hands since the last load", () => {
    const before = [
      { id: "v1", bossId: "a" },
      { id: "v2", bossId: null },
      { id: "v3", bossId: "c" },
    ];
    const after = [
      { id: "v1", bossId: "b" },
      { id: "v2", bossId: "a" },
      { id: "v3", bossId: null },
      { id: "v4", bossId: "d" },
    ];
    expect(takeoversBetween(before, after)).toEqual([
      { venueId: "v1", bossId: "b" },
      { venueId: "v2", bossId: "a" },
    ]);
  });

  it("never celebrates the first load", () => {
    expect(takeoversBetween(null, [{ id: "v1", bossId: "a" }])).toEqual([]);
  });
});

describe("gliding along a curve (MOT-04)", () => {
  const line = { xs: [0, 30, 30], ys: [0, 0, 40] };

  it("measures and walks a polyline", () => {
    expect(polylineLength(line)).toBe(70);
    expect(pointAlong(line, 15)).toEqual({ x: 15, y: 0 });
    expect(pointAlong(line, 50)).toEqual({ x: 30, y: 20 });
  });

  it("stays on the ends past them", () => {
    expect(pointAlong(line, -5)).toEqual({ x: 0, y: 0 });
    expect(pointAlong(line, 500)).toEqual({ x: 30, y: 40 });
    expect(pointAlong({ xs: [], ys: [] }, 3)).toEqual({ x: 0, y: 0 });
  });
});

describe("card swipes (MOT-06)", () => {
  it("commits past a third of the card or on a fling the same way", () => {
    expect(swipeDecision(-140, 0, 400)).toBe("left");
    expect(swipeDecision(60, 1200, 400)).toBe("right");
    expect(swipeDecision(60, -1200, 400)).toBeNull();
    expect(swipeDecision(40, 100, 400)).toBeNull();
  });

  it("tilts a little and shows the action as the card nears the edge", () => {
    expect(swipeTilt(400, 400)).toBe(12);
    expect(swipeTilt(-100, 400)).toBeCloseTo(-3.5);
    expect(swipeLabelOpacity(0, 400)).toBe(0);
    expect(swipeLabelOpacity(400, 400)).toBe(1);
  });
});
