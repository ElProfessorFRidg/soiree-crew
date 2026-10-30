import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { palette, scaled } from "@crew/design-tokens";
import { countryRules } from "@crew/units";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { useLiveParty } from "@/server/crewData";
import { cancelMySos, refreshSos, sendSos, useRadar } from "@/server/radarData";
import { showFailure } from "@/server/errors";
import { confirmAction } from "@/ui/confirm";
import { mapUrl } from "@/party/NightAlerts";
import { UnwellButton } from "@/party/UnwellBanner";
import { useSession } from "@/server/session";
import { currentFix } from "@/server/venueData";
import { useLiveBac, useNow, useUiLevel } from "@/state/hooks";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Panel, Row } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

const HOLD_MS = 2_000;
const COUNTDOWN_S = 5;
const RING = 220;
const STROKE = 10;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function call(number: string) {
  haptic.heavy();
  void Linking.openURL(`tel:${number}`);
}

/** N-28: a text to the emergency contact, with the position when the phone has one. */
function text(phone: string, body: string) {
  haptic.heavy();
  // iOS reads the body after "&", Android after "?".
  const separator = Platform.OS === "ios" ? "&" : "?";
  void Linking.openURL(`sms:${phone}${separator}body=${encodeURIComponent(body)}`);
}

/**
 * N-28. At levels 0 and 1 the call needs a 2 s hold, so a pocket tap never dials.
 * At levels 2 and 3 a long press is not allowed (ADP-04), so one tap starts a
 * 5 s countdown with a big cancel button (decision D-07).
 */
