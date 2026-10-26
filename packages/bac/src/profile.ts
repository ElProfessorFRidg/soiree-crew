import { DEFAULT_R_FEMALE, DEFAULT_R_MALE, R_MAX, R_MIN } from "./constants";

/**
 * The formulas only know two body models. "Other / prefer not to say" maps to
 * `female` because it gives the higher estimate.
 */
export type BodyModel = "male" | "female";

export interface BodyProfile {
  weightKg: number;
  bodyModel: BodyModel;
  heightCm?: number;
  ageYears?: number;
}

export const PROFILE_BOUNDS = {
  weightKg: { min: 30, max: 250 },
  heightCm: { min: 120, max: 230 },
  ageYears: { min: 18, max: 100 },
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Watson total body water, litres. */
function watsonBodyWater(profile: Required<BodyProfile>): number {
  const { weightKg, heightCm, ageYears, bodyModel } = profile;
  if (bodyModel === "male") {
    return 2.447 - 0.09516 * ageYears + 0.1074 * heightCm + 0.3362 * weightKg;
  }
  return -2.097 + 0.1069 * heightCm + 0.2466 * weightKg;
}

function forrestFactor(bodyModel: BodyModel, weightKg: number, heightCm: number): number {
  const bmi = weightKg / (heightCm / 100) ** 2;
  return bodyModel === "male" ? 1.0181 - 0.01213 * bmi : 0.9367 - 0.0124 * bmi;
}

/**
 * Widmark distribution factor r (L/kg). Watson for men when age and height are
 * known, Forrest when height is known, population default otherwise.
 */
export function distributionFactor(profile: BodyProfile): number {
  const weightKg = clamp(profile.weightKg, PROFILE_BOUNDS.weightKg.min, PROFILE_BOUNDS.weightKg.max);
  const { heightCm, ageYears, bodyModel } = profile;

  let r: number;
  if (bodyModel === "male" && heightCm !== undefined && ageYears !== undefined) {
    r = watsonBodyWater({ weightKg, heightCm, ageYears, bodyModel }) / (0.8 * weightKg);
  } else if (heightCm !== undefined) {
    r = forrestFactor(bodyModel, weightKg, heightCm);
  } else {
    r = bodyModel === "male" ? DEFAULT_R_MALE : DEFAULT_R_FEMALE;
  }
  return clamp(r, R_MIN, R_MAX);
}

/** Litres of body water the alcohol spreads into. */
export function distributionVolume(profile: BodyProfile): number {
  const weightKg = clamp(profile.weightKg, PROFILE_BOUNDS.weightKg.min, PROFILE_BOUNDS.weightKg.max);
  return distributionFactor(profile) * weightKg;
}
