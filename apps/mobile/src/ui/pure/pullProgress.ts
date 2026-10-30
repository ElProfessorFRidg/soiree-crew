/** How far past the top the finger pulls for the glass to be full (MOT-10). */
export const PULL_DISTANCE = 96;

/** 0 at rest, 1 once pulled `PULL_DISTANCE` points past the top. Runs on the UI thread too. */
export function pullProgress(offsetY: number): number {
  "worklet";
  if (!(offsetY < 0)) return 0;
  return Math.min(1, -offsetY / PULL_DISTANCE);
}
