import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, Share, StyleSheet, View, Platform } from "react-native";
import QRCode from "react-native-qrcode-svg";
import Animated, { FadeIn, SlideInLeft, SlideInRight, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { duration, palette } from "@crew/design-tokens";
import { breathRatio, COUNTRIES, countryRules, drivingLimit, formatBacValue, UI_LANGUAGES } from "@crew/units";
import { ConnectServer } from "@/crew/ConnectServer";
import { Field } from "@/crew/Field";
import { crewErrorMessage, inviteCodeFrom } from "@/crew/invite";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { ProfileFields } from "@/profile/ProfileFields";
import { draftFromProfile, saveProfile } from "@/profile/saveProfile";
import { acceptInvite, createCrew, createInvite, CREW_KINDS, type CrewKind } from "@/server/crewData";
import { useSession } from "@/server/session";
import { setPreferences } from "@/state/preferences";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Button, IconButton } from "@/ui/Button";
import { Chip, Panel, Row, Segmented, Switch } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

// O-01 to O-05, SEC-08: the arrival flow of the Arrivee board. Consent comes before the weight is
// typed (SEC-08), so it sits one step earlier than on the board (ADR 0006).

/** Legal drinking age of the country picked for the legal limit (O-02, decision D-04). */
function legalAge(country: string): number {
  return country.startsWith("US") ? 21 : 18;
}

type Step = "welcome" | "account" | "consent" | "profile" | "settings" | "notifications" | "crew";
const FLOW: readonly Step[] = ["welcome", "account", "consent", "profile", "settings", "notifications", "crew"];

const appIcon = require("../../assets/icon.png") as number;

function Progress({ index, total }: { index: number; total: number }) {
  const theme = useTheme();
  const i18n = useT();
  return (
    <View style={styles.progress} accessibilityRole="progressbar" accessibilityLabel={i18n.t("onboarding.step", { n: index + 1, total })}>
      {Array.from({ length: total }, (_, i) => (
        <Segment key={i} on={i <= index} track={theme.surfaceRaised} />
      ))}
    </View>
  );
}

function Segment({ on, track }: { on: boolean; track: string }) {
  const fill = useAnimatedStyle(() => ({ width: withTiming(on ? "100%" : "0%", { duration: duration.progress, easing: easings.out }) }), [on]);
  return (
    <View style={[styles.segment, { backgroundColor: track }]}>
      <Animated.View style={[styles.segmentFill, fill]} />
    </View>
  );
}

function AgeGate({ age }: { age: number }) {
  const i18n = useT();
  const theme = useTheme();
  const [refused, setRefused] = useState(false);
  return (
    <Screen>
      <Animated.View entering={FadeIn.duration(duration.enter).easing(easings.out)} style={styles.age}>
        <Image source={appIcon} style={styles.icon} accessibilityIgnoresInvertColors />
        <Text variant="h1">{i18n.t("onboarding.ageTitle", { age })}</Text>
        <Text muted>{i18n.t("onboarding.ageBody")}</Text>
        {refused ? (
          <Animated.View entering={FadeIn.duration(duration.enter)}>
            <Panel tint="danger">
              <Text variant="h3" color={theme.danger}>
                {i18n.t("onboarding.ageRefused", { age })}
              </Text>
              <Text>{i18n.t("onboarding.ageRefusedBody")}</Text>
            </Panel>
          </Animated.View>
        ) : null}
        <Button
          label={i18n.t("onboarding.ageYes", { age })}
          height={64}
          onPress={() => {
            haptic.confirmed();
            useAppStore.setState({ ageConfirmedAt: Date.now() });
          }}
        />
        <Button
          label={i18n.t("onboarding.ageNo")}
          variant="secondary"
          onPress={() => {
            haptic.error();
            setRefused(true);
          }}
        />
      </Animated.View>
    </Screen>
  );
}

