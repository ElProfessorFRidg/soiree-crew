// ADP-08, QOL-24: when the app goes easy on the battery. Pure: no module, no storage.

/** Under this charge, unplugged, the app goes easy on the battery. */
export const LOW_LEVEL = 0.2;

export interface PowerReading {
  /** 0 to 1; null or negative when the phone does not say. */
  level: number | null;
  charging: boolean;
  /** iOS Low Power Mode, Android Battery Saver. */
  lowPowerMode: boolean;
}

/** Low Power Mode, or a low battery off the charger. Off when the person turned the setting off. */
export function savingPower(reading: PowerReading, settingOn: boolean): boolean {
  if (!settingOn) return false;
  if (reading.lowPowerMode) return true;
  return reading.level !== null && reading.level >= 0 && reading.level <= LOW_LEVEL && !reading.charging;
}

/**
 * QOL-24: an endless loop in eco mode plays this many cycles, slower, then rests on its first frame.
 * Animations stay; only their repetition and pace step back.
 */
export const ECO_LOOP_CYCLES = 3;
export const ECO_LOOP_SLOWDOWN = 2;

/**
 * The repeat count and the duration factor for a Reanimated `withRepeat` loop. A reversing loop
 * counts each direction, so its count stays even and it ends where it started.
 */
export function loopPlan(eco: boolean, reverse: boolean): { count: number; slow: number } {
  if (!eco) return { count: -1, slow: 1 };
  return { count: reverse ? ECO_LOOP_CYCLES * 2 : ECO_LOOP_CYCLES, slow: ECO_LOOP_SLOWDOWN };
}

export interface LocationPlan {
  accuracy: "low" | "lowest" | "balanced";
  /** Metres between two updates. */
  distanceInterval: number;
  deferredUpdatesDistance: number;
  /** Minutes between two updates (Android), and between deferred batches. */
  intervalMinutes: number;
}

/**
 * The background location settings (location/outing.ts). The driving warning needs two fixes less
 * than 3 min apart to read a car's speed (speed.ts), so in saving mode it only spaces them to 2 min;
 * the outing nudge alone drops to the coarsest fix every 15 min.
 */
export function locationPlan(drive: boolean, saving: boolean): LocationPlan {
  if (drive) return { accuracy: "balanced", distanceInterval: 100, deferredUpdatesDistance: 0, intervalMinutes: saving ? 2 : 1 };
  if (saving) return { accuracy: "lowest", distanceInterval: 250, deferredUpdatesDistance: 500, intervalMinutes: 15 };
  return { accuracy: "low", distanceInterval: 100, deferredUpdatesDistance: 200, intervalMinutes: 5 };
}
