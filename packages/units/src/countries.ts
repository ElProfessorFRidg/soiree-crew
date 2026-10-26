import type { BacUnit } from "./bac";

export type UnitSystem = "metric" | "us_customary" | "uk_imperial";

export interface EmergencyNumbers {
  /** Number to show first on the SOS screen: the ambulance where it differs from 112. */
  primary: string;
  ambulance?: string;
  police?: string;
  fire?: string;
  /** EU and EEA phones always offer 112 next to the national numbers. */
  eu112: boolean;
}

export interface CountryRules {
  /** ISO 3166-1 alpha-2, plus a region suffix where the limit differs inside the country (GB-SCT, US-UT). */
  code: string;
  /** Legal driving limit, g/L of blood. 0 means any alcohol. */
  limitBlood: number;
  /** Legal breath limit in mg/L when the law states one. Used to derive the display ratio. */
  limitBreath: number | null;
  noviceBlood: number;
  professionalBlood: number;
  /** Blood/breath ratio used for display when the law gives no breath limit. */
  defaultBreathRatio: number;
  /** BAC units in the order the country's law and habits use them. */
  bacUnits: readonly BacUnit[];
  unitSystem: UnitSystem;
  /** Grams of ethanol in one standard drink, for stats and goals only. */
  standardDrinkGrams: number;
  currency: string;
  emergency: EmergencyNumbers;
  /**
   * False when the limit could not be read on an official source (research/bac.md §2.3).
   * Unverified countries ship as zero tolerance, the safe direction.
   */
  verified: boolean;
}

const EU = (primary = "112", rest: Omit<EmergencyNumbers, "primary" | "eu112"> = {}): EmergencyNumbers => ({
  primary,
  eu112: true,
  ...rest,
});

const metricEu = (
  code: string,
  limitBlood: number,
  limitBreath: number | null,
  noviceBlood: number,
  professionalBlood: number,
  bacUnits: readonly BacUnit[],
  emergency: EmergencyNumbers,
  extra: Partial<CountryRules> = {},
): CountryRules => ({
  code,
  limitBlood,
  limitBreath,
  noviceBlood,
  professionalBlood,
  defaultBreathRatio: 2000,
  bacUnits,
  unitSystem: "metric",
  standardDrinkGrams: 10,
  currency: "EUR",
  emergency,
  verified: true,
  ...extra,
});

const G_BREATH: readonly BacUnit[] = ["g_per_l_blood", "mg_per_l_breath"];
const PERMILLE_BREATH: readonly BacUnit[] = ["permille", "mg_per_l_breath"];

