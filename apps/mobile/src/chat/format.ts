import type { UserPreferences } from "@crew/units";
import type { Translator } from "@/i18n";
import { formatClock } from "@/i18n/format";

const DAY_MS = 86_400_000;

function dayStart(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** The time on a chat row: clock today, "hier", the weekday this week, then the date. */
export function whenShort(at: number, i18n: Translator, hourCycle: UserPreferences["hourCycle"], now = Date.now()): string {
  const days = Math.round((dayStart(now) - dayStart(at)) / DAY_MS);
  if (days <= 0) return formatClock(at, i18n.language, hourCycle);
  if (days === 1) return i18n.t("chat.yesterday");
  if (days < 7) return new Intl.DateTimeFormat(i18n.locale, { weekday: "short" }).format(new Date(at));
  return new Intl.DateTimeFormat(i18n.locale, { day: "numeric", month: "short" }).format(new Date(at));
}

/** 0:12 for a voice note. */
export function clip(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The disappearing timer in words, for the header and the segmented control. */
export function timerLabel(seconds: number, i18n: Translator): string {
  if (!seconds) return i18n.t("chat.timerOff");
  if (seconds <= 86_400) return i18n.t("chat.hours", { n: seconds / 3600 });
  return i18n.t("chat.days", { n: seconds / 86_400 });
}
