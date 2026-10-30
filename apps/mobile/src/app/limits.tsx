import { router } from "expo-router";
import { StyleSheet, View, Platform } from "react-native";
import { breathRatio, formatBacValue } from "@crew/units";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { useLiveBac, useNow } from "@/state/hooks";
import { setPreferences } from "@/state/preferences";
import { muteUntilMorning, refreshReminders } from "@/reminders/reminders";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Panel, Row, Segmented, Switch } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Stepper } from "@/ui/Stepper";
import { Text } from "@/ui/Text";

/** Personal limit range in tenths of g/L, as the prototype slider (0.2 to 1.5). */
const LIMIT_MIN = 2;
const LIMIT_MAX = 15;
const WATER_OPTIONS = [30, 45, 60, 0] as const;

export default function LimitsScreen() {
  const i18n = useT();
  const theme = useTheme();
  const now = useNow();
  const live = useLiveBac(now);
  const preferences = useAppStore((state) => state.preferences);
  const mutedUntil = useAppStore((state) => state.remindersMutedUntil);
  const hourCycle = preferences.hourCycle;
  if (!live) return null;

  const ratio = breathRatio(live.rules);
  const unit = i18n.t(`units.${preferences.bacUnit}`);
  const format = (tenths: number) =>
    formatBacValue(tenths / 10, preferences.bacUnit, ratio, i18n.locale);
  const limitTenths =
    preferences.personalLimit === null
      ? null
      : Math.round(preferences.personalLimit * 10);
  const { driving } = live;
  // O-87: the same conservative reading as the Party screen.
  const underText = driving.rising
    ? i18n.t("party.drivingRising")
    : driving.tooCloseToCall
      ? i18n.t("party.tooClose")
      : driving.underLimitAt === null || driving.underLimitAt <= now
        ? i18n.t("limits.underNow")
        : formatClock(driving.underLimitAt, i18n.language, preferences.hourCycle);

  return (
    <Screen back title={i18n.t("limits.title")}>
      <Panel>
        <Text variant="h3">{i18n.t("limits.myLimit")}</Text>
        {limitTenths === null ? (
          <Button
            label={i18n.t("limits.setLimit")}
            variant="secondary"
            icon="plus"
            height={48}
            onPress={() => setPreferences({ personalLimit: 0.8 })}
          />
        ) : (
          <>
            <Stepper
              value={limitTenths}
              min={LIMIT_MIN}
              max={LIMIT_MAX}
              format={format}
              unit={unit}
              onChange={(tenths) =>
                setPreferences({ personalLimit: tenths / 10 })
              }
              decreaseLabel={i18n.t("limits.lower")}
              increaseLabel={i18n.t("limits.higher")}
            />
            {Platform.OS === "web" ? null : (
              <View style={styles.switchRow}>
                <Text style={styles.flex}>{i18n.t("limits.warn")}</Text>
                <Switch
                  value={preferences.warnNearLimit}
                  onValueChange={(warnNearLimit) =>
                    setPreferences({ warnNearLimit })
                  }
                  accessibilityLabel={i18n.t("limits.warn")}
                />
              </View>
            )}
            <Button
              label={i18n.t("limits.removeLimit")}
              variant="outline"
              height={44}
              onPress={() => setPreferences({ personalLimit: null })}
            />
          </>
        )}
      </Panel>

      {Platform.OS === "web" ? (
        <Text variant="small">{i18n.t("settings.remindersAppOnly")}</Text>
      ) : (
        <Panel>
          <Text variant="h3">{i18n.t("limits.water")}</Text>
          <Segmented<number>
            accessibilityLabel={i18n.t("limits.water")}
            value={preferences.waterReminderMinutes ?? 0}
            items={WATER_OPTIONS.map((minutes) => ({
              value: minutes,
              label:
                minutes === 0
                  ? i18n.t("limits.waterOff")
                  : minutes === 60
                    ? i18n.t("limits.waterHour")
                    : i18n.t("limits.waterEvery", { minutes }),
            }))}
            onChange={(minutes) =>
              setPreferences({
                waterReminderMinutes: minutes === 0 ? null : minutes,
              })
            }
          />
        </Panel>
      )}

      <Panel>
        <Text variant="h3">{i18n.t("limits.driving")}</Text>
        <Row
          title={i18n.t("limits.country")}
          subtitle={i18n.t(
            `countries.${preferences.legalCountry}` as "countries.FR",
          )}
          trailing={<Icon name="chev" color={theme.textMuted} />}
          onPress={() => router.push("/(tabs)/me")}
        />
        <View style={styles.switchRow}>
          <Text style={styles.flex}>{i18n.t("limits.underAt")}</Text>
          <Text variant="h3" color={theme.amber}>
            {underText}
          </Text>
        </View>
        <Text variant="small">{i18n.t("limits.changeInMe")}</Text>
      </Panel>
      <Text variant="disclaimer">{i18n.t("party.notice")}</Text>
      {/* QOL-30: one tap for a quiet night, back on its own in the morning. No reminders on web. */}
      {Platform.OS === "web" ? null : mutedUntil !== null && mutedUntil > Date.now() ? (
        <>
          <Text variant="small">
            {i18n.t("limits.muted", {
              time: formatClock(mutedUntil, i18n.language, hourCycle),
            })}
          </Text>
          <Button
            label={i18n.t("limits.unmute")}
            variant="outline"
            height={48}
            onPress={() => {
              useAppStore.setState({ remindersMutedUntil: null });
              void refreshReminders();
            }}
          />
        </>
      ) : (
        <Button
          label={i18n.t("limits.muteNow")}
          variant="outline"
          height={48}
          onPress={() => void muteUntilMorning()}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
  },
  flex: { flex: 1 },
});
