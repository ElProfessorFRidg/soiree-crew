import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Platform, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInLeft, SlideInRight, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { duration, palette } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { AccountStep } from "@/onboarding/AccountStep";
import { ConsentPanel } from "@/onboarding/ConsentPanel";
import { CrewWaiting, FirstCrew } from "@/onboarding/CrewStep";
import { freshDraft, legalAge, nextStep, previousStep, progress, type FlowContext, type OnboardingDraft, type Step } from "@/onboarding/flow";
import { askForReminders, NotificationsStep } from "@/onboarding/NotificationsStep";
import { ValueCards } from "@/onboarding/ValueCards";
import { ProfileFields } from "@/profile/ProfileFields";
import { draftFromProfile, saveProfile } from "@/profile/saveProfile";
import { useSession } from "@/server/session";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Button, IconButton } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

// O-01 to O-05, SEC-08: the arrival flow of the Arrivee board, shortened so the app comes fast:
// age, welcome, account (only if wanted), consent, profile (only with the consent), crew, then the
// reminders. Consent comes before the weight is typed (SEC-08, ADR 0006). The detected settings
// moved to a card on the first Party screen. Every step and choice is kept in the app store, so a
// closed app reopens where it was.

const appIcon = require("../../assets/icon.png") as number;

/** Shown once per launch: the banner says the draft came back, then stays closed. */
let restoreAnnounced = false;

function Progress({ index, total }: { index: number; total: number }) {
  const theme = useTheme();
  const i18n = useT();
  return (
    <View
      style={styles.progress}
      accessibilityRole="progressbar"
      accessibilityLabel={i18n.t("onboarding.step", { n: index + 1, total })}
      accessibilityValue={{ min: 1, max: total, now: index + 1 }}
    >
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

/** O-04: "Brouillon retrouvé", closable. */
function DraftBanner({ onClose }: { onClose: () => void }) {
  const i18n = useT();
  const theme = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(duration.enter)} exiting={FadeOut.duration(duration.toastIn)}>
      <Panel style={styles.banner}>
        <Icon name="edit" color={theme.amber} />
        <Text variant="small" style={styles.flex} accessibilityLiveRegion="polite">
          {i18n.t("onboarding.draftRestored")}
        </Text>
        <IconButton icon="x" accessibilityLabel={i18n.t("common.close")} onPress={onClose} />
      </Panel>
    </Animated.View>
  );
}

function initialDraft(): OnboardingDraft {
  const { onboarding, profile } = useAppStore.getState();
  return onboarding ?? freshDraft(draftFromProfile(profile), profile?.healthConsentAt != null);
}

