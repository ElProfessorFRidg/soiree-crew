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
import { ageFromBirthDate, freshDraft, nextStep, previousStep, progress, visibleSteps, type FlowContext, type OnboardingDraft, type Step } from "@/onboarding/flow";
import { CrewStep } from "@/onboarding/CrewStep";
import { BacStep, BirthStep, commitBirthDate, PhotoStep } from "@/onboarding/IdentitySteps";
import { removeProfilePhoto, uploadProfilePhoto } from "@/onboarding/profilePhoto";
import { askForReminders, NotificationsStep } from "@/onboarding/NotificationsStep";
import { ClosingStep, LocationStep, RegionStep, VisibilityStep } from "@/onboarding/SetupSteps";
import { isVisibilityKey } from "@/onboarding/visibility";
import { ValueCards } from "@/onboarding/ValueCards";
import { draftFromProfile, saveProfile } from "@/profile/saveProfile";
import { useSession } from "@/server/session";
import { useAppStore } from "@/state/store";
import { askPermission } from "@/system/askPermission";
import { openAppSettings } from "@/system/permissions";
import { useTheme } from "@/theme";
import { Button, IconButton } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

// O-01 to O-05, PREF-02, PROF-01, PROF-02, SEC-08: the arrival flow of the Arrivee board as one
// continuous run, a question per screen: account, date of birth, photo, consent, body profile, the
// settings read from the phone, the five visibility choices, the crew, the permissions one by one and the
// finished card. Every answer is written to the app store (and the server when it has one) as it is
// given, so a closed app reopens on the screen it stopped at. Consent comes before the weight is
// typed (SEC-08, ADR 0006).

const appIcon = require("../../assets/icon.png") as number;

/** Shown once per launch: the banner says the draft came back, then stays closed. */
let restoreAnnounced = false;

