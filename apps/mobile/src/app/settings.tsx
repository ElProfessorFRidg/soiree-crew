import { checkForUpdateAsync, fetchUpdateAsync, isEnabled } from "expo-updates";
import { UpdateStatus } from "@/system/UpdateStatus";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, StyleSheet, TextInput, View } from "react-native";
import { getMotionScale, setMotionScale } from "@crew/design-tokens";
import type { UnitSystem } from "@crew/units";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { formatClock } from "@/i18n/format";
import { CREW_KINDS, setCrewAi, setCrewLeaderboard, setCrewPublicName, updateCrew, useCrewData } from "@/server/crewData";
import { setCrewParticipation } from "@/server/venueData";
import { setPreferences } from "@/state/preferences";
import { followPhoneHourCycle, useAppStore } from "@/state/store";
import { WeekStartRow } from "@/system/WeekStartRow";
import { useTheme } from "@/theme";
import { Chip, Panel, Row, Segmented, Switch } from "@/ui/controls";
import { Icon, type AnyIconName } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { inputText } from "@/ui/inputText";
import type { ThemeChoice } from "@/theme/choice";
import { Stepper } from "@/ui/Stepper";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { startOuting, stopCrewDetect, stopOuting, syncLocationUpdates } from "@/location/outing";
import { askPermission, permissionStatus } from "@/system/askPermission";
import { Button } from "@/ui/Button";
import { checkForUpdate, currentVersion } from "@/system/updates";
import { AppIconPicker } from "@/profile/AppIconPicker";
import { refreshReminders } from "@/reminders/reminders";
import { refreshCalendarReminders } from "@/server/calendarData";
import { AccountSection } from "@/profile/AccountSection";
import { RegionRules } from "@/profile/RegionRules";
import { UpdateNotice } from "@/system/UpdateNotice";
import { showFailure } from "@/server/errors";
import { MAPS_APPS, MAPS_NAMES, mapsAppOf, type MapsApp } from "@/venues/directions";

const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD", "AUD"] as const;
const WATER_STEPS = [30, 45, 60, 90] as const;
const TEXT_SCALES = [0.9, 1, 1.15, 1.3] as const;

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

function Section({ title, icon, children }: { title: string; icon?: AnyIconName; children: ReactNode }) {
  const theme = useTheme();
  return (
    <>
      <View style={styles.sectionTitle}>
        {icon ? <Icon name={icon} size={16} color={theme.textMuted} /> : null}
        <Text variant="label">{title}</Text>
      </View>
      <Panel>{children}</Panel>
    </>
  );
}


type SettingsSection = "region" | "appearance" | "notifications" | "security" | "data" | "crews" | "about";
const SECTION_ICONS: Record<SettingsSection, AnyIconName> = {
  region: "x:globe",
  appearance: "x:palette",
  notifications: "bell",
  security: "shield",
  data: "x:database",
  crews: "users",
  about: "x:info",
};
const GROUPS: { title: "preferences" | "safety" | "crew" | "help"; items: SettingsSection[] }[] = [
  { title: "preferences", items: ["region", "appearance", "notifications"] },
  { title: "safety", items: ["security", "data"] },
  { title: "crew", items: ["crews"] },
  { title: "help", items: ["about"] },
];
/** One line per setting, so the search box can find it: the label key and the screen it lives on. */
const SEARCH: { label: string; section: SettingsSection }[] = [
  { label: "settings.unitSystem", section: "region" },
  { label: "settings.currency", section: "region" },
  { label: "settings.timeFormat", section: "region" },
  { label: "settings.dayBoundary", section: "region" },
  { label: "settings.themeLabel", section: "appearance" },
  { label: "settings.textSize", section: "appearance" },
  { label: "settings.eco", section: "appearance" },
  { label: "settings.sounds", section: "appearance" },
  { label: "settings.haptics", section: "appearance" },
  { label: "settings.hapticsSoft", section: "appearance" },
  { label: "appIcon.section", section: "appearance" },
  { label: "settings.notifications", section: "notifications" },
  { label: "settings.lockNumbers", section: "notifications" },
  { label: "settings.nudges", section: "notifications" },
  { label: "settings.outing", section: "notifications" },
  { label: "settings.crewDetect", section: "notifications" },
  { label: "settings.water", section: "notifications" },
  { label: "settings.limit", section: "notifications" },
  { label: "settings.recap", section: "notifications" },
  { label: "settings.nightExtras", section: "notifications" },
  { label: "settings.quiet", section: "notifications" },
  { label: "settings.driveAlert", section: "security" },
  { label: "settings.dataSaver", section: "data" },
  { label: "settings.mapsApp", section: "data" },
  { label: "settings.inLeaderboard", section: "crews" },
  { label: "settings.inTerritory", section: "crews" },
  { label: "people.viewAs", section: "crews" },
  { label: "updates.check", section: "about" },
  { label: "updates.checkNow", section: "about" },
  { label: "updates.changelog", section: "about" },
];

