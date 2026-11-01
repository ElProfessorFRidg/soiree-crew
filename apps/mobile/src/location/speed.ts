// Car speed from a few background positions (driving.ts). Pure: no module, no storage.

/** About 25 km/h, in m/s. */
const DRIVING_MPS = 25 / 3.6;
/** Two fast fixes at least this far apart: a car, not a sprint for the bus. */
const SUSTAINED_MS = 50_000;
/** A speed derived from two fixes further apart than this says nothing about now. */
const MAX_PAIR_MS = 3 * 60_000;

export interface Fix {
  at: number;
  lat: number;
  lng: number;
  /** Horizontal accuracy in metres, when the system gives one. */
  accuracy: number | null;
  /** Speed in m/s as the system measured it, null when unknown. */
  speed: number | null;
}

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/**
 * The speed at `fix`: the measured one when there is one, otherwise the distance from the fix
 * before, minus both accuracy margins so a wobbly cell position never looks like a car.
 */
function speedAt(fix: Fix, before: Fix | undefined): number | null {
  if (fix.speed !== null && fix.speed >= 0) return fix.speed;
  if (!before) return null;
  const dt = fix.at - before.at;
  if (dt < 20_000 || dt > MAX_PAIR_MS) return null;
  const margin = (fix.accuracy ?? 100) + (before.accuracy ?? 100);
  return Math.max(0, metersBetween(before, fix) - margin) / (dt / 1000);
}

/** Driving: the latest fixes are all at car speed, two of them at least 50 s apart. */
export function isDriving(fixes: readonly Fix[]): boolean {
  const sorted = [...fixes].sort((a, b) => a.at - b.at);
  let runStart: number | null = null;
  let runEnd: number | null = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const fix = sorted[i]!;
    const speed = speedAt(fix, sorted[i - 1]);
    if (speed === null || speed < DRIVING_MPS) break;
    runEnd ??= fix.at;
    runStart = fix.at;
  }
  return runStart !== null && runEnd !== null && runEnd - runStart >= SUSTAINED_MS;
}

