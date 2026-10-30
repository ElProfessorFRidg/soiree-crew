import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme";
import { Text } from "./Text";

const COLUMNS = 13;

/** Profil board: one square per week, darker to amber with the number of nights out. */
export function Heatmap({ values, accessibilityLabel }: { values: readonly number[]; accessibilityLabel: string }) {
  const theme = useTheme();
  const shade = (n: number) => (n <= 0 ? theme.surfaceRaised : n === 1 ? `${theme.amber}55` : n === 2 ? `${theme.amber}AA` : theme.amber);
  return (
    <View style={styles.grid} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      {values.map((n, i) => (
        <View key={i} style={[styles.cell, { backgroundColor: shade(n) }]} />
      ))}
    </View>
  );
}

const DAY_MS = 86_400_000;
const GAP = 3;
const LABEL_WIDTH = 16;
const MIN_CELL = 12;
const dateOf = (night: string) => new Date(`${night}T12:00:00Z`);
const keyOf = (date: Date) => date.toISOString().slice(0, 10);

/**
 * N-14: a calendar of nights out, one column per week and one row per weekday, weeks starting on
 * the user's first day of the week (PREF-02). Nights after tonight stay blank.
 */
export function CalendarHeatmap({
  nights,
  tonight,
  weeks,
  firstDay,
  locale,
  accessibilityLabel,
}: {
  nights: readonly { night: string; count: number }[];
  tonight: string;
  weeks: number;
  /** 0 = Sunday ... 6 = Saturday. */
  firstDay: number;
  locale: string;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const counts = useMemo(() => new Map(nights.map((n) => [n.night, n.count])), [nights]);
  // As many weeks as fit with squares big enough to tell apart (12 px), up to what the server sent.
  const shown = width ? Math.max(4, Math.min(weeks, Math.floor((width - LABEL_WIDTH) / (MIN_CELL + GAP)))) : weeks;
  const end = dateOf(tonight);
  const lastWeekStart = new Date(end.getTime() - ((end.getUTCDay() - firstDay + 7) % 7) * DAY_MS);
  const start = new Date(lastWeekStart.getTime() - (shown - 1) * 7 * DAY_MS);
  const cell = width ? Math.floor((width - LABEL_WIDTH - GAP * shown) / shown) : 0;
  const shade = (n: number) => (n <= 0 ? theme.surfaceRaised : n === 1 ? `${theme.amber}88` : theme.amber);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" });
  const month = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {cell ? (
        <>
          <View style={[styles.calRow, { height: 14 }]}>
            <View style={{ width: LABEL_WIDTH }} />
            {Array.from({ length: shown }, (_, w) => {
              const first = new Date(start.getTime() + w * 7 * DAY_MS);
              const previous = new Date(first.getTime() - 7 * DAY_MS);
              const label = w === 0 || first.getUTCMonth() !== previous.getUTCMonth() ? month.format(first) : "";
              return (
                <View key={w} style={{ width: cell, marginLeft: GAP, overflow: "visible" }}>
                  {label ? (
                    <Text variant="small" style={styles.month} numberOfLines={1}>
                      {label}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
          {Array.from({ length: 7 }, (_, d) => (
            <View key={d} style={[styles.calRow, { marginTop: GAP }]}>
              <Text variant="small" style={[styles.weekday, { width: LABEL_WIDTH, lineHeight: cell }]}>
                {d % 2 === 0 ? weekday.format(new Date(start.getTime() + d * DAY_MS)) : ""}
              </Text>
              {Array.from({ length: shown }, (_, w) => {
                const date = new Date(start.getTime() + (w * 7 + d) * DAY_MS);
                const future = date.getTime() > end.getTime();
                return (
                  <View
                    key={w}
                    style={{ width: cell, height: cell, marginLeft: GAP, borderRadius: 2, backgroundColor: future ? "transparent" : shade(counts.get(keyOf(date)) ?? 0) }}
                  />
                );
              })}
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 3 },
  cell: { width: `${100 / COLUMNS - 1}%`, aspectRatio: 1, borderRadius: 3 },
  calRow: { flexDirection: "row", alignItems: "center" },
  month: { position: "absolute", left: 0, width: 40, fontSize: 10, lineHeight: 12 },
  weekday: { fontSize: 10, textAlign: "left" },
});