/** Reglages board, screen 1: a search box, then the categories in groups, each line opens its own screen. */
function SettingsRoot() {
  const i18n = useT();
  const theme = useTheme();
  const preferences = useAppStore((state) => state.preferences);
  const [query, setQuery] = useState("");
  const summary: Record<SettingsSection, string> = {
    region: `${i18n.t(`languages.${preferences.language}`)}, ${i18n.t(`countries.${preferences.legalCountry}` as "countries.FR")}, ${i18n.t(`units.${preferences.bacUnit}`)}`,
    appearance: i18n.t("settings.appearanceSummary"),
    notifications: i18n.t("settings.notificationsSummary"),
    security: i18n.t("settings.securitySummary"),
    data: i18n.t("settings.dataSummary"),
    crews: i18n.t("settings.crewsSummary"),
    about: i18n.t("settings.aboutSummary"),
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
  const open = (id: SettingsSection) => router.push({ pathname: "/settings", params: { section: id } });
  const needle = query.trim().toLocaleLowerCase(i18n.language);
  const found = needle
    ? SEARCH.filter((entry) => i18n.t(entry.label as "settings.title").toLocaleLowerCase(i18n.language).includes(needle))
    : [];
  return (
    <>
      <UpdateNotice />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={i18n.t("settings.search")}
        placeholderTextColor={theme.textMuted}
        accessibilityLabel={i18n.t("settings.search")}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        returnKeyType="search"
        style={[styles.search, inputText({}), { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
      />
      {needle ? (
        found.length ? (
          <Panel>
            {found.map((entry, index) =>
              link(i18n.t(entry.label as "settings.title"), SECTION_ICONS[entry.section], () => open(entry.section), i18n.t(`settings.sections.${entry.section}`), index === found.length - 1),
            )}
          </Panel>
        ) : (
          <Text variant="small" align="center">{i18n.t("settings.searchNone")}</Text>
        )
      ) : (
        <>
          {GROUPS.map((group) => (
            <View key={group.title} style={styles.group}>
              <Text variant="label">{i18n.t(`settings.groups.${group.title}`)}</Text>
              <Panel>
                {group.items.map((id, index) => link(i18n.t(`settings.sections.${id}`), SECTION_ICONS[id], () => open(id), summary[id], index === group.items.length - 1))}
              </Panel>
            </View>
          ))}
          <View style={styles.group}>
            <Text variant="label">{i18n.t("settings.groups.shortcuts")}</Text>
            <Panel>
              {link(i18n.t("people.edit"), "user", () => router.push("/edit-profile"))}
              {link(i18n.t("settings.guardrails"), "x:target", () => router.push("/limits"))}
              {link(i18n.t("settings.drinks"), "glass", () => router.push("/add-drink"))}
              {link(i18n.t("privacy.open"), "lock", () => router.push("/privacy"), undefined, true)}
            </Panel>
          </View>
        </>
      )}
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
  const hapticsSoft = useAppStore((state) => state.hapticsSoft);
  const textScale = useAppStore((state) => state.textScale);
  const lockScreenNumbers = useAppStore((state) => state.lockScreenNumbers);
  const themeChoice = useAppStore((state) => state.themeChoice);
  const ecoOn = useAppStore((state) => state.ecoOn);
  const dataSaver = useAppStore((state) => state.dataSaver);
  const nudgesOn = useAppStore((state) => state.nudgesOn);
  const outingNudgeOn = useAppStore((state) => state.outingNudgeOn);
  const crewDetectOn = useAppStore((state) => state.crewDetectOn);
  const nightNudges = useAppStore((state) => state.nightNudges);
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
          <Section title={i18n.t("settings.formats")} icon="x:sliders">
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
            <Text variant="small">{i18n.t("settings.dayBoundaryHint", { time: hour(preferences.dayBoundaryHour) })}</Text>
            <WeekStartRow />
          </Section>

          <Text variant="small">{i18n.t("settings.savedEverywhere")}</Text>
        </>
      ) : null}
      {section === "notifications" ? (
        <>
          {/* N-35: which crew notifications ring the phone, per type. */}
          <Panel>
            <Row
              title={i18n.t("notify.settingsOpen")}
              leading={<Icon name="bell" color={theme.textMuted} />}
              trailing={<Icon name="chev" color={theme.textMuted} />}
              onPress={() => router.push("/notification-settings")}
              last
            />
          </Panel>
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
            {/* Reminders are local notifications: a browser tab cannot send them (reminders.ts). */}
            {Platform.OS === "web" ? (
              <Text variant="small">{i18n.t("settings.remindersAppOnly")}</Text>
            ) : (
              <>
                <SwitchRow
                  label={i18n.t("settings.nudges")}
                  hint={i18n.t("settings.nudgesHint")}
                  value={nudgesOn}
                  onChange={(on) => {
                    useAppStore.setState({ nudgesOn: on });
                    void refreshCalendarReminders().catch(() => undefined);
                  }}
                />
                <SwitchRow
                  label={i18n.t("settings.outing")}
                  hint={i18n.t("settings.outingHint")}
                  value={outingNudgeOn}
                  onChange={(on) => {
                    if (!on) {
                      useAppStore.setState({ outingNudgeOn: false });
                      void stopOuting();
                      return;
                    }
                    useAppStore.setState({ outingNudgeOn: true });
                    void (async () => {
                      // The reason first (one sheet), then the system asks "while using", then "always".
                      const before = await permissionStatus("location");
                      const foreground = await askPermission("location", "outing");
                      const background = foreground.granted ? await askPermission("locationAlways", before.granted ? "outing" : null) : foreground;
                      if (background.granted && (await startOuting())) return;
                      useAppStore.setState({ outingNudgeOn: false });
                      if (!background.declined) showToast({ tone: "danger", message: i18n.t("settings.outingDenied") });
                    })();
                  }}
                />
                <SwitchRow
                  label={i18n.t("settings.crewDetect")}
                  hint={i18n.t("settings.crewDetectHint")}
                  value={crewDetectOn}
                  onChange={(on) => {
                    if (!on) {
                      void stopCrewDetect();
                      return;
                    }
                    // It rides on the outing nudge and its "Always" permission.
                    if (!outingNudgeOn) {
                      showToast({ message: i18n.t("settings.crewDetectNeedsOuting") });
                      return;
                    }
                    useAppStore.setState({ crewDetectOn: true });
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
                {/* The extra night notifications, together: food, pace, the way home, the morning after. */}
                <Text variant="label">{i18n.t("settings.nightExtras")}</Text>
                {(
                  [
                    ["food", "settings.nightFood"],
                    ["pace", "settings.nightPace"],
                    ["ride", "settings.nightRide"],
                    ["morning", "settings.nightMorning"],
                  ] as const
                ).map(([kind, label]) => (
                  <SwitchRow
                    key={kind}
                    label={i18n.t(label)}
                    value={nightNudges[kind]}
                    onChange={(on) => {
                      useAppStore.setState((s) => ({ nightNudges: { ...s.nightNudges, [kind]: on } }));
                      void refreshReminders().catch(() => undefined);
                    }}
                  />
                ))}
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
          <Section title={i18n.t("settings.themeLabel")} icon="x:palette">
            <Segmented<ThemeChoice>
              accessibilityLabel={i18n.t("settings.themeLabel")}
              value={themeChoice}
              items={[
                { value: "auto", label: i18n.t("settings.themeAuto") },
                { value: "dark", label: i18n.t("settings.themeDark") },
                { value: "light", label: i18n.t("settings.themeLight") },
              ]}
              onChange={(choice) => useAppStore.setState({ themeChoice: choice })}
            />
            <SwitchRow label={i18n.t("settings.eco")} hint={i18n.t("settings.ecoHint")} value={ecoOn} onChange={(on) => useAppStore.setState({ ecoOn: on })} />
          </Section>
          <Section title={i18n.t("settings.textSize")} icon="x:textsize">
            <Segmented<number>
              accessibilityLabel={i18n.t("settings.textSize")}
              value={textScale}
              items={TEXT_SCALES.map((value) => ({ value, label: i18n.t(`settings.textScale.${String(value).replace(".", "_")}` as "settings.title") }))}
              onChange={(value) => useAppStore.setState({ textScale: value })}
            />
            <Text variant="small">{i18n.t("settings.textSizeHint")}</Text>
          </Section>
          <Section title={i18n.t("settings.soundAndTouch")} icon="x:volume">
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
            <SwitchRow
              label={i18n.t("settings.hapticsSoft")}
              hint={i18n.t("settings.hapticsSoftHint")}
              value={hapticsSoft}
              onChange={(on) => {
                useAppStore.setState({ hapticsSoft: on });
                if (hapticsOn) haptic.confirmed();
              }}
            />
          </Section>
          <Section title={i18n.t("appIcon.section")} icon="x:sparkle">
            <AppIconPicker />
          </Section>

          {__DEV__ ? <MotionScale /> : null}
        </>
      ) : null}
      {section === "crews" ? (
        <>
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
        </>
      ) : null}
      {section === "data" ? (
        <>
          <Section title={i18n.t("settings.dataTitle")} icon="x:database">
            <SwitchRow label={i18n.t("settings.dataSaver")} hint={i18n.t("settings.dataSaverHint")} value={dataSaver} onChange={(on) => useAppStore.setState({ dataSaver: on })} />
          </Section>
          <Section title={i18n.t("settings.mapsApp")} icon="x:map">
            <Segmented<MapsApp>
              accessibilityLabel={i18n.t("settings.mapsApp")}
              value={mapsAppOf(preferences.mapsApp)}
              items={MAPS_APPS.map((value) => ({ value, label: MAPS_NAMES[value] }))}
              onChange={(mapsApp) => setPreferences({ mapsApp })}
            />
            <Text variant="small">{i18n.t("settings.mapsAppHint")}</Text>
          </Section>
          <Panel>
            <Row title={i18n.t("privacy.open")} leading={<Icon name="lock" color={theme.textMuted} />} trailing={<Icon name="chev" color={theme.textMuted} />} onPress={() => router.push("/privacy")} last />
          </Panel>
        </>
      ) : null}
      {section === "about" ? (
        <>
          <Section title={i18n.t("settings.aboutTitle")} icon="x:cloudDown">
            <UpdateStatus />
            <CheckNow />
          </Section>
          <Panel>
            <SwitchRow
              label={i18n.t("updates.check")}
              hint={i18n.t("updates.checkHint", { version: currentVersion })}
              value={checkUpdates}
              onChange={(on) => {
                useAppStore.setState({ checkUpdates: on, ...(on ? {} : { latestRelease: null }) });
                if (on) void checkForUpdate(true).catch(() => undefined);
              }}
            />
          </Panel>
          <Panel>
            <Row title={i18n.t("updates.changelog")} leading={<Icon name="x:film" color={theme.textMuted} />} trailing={<Icon name="chev" color={theme.textMuted} />} onPress={() => router.push("/versions")} />
            <Row title={i18n.t("diagnostics.title")} leading={<Icon name="x:info" color={theme.textMuted} />} trailing={<Icon name="chev" color={theme.textMuted} />} onPress={() => router.push("/server-status")} />
            <Row title={i18n.t("diagnostics.journal")} leading={<Icon name="x:info" color={theme.textMuted} />} trailing={<Icon name="chev" color={theme.textMuted} />} onPress={() => router.push("/diagnostic-log")} last />
          </Panel>
        </>
      ) : null}
      {section === "security" && Platform.OS !== "web" ? <DriveAlertSection /> : null}
      {section === "security" ? <AccountSection /> : null}
    </Screen>
  );
}

/** "Alerte si je conduis après avoir bu": on by default once the "Always" location is granted (location/driving.ts). */
function DriveAlertSection() {
  const i18n = useT();
  const chosen = useAppStore((state) => state.driveAlertOn);
  const [background, setBackground] = useState(false);
  useEffect(() => {
    void permissionStatus("locationAlways").then((answer) => setBackground(answer.granted));
  }, []);
  const value = chosen ?? background;
  return (
    <Section title={i18n.t("settings.driveSection")}>
      <SwitchRow
        label={i18n.t("settings.driveAlert")}
        hint={i18n.t("settings.driveAlertHint")}
        value={value}
        onChange={(on) => {
          useAppStore.setState({ driveAlertOn: on });
          if (!on) {
            void syncLocationUpdates();
            return;
          }
          void (async () => {
            const before = await permissionStatus("location");
            const foreground = await askPermission("location", "drive");
            const always = foreground.granted ? await askPermission("locationAlways", before.granted ? "drive" : null) : foreground;
            setBackground(always.granted);
            if (always.granted && (await syncLocationUpdates())) return;
            useAppStore.setState({ driveAlertOn: false });
            if (!always.declined) showToast({ tone: "danger", message: i18n.t("settings.driveDenied") });
          })();
        }}
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 46 },
  group: { gap: 6 },
  sectionTitle: { flexDirection: "row", alignItems: "center", gap: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54 },
  pair: { flexDirection: "row", gap: 12 },
  crew: { gap: 4, paddingVertical: 8 },
});

const SCALES = [0.1, 0.25, 1, 2, 10] as const;

/** O-12: ask GitHub now, and say the answer: up to date, or the newer version (the banner offers it). */
function CheckNow() {
  const i18n = useT();
  const [busy, setBusy] = useState(false);
  const checking = useRef(false);
  if (Platform.OS === "web") return null;
  return (
    <Button
      label={i18n.t("updates.checkNow")}
      icon="x:refresh"
      variant="primary"
      loading={busy}
      onPress={() => {
        if (checking.current) return;
        checking.current = true;
        setBusy(true);
        const ota = isEnabled
          ? checkForUpdateAsync().then(async (available) => {
              if (!available.isAvailable && !available.isRollBackToEmbedded) return false;
              const fetched = await fetchUpdateAsync();
              return fetched.isNew || fetched.isRollBackToEmbedded;
            })
          : Promise.resolve(false);
        void Promise.allSettled([checkForUpdate(true), ota])
          .then(([ipaResult, otaResult]) => {
            const result = ipaResult.status === "fulfilled" ? ipaResult.value : "unavailable";
            const latest = useAppStore.getState().latestRelease;
            if (result === "newer" && latest) showToast({ message: i18n.t("updates.available", { version: latest.version ?? String(latest.build) }) });
            else if (otaResult.status === "fulfilled" && otaResult.value) showToast({ message: i18n.t("updates.otaReady") });
            else if (result === "latest" && otaResult.status === "fulfilled") showToast({ message: i18n.t("updates.upToDate", { version: currentVersion }) });
            else showToast({ tone: "danger", message: i18n.t("updates.unavailable") });
          })
          .finally(() => {
            checking.current = false;
            setBusy(false);
          });
      }}
    />
  );
}

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
    </Section>
  );
}
