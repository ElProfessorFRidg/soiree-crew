import { getCalendars, getLocales } from "expo-localization";
import { useAppStore } from "@/state/store";

// PREF-02: regions whose weeks start on Sunday or Saturday; everyone else starts on Monday (ISO 8601).
const SUNDAY_FIRST = new Set([
  "US", "CA", "MX", "BR", "JP", "KR", "TW", "HK", "MO", "PH", "IL", "IN", "ZA", "SA", "AR", "CO", "PE", "VE",
  "GT", "HN", "NI", "PA", "PR", "DO", "SV", "PY", "BO", "TH", "KH", "LA", "MM", "NP", "PK", "BD", "ID", "KE", "ZW",
]);
const SATURDAY_FIRST = new Set(["AF", "DZ", "BH", "DJ", "EG", "IQ", "IR", "JO", "KW", "LY", "OM", "QA", "SD", "SY"]);

/** The week start the phone reports, 0 = Sunday ... 6 = Saturday. */
export function deviceFirstDayOfWeek(): number {
  // expo-localization counts 1 = Sunday ... 7 = Saturday.
  const weekday = getCalendars()[0]?.firstWeekday;
  if (typeof weekday === "number" && weekday >= 1 && weekday <= 7) return weekday - 1;
  const region = getLocales()[0]?.regionCode?.toUpperCase() ?? "";
  if (SUNDAY_FIRST.has(region)) return 0;
  if (SATURDAY_FIRST.has(region)) return 6;
  return 1;
}

/** PREF-02: first day of the week, 0 = Sunday ... 6 = Saturday; the Settings choice wins over the phone. */
export function firstDayOfWeek(): number {
  const chosen = useAppStore.getState().weekStartOverride;
  return typeof chosen === "number" && chosen >= 0 && chosen <= 6 ? chosen : deviceFirstDayOfWeek();
}

/** The same value as a hook, so a screen redraws when the Settings choice changes. */
export function useFirstDayOfWeek(): number {
  const chosen = useAppStore((s) => s.weekStartOverride);
  return typeof chosen === "number" && chosen >= 0 && chosen <= 6 ? chosen : deviceFirstDayOfWeek();
}

/** The `count` days of the week holding `day`, starting on the first day of the week, at local midnight. */
export function weekDays(day: Date, first = firstDayOfWeek(), count = 7): Date[] {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  start.setDate(start.getDate() - ((start.getDay() - first + 7) % 7));
  return Array.from({ length: count }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}
