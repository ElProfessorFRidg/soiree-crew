/**
 * O-24: what part of a chart is on screen. `zoom` 1 shows everything; `offset` is the fraction of the
 * time domain at the left edge. Pure and worklet-safe, so gestures and tests share it.
 */
export interface ChartWindow {
  zoom: number;
  offset: number;
}

export const FULL_WINDOW: ChartWindow = { zoom: 1, offset: 0 };
export const MIN_CHART_ZOOM = 1;
export const MAX_CHART_ZOOM = 8;

const clamp = (value: number, min: number, max: number) => {
  "worklet";
  return Math.min(max, Math.max(min, value));
};

/** The window brought back inside its bounds: zoom 1 to 8, never showing past either end. */
export function clampWindow(window: ChartWindow): ChartWindow {
  "worklet";
  const zoom = clamp(window.zoom, MIN_CHART_ZOOM, MAX_CHART_ZOOM);
  return { zoom, offset: clamp(window.offset, 0, 1 - 1 / zoom) };
}

/**
 * Past a bound the window still moves, but less and less, so the finger feels the edge
 * (the release then springs back with `clampWindow`).
 */
export function rubberWindow(window: ChartWindow): ChartWindow {
  "worklet";
  const resist = (value: number, min: number, max: number, give: number) => {
    "worklet";
    if (value < min) return min - give * (1 - 1 / (1 + (min - value) / give));
    if (value > max) return max + give * (1 - 1 / (1 + (value - max) / give));
    return value;
  };
  const zoom = resist(window.zoom, MIN_CHART_ZOOM, MAX_CHART_ZOOM, 0.25);
  const span = 1 / Math.max(zoom, MIN_CHART_ZOOM);
  return { zoom, offset: resist(window.offset, 0, 1 - span, span * 0.15) };
}

/** Domain fraction (0 to 1) under a screen fraction (0 to 1) of the plot. */
export function domainAt(window: ChartWindow, screenFraction: number): number {
  "worklet";
  return window.offset + screenFraction / window.zoom;
}

/** Screen fraction of a domain fraction: below 0 or above 1 means off screen. */
export function screenAt(window: ChartWindow, domainFraction: number): number {
  "worklet";
  return (domainFraction - window.offset) * window.zoom;
}

/**
 * A pinch from `start`: the domain point that was under the first focal point stays under the
 * fingers, wherever they move. One formula covers zooming and two-finger panning.
 */
export function pinchWindow(start: ChartWindow, scale: number, startFocal: number, focal: number): ChartWindow {
  "worklet";
  const anchor = domainAt(start, startFocal);
  const zoom = start.zoom * scale;
  return rubberWindow({ zoom, offset: anchor - focal / zoom });
}

/** Visible time range of a domain [from, to] through a window. */
export function visibleRange(window: ChartWindow, from: number, to: number): { from: number; to: number } {
  const span = to - from;
  const clamped = clampWindow(window);
  return { from: from + clamped.offset * span, to: from + (clamped.offset + 1 / clamped.zoom) * span };
}

export const isZoomed = (window: ChartWindow): boolean => window.zoom > 1.01;
