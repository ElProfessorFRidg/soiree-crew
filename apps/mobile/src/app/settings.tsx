import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { UnitSystem } from "@crew/units";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { setCrewAi, setCrewLeaderboard, useCrewData } from "@/server/crewData";
import { setCrewParticipation } from "@/server/venueData";
import { setPreferences } from "@/state/preferences";
import { followPhoneHourCycle, useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Chip, Panel, Row, Segmented, Switch } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Stepper } from "@/ui/Stepper";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { checkForUpdate, currentBuild } from "@/system/updates";

const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD", "AUD"] as const;
const WATER_STEPS = [30, 45, 60, 90] as const;

function SwitchRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (on: boolean) => void }) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.flex}>
        <Text variant="h3">{label}</Text>
        {hint ? <Text variant="small">{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <Text variant="label">{title}</Text>
      <Panel>{children}</Panel>
    </>
  );
}

/** PREF-03: every setting by hand. Each change is instant, stored on the server and synced (PREF-01). */
export default function SettingsScreen() {
  const i18n = useT();
  const theme = useTheme();
  const preferences = useAppStore((state) => state.preferences);
  const followsPhone = useAppStore((state) => state.hourCycleFollowsPhone);
  const checkUpdates = useAppStore((state) => state.checkUpdates);
  const crews = useCrewData((state) => state.crews);
  const hour = (h: number) => formatClock(new Date(2026, 0, 1, h).getTime(), i18n.language, preferences.hourCycle);
  const offline = () => showToast({ tone: "danger", message: i18n.t("crew.offline") });
  const currencies = CURRENCIES.includes(preferences.currency as (typeof CURRENCIES)[number]) ? CURRENCIES : [preferences.currency, ...CURRENCIES];

  return (
    <Screen back title={i18n.t("settings.title")} withToasts>
      <Text variant="small">{i18n.t("settings.savedEverywhere")}</Text>

      <Section title={i18n.t("settings.formats")}>
        <Text variant="label">{i18n.t("settings.unitSystem")}</Text>
        <Segmented<UnitSystem>
          accessibilityLabel={i18n.t("settings.unitSystem")}
          value={preferences.unitSystem}
          items={[
            { value: "metric", label: i18n.t("settings.metric") },
            { value: "us_customary", label: i18n.t("settings.usCustomary") },
            { value: "uk_imperial", label: i18n.t("settings.ukImperial") },
          ]}
          onChange={(unitSystem) => setPreferences({ unitSystem })}
        />
        <Text variant="label">{i18n.t("settings.currency")}</Text>
        <View style={styles.chips}>
          {currencies.map((code) => (
            <Chip key={code} label={code} selected={code === preferences.currency} onPress={() => setPreferences({ currency: code })} />
          ))}
        </View>
        <Text variant="label">{i18n.t("settings.timeFormat")}</Text>
        <Segmented<"phone" | "h23" | "h12">
          accessibilityLabel={i18n.t("settings.timeFormat")}
          value={followsPhone ? "phone" : preferences.hourCycle}
          items={[
            { value: "phone", label: i18n.t("settings.hourPhone") },
            { value: "h23", label: i18n.t("settings.h23") },
            { value: "h12", label: i18n.t("settings.h12") },
          ]}
          onChange={(choice) => {
            useAppStore.setState({ hourCycleFollowsPhone: choice === "phone" });
            if (choice === "phone") followPhoneHourCycle();
            else setPreferences({ hourCycle: choice });
          }}
        />
        <Text variant="label">{i18n.t("settings.dayBoundary")}</Text>
        <Stepper
          value={preferences.dayBoundaryHour}
          min={0}
          max={12}
          onChange={(dayBoundaryHour) => setPreferences({ dayBoundaryHour })}
          format={hour}
          decreaseLabel={i18n.t("settings.earlierBoundary")}
          increaseLabel={i18n.t("settings.laterBoundary")}
        />
      </Section>

      <Section title={i18n.t("settings.notifications")}>
        <SwitchRow
          label={i18n.t("updates.check")}
          hint={i18n.t("updates.checkHint", { build: currentBuild || "dev" })}
          value={checkUpdates}
          onChange={(on) => {
            useAppStore.setState({ checkUpdates: on, ...(on ? {} : { latestRelease: null }) });
            if (on) void checkForUpdate(true).catch(() => undefined);
          }}
        />
        <SwitchRow
          label={i18n.t("settings.water")}
          value={preferences.waterReminderMinutes !== null}
          onChange={(on) => setPreferences({ waterReminderMinutes: on ? 45 : null })}
        />
        {preferences.waterReminderMinutes !== null ? (
          <Segmented<number>
            accessibilityLabel={i18n.t("settings.water")}
            value={preferences.waterReminderMinutes}
            items={WATER_STEPS.map((minutes) => ({ value: minutes, label: minutes === 60 ? i18n.t("limits.waterHour") : i18n.t("limits.waterEvery", { minutes }) }))}
            onChange={(waterReminderMinutes) => setPreferences({ waterReminderMinutes })}
          />
        ) : null}
        <SwitchRow label={i18n.t("settings.limit")} value={preferences.warnNearLimit} onChange={(warnNearLimit) => setPreferences({ warnNearLimit })} />
        <SwitchRow label={i18n.t("settings.recap")} value={preferences.notifyRecap} onChange={(notifyRecap) => setPreferences({ notifyRecap })} />
        <Text variant="label">{i18n.t("settings.quiet")}</Text>
        <View style={styles.pair}>
          <View style={styles.flex}>
            <Text variant="small">{i18n.t("settings.quietFrom")}</Text>
            <Stepper
              value={preferences.quietFromHour}
              min={0}
              max={23}
              onChange={(quietFromHour) => setPreferences({ quietFromHour })}
              format={hour}
              decreaseLabel={`${i18n.t("settings.quietFrom")}, ${i18n.t("settings.earlier")}`}
              increaseLabel={`${i18n.t("settings.quietFrom")}, ${i18n.t("settings.later")}`}
            />
          </View>
          <View style={styles.flex}>
            <Text variant="small">{i18n.t("settings.quietTo")}</Text>
            <Stepper
              value={preferences.quietToHour}
              min={0}
              max={23}
              onChange={(quietToHour) => setPreferences({ quietToHour })}
              format={hour}
              decreaseLabel={`${i18n.t("settings.quietTo")}, ${i18n.t("settings.earlier")}`}
              increaseLabel={`${i18n.t("settings.quietTo")}, ${i18n.t("settings.later")}`}
            />
          </View>
        </View>
        <Text variant="small">{i18n.t("settings.quietHint")}</Text>
      </Section>

      {crews.length ? (
        <Section title={i18n.t("settings.crews")}>
          {crews.map((crew, index) => (
            <View key={crew.id} style={[styles.crew, index > 0 && { borderTopColor: theme.line, borderTopWidth: 1 }]}>
              <Text variant="h2">{crew.name}</Text>
              <SwitchRow
                label={i18n.t("settings.inLeaderboard")}
                value={!crew.me.leaderboardOptOut}
                onChange={(on) => void setCrewParticipation(crew.id, { leaderboardOptOut: !on }).catch(offline)}
              />
              <SwitchRow
                label={i18n.t("settings.inTerritory")}
                value={!crew.me.territoryOptOut}
                onChange={(on) => void setCrewParticipation(crew.id, { territoryOptOut: !on }).catch(offline)}
              />
              {crew.role === "admin" ? (
                <>
                  <SwitchRow label={i18n.t("settings.crewLeaderboard")} value={crew.leaderboardEnabled} onChange={(on) => void setCrewLeaderboard(crew.id, on).catch(offline)} />
                  <SwitchRow label={i18n.t("settings.crewAi")} hint={i18n.t("settings.crewAiHint")} value={crew.aiEnabled ?? false} onChange={(on) => void setCrewAi(crew.id, on).catch(offline)} />
                </>
              ) : !crew.leaderboardEnabled ? (
                <Text variant="small">
                  {i18n.t("recap.podiumOff")} {i18n.t("settings.adminOnly")}
                </Text>
              ) : null}
            </View>
          ))}
        </Section>
      ) : null}

      <Row
        title={i18n.t("people.viewAs")}
        subtitle={i18n.t("people.neverStrangers")}
        leading={<Icon name="eye" color={theme.textMuted} />}
        trailing={<Icon name="chev" color={theme.textMuted} />}
        onPress={() => router.push({ pathname: "/profile", params: { id: "me", as: "stranger" } })}
      />
      <Row
        title={i18n.t("settings.drinks")}
        subtitle={i18n.t("settings.drinksHint")}
        leading={<Icon name="glass" color={theme.textMuted} />}
        trailing={<Icon name="chev" color={theme.textMuted} />}
        onPress={() => router.push("/add-drink")}
        last
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54 },
  pair: { flexDirection: "row", gap: 12 },
  crew: { gap: 4, paddingVertical: 8 },
});
