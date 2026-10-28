import { router, useLocalSearchParams } from "expo-router";
import { useState, type ReactNode } from "react";
import { StyleSheet, View, Platform } from "react-native";
import { getMotionScale, setMotionScale } from "@crew/design-tokens";
import type { UnitSystem } from "@crew/units";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { formatClock } from "@/i18n/format";
import { CREW_KINDS, setCrewAi, setCrewLeaderboard, setCrewPublicName, updateCrew, useCrewData } from "@/server/crewData";
import { setCrewParticipation } from "@/server/venueData";
import { setPreferences } from "@/state/preferences";
import { followPhoneHourCycle, useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Chip, Panel, Row, Segmented, Switch } from "@/ui/controls";
import { Icon, type AnyIconName } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Stepper } from "@/ui/Stepper";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { checkForUpdate, currentBuild } from "@/system/updates";
import { AppIconPicker } from "@/profile/AppIconPicker";
import { refreshReminders } from "@/reminders/reminders";
import { AccountSection } from "@/profile/AccountSection";
import { RegionRules } from "@/profile/RegionRules";
import { UpdateNotice } from "@/system/UpdateNotice";
import { showFailure } from "@/server/errors";

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


type SettingsSection = "region" | "notifications" | "security" | "appearance";
const SECTIONS: { id: SettingsSection; icon: AnyIconName }[] = [
  { id: "region", icon: "flag" },
  { id: "notifications", icon: "bell" },
  { id: "security", icon: "lock" },
  { id: "appearance", icon: "eye" },
];

/** Reglages board, screen 1: one list, each line opens its own screen. */
function SettingsRoot() {
  const i18n = useT();
  const theme = useTheme();
  const preferences = useAppStore((state) => state.preferences);
  const summary: Record<SettingsSection, string> = {
    region: `${i18n.t(`languages.${preferences.language}`)}, ${i18n.t(`countries.${preferences.legalCountry}` as "countries.FR")}, ${i18n.t(`units.${preferences.bacUnit}`)}`,
    notifications: i18n.t("settings.notificationsSummary"),
    security: i18n.t("settings.securitySummary"),
    appearance: i18n.t("settings.appearanceSummary"),
  };
  const link = (title: string, icon: AnyIconName, onPress: () => void, subtitle?: string, last?: boolean) => (
    <Row
      key={title}
      title={title}
      subtitle={subtitle}
      leading={<Icon name={icon} color={theme.textMuted} />}
      trailing={<Icon name="chev" color={theme.textMuted} />}
      onPress={onPress}
      last={last}
    />
  );
  return (
    <>
      <UpdateNotice />
      <Panel>
        {SECTIONS.map((s, index) =>
          link(i18n.t(`settings.sections.${s.id}`), s.icon, () => router.push({ pathname: "/settings", params: { section: s.id } }), summary[s.id], index === SECTIONS.length - 1),
        )}
      </Panel>
      <Panel>
        {link(i18n.t("settings.guardrails"), "x:target", () => router.push("/limits"))}
        {link(i18n.t("people.edit"), "user", () => router.push("/edit-profile"))}
        {link(i18n.t("settings.drinks"), "glass", () => router.push("/add-drink"))}
        {link(i18n.t("privacy.open"), "shield", () => router.push("/privacy"), undefined, true)}
      </Panel>
      <Text variant="small" align="center">
        {i18n.t("settings.version", { build: currentBuild || "dev" })}
      </Text>
    </>
  );
}

