import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { palette } from "@crew/design-tokens";
import { useT, type Translator } from "@/i18n";
import { useCrewNames } from "@/crew/names";
import { formatClock } from "@/i18n/format";
import { haptic } from "@/motion/haptics";
import type { NightStatus, Radar } from "@/server/radarData";
import { useAppStore } from "@/state/store";
import { useFirstDayOfWeek } from "@/system/weekStart";
import type { Theme } from "@crew/design-tokens";
import { useTheme } from "@/theme";
import { Segmented, Tag } from "@/ui/controls";
import { Icon, type AnyIconName } from "@/ui/Icon";
import { ScalePressable } from "@/ui/Pressable";
import { Text } from "@/ui/Text";
import { atNightMinute } from "./StatusDetails";

/** YYYY-MM-DD read as a local calendar day (never shifted by the time zone). */
export function nightDay(night: string): Date {
  const [y, m, d] = night.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

/** "Tonight", "Tomorrow night", else "Thu 12" in the user's region. */
export function nightLabel(night: string, radar: Radar, i18n: Translator): string {
  const index = radar.nights.indexOf(night);
  if (index === 0) return i18n.t("radar.tonight");
  if (index === 1) return i18n.t("radar.tomorrowNight");
  return new Intl.DateTimeFormat(i18n.locale, { weekday: "short", day: "numeric" }).format(nightDay(night));
}

/** N-02: one colour and one glyph per status, from the design tokens, so the grid reads without colour too. */
export function statusLook(status: NightStatus | undefined, theme: Theme): { bg: string; fg: string; icon: AnyIconName | null; border: string } {
  switch (status) {
    case "going_out":
      return { bg: theme.amber, fg: theme.onAccent, icon: "glass", border: "transparent" };
    case "maybe":
      return { bg: theme.ok, fg: theme.onAccent, icon: "flame", border: "transparent" };
    case "home":
      return { bg: palette.tint.waterBg, fg: palette.tint.waterText, icon: "home", border: "transparent" };
    case "unavailable":
      return { bg: theme.surfaceRaised, fg: theme.textMuted, icon: "x", border: "transparent" };
    default:
      return { bg: "transparent", fg: theme.textMuted, icon: null, border: theme.line };
  }
}

const TAG_TONE = { going_out: "amber", maybe: "ok", home: "water", unavailable: "neutral" } as const;
const STATUSES: readonly NightStatus[] = ["going_out", "maybe", "home", "unavailable"];

/** Friday and Saturday nights, Thursday and Friday where the week starts on Saturday. */
function weekendNights(firstDay: number): number[] {
  return firstDay === 6 ? [4, 5] : [5, 6];
}

type Group = "tonight" | "weekend" | "week" | "nextWeek";

/** N-02: tonight, this weekend, the rest of this week, next week; the week as the region counts it (PREF-02). */
function groupOf(night: string, tonight: string, firstDay: number): Group {
  if (night === tonight) return "tonight";
  const day = nightDay(night);
  const start = nightDay(tonight);
  start.setDate(start.getDate() - ((start.getDay() - firstDay + 7) % 7));
  const nextWeek = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  // Seven nights in a row hold exactly one weekend: the coming one.
  if (weekendNights(firstDay).includes(day.getDay())) return "weekend";
  return day < nextWeek ? "week" : "nextWeek";
}

/** N-02: the crew's next seven nights, as a calendar grid by person or as a list grouped by when. */
export function WeekBoard({ radar, me, selected, onPick }: { radar: Radar; me: string; selected: string; onPick: (night: string) => void }) {
  const i18n = useT();
  const theme = useTheme();
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const firstDay = useFirstDayOfWeek();
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const crewName = useCrewNames();
  const nameOf = (id: string) => (id === me ? i18n.t("crew.you") : crewName(id, radar.members.find((m) => m.userId === id)?.name ?? ""));
  const statusOf = (userId: string, night: string) => radar.statuses.find((s) => s.userId === userId && s.night === night);
  const weekday = (night: string, style: "narrow" | "long") => new Intl.DateTimeFormat(i18n.locale, { weekday: style }).format(nightDay(night));

  const describe = (s: Radar["statuses"][number]) => {
    const clock = (minutes: number) => formatClock(atNightMinute(s.night, minutes), i18n.language, hourCycle);
    const when =
      s.fromMinute === null ? null : s.toMinute === null ? i18n.t("radar.from", { time: clock(s.fromMinute) }) : i18n.t("radar.window", { from: clock(s.fromMinute), to: clock(s.toMinute) });
    return [i18n.t(`radar.${s.status}`), when, s.place || null].filter(Boolean).join(", ");
  };

  const groups: { id: Group; nights: string[] }[] = (["tonight", "weekend", "week", "nextWeek"] as const).map((id) => ({
    id,
    nights: radar.nights.filter((n) => groupOf(n, radar.tonight, firstDay) === id),
  }));
  const outOn = (night: string) => radar.statuses.filter((s) => s.night === night && (s.status === "going_out" || s.status === "maybe"));
  const groupTitle: Record<Group, string> = {
    tonight: i18n.t("radar.tonight"),
    weekend: i18n.t("radar.groupWeekend"),
    week: i18n.t("radar.groupWeek"),
    nextWeek: i18n.t("radar.groupNextWeek"),
  };

  return (
    <View style={styles.block}>
      <Text variant="label">{i18n.t("radar.week")}</Text>
      <Segmented<"calendar" | "list">
        accessibilityLabel={i18n.t("radar.week")}
        value={view}
        items={[
          { value: "list", label: i18n.t("radar.viewList") },
          { value: "calendar", label: i18n.t("radar.viewCalendar") },
        ]}
        onChange={setView}
      />

      {view === "calendar" ? (
        <View>
          <View style={styles.row}>
            <View style={styles.name} />
            {radar.nights.map((night, i) => (
              <View key={night} style={[styles.cellWrap, i > 0 && nightDay(night).getDay() === firstDay ? { borderLeftWidth: 1.5, borderLeftColor: theme.lineStrong } : null]}>
                <Text variant="tab" align="center" color={night === radar.tonight ? theme.amberText : theme.textMuted}>
                  {weekday(night, "narrow")}
                </Text>
              </View>
            ))}
          </View>
          {radar.members.map((member) => (
            <View key={member.userId} style={styles.row}>
              <Text variant="small" style={styles.name} numberOfLines={2}>
                {nameOf(member.userId)}
              </Text>
              {radar.nights.map((night, i) => {
                const s = statusOf(member.userId, night);
                const look = statusLook(s?.status, theme);
                const label = `${nameOf(member.userId)}, ${weekday(night, "long")}, ${s ? describe(s) : i18n.t("radar.noStatus")}`;
                const cell = (
                  <View style={[styles.cell, { backgroundColor: look.bg, borderColor: night === selected && member.userId === me ? theme.text : look.border }]}>
                    {look.icon ? <Icon name={look.icon} size={14} color={look.fg} /> : null}
                  </View>
                );
                const divider = i > 0 && nightDay(night).getDay() === firstDay ? { borderLeftWidth: 1.5, borderLeftColor: theme.lineStrong } : null;
                // My own row picks the night to set above; the others' rows are read only.
                return member.userId === me ? (
                  <ScalePressable
                    key={night}
                    style={[styles.cellWrap, divider]}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: night === selected }}
                    onPress={() => {
                      haptic.select();
                      onPick(night);
                    }}
                  >
                    {cell}
                  </ScalePressable>
                ) : (
                  <View key={night} style={[styles.cellWrap, divider]} accessible accessibilityLabel={label}>
                    {cell}
                  </View>
                );
              })}
            </View>
          ))}
          <View style={styles.legend}>
            {STATUSES.map((status) => (
              <Tag key={status} tone={TAG_TONE[status]} icon={statusLook(status, theme).icon ?? undefined} label={i18n.t(`radar.${status}`)} />
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.block}>
          {groups.every((g) => g.nights.every((n) => outOn(n).length === 0)) ? <Text variant="small">{i18n.t("radar.weekEmpty")}</Text> : null}
          {groups
            .filter((g) => g.nights.some((n) => outOn(n).length > 0))
            .map((g) => (
              <View key={g.id} style={styles.group}>
                <Text variant="h3">{groupTitle[g.id]}</Text>
                {g.nights
                  .filter((n) => outOn(n).length > 0)
                  .map((night) => (
                    <View key={night} style={styles.night}>
                      {g.id !== "tonight" ? <Text variant="label">{nightLabel(night, radar, i18n)}</Text> : null}
                      {outOn(night).map((s) => {
                        const look = statusLook(s.status, theme);
                        return (
                          <View key={s.userId} style={styles.line} accessible accessibilityLabel={`${nameOf(s.userId)}, ${describe(s)}`}>
                            <View style={[styles.dot, { backgroundColor: look.bg }]}>{look.icon ? <Icon name={look.icon} size={12} color={look.fg} /> : null}</View>
                            <Text style={styles.flex}>
                              <Text variant="h3">{nameOf(s.userId)}</Text>
                              <Text variant="small">{`  ${describe(s)}`}</Text>
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ))}
              </View>
            ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", minHeight: 36 },
  name: { width: 72, paddingRight: 4 },
  cellWrap: { flex: 1, alignItems: "stretch", paddingHorizontal: 2 },
  cell: { height: 30, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  group: { gap: 6 },
  night: { gap: 4 },
  line: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 32 },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
});
