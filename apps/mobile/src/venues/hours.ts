import type { UserPreferences } from "@crew/units";
import type { Translator } from "@/i18n";
import { formatClock } from "@/i18n/format";

/** N-08: same shape as the server's (apps/server/src/hours.ts). Days 0 Monday to 6 Sunday, minutes after midnight. */
export interface HourRange {
  days: number[];
  from: number;
  to: number;
}
export interface WeekSchedule {
  open: HourRange[];
  happy: HourRange[];
}

export interface VenueFacts {
  /** "owner" once the place is claimed and its owner wrote hours; "crew" for user-entered ones. */
  source: "owner" | "crew" | null;
  hoursText?: string;
  happyText?: string;
  schedule: WeekSchedule | null;
  openNow: boolean | null;
  happyNow: boolean;
  canEdit?: boolean;
}

/** A clock time from minutes after midnight, in the user's format. */
export function clockOf(minutes: number, i18n: Translator, hourCycle: UserPreferences["hourCycle"]): string {
  const day = new Date(2026, 0, 5);
  day.setHours(0, minutes % 1440, 0, 0);
  return formatClock(day.getTime(), i18n.language, hourCycle);
}

/** Short weekday names, Monday first. */
export function weekdayNames(i18n: Translator, style: "short" | "narrow" = "short"): string[] {
  // 2 November 2026 is a Monday.
  return Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(i18n.locale, { weekday: style }).format(new Date(2026, 10, 2 + i)));
}

function daysText(days: number[], i18n: Translator): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 7) return i18n.t("venue.hours.everyDay");
  const names = weekdayNames(i18n);
  const contiguous = sorted.length > 2 && sorted.every((d, i) => i === 0 || d === sorted[i - 1]! + 1);
  if (contiguous) return i18n.t("venue.hours.dayRange", { from: names[sorted[0]!]!, to: names[sorted.at(-1)!]! });
  return sorted.map((d) => names[d]).join(", ");
}

/** "Tue to Sat, 18:00 to 02:00" for each range, joined. */
export function describeRanges(ranges: HourRange[], i18n: Translator, hourCycle: UserPreferences["hourCycle"]): string {
  return ranges
    .map((r) => i18n.t("venue.hours.range", { days: daysText(r.days, i18n), from: clockOf(r.from, i18n, hourCycle), to: clockOf(r.to, i18n, hourCycle) }))
    .join("; ");
}