/** PREF-03: every setting by hand. Each change is instant, stored on the server and synced (PREF-01). */
export default function SettingsScreen() {
  const i18n = useT();
  const { section } = useLocalSearchParams<{ section?: SettingsSection }>();
  const theme = useTheme();
  const preferences = useAppStore((state) => state.preferences);
  const followsPhone = useAppStore((state) => state.hourCycleFollowsPhone);
  const checkUpdates = useAppStore((state) => state.checkUpdates);
  const soundsOn = useAppStore((state) => state.soundsOn);
  const hapticsOn = useAppStore((state) => state.hapticsOn);
  const lockScreenNumbers = useAppStore((state) => state.lockScreenNumbers);
  const crews = useCrewData((state) => state.crews);
  const hour = (h: number) => formatClock(new Date(2026, 0, 1, h).getTime(), i18n.language, preferences.hourCycle);
  const offline = showFailure(i18n);
  const currencies = CURRENCIES.includes(preferences.currency as (typeof CURRENCIES)[number]) ? CURRENCIES : [preferences.currency, ...CURRENCIES];

  return (
    <Screen back title={section ? i18n.t(`settings.sections.${section}`) : i18n.t("settings.title")} withToasts>
      {!section ? <SettingsRoot /> : null}
      {section === "region" ? (
        <>
          <RegionRules />
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

          <Text variant="small">{i18n.t("settings.savedEverywhere")}</Text>
        </>
      ) : null}
      {section === "notifications" ? (
        <>
          <Section title={i18n.t("settings.notifications")}>
            <SwitchRow
              label={i18n.t("settings.lockNumbers")}
              hint={i18n.t("settings.lockNumbersHint")}
              value={lockScreenNumbers}
              onChange={(on) => {
                useAppStore.setState({ lockScreenNumbers: on });
                void refreshReminders().catch(() => undefined);
              }}
            />
            <SwitchRow
              label={i18n.t("updates.check")}
              hint={i18n.t("updates.checkHint", { build: currentBuild || "dev" })}
              value={checkUpdates}
              onChange={(on) => {
                useAppStore.setState({ checkUpdates: on, ...(on ? {} : { latestRelease: null }) });
                if (on) void checkForUpdate(true).catch(() => undefined);
              }}
            />
            {/* Reminders are local notifications: a browser tab cannot send them (reminders.ts). */}
            {Platform.OS === "web" ? (
              <Text variant="small">{i18n.t("settings.remindersAppOnly")}</Text>
            ) : (
              <>
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
              </>
            )}
          </Section>

        </>
      ) : null}
      {section === "appearance" ? (
        <>
          <Section title={i18n.t("appIcon.section")}>
            <SwitchRow
              label={i18n.t("settings.sounds")}
              hint={i18n.t("settings.soundsHint")}
              value={soundsOn}
              onChange={(on) => {
                useAppStore.setState({ soundsOn: on });
                if (on) haptic.cheers();
              }}
            />
            <SwitchRow
              label={i18n.t("settings.haptics")}
              value={hapticsOn}
              onChange={(on) => {
                useAppStore.setState({ hapticsOn: on });
                if (on) haptic.confirmed();
              }}
            />
            <AppIconPicker />
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
                      <View style={styles.chips}>
                        {CREW_KINDS.map((k) => (
                          <Chip key={k} label={i18n.t(`crew.kinds.${k}`)} selected={(crew.kind ?? "friends") === k} onPress={() => void updateCrew(crew.id, { kind: k }).catch(offline)} />
                        ))}
                      </View>
                      <SwitchRow label={i18n.t("crew.openSwitch")} hint={i18n.t("crew.openHint")} value={Boolean(crew.open)} onChange={(open) => void updateCrew(crew.id, { open }).catch(offline)} />
                      <SwitchRow label={i18n.t("settings.crewLeaderboard")} value={crew.leaderboardEnabled} onChange={(on) => void setCrewLeaderboard(crew.id, on).catch(offline)} />
                      <SwitchRow
                        label={i18n.t("settings.crewPublicName")}
                        hint={i18n.t("settings.crewPublicNameHint")}
                        value={crew.publicName ?? false}
                        onChange={(on) => void setCrewPublicName(crew.id, on).catch(offline)}
                      />
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
            last
          />
          {__DEV__ ? <MotionScale /> : null}
        </>
      ) : null}
      {section === "security" ? <AccountSection /> : null}
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

const SCALES = [0.1, 0.25, 1, 2, 10] as const;

/** MOT-14, dev builds only: slows or speeds every animation for the frame-by-frame review. */
function MotionScale() {
  const i18n = useT();
  const [scale, setScale] = useState(getMotionScale());
  return (
    <Section title={i18n.t("settings.motionScale")}>
      <Segmented<number>
        items={SCALES.map((s) => ({ value: s, label: `${i18n.number(s, s < 1 ? 2 : 0)}×` }))}
        value={scale}
        accessibilityLabel={i18n.t("settings.motionScale")}
        onChange={(s) => {
          setMotionScale(s);
          setScale(s);
        }}
      />
      <Text variant="small">{i18n.t("settings.motionScaleHint")}</Text>
    </Section>
  );
}
