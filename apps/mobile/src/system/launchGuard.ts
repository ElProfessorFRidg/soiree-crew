/**
 * Launch never waits forever. Each step the first screen waits for (fonts, stored data, the session
 * in the Keychain) gets a deadline; past it the app goes on without that step and remembers which one
 * stalled. Seen with TrollStore and other re-signers, where the Keychain or the storage can answer
 * late or never because the app runs without its usual entitlements.
 */
export const LAUNCH_STEP_MS = 4000;

const stalled = new Set<string>();

export function stalledSteps(): string[] {
  return [...stalled];
}

export function withDeadline<T>(step: string, work: Promise<T>, fallback: T, ms = LAUNCH_STEP_MS): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => {
      stalled.add(step);
      resolve(fallback);
    }, ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}