// Sources per row: research/bac.md §2.3 (limits) and §2.4 (units, drinks, numbers).
export const COUNTRIES: Readonly<Record<string, CountryRules>> = {
  FR: metricEu("FR", 0.5, 0.25, 0.2, 0.5, G_BREATH, EU("15", { ambulance: "15", police: "17", fire: "18" })),
  BE: metricEu("BE", 0.5, null, 0.5, 0.2, G_BREATH, EU()),
  LU: metricEu("LU", 0.5, 0.25, 0.2, 0.2, PERMILLE_BREATH, EU("112", { police: "113" })),
  CH: metricEu("CH", 0.5, 0.25, 0.1, 0.1, PERMILLE_BREATH, EU("144", { ambulance: "144", police: "117", fire: "118" }), {
    currency: "CHF",
  }),
  DE: metricEu("DE", 0.5, 0.25, 0, 0, PERMILLE_BREATH, EU("112", { police: "110" }), { standardDrinkGrams: 12 }),
  ES: metricEu("ES", 0.5, 0.25, 0.3, 0.3, G_BREATH, EU()),
  IT: metricEu("IT", 0.5, null, 0, 0, ["g_per_l_blood"], EU("118", { ambulance: "118", fire: "115" }), {
    standardDrinkGrams: 12,
  }),
  PT: metricEu("PT", 0.5, null, 0.2, 0.2, ["g_per_l_blood"], EU(), { defaultBreathRatio: 2300 }),
  NL: metricEu("NL", 0.5, 0.22, 0.2, 0.5, ["g_per_l_blood", "ug_per_l_breath"], EU()),
  IE: {
    ...metricEu("IE", 0.5, 0.22, 0.2, 0.2, ["mg_per_100ml_blood", "ug_per_100ml_breath"], EU("112", { ambulance: "999" })),
    unitSystem: "uk_imperial",
  },
  PL: metricEu("PL", 0.2, 0.1, 0.2, 0.2, PERMILLE_BREATH, EU("112", { ambulance: "999", fire: "998", police: "997" }), {
    currency: "PLN",
  }),
  CZ: metricEu("CZ", 0, 0, 0, 0, ["permille"], EU(), { currency: "CZK" }),
  SK: metricEu("SK", 0, 0, 0, 0, ["permille"], EU("155", { ambulance: "155", fire: "150", police: "158" })),
  HU: metricEu("HU", 0, 0, 0, 0, ["permille"], EU(), { currency: "HUF" }),
  RO: metricEu("RO", 0, 0, 0, 0, ["g_per_l_blood"], EU(), { currency: "RON", standardDrinkGrams: 12 }),
  SE: metricEu("SE", 0.2, 0.1, 0.2, 0.2, PERMILLE_BREATH, EU(), { currency: "SEK", standardDrinkGrams: 12 }),
  // In Norway 112 is the police and 113 the ambulance.
  NO: metricEu("NO", 0.2, 0.1, 0.2, 0.2, PERMILLE_BREATH, EU("113", { ambulance: "113", police: "112", fire: "110" }), {
    currency: "NOK",
    standardDrinkGrams: 12,
  }),
  GB: {
    code: "GB",
    limitBlood: 0.8,
    limitBreath: 0.35,
    noviceBlood: 0.8,
    professionalBlood: 0.8,
    defaultBreathRatio: 2286,
    bacUnits: ["mg_per_100ml_blood", "ug_per_100ml_breath"],
    unitSystem: "uk_imperial",
    standardDrinkGrams: 8,
    currency: "GBP",
    emergency: { primary: "999", eu112: false },
    verified: true,
  },
  "GB-SCT": {
    code: "GB-SCT",
    limitBlood: 0.5,
    limitBreath: 0.22,
    noviceBlood: 0.5,
    professionalBlood: 0.5,
    defaultBreathRatio: 2273,
    bacUnits: ["mg_per_100ml_blood", "ug_per_100ml_breath"],
    unitSystem: "uk_imperial",
    standardDrinkGrams: 8,
    currency: "GBP",
    emergency: { primary: "999", eu112: false },
    verified: true,
  },
  US: {
    code: "US",
    limitBlood: 0.8,
    limitBreath: null,
    noviceBlood: 0.2,
    professionalBlood: 0.4,
    defaultBreathRatio: 2100,
    bacUnits: ["percent_bac"],
    unitSystem: "us_customary",
    standardDrinkGrams: 14,
    currency: "USD",
    emergency: { primary: "911", eu112: false },
    verified: true,
  },
  "US-UT": {
    code: "US-UT",
    limitBlood: 0.5,
    limitBreath: null,
    noviceBlood: 0.2,
    professionalBlood: 0.4,
    defaultBreathRatio: 2100,
    bacUnits: ["percent_bac"],
    unitSystem: "us_customary",
    standardDrinkGrams: 14,
    currency: "USD",
    emergency: { primary: "911", eu112: false },
    verified: true,
  },
  CA: {
    code: "CA",
    limitBlood: 0.8,
    limitBreath: null,
    noviceBlood: 0,
    professionalBlood: 0.8,
    defaultBreathRatio: 2100,
    bacUnits: ["mg_per_100ml_blood"],
    unitSystem: "metric",
    standardDrinkGrams: 13.45,
    currency: "CAD",
    emergency: { primary: "911", eu112: false },
    verified: true,
  },
  AU: {
    code: "AU",
    limitBlood: 0.5,
    limitBreath: null,
    noviceBlood: 0,
    professionalBlood: 0.2,
    defaultBreathRatio: 2100,
    bacUnits: ["percent_bac"],
    unitSystem: "metric",
    standardDrinkGrams: 10,
    currency: "AUD",
    emergency: { primary: "000", eu112: false },
    verified: true,
  },
  NZ: {
    code: "NZ",
    limitBlood: 0.5,
    limitBreath: 0.25,
    noviceBlood: 0,
    professionalBlood: 0.5,
    defaultBreathRatio: 2000,
    bacUnits: ["mg_per_100ml_blood", "ug_per_l_breath"],
    unitSystem: "metric",
    standardDrinkGrams: 10,
    currency: "NZD",
    emergency: { primary: "111", eu112: false },
    verified: true,
  },
  // Any alcohol below 0.15 mg/L is still prohibited, so the driving card treats Japan as zero tolerance.
  JP: {
    code: "JP",
    limitBlood: 0,
    limitBreath: 0,
    noviceBlood: 0,
    professionalBlood: 0,
    defaultBreathRatio: 2000,
    bacUnits: ["mg_per_l_breath"],
    unitSystem: "metric",
    standardDrinkGrams: 20,
    currency: "JPY",
    emergency: { primary: "119", ambulance: "119", police: "110", fire: "119", eu112: false },
    verified: true,
  },
  BR: {
    code: "BR",
    limitBlood: 0,
    limitBreath: 0,
    noviceBlood: 0,
    professionalBlood: 0,
    defaultBreathRatio: 2000,
    bacUnits: ["g_per_l_blood", "mg_per_l_breath"],
    unitSystem: "metric",
    standardDrinkGrams: 10,
    currency: "BRL",
    emergency: { primary: "192", ambulance: "192", police: "190", fire: "193", eu112: false },
    verified: true,
  },
  MA: {
    code: "MA",
    limitBlood: 0,
    limitBreath: 0,
    noviceBlood: 0,
    professionalBlood: 0,
    defaultBreathRatio: 2000,
    bacUnits: ["g_per_l_blood"],
    unitSystem: "metric",
    standardDrinkGrams: 10,
    currency: "MAD",
    emergency: { primary: "150", ambulance: "150", police: "190", fire: "150", eu112: false },
    verified: false,
  },
  TN: {
    code: "TN",
    limitBlood: 0,
    limitBreath: 0,
    noviceBlood: 0,
    professionalBlood: 0,
    defaultBreathRatio: 2000,
    bacUnits: ["g_per_l_blood"],
    unitSystem: "metric",
    standardDrinkGrams: 10,
    currency: "TND",
    emergency: { primary: "190", ambulance: "190", police: "197", fire: "198", eu112: false },
    verified: false,
  },
  DZ: {
    code: "DZ",
    limitBlood: 0.2,
    limitBreath: null,
    noviceBlood: 0.2,
    professionalBlood: 0.2,
    defaultBreathRatio: 2000,
    bacUnits: ["g_per_l_blood"],
    unitSystem: "metric",
    standardDrinkGrams: 10,
    currency: "DZD",
    emergency: { primary: "14", ambulance: "14", police: "17", fire: "14", eu112: false },
    verified: false,
  },
  RU: {
    code: "RU",
    limitBlood: 0,
    limitBreath: 0,
    noviceBlood: 0,
    professionalBlood: 0,
    defaultBreathRatio: 2000,
    bacUnits: ["permille", "mg_per_l_breath"],
    unitSystem: "metric",
    standardDrinkGrams: 10,
    currency: "RUB",
    emergency: { primary: "112", eu112: false },
    verified: false,
  },
};

export const FALLBACK_COUNTRY = "FR";

export function countryRules(code: string): CountryRules {
  return COUNTRIES[code] ?? COUNTRIES[code.split("-")[0] ?? ""] ?? COUNTRIES[FALLBACK_COUNTRY]!;
}

export type DriverCategory = "standard" | "novice" | "professional";

/** Limit that applies to this driver, g/L of blood. */
export function drivingLimit(rules: CountryRules, category: DriverCategory): number {
  if (!rules.verified) return 0;
  if (category === "novice") return Math.min(rules.noviceBlood, rules.limitBlood);
  if (category === "professional") return Math.min(rules.professionalBlood, rules.limitBlood);
  return rules.limitBlood;
}

/**
 * Blood/breath ratio that makes the breath figure cross the breath limit at the
 * same moment the blood figure crosses the blood limit (research/bac.md §2.2).
 */
export function breathRatio(rules: CountryRules): number {
  if (rules.limitBreath && rules.limitBlood > 0) return Math.round((1000 * rules.limitBlood) / rules.limitBreath);
  return rules.defaultBreathRatio;
}
