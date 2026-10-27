import type { BacUnit } from "./bac";
import { COUNTRIES, countryRules, FALLBACK_COUNTRY, type DriverCategory, type UnitSystem } from "./countries";

export type UiLanguage = "fr" | "en" | "es" | "it" | "de" | "pt" | "ru";
/** O-09: French and English are written first; the others follow them. */
export const UI_LANGUAGES: readonly UiLanguage[] = ["fr", "en", "es", "it", "de", "pt", "ru"];

/**
 * Server-side settings (PREF-01). Language, legal country and units are
 * independent (PREF-04): nothing below is inferred from the language alone.
 */
export interface UserPreferences {
  language: UiLanguage;
  legalCountry: string;
  driverCategory: DriverCategory;
  unitSystem: UnitSystem;
  bacUnit: BacUnit;
  currency: string;
  hourCycle: "h12" | "h23";
  /** Hour (0 to 23, local) when "tonight" ends: 2 am on Sunday counts as Saturday night (QOL-02). */
  dayBoundaryHour: number;
  /** Personal BAC limit for the night, g/L of blood (O-25, O-26). Null when not set. */
  personalLimit: number | null;
  /** Warn once when the estimate gets close to the personal limit (O-26). */
  warnNearLimit: boolean;
  /** Minutes between water reminders during a night (O-27). Null when off. */
  waterReminderMinutes: number | null;
  /** Spending cap for one night, in minor units of `currency` (N-20). Null when not set. */
  partyBudget: number | null;
  /** "The recap is ready" notification (O-41). */
  notifyRecap: boolean;
  /** Quiet hours, local, for notifications that can wait (QOL-20). Safety alerts ignore them. */
  quietFromHour: number;
  quietToHour: number;
  /** QOL-18: the ride app picked once and remembered. Null until chosen. */
  rideApp: string | null;
}

export interface DeviceLocale {
  /** BCP 47 tags in the phone's order of preference. */
  languageTags: readonly string[];
  /** Region the phone is set to, ISO 3166-1. May differ from the language's region. */
  region: string | null;
  uses24HourClock: boolean | null;
}

function pickLanguage(tags: readonly string[]): UiLanguage {
  for (const tag of tags) {
    const base = tag.toLowerCase().split(/[-_]/)[0];
    if (base && (UI_LANGUAGES as readonly string[]).includes(base)) return base as UiLanguage;
  }
  return "en";
}

/** Smart defaults on first launch, from the device settings only (PREF-02). */
export function defaultPreferences(device: DeviceLocale): UserPreferences {
  const tagRegion = device.languageTags[0]?.split(/[-_]/)[1]?.toUpperCase();
  const region = device.region?.toUpperCase() ?? tagRegion ?? FALLBACK_COUNTRY;
  const legalCountry = COUNTRIES[region] ? region : FALLBACK_COUNTRY;
  const rules = countryRules(legalCountry);
  const twelveHourRegions = new Set(["US", "CA", "AU", "NZ"]);
  const hourCycle =
    device.uses24HourClock === null ? (twelveHourRegions.has(region) ? "h12" : "h23") : device.uses24HourClock ? "h23" : "h12";

  return {
    language: pickLanguage(device.languageTags),
    legalCountry,
    driverCategory: "standard",
    unitSystem: rules.unitSystem,
    bacUnit: rules.bacUnits[0] ?? "g_per_l_blood",
    currency: rules.currency,
    hourCycle,
    dayBoundaryHour: 6,
    personalLimit: null,
    warnNearLimit: true,
    waterReminderMinutes: 45,
    partyBudget: null,
    notifyRecap: true,
    quietFromHour: 22,
    quietToHour: 9,
    rideApp: null,
  };
}

/**
 * Start of the night a timestamp belongs to (QOL-02), as local wall-clock
 * midnight-shifted by the day boundary. `offsetMinutes` is the local UTC offset.
 */
export function nightKey(at: number, offsetMinutes: number, dayBoundaryHour: number): string {
  const local = new Date(at + offsetMinutes * 60_000 - dayBoundaryHour * 3_600_000);
  return local.toISOString().slice(0, 10);
}

/**
 * QOL-20: when a notification that can wait may go out. `now` itself outside
 * the quiet hours, else the end of the quiet hours. Uses the device's local time.
 */
export function afterQuietHours(now: number, quietFromHour: number, quietToHour: number): number {
  if (quietFromHour === quietToHour) return now;
  const hour = new Date(now).getHours();
  const wraps = quietFromHour > quietToHour;
  const quiet = wraps ? hour >= quietFromHour || hour < quietToHour : hour >= quietFromHour && hour < quietToHour;
  if (!quiet) return now;
  const next = new Date(now);
  if (hour >= quietToHour) next.setDate(next.getDate() + 1);
  next.setHours(quietToHour, 0, 0, 0);
  return next.getTime();
}
