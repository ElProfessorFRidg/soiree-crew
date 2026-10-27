import { describe, expect, it } from "vitest";
import { applyDrawingEvent, createLocalTransport, keepPoint, strokePath, type DrawingEvent, type Stroke } from "./drawing";

describe("drawing", () => {
  it("rebuilds strokes from events, the way a remote viewer would", () => {
    const events: DrawingEvent[] = [
      { type: "stroke.start", id: "s1", colour: "#000", width: 0.01, point: { x: 0, y: 0 } },
      { type: "stroke.extend", id: "s1", points: [{ x: 0.5, y: 0.5 }] },
      { type: "stroke.start", id: "s2", colour: "#f00", width: 0.02, point: { x: 1, y: 1 } },
      { type: "undo" },
    ];
    const strokes = events.reduce<Stroke[]>(applyDrawingEvent, []);
    expect(strokes).toHaveLength(1);
    expect(strokes[0]?.points).toHaveLength(2);
    expect(applyDrawingEvent(strokes, { type: "clear" })).toEqual([]);
  });

  it("smooths a stroke with curves and scales it to the canvas", () => {
    const d = strokePath(
      [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.5 },
        { x: 1, y: 0 },
      ],
      200,
      100,
    );
    expect(d).toBe("M0 0Q100 50 150 25L200 0");
    expect(strokePath([{ x: 0.5, y: 0.5 }], 10, 10)).toMatch(/^M5 5L/);
    expect(strokePath([], 10, 10)).toBe("");
  });

  it("drops points that barely moved", () => {
    expect(keepPoint({ x: 0, y: 0 }, { x: 0.001, y: 0 }, 0.004)).toBe(false);
    expect(keepPoint({ x: 0, y: 0 }, { x: 0.01, y: 0 }, 0.004)).toBe(true);
    expect(keepPoint(undefined, { x: 0, y: 0 }, 0.004)).toBe(true);
  });

  it("loops events back to local listeners until they unsubscribe", () => {
    const transport = createLocalTransport();
    const seen: DrawingEvent[] = [];
    const stop = transport.subscribe((e) => seen.push(e));
    transport.send({ type: "clear" });
    stop();
    transport.send({ type: "clear" });
    expect(seen).toHaveLength(1);
    expect(transport.kind).toBe("local");
  });
});
