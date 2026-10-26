import type { UiLanguage, UserPreferences } from "@crew/units";

const MINUTE_MS = 60_000;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Clock time in the user's language and hour cycle: "22 h 47" in French, "10:47 PM" in English (h12). */
export function formatClock(at: number, language: UiLanguage, hourCycle: UserPreferences["hourCycle"]): string {
  const date = new Date(at);
  if (language === "fr" && hourCycle === "h23") {
    return `${date.getHours()} h ${pad(date.getMinutes())}`;
  }
  return new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: hourCycle === "h12",
  }).format(date);
}

/** Rounded to the minute first, so 1 h 59.6 min reads "2 h 00", never "1 h 60". */
export function formatDuration(ms: number, language: UiLanguage): string {
  const totalMinutes = Math.max(0, Math.round(ms / MINUTE_MS));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return language === "fr" ? `${hours} h ${pad(minutes)}` : `${hours}h ${pad(minutes)}m`;
}