export default function Onboarding() {
  const i18n = useT();
  const preferences = useAppStore((state) => state.preferences);
  const ageConfirmed = useAppStore((state) => state.ageConfirmedAt !== null);
  const stored = useAppStore((state) => state.onboarding);
  const session = useSession((state) => state.session);
  const [forward, setForward] = useState(true);
  const [crewMade, setCrewMade] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [restored, setRestored] = useState(() => {
    const draft = useAppStore.getState().onboarding;
    const found = !restoreAnnounced && draft !== null && draft.step !== "welcome";
    restoreAnnounced = true;
    return found;
  });
  const draft = stored ?? initialDraft();

  useEffect(() => {
    // Being here means not being in the app: an earlier finish (before a consent was withdrawn) no longer counts.
    useAppStore.setState((state) => ({ onboardedAt: null, onboarding: state.onboarding ?? initialDraft() }));
  }, []);

  const update = (patch: Partial<OnboardingDraft>) =>
    useAppStore.setState((state) => ({ onboarding: { ...(state.onboarding ?? initialDraft()), ...patch, savedAt: Date.now() } }));

  const context: FlowContext = {
    signedIn: session !== null,
    accountVisited: draft.accountVisited,
    health: draft.health,
    notificationsSupported: Platform.OS !== "web",
  };
  const step = draft.step;
  const after = nextStep(step, context);

  const finish = () => {
    useAppStore.setState((state) => ({ onboardedAt: Date.now(), onboarding: null, firstRun: state.firstRun.active ? state.firstRun : { ...state.firstRun, active: true } }));
    router.replace("/(tabs)");
  };
  const go = (next: Step | "done", isForward = true) => {
    if (next === "done") {
      finish();
      return;
    }
    haptic.select();
    setForward(isForward);
    setRestored(false);
    update({ step: next });
  };
  const advance = () => go(nextStep(step, context));
  const back = () => {
    const previous = step === "account" && draft.accountReturn ? draft.accountReturn : previousStep(step, context);
    if (previous) go(previous, false);
  };
  const leaveAccount = () => {
    const target = draft.accountReturn ?? "consent";
    update({ accountReturn: null });
    go(target);
  };

  // Making or opening the account moves on by itself, to where the account was asked from. A
  // draft restored on the account step of an account made since moves on too.
  useEffect(() => {
    if (session && step === "account") leaveAccount();
    // leaveAccount only changes the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, step]);

  if (!ageConfirmed) return <AgeGate age={legalAge(preferences.legalCountry)} />;

  const doneLabel = after === "done" ? i18n.t("onboarding.finish") : i18n.t("onboarding.next");
  const footer = (() => {
    switch (step) {
      case "welcome":
        return null;
      case "account":
        return <Button label={i18n.t("onboarding.guest")} variant="outline" height={48} onPress={leaveAccount} />;
      case "consent":
        return (
          <View style={styles.footer}>
            <Button
              label={i18n.t("onboarding.next")}
              height={56}
              disabled={!draft.health}
              accessibilityHint={draft.health ? undefined : i18n.t("onboarding.consentWithout")}
              onPress={() => {
                update({ consentAt: draft.consentAt ?? Date.now(), skippedHealth: false });
                advance();
              }}
            />
            {draft.health ? null : (
              <Button
                label={i18n.t("onboarding.skipHealth")}
                variant="outline"
                height={48}
                onPress={() => {
                  update({ skippedHealth: true, consentAt: null });
                  go(nextStep("consent", { ...context, health: false }));
                }}
              />
            )}
          </View>
        );
      case "profile":
        return (
          <Button
            label={doneLabel}
            height={56}
            onPress={() => {
              saveProfile(draft.profile, draft.consentAt ?? Date.now());
              advance();
            }}
          />
        );
      case "crew":
        return crewMade ? null : <Button label={i18n.t("onboarding.later")} variant="outline" height={48} onPress={advance} />;
      case "notifications":
        return (
          <Button
            label={doneLabel}
            height={56}
            loading={finishing}
            onPress={() => {
              setFinishing(true);
              void askForReminders(i18n, session !== null).finally(() => {
                setFinishing(false);
                advance();
              });
            }}
          />
        );
    }
  })();

  const entering = (forward ? SlideInRight : SlideInLeft).duration(duration.enter).easing(easings.out);
  const { index, total } = progress(step, context);

  return (
    <Screen footer={footer} withToasts>
      {step !== "welcome" ? (
        <View style={styles.top}>
          <IconButton icon="back" accessibilityLabel={i18n.t("common.back")} onPress={back} />
          <Progress index={index} total={total} />
        </View>
      ) : null}
      {restored ? <DraftBanner onClose={() => setRestored(false)} /> : null}
      <Animated.View key={step} entering={entering} style={styles.step}>
        {step === "welcome" ? (
          <Welcome
            signedIn={session !== null}
            onCreate={() => {
              update({ accountMode: "create", accountVisited: true, accountReturn: null });
              go("account");
            }}
            onSignIn={() => {
              update({ accountMode: "signin", accountVisited: true, accountReturn: null });
              go("account");
            }}
            onGuest={() => go("consent")}
          />
        ) : null}
        {step === "account" ? <AccountStep mode={draft.accountMode} onModeChange={(accountMode) => update({ accountMode })} /> : null}
        {step === "consent" ? (
          <>
            <Text variant="h1">{i18n.t("onboarding.consentTitle")}</Text>
            <ConsentPanel value={draft.health} onChange={(health) => update({ health })} />
          </>
        ) : null}
        {step === "profile" ? (
          <>
            <Text variant="h1">{i18n.t("onboarding.profileTitle")}</Text>
            <Text muted>{i18n.t("onboarding.profileBody")}</Text>
            <ProfileFields draft={draft.profile} onChange={(profile) => update({ profile })} />
          </>
        ) : null}
        {step === "crew" && session ? <FirstCrew onCreated={() => setCrewMade(true)} onDone={advance} doneLabel={doneLabel} /> : null}
        {step === "crew" && !session ? (
          <CrewWaiting
            onCreateAccount={() => {
              update({ accountMode: "create", accountVisited: true, accountReturn: "crew" });
              go("account");
            }}
          />
        ) : null}
        {step === "notifications" ? <NotificationsStep health={draft.health} /> : null}
      </Animated.View>
    </Screen>
  );
}

function Welcome({ onCreate, onSignIn, onGuest, signedIn }: { onCreate: () => void; onSignIn: () => void; onGuest: () => void; signedIn: boolean }) {
  const i18n = useT();
  return (
    <View style={styles.welcome}>
      <Image source={appIcon} style={styles.welcomeIcon} accessibilityIgnoresInvertColors />
      <Text variant="h1" style={styles.hero}>
        {i18n.t("onboarding.welcomeTitle")}
      </Text>
      <Text muted>{i18n.t("onboarding.welcomeBody")}</Text>
      <ValueCards />
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
            <Button label={i18n.t("onboarding.haveAccount")} variant="outline" height={48} onPress={onSignIn} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  age: { gap: 16, paddingTop: 48 },
  welcome: { gap: 14, paddingTop: 24 },
  icon: { width: 72, height: 72, borderRadius: 18 },
  welcomeIcon: { width: 56, height: 56, borderRadius: 14 },
  hero: { fontSize: 34, lineHeight: 38 },
  actions: { gap: 12, marginTop: 8 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  progress: { flex: 1, flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  segmentFill: { height: 4, borderRadius: 2, backgroundColor: palette.accent.amber },
  step: { gap: 16 },
  footer: { gap: 10 },
  banner: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  flex: { flex: 1 },
});
