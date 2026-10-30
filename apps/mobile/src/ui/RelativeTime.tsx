import { useEffect, useState } from "react";
import type { StyleProp, TextStyle } from "react-native";
import { useT, type Translator } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { haptic } from "@/motion/haptics";
import { useAppStore } from "@/state/store";
import { Text } from "./Text";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

type RelativeUnit = "minute" | "hour" | "day";

/**
 * QOL-12: "5 min ago" in the app's language. Intl.RelativeTimeFormat when the runtime has it
 * (it says "yesterday" rather than "1 day ago"); the catalogue's plurals otherwise.
 */
export function relativeLabel(at: number, now: number, i18n: Translator): string | null {
  const elapsed = Math.max(0, now - at);
  if (elapsed < MINUTE_MS) return i18n.t("common.justNow");
  if (elapsed >= 7 * DAY_MS) return null;
  const [value, unit]: [number, RelativeUnit] =
    elapsed < HOUR_MS ? [Math.floor(elapsed / MINUTE_MS), "minute"] : elapsed < DAY_MS ? [Math.floor(elapsed / HOUR_MS), "hour"] : [Math.floor(elapsed / DAY_MS), "day"];
  const Rtf = (Intl as { RelativeTimeFormat?: typeof Intl.RelativeTimeFormat }).RelativeTimeFormat;
  if (Rtf) {
    try {
      return new Rtf(i18n.locale, { numeric: "auto", style: "short" }).format(-value, unit);
    } catch {
      // A locale the runtime lacks: the catalogue below.
    }
  }
  return i18n.plural(unit === "minute" ? "common.minutesAgo" : unit === "hour" ? "common.hoursAgo" : "common.daysAgo", value);
}

/** The exact moment: the time alone today, with the date otherwise, in the user's region and hour cycle. */
export function exactLabel(at: number, now: number, i18n: Translator, hourCycle: "h12" | "h23"): string {
  const time = formatClock(at, i18n.language, hourCycle);
  const date = new Date(at);
  if (date.toDateString() === new Date(now).toDateString()) return time;
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  const day = new Intl.DateTimeFormat(i18n.locale, { weekday: "short", day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) }).format(date);
  return `${day}, ${time}`;
}

/** Recent moments tick every 30 s, older ones every few minutes. */
function useNow(at: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const every = Date.now() - at < HOUR_MS ? 30_000 : 5 * MINUTE_MS;
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [at, now]);
  return now;
}

/**
 * QOL-12: when something happened, as "5 min ago"; a tap shows the exact time and another
 * tap goes back. Screen readers always hear the exact time. Past moments only.
 */
export function RelativeTime({
  at,
  variant = "small",
  color,
  style,
  prefix,
}: {
  at: number;
  variant?: "small" | "body" | "tag" | "tab";
  color?: string;
  style?: StyleProp<TextStyle>;
  /** Text before the time, e.g. a name: "Jade, 5 min ago". */
  prefix?: string;
}) {
  const i18n = useT();
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const now = useNow(at);
  const [exact, setExact] = useState(false);
  const precise = exactLabel(at, now, i18n, hourCycle);
  const relative = relativeLabel(at, now, i18n) ?? precise;
  const shown = exact ? precise : relative;
  return (
    <Text
      variant={variant}
      color={color}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={prefix ? `${prefix}, ${precise}` : precise}
      accessibilityHint={i18n.t("common.timeToggle")}
      suppressHighlighting
      onPress={() => {
        haptic.select();
        setExact((on) => !on);
      }}
    >
      {prefix ? `${prefix}, ${shown}` : shown}
    </Text>
  );
}