/** A single line under the back button that fills as the screens go by. */
function Progress({ index, total }: { index: number; total: number }) {
  const theme = useTheme();
  const i18n = useT();
  const fill = useAnimatedStyle(() => ({ width: withTiming(`${((index + 1) / total) * 100}%`, { duration: duration.progress, easing: easings.out }) }), [index, total]);
  return (
    <View
      style={[styles.progress, { backgroundColor: theme.surfaceRaised }]}
      accessibilityRole="progressbar"
      accessibilityLabel={i18n.t("onboarding.step", { n: index + 1, total })}
      accessibilityValue={{ min: 1, max: total, now: index + 1 }}
    >
      <Animated.View style={[styles.progressFill, fill]} />
    </View>
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
  const stored = useAppStore((state) => state.onboarding);
  const session = useSession((state) => state.session);
  const [forward, setForward] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [tooYoung, setTooYoung] = useState(false);
  const [restored, setRestored] = useState(() => {
    const draft = useAppStore.getState().onboarding;
    const found = !restoreAnnounced && draft !== null && draft.step !== "welcome";
    restoreAnnounced = true;
    return found;
  });
  // A draft kept by an older version has no birth date, photo or choices yet.
  const draft: OnboardingDraft = {
    ...freshDraft(draftFromProfile(null), false),
    ...(stored ?? initialDraft()),
  };

  useEffect(() => {
    // Being here means not being in the app: an earlier finish (before a consent was withdrawn) no longer counts.
    useAppStore.setState((state) => ({
      onboardedAt: null,
      onboarding: state.onboarding ?? initialDraft(),
    }));
  }, []);

  const update = (patch: Partial<OnboardingDraft>) =>
    useAppStore.setState((state) => ({ onboarding: { ...draftOf(state.onboarding), ...patch, savedAt: Date.now() } }));

  const context: FlowContext = {
    signedIn: session !== null,
    accountVisited: draft.accountVisited,
    accountFirst: draft.accountMode === "signin",
    health: draft.health,
    notificationsSupported: Platform.OS !== "web",
    locationSupported: Platform.OS !== "web",
  };
  // A draft saved on a screen this version no longer has (the old crew step) resumes at the date of birth.
  const step: Step = visibleSteps(context).includes(draft.step) ? draft.step : "welcome";
  const after = nextStep(step, context);
  const name = session?.displayName ?? "";
  const personId = session?.userId ?? "me";

  const finish = () => {
    useAppStore.setState((state) => ({
      onboardedAt: Date.now(),
      onboarding: null,
      profilePhoto: draft.photo,
      firstRun: state.firstRun.active ? state.firstRun : { ...state.firstRun, active: true },
    }));
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
    const target = draft.accountReturn ?? nextStep("account", context);
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

  // O-04: the photo goes to the server as soon as there is an account: at once when it is picked
  // signed in, right after the account is made when it was picked before.
  useEffect(() => {
    if (!session || !draft.photo || draft.photoSent) return;
    let current = true;
    uploadProfilePhoto(draft.photo)
      .then(() => current && update({ photoSent: true }))
      .catch(() => current && showToast({ tone: "danger", message: i18n.t("crew.offline") }));
    return () => {
      current = false;
    };
    // update only writes the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, draft.photo, draft.photoSent]);

  const next = i18n.t("onboarding.next");
  const askLocation = async () => {
    setFinishing(true);
    const answer = await askPermission("location", "checkin").finally(() => setFinishing(false));
    update({
      permissions: {
        ...draft.permissions,
        location: answer.granted ? "granted" : "skipped",
      },
    });
    if (!answer.granted && !answer.declined) {
      showToast({
        message: i18n.t("journey.locDenied"),
        durationMs: 8_000,
        ...(answer.canAskAgain
          ? {}
          : {
              action: {
                label: i18n.t("common.openSettings"),
                onPress: openAppSettings,
              },
            }),
      });
    }
    advance();
  };

  const footer = (() => {
    switch (step) {
      case "welcome":
        return null;
      case "account":
        return <Button label={i18n.t("onboarding.guest")} variant="outline" height={48} onPress={leaveAccount} />;
      case "birth":
        return (
          <Button
            label={next}
            height={56}
            loading={committing}
            disabled={draft.birthDate === null}
            onPress={() => {
              if (draft.birthDate === null) return;
              setCommitting(true);
              void commitBirthDate(draft.birthDate, preferences.legalCountry)
                .then((result) => {
                  if (result === "ok") {
                    setTooYoung(false);
                    advance();
                  } else if (result === "under") {
                    haptic.error();
                    setTooYoung(true);
                  } else
                    showToast({
                      tone: "danger",
                      message: i18n.t("crew.offline"),
                    });
                })
                .finally(() => setCommitting(false));
            }}
          />
        );
      case "photo":
        return <Button label={draft.photo ? next : i18n.t("journey.photoSkip")} height={56} variant={draft.photo ? "primary" : "secondary"} onPress={advance} />;
      case "consent":
        return (
          <View style={styles.footer}>
            <Button
              label={next}
              height={56}
              disabled={!draft.health}
              accessibilityHint={draft.health ? undefined : i18n.t("onboarding.consentWithout")}
              onPress={() => {
                update({
                  consentAt: draft.consentAt ?? Date.now(),
                  skippedHealth: false,
                });
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
      case "bac":
        return (
          <Button
            label={next}
            height={56}
            onPress={() => {
              saveProfile(draft.profile, draft.consentAt ?? Date.now());
              advance();
            }}
          />
        );
      case "region":
        return <Button label={next} height={56} onPress={advance} />;
      case "notifications":
        return (
          <Button
            label={next}
            height={56}
            loading={finishing}
            onPress={() => {
              setFinishing(true);
              void askForReminders(i18n, session !== null).finally(() => {
                setFinishing(false);
                update({
                  permissions: {
                    ...draft.permissions,
                    notifications: "granted",
                  },
                });
                advance();
              });
            }}
          />
        );
      case "location":
        return (
          <View style={styles.footer}>
            <Button label={i18n.t("journey.locAllow")} height={56} loading={finishing} onPress={() => void askLocation()} />
            <Button
              label={i18n.t("journey.locSkip")}
              variant="outline"
              height={48}
              onPress={() => {
                update({
                  permissions: { ...draft.permissions, location: "skipped" },
                });
                advance();
              }}
            />
          </View>
        );
      case "crew":
        return <Button label={i18n.t("journey.crewSkip")} variant="outline" height={48} onPress={advance} />;
      case "closing":
        return <Button label={i18n.t("journey.closingGo")} height={56} onPress={finish} />;
      default: {
        // The five visibility screens: nothing is pre-ticked, so Continue waits for a tap on one of the four.
        const answered = isVisibilityKey(step) && draft.visibility[step] !== undefined;
        return <Button label={next} height={56} disabled={!answered} accessibilityHint={answered ? undefined : i18n.t("journey.chooseOne")} onPress={advance} />;
      }
    }
  })();

  const entering = (forward ? SlideInRight : SlideInLeft).duration(duration.enter).easing(easings.out);
  const { index, total } = progress(step, context);
  const age = draft.birthDate ? ageFromBirthDate(draft.birthDate, Date.now()) : null;

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
              update({
                accountMode: "create",
                accountVisited: true,
                accountReturn: null,
              });
              go("account");
            }}
            onSignIn={() => {
              update({
                accountMode: "signin",
                accountVisited: true,
                accountReturn: null,
              });
              go("account");
            }}
            onGuest={() => go(nextStep("welcome", context))}
          />
        ) : null}
        {step === "account" ? <AccountStep mode={draft.accountMode} onModeChange={(accountMode) => update({ accountMode })} birthDate={draft.birthDate} /> : null}
        {step === "birth" ? (
          <BirthStep
            birthDate={draft.birthDate}
            country={preferences.legalCountry}
            tooYoung={tooYoung}
            onChange={(birthDate) => {
              setTooYoung(false);
              update({ birthDate });
            }}
          />
        ) : null}
        {step === "photo" ? (
          <PhotoStep
            photo={draft.photo}
            onChange={(photo) => {
              update({ photo, photoSent: false });
              if (!photo && session) void removeProfilePhoto().catch(() => undefined);
            }}
            personId={personId}
            name={name}
          />
        ) : null}
        {step === "consent" ? (
          <>
            <Text variant="h1">{i18n.t("onboarding.consentTitle")}</Text>
            <ConsentPanel value={draft.health} onChange={(health) => update({ health })} />
          </>
        ) : null}
        {step === "bac" ? <BacStep draft={draft.profile} onChange={(profile) => update({ profile })} birthDate={draft.birthDate} /> : null}
        {step === "region" ? <RegionStep /> : null}
        {isVisibilityKey(step) ? (
          <VisibilityStep
            item={step}
            value={draft.visibility[step]}
            name={name}
            personId={personId}
            note={step === "venues"}
            onChange={(audience) => {
              const visibility = { ...draft.visibility };
              if (audience === undefined) delete visibility[step];
              else visibility[step] = audience;
              update({ visibility });
            }}
          />
        ) : null}
        {step === "crew" ? <CrewStep onDone={advance} doneLabel={next} /> : null}
        {step === "notifications" ? <NotificationsStep health={draft.health} /> : null}
        {step === "location" ? <LocationStep /> : null}
        {step === "closing" ? (
          <ClosingStep name={name || i18n.t("journey.previewYou")} username={session?.username ?? null} personId={personId} photo={draft.photo} age={age} visibility={draft.visibility} />
        ) : null}
      </Animated.View>
    </Screen>
  );
}

/** The draft in the store, or a fresh one: an update never starts from nothing. */
function draftOf(stored: OnboardingDraft | null): OnboardingDraft {
  return {
    ...freshDraft(draftFromProfile(null), false),
    ...(stored ?? initialDraft()),
  };
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
  welcome: { gap: 14, paddingTop: 24 },
  welcomeIcon: { width: 56, height: 56, borderRadius: 14 },
  hero: { fontSize: 34, lineHeight: 38 },
  actions: { gap: 12, marginTop: 8 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  progress: { flex: 1, height: 3, borderRadius: 2, overflow: "hidden" },
  progressFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: palette.accent.amber,
  },
  step: { gap: 16 },
  footer: { gap: 10 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  flex: { flex: 1 },
});
