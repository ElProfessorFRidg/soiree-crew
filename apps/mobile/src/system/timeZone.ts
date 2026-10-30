import { getCalendars } from "expo-localization";

/** The phone's IANA time zone, e.g. "Europe/Paris" (QOL-02, PREF-05). */
export function phoneTimeZone(): string | null {
  try {
    return getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}