export default function SosScreen() {
  const i18n = useT();
  const theme = useTheme();
  const now = useNow();
  const live = useLiveBac(now);
  const { level } = useUiLevel(live?.estimate.bac ?? 0, now);
  const country = useAppStore((state) => state.preferences.legalCountry);
  const rules = countryRules(country);
  const primary = rules.emergency.ambulance ?? rules.emergency.primary;
  const session = useSession((state) => state.session);
  const liveParty = useLiveParty();
  const [sent, setSent] = useState<null | "with" | "without" | "failed">(null);
  const [holding, setHolding] = useState(false);
  const mine = useRadar((state) => state.mine);
  const contact = useAppStore((state) => state.emergencyContact);
  const [lastFix, setLastFix] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    // An alert sent from another of my phones can be called off from here too.
    if (session) void refreshSos().catch(() => undefined);
  }, [session]);

  /** N-28: the hold alerts the crew (with the location when allowed); without a crew it calls for help. */
  const trigger = () => {
    if (!session) {
      call(primary);
      return;
    }
    haptic.heavy();
    // Whatever the location does, the alert leaves: a failed fix is just an alert without a position.
    const fix = Promise.race([
      currentFix(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4_000)),
    ]).catch(() => null);
    void fix.then(async (result) => {
      const location =
        result && result.ok
          ? {
              lat: result.fix.lat,
              lng: result.fix.lng,
              accuracy: result.fix.accuracy,
            }
          : undefined;
      if (location) setLastFix(location);
      // Saying "sent" when nothing left would be the worst lie in the app (ADP-09).
      const ok = await sendSos({
        ...(liveParty ? { partyId: liveParty.party.id } : {}),
        ...(location ? { location } : {}),
      })
        .then(() => true)
        .catch(() => false);
      if (!ok) haptic.error();
      setSent(ok ? (location ? "with" : "without") : "failed");
    });
  };

  const progress = useSharedValue(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (ticker.current) clearInterval(ticker.current);
    },
    [],
  );

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      trigger();
      return;
    }
    const timer = setTimeout(
      () => setCountdown((s) => (s === null ? null : s - 1)),
      1_000,
    );
    return () => clearTimeout(timer);
  }, [countdown, primary]);

  const circumference = Math.PI * (RING - STROKE);
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const startHold = () => {
    setHolding(true);
    progress.value = withTiming(1, {
      duration: HOLD_MS,
      easing: Easing.linear,
    });
    let ticks = 0;
    ticker.current = setInterval(() => {
      ticks += 1;
      haptic.holdTick();
      if (ticks >= 4 && ticker.current) clearInterval(ticker.current);
    }, HOLD_MS / 4);
    holdTimer.current = setTimeout(trigger, HOLD_MS);
  };
  const endHold = () => {
    setHolding(false);
    cancelAnimation(progress);
    progress.value = withTiming(0, { duration: scaled(200) });
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (ticker.current) clearInterval(ticker.current);
  };

  const holdMode = level < 2;

  /** N-28: the sender calls it off; every banner in the crew goes. */
  const callOff = () =>
    void confirmAction({ title: i18n.t("sosAlert.cancelSentConfirm"), confirmLabel: i18n.t("sosAlert.cancelSent"), cancelLabel: i18n.t("sosAlert.keepSent") }).then((ok) => {
      if (!ok) return;
      haptic.confirmed();
      void cancelMySos()
        .then(() => setSent(null))
        .catch(showFailure(i18n));
    });

  return (
    <Screen back title={i18n.t("sos.title")} scrollEnabled={!holding} withToasts>
      {mine.length ? (
        <Panel tint="danger" style={styles.mine}>
          <Text variant="h3">{i18n.t("sosAlert.mineOpen")}</Text>
          <Button label={i18n.t("sosAlert.cancelSent")} variant="secondary" height={52} onPress={callOff} />
        </Panel>
      ) : null}
      <View style={styles.center}>
        {holdMode ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              session ? i18n.t("sosAlert.alertA11y") : i18n.t("sos.holdA11y")
            }
            onPressIn={startHold}
            onPressOut={endHold}
            // A shaky thumb can drift well off the ring without cancelling the hold.
            pressRetentionOffset={{ top: 80, bottom: 80, left: 80, right: 80 }}
            style={styles.ringButton}
          >
            <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
              <Circle
                cx={RING / 2}
                cy={RING / 2}
                r={(RING - STROKE) / 2}
                stroke={palette.tint.dangerBg}
                strokeWidth={STROKE}
                fill="none"
              />
              <AnimatedCircle
                cx={RING / 2}
                cy={RING / 2}
                r={(RING - STROKE) / 2}
                stroke={theme.danger}
                strokeWidth={STROKE}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${circumference} ${circumference}`}
                animatedProps={ringProps}
                transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
              />
            </Svg>
            <View style={[styles.core, { backgroundColor: theme.danger }]}>
              <Icon name="phone" size={40} color={theme.onAccent} />
              <Text variant="h2" color={theme.onAccent}>
                {primary}
              </Text>
            </View>
          </Pressable>
        ) : countdown === null ? (
          <Button
            label={
              session
                ? i18n.t("sosAlert.tapToAlert")
                : i18n.t("sos.tap", { number: primary })
            }
            icon="phone"
            variant="danger"
            height={104}
            fontSize={24}
            iconSize={30}
            style={styles.wide}
            onPress={() => {
              haptic.heavy();
              setCountdown(COUNTDOWN_S);
            }}
          />
        ) : (
          <View style={[styles.wide, styles.countdown]}>
            <Text
              variant="h2"
              align="center"
              accessibilityLiveRegion="assertive"
            >
              {session
                ? i18n.t("sosAlert.countdown", { seconds: countdown })
                : i18n.t("sos.countdown", { seconds: countdown })}
            </Text>
            <Button
              label={session ? i18n.t("sosAlert.cancel") : i18n.t("sos.cancel")}
              variant="secondary"
              height={104}
              fontSize={24}
              onPress={() => setCountdown(null)}
            />
          </View>
        )}
        {holdMode && !sent ? (
          <Text align="center">
            {session ? i18n.t("sosAlert.holdToAlert") : i18n.t("sos.hold")}
          </Text>
        ) : null}
        {sent === "failed" ? (
          <View style={styles.wide}>
            <Text
              variant="h2"
              align="center"
              color={theme.danger}
              accessibilityLiveRegion="assertive"
            >
              {i18n.t("sosAlert.failed")}
            </Text>
            <Button
              label={i18n.t("common.retry")}
              variant="secondary"
              height={64}
              fontSize={20}
              onPress={() => {
                setSent(null);
                trigger();
              }}
            />
            <Button
              label={i18n.t("party.callEmergency", { number: primary })}
              icon="phone"
              variant="danger"
              height={64}
              onPress={() => call(primary)}
            />
          </View>
        ) : sent ? (
          <Text variant="h2" align="center" accessibilityLiveRegion="assertive">
            {i18n.t("sosAlert.sent")}{" "}
            {sent === "with"
              ? i18n.t("sosAlert.withLocation")
              : i18n.t("sosAlert.withoutLocation")}
          </Text>
        ) : null}
      </View>

      <UnwellButton />

      {contact ? (
        <>
          <Text variant="label">{i18n.t("sos.contact")}</Text>
          <Panel>
            <Row title={i18n.t("sos.callContact", { name: contact.name })} subtitle={contact.phone} onPress={() => call(contact.phone)} />
            <Row
              title={i18n.t("sos.textContact", { name: contact.name })}
              subtitle={lastFix ? i18n.t("sos.textWithPlace") : undefined}
              onPress={() => text(contact.phone, lastFix ? `${i18n.t("sos.textBody")} ${mapUrl(lastFix)}` : i18n.t("sos.textBody"))}
              last
            />
          </Panel>
        </>
      ) : (
        <Button label={i18n.t("sos.addContact")} variant="outline" height={44} onPress={() => router.push("/(tabs)/me")} />
      )}

      <Text variant="label">{i18n.t("sos.numbers")}</Text>
      <Panel>
        {rules.emergency.ambulance ? (
          <Row
            title={i18n.t("sos.ambulance")}
            subtitle={rules.emergency.ambulance}
            onPress={() => call(rules.emergency.ambulance!)}
          />
        ) : null}
        {rules.emergency.police ? (
          <Row
            title={i18n.t("sos.police")}
            subtitle={rules.emergency.police}
            onPress={() => call(rules.emergency.police!)}
          />
        ) : null}
        {rules.emergency.fire ? (
          <Row
            title={i18n.t("sos.fire")}
            subtitle={rules.emergency.fire}
            onPress={() => call(rules.emergency.fire!)}
          />
        ) : null}
        {rules.emergency.eu112 && primary !== "112" ? (
          <Row
            title={i18n.t("sos.europe")}
            subtitle="112"
            onPress={() => call("112")}
            last
          />
        ) : !rules.emergency.ambulance ? (
          <Row
            title={i18n.t("sos.ambulance")}
            subtitle={primary}
            onPress={() => call(primary)}
            last
          />
        ) : null}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", gap: 16, paddingVertical: 12 },
  ringButton: {
    width: RING,
    height: RING,
    alignItems: "center",
    justifyContent: "center",
  },
  core: {
    width: RING - 44,
    height: RING - 44,
    borderRadius: RING,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  wide: { alignSelf: "stretch" },
  mine: { gap: 10 },
  countdown: { gap: 16 },
});
