// Strokes for Quick Draw (O-63). Points are stored in canvas units from 0 to 1 so the same drawing
// renders on any screen, which is also what a remote transport would send.

export interface StrokePoint {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  colour: string;
  /** Width as a share of the canvas width. */
  width: number;
  points: StrokePoint[];
}

export type DrawingEvent =
  | { type: "stroke.start"; id: string; colour: string; width: number; point: StrokePoint }
  | { type: "stroke.extend"; id: string; points: StrokePoint[] }
  | { type: "clear" }
  | { type: "undo" };

/** Rebuilds the drawing from events: the local canvas and any remote viewer use the same function. */
export function applyDrawingEvent(strokes: readonly Stroke[], event: DrawingEvent): Stroke[] {
  switch (event.type) {
    case "stroke.start":
      return [...strokes, { id: event.id, colour: event.colour, width: event.width, points: [event.point] }];
    case "stroke.extend":
      return strokes.map((s) => (s.id === event.id ? { ...s, points: [...s.points, ...event.points] } : s));
    case "clear":
      return [];
    case "undo":
      return strokes.slice(0, -1);
  }
}

/** Skips points closer than `minDistance` to the last kept one: fewer points, smoother curve, lighter messages. */
export function keepPoint(last: StrokePoint | undefined, next: StrokePoint, minDistance: number): boolean {
  if (!last) return true;
  return Math.hypot(next.x - last.x, next.y - last.y) >= minDistance;
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * SVG path through the points, smoothed with quadratic curves between midpoints
 * so a shaky finger still draws a clean line. A single point becomes a dot.
 */
export function strokePath(points: readonly StrokePoint[], width: number, height: number): string {
  const scaled = points.map((p) => ({ x: round(p.x * width), y: round(p.y * height) }));
  const first = scaled[0];
  if (!first) return "";
  if (scaled.length === 1) return `M${first.x} ${first.y}L${first.x + 0.1} ${first.y}`;
  if (scaled.length === 2) {
    const second = scaled[1] as StrokePoint;
    return `M${first.x} ${first.y}L${second.x} ${second.y}`;
  }
  let d = `M${first.x} ${first.y}`;
  for (let i = 1; i < scaled.length - 1; i++) {
    const p = scaled[i] as StrokePoint;
    const next = scaled[i + 1] as StrokePoint;
    const mid = { x: round((p.x + next.x) / 2), y: round((p.y + next.y) / 2) };
    d += `Q${p.x} ${p.y} ${mid.x} ${mid.y}`;
  }
  const last = scaled[scaled.length - 1] as StrokePoint;
  return `${d}L${last.x} ${last.y}`;
}

/**
 * Where drawing events go. Today only the local transport exists: everyone plays around one phone.
 * Online play (several phones, O-63) plugs a remote transport in here without touching the canvas.
 */
export interface DrawingTransport {
  readonly kind: "local" | "remote";
  send(event: DrawingEvent): void;
  subscribe(listener: (event: DrawingEvent) => void): () => void;
}

/** Loops events back to local listeners (the canvas itself, a replay on the result screen). */
export function createLocalTransport(): DrawingTransport {
  const listeners = new Set<(event: DrawingEvent) => void>();
  return {
    kind: "local",
    send(event) {
      for (const listener of listeners) listener(event);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