export default function Onboarding() {
  const i18n = useT();
  const theme = useTheme();
  const preferences = useAppStore((state) => state.preferences);
  const ageConfirmed = useAppStore((state) => state.ageConfirmedAt !== null);
  const session = useSession((state) => state.session);
  const [step, setStep] = useState<Step>("welcome");
  const [forward, setForward] = useState(true);
  const [accountMode, setAccountMode] = useState<"create" | "password">("create");
  const [draft, setDraft] = useState(() => draftFromProfile(useAppStore.getState().profile));
  const [health, setHealth] = useState(false);
  const [consentAt, setConsentAt] = useState<number | null>(null);
  const [crewMade, setCrewMade] = useState(false);

  // The steps shown depend on the account: without one there is no account form and no crew.
  // Reminders are local notifications: a browser tab cannot send them, so the web skips that step.
  const flow = FLOW.filter((s) => (s === "crew" ? session !== null : s === "notifications" ? Platform.OS !== "web" : s !== "account" || step === "account"));
  const index = flow.indexOf(step);

  const go = (next: Step | "done", isForward = true) => {
    if (next === "done") {
      router.replace("/(tabs)");
      return;
    }
    haptic.select();
    setForward(isForward);
    setStep(next);
  };
  const advance = () => go(flow[index + 1] ?? "done");
  const back = () => {
    const previous = step === "consent" && session === null ? "welcome" : flow[index - 1];
    if (previous) go(previous, false);
  };

  // Signing in or creating the account moves on by itself.
  const hadSession = useRef(session !== null);
  useEffect(() => {
    if (session && !hadSession.current && step === "account") go("consent");
    hadSession.current = session !== null;
    // go only changes local state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, step]);

  if (!ageConfirmed) return <AgeGate age={legalAge(preferences.legalCountry)} />;

  const footer = (() => {
    switch (step) {
      case "welcome":
        return null;
      case "account":
        return <Button label={i18n.t("onboarding.guest")} variant="outline" height={48} onPress={() => go("consent")} />;
      case "consent":
        return (
          <Button
            label={i18n.t("onboarding.next")}
            height={56}
            disabled={!health}
            onPress={() => {
              setConsentAt((at) => at ?? Date.now());
              advance();
            }}
          />
        );
      case "profile":
        return (
          <Button
            label={i18n.t("onboarding.next")}
            height={56}
            onPress={() => {
              saveProfile(draft, consentAt ?? Date.now());
              advance();
            }}
          />
        );
      case "settings":
        return <Button label={i18n.t("onboarding.looksRight")} height={56} onPress={advance} />;
      case "notifications":
        return <Button label={session ? i18n.t("onboarding.next") : i18n.t("onboarding.finish")} height={56} onPress={advance} />;
      case "crew":
        return crewMade ? null : <Button label={i18n.t("onboarding.later")} variant="outline" height={48} onPress={() => go("done")} />;
    }
  })();

  const entering = (forward ? SlideInRight : SlideInLeft).duration(duration.enter).easing(easings.out);

  return (
    <Screen footer={footer} withToasts>
      {step !== "welcome" ? (
        <View style={styles.top}>
          <IconButton icon="back" accessibilityLabel={i18n.t("common.back")} onPress={back} />
          <Progress index={Math.max(0, index - 1)} total={flow.length - 1} />
        </View>
      ) : null}
      <Animated.View key={step} entering={entering} style={styles.step}>
        {step === "welcome" ? (
          <Welcome
            onCreate={() => {
              setAccountMode("create");
              go("account");
            }}
            onSignIn={() => {
              setAccountMode("password");
              go("account");
            }}
            onGuest={() => go("consent")}
            signedIn={session !== null}
          />
        ) : null}
        {step === "account" ? (
          <>
            <Text variant="h1">{accountMode === "create" ? i18n.t("onboarding.accountTitle") : i18n.t("onboarding.signInTitle")}</Text>
            <ConnectServer initialMode={accountMode} />
          </>
        ) : null}
        {step === "consent" ? (
          <>
            <Text variant="h1">{i18n.t("onboarding.consentTitle")}</Text>
            <Panel>
              <View style={styles.switchRow}>
                <View style={styles.flex}>
                  <Text variant="h3">{i18n.t("onboarding.consentHealth")}</Text>
                  <Text variant="small">{i18n.t("onboarding.consentHealthBody")}</Text>
                </View>
                <Switch value={health} onValueChange={setHealth} accessibilityLabel={i18n.t("onboarding.consentHealth")} />
              </View>
            </Panel>
            <Row
              title={i18n.t("onboarding.consentPrivacy")}
              leading={<Icon name="shield" color={theme.textMuted} />}
              trailing={<Icon name="chev" color={theme.textMuted} />}
              onPress={() => router.push("/privacy")}
              last
            />
          </>
        ) : null}
        {step === "profile" ? (
          <>
            <Text variant="h1">{i18n.t("onboarding.profileTitle")}</Text>
            <Text variant="label">{i18n.t("onboarding.profileBody")}</Text>
            <ProfileFields draft={draft} onChange={setDraft} />
          </>
        ) : null}
        {step === "settings" ? <DetectedSettings /> : null}
        {step === "notifications" ? <Notifications /> : null}
        {step === "crew" ? <FirstCrew onCreated={() => setCrewMade(true)} onDone={() => go("done")} /> : null}
      </Animated.View>
    </Screen>
  );
}

function Welcome({ onCreate, onSignIn, onGuest, signedIn }: { onCreate: () => void; onSignIn: () => void; onGuest: () => void; signedIn: boolean }) {
  const i18n = useT();
  return (
    <View style={styles.welcome}>
      <Image source={appIcon} style={styles.icon} accessibilityIgnoresInvertColors />
      <Text variant="h1" style={styles.hero}>{i18n.t("onboarding.welcomeTitle")}</Text>
      <Text muted>{i18n.t("onboarding.welcomeBody")}</Text>
      <View style={styles.actions}>
        {signedIn ? (
          <Button label={i18n.t("onboarding.next")} height={56} onPress={onGuest} />
        ) : (
          <>
            <Button label={i18n.t("onboarding.createAccount")} height={56} onPress={onCreate} />
            <Button label={i18n.t("onboarding.guest")} variant="secondary" height={52} onPress={onGuest} />
            <Text variant="small" align="center">
              {i18n.t("onboarding.guestHint")}
            </Text>
            <Button label={i18n.t("onboarding.haveAccount")} variant="outline" height={44} onPress={onSignIn} />
          </>
        )}
      </View>
    </View>
  );
}

/** PREF-02: what was guessed from the phone, each line changeable on the spot. */
function DetectedSettings() {
  const i18n = useT();
  const theme = useTheme();
  const preferences = useAppStore((state) => state.preferences);
  const [open, setOpen] = useState<"country" | "language" | "unit" | null>(null);
  const rules = countryRules(preferences.legalCountry);
  const ratio = breathRatio(rules);
  const limitText = (gPerL: number) => `${formatBacValue(gPerL, preferences.bacUnit, ratio, i18n.locale)} ${i18n.t(`units.${preferences.bacUnit}`)}`;
  const country = i18n.t(`countries.${preferences.legalCountry}` as "countries.FR");
  const novice = drivingLimit(rules, "novice");
  const standard = drivingLimit(rules, "standard");
  const numbers = [...new Set([rules.emergency.eu112 ? "112" : null, rules.emergency.primary, rules.emergency.ambulance].filter((n): n is string => !!n))];
  const toggle = (which: typeof open) => {
    haptic.select();
    setOpen((current) => (current === which ? null : which));
  };
  const chevron = (which: typeof open) => <Icon name={open === which ? "arrowup" : "arrowdn"} color={theme.textMuted} />;
  return (
    <>
      <Text variant="h1">{i18n.t("onboarding.settingsTitle", { country })}</Text>
      <Text muted>{i18n.t("onboarding.settingsBody")}</Text>
      <Panel>
        <Row title={i18n.t("profile.language")} subtitle={i18n.t(`languages.${preferences.language}`)} trailing={chevron("language")} onPress={() => toggle("language")} />
        {open === "language" ? (
          <Animated.View entering={FadeIn.duration(duration.enter)} style={styles.chips}>
            {UI_LANGUAGES.map((language) => (
              <Chip key={language} label={i18n.t(`languages.${language}`)} selected={preferences.language === language} onPress={() => setPreferences({ language })} />
            ))}
          </Animated.View>
        ) : null}
        <Row
          title={i18n.t("profile.country")}
          subtitle={i18n.t("onboarding.limitLine", { limit: limitText(standard), country })}
          trailing={chevron("country")}
          onPress={() => toggle("country")}
        />
        {open === "country" ? (
          <Animated.View entering={FadeIn.duration(duration.enter)}>
            {Object.keys(COUNTRIES).map((code) => (
              <Row
                key={code}
                title={i18n.t(`countries.${code}` as "countries.FR")}
                trailing={code === preferences.legalCountry ? <Icon name="check" color={theme.amber} /> : null}
                onPress={() => {
                  const next = countryRules(code);
                  setPreferences({ legalCountry: code, bacUnit: next.bacUnits[0] ?? "g_per_l_blood", currency: next.currency, unitSystem: next.unitSystem });
                  setOpen(null);
                }}
              />
            ))}
          </Animated.View>
        ) : null}
        {novice !== standard ? (
          <View style={[styles.switchRow, styles.rowPad, { borderBottomColor: theme.line }]}>
            <View style={styles.flex}>
              <Text variant="h3">{i18n.t("profile.novice")}</Text>
              <Text variant="small">{i18n.t("onboarding.noviceLine", { limit: limitText(novice) })}</Text>
            </View>
            <Switch
              value={preferences.driverCategory === "novice"}
              onValueChange={(on) => setPreferences({ driverCategory: on ? "novice" : "standard" })}
              accessibilityLabel={i18n.t("profile.novice")}
            />
          </View>
        ) : null}
        <Row title={i18n.t("onboarding.bacShown")} subtitle={i18n.t(`units.long.${preferences.bacUnit}`)} trailing={chevron("unit")} onPress={() => toggle("unit")} />
        {open === "unit" ? (
          <Animated.View entering={FadeIn.duration(duration.enter)} style={styles.chips}>
            {rules.bacUnits.map((unit) => (
              <Chip key={unit} label={i18n.t(`units.${unit}`)} selected={unit === preferences.bacUnit} onPress={() => setPreferences({ bacUnit: unit })} />
            ))}
          </Animated.View>
        ) : null}
        <Row title={i18n.t("onboarding.units")} subtitle={i18n.t(preferences.unitSystem === "metric" ? "settings.metric" : preferences.unitSystem === "us_customary" ? "settings.usCustomary" : "settings.ukImperial")} />
        <Row title={i18n.t("onboarding.standardDrink")} subtitle={i18n.t("onboarding.standardDrinkValue", { grams: rules.standardDrinkGrams })} />
        <Row title={i18n.t("onboarding.moneyTime")} subtitle={`${preferences.currency}, ${i18n.t(preferences.hourCycle === "h23" ? "settings.h23" : "settings.h12")}`} />
        <Row title={i18n.t("onboarding.emergency")} subtitle={numbers.join(", ")} last />
      </Panel>
      {!rules.verified ? (
        <Text variant="small" color={theme.danger}>
          {i18n.t("profile.unverified")}
        </Text>
      ) : null}
    </>
  );
}

/** O-03, QOL-20: what may notify, chosen before the first night. */
function Notifications() {
  const i18n = useT();
  const preferences = useAppStore((state) => state.preferences);
  const hour = (h: number) => formatClock(new Date(2026, 0, 1, h).getTime(), i18n.language, preferences.hourCycle);
  const rows = [
    ["settings.water", "onboarding.notifWater", preferences.waterReminderMinutes !== null, (on: boolean) => setPreferences({ waterReminderMinutes: on ? 45 : null })],
    ["settings.limit", "onboarding.notifLimit", preferences.warnNearLimit, (on: boolean) => setPreferences({ warnNearLimit: on })],
    ["settings.recap", "onboarding.notifRecap", preferences.notifyRecap, (on: boolean) => setPreferences({ notifyRecap: on })],
  ] as const;
  return (
    <>
      <Text variant="h1">{i18n.t("onboarding.notifTitle")}</Text>
      <Text muted>{i18n.t("onboarding.notifBody")}</Text>
      <Panel>
        {rows.map(([title, hint, value, onChange]) => (
          <View key={title} style={styles.switchRow}>
            <View style={styles.flex}>
              <Text variant="h3">{i18n.t(title)}</Text>
              <Text variant="small">{i18n.t(hint)}</Text>
            </View>
            <Switch value={value} onValueChange={onChange} accessibilityLabel={i18n.t(title)} />
          </View>
        ))}
      </Panel>
      <Row
        title={i18n.t("settings.quiet")}
        subtitle={i18n.t("onboarding.quietBody", { from: hour(preferences.quietFromHour), to: hour(preferences.quietToHour) })}
        leading={<Icon name="moon" color={palette.dark.textMuted} />}
        last
      />
    </>
  );
}

/** O-05: create the first crew (the name updates the invite card as it is typed) or join one. */
function FirstCrew({ onCreated, onDone }: { onCreated: () => void; onDone: () => void }) {
  const i18n = useT();
  const theme = useTheme();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CrewKind>("friends");
  const [invite, setInvite] = useState<{ url: string; code: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const fail = (error: unknown) => {
    haptic.error();
    showToast({ tone: "danger", message: crewErrorMessage(error, i18n) });
  };
  const shown = name.trim() || i18n.t("onboarding.crewNamePlaceholder");

  return (
    <>
      <Text variant="h1">{i18n.t("onboarding.crewTitle")}</Text>
      <Segmented
        accessibilityLabel={i18n.t("onboarding.crewTitle")}
        value={mode}
        items={[
          { value: "create", label: i18n.t("onboarding.crewCreate") },
          { value: "join", label: i18n.t("onboarding.crewJoin") },
        ]}
        onChange={setMode}
      />
      {mode === "create" ? (
        <Animated.View key="create" entering={FadeIn.duration(duration.enter)} style={styles.step}>
          {invite ? null : (
            <>
              <Field label={i18n.t("crew.crewName")} placeholder={i18n.t("onboarding.crewNamePlaceholder")} value={name} onChangeText={setName} maxLength={40} />
              <View style={styles.chips}>
                {CREW_KINDS.map((k) => (
                  <Chip key={k} label={i18n.t(`crew.kinds.${k}`)} selected={kind === k} onPress={() => setKind(k)} />
                ))}
              </View>
            </>
          )}
          <Panel style={styles.inviteCard}>
            <Text variant="h2" align="center">
              {shown}
            </Text>
            <View style={[styles.qr, { backgroundColor: theme.text }]}>
              {invite ? (
                <Animated.View entering={FadeIn.duration(duration.enter)}>
                  <QRCode value={invite.url} size={168} backgroundColor={palette.dark.text} color={palette.accent.onAccent} />
                </Animated.View>
              ) : (
                <Icon name="x:scan" size={56} color={palette.accent.onAccent} />
              )}
            </View>
            <Text variant="small" align="center">
              {i18n.t("onboarding.crewShare")}
            </Text>
            {invite ? (
              <View style={styles.inviteActions}>
                <Button
                  label={i18n.t("onboarding.copyLink")}
                  icon="link"
                  variant="secondary"
                  height={48}
                  onPress={() =>
                    void Clipboard.setStringAsync(invite.url).then(() => {
                      haptic.confirmed();
                      showToast({ message: i18n.t("onboarding.copied") });
                    })
                  }
                />
                <Button label={i18n.t("crew.invite")} icon="share" variant="outline" height={48} onPress={() => void Share.share({ message: i18n.t("crew.inviteShare", { crew: shown, url: invite.url }) })} />
                <Text variant="small" align="center">
                  {i18n.t("onboarding.linkHint")}
                </Text>
              </View>
            ) : null}
          </Panel>
          {invite ? (
            <Button label={i18n.t("onboarding.finish")} height={56} onPress={onDone} />
          ) : (
            <Button
              label={i18n.t("crew.create")}
              height={56}
              disabled={!name.trim()}
              loading={busy}
              onPress={() => {
                setBusy(true);
                createCrew(name.trim(), kind)
                  .then((id) => createInvite(id))
                  .then((created) => {
                    haptic.confirmed();
                    setInvite(created);
                    onCreated();
                  })
                  .catch(fail)
                  .finally(() => setBusy(false));
              }}
            />
          )}
        </Animated.View>
      ) : (
        <Animated.View key="join" entering={FadeIn.duration(duration.enter)} style={styles.step}>
          <Field
            label={i18n.t("crew.inviteCode")}
            value={code}
            onChangeText={(text) => setCode(inviteCodeFrom(text) ?? text.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={60}
          />
          <Button
            label={i18n.t("onboarding.pasteLink")}
            icon="link"
            variant="outline"
            height={44}
            onPress={() =>
              void Clipboard.getStringAsync().then((text) => {
                const found = inviteCodeFrom(text);
                if (found) setCode(found);
                else showToast({ message: i18n.t("crew.pasteNothing") });
              })
            }
          />
          <Button
            label={i18n.t("crew.join")}
            height={56}
            disabled={code.trim().length !== 8}
            loading={busy}
            onPress={() => {
              setBusy(true);
              acceptInvite(code)
                .then(() => {
                  haptic.confirmed();
                  onDone();
                })
                .catch(fail)
                .finally(() => setBusy(false));
            }}
          />
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  age: { gap: 16, paddingTop: 48 },
  welcome: { gap: 16, paddingTop: 48 },
  icon: { width: 72, height: 72, borderRadius: 18 },
  hero: { fontSize: 34, lineHeight: 38 },
  actions: { gap: 12, marginTop: 24 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  progress: { flex: 1, flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  segmentFill: { height: 4, borderRadius: 2, backgroundColor: palette.accent.amber },
  step: { gap: 16 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  rowPad: { borderBottomWidth: 1, paddingVertical: 12 },
  flex: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 8 },
  inviteCard: { alignItems: "center", gap: 12 },
  qr: { width: 192, height: 192, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  inviteActions: { alignSelf: "stretch", gap: 8 },
});
