/**
 * MOT-04: a point travelling along a polyline, so an avatar can glide along a curve instead of
 * jumping between samples. Coordinates are kept as two flat arrays so worklets can read them.
 */
export interface Polyline {
  xs: number[];
  ys: number[];
}

export function polylineLength(line: Polyline): number {
  "worklet";
  let total = 0;
  for (let i = 1; i < line.xs.length; i++) total += Math.hypot(line.xs[i]! - line.xs[i - 1]!, line.ys[i]! - line.ys[i - 1]!);
  return total;
}

/** The point `distance` pixels from the start, clamped to the ends. */
export function pointAlong(line: Polyline, distance: number): { x: number; y: number } {
  "worklet";
  const count = line.xs.length;
  if (count === 0) return { x: 0, y: 0 };
  if (distance <= 0 || count === 1) return { x: line.xs[0]!, y: line.ys[0]! };
  let walked = 0;
  for (let i = 1; i < count; i++) {
    const x0 = line.xs[i - 1]!;
    const y0 = line.ys[i - 1]!;
    const step = Math.hypot(line.xs[i]! - x0, line.ys[i]! - y0);
    if (walked + step >= distance) {
      const t = step === 0 ? 0 : (distance - walked) / step;
      return { x: x0 + (line.xs[i]! - x0) * t, y: y0 + (line.ys[i]! - y0) * t };
    }
    walked += step;
  }
  return { x: line.xs[count - 1]!, y: line.ys[count - 1]! };
}
