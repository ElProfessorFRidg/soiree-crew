import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming, ZoomIn } from "react-native-reanimated";
import { duration, palette } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { ApiError } from "@/server/api";
import { refreshCrews } from "@/server/crewData";
import { checkIn, currentFix, leaveVenue, refreshVenues, stillHere, useVenueData, type CheckInResult } from "@/server/venueData";
import { useSession } from "@/server/session";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Panel, Switch } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { serverMessage } from "@/server/errors";

/** DESIGN.md §5: check-in steps appear one by one, every 650 ms. They show progress, never which signal decided. */
const STEP_MS = 650;
type Phase = "idle" | "working" | "done";

function Takeover({ venue }: { venue: string }) {
  const i18n = useT();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const wash = useSharedValue(0);
  useEffect(() => {
    // MOT-09 signature moment: crown drop, amber wash, then a heavy haptic.
    haptic.heavy();
    if (!reduceMotion) wash.value = withSequence(withTiming(1, { duration: duration.wash, easing: easings.out }), withTiming(0, { duration: 400 }));
  }, [wash, reduceMotion]);
  const washStyle = useAnimatedStyle(() => ({ opacity: 0.85 * (1 - wash.value), transform: [{ scale: 0.2 + wash.value * 3.8 }] }));
  return (
    <View style={styles.takeover}>
      <Animated.View pointerEvents="none" style={[styles.wash, { width, height: width, borderRadius: width / 2, backgroundColor: theme.amber }, washStyle]} />
      <Animated.View entering={ZoomIn.duration(duration.crownDrop).easing(easings.overshoot)}>
        <Icon name="crown" size={72} color={theme.amber} strokeWidth={2.4} />
      </Animated.View>
      <Text variant="h1" align="center" accessibilityLiveRegion="assertive">
        {i18n.t("checkin.takeover", { venue })}
      </Text>
    </View>
  );
}

export default function CheckInScreen() {
  const i18n = useT();
  const theme = useTheme();
  const { venueId, crewId } = useLocalSearchParams<{ venueId: string; crewId: string }>();
  const me = useSession((state) => state.session?.userId);
  const venue = useVenueData((state) => (crewId ? state.byCrew[crewId]?.venues.find((v) => v.id === venueId) : undefined));
  const open = useVenueData((state) => state.openCheckIn);
  const [isPrivate, setPrivate] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [steps, setSteps] = useState(0);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const venueName = venue?.name ?? "";
  const alreadyHere = open?.venueId === venueId;

  const run = async () => {
    if (!venueId) return;
    setPhase("working");
    setSteps(1);
    const timer = setInterval(() => setSteps((s) => Math.min(3, s + 1)), STEP_MS);
    const fix = await currentFix();
    if (!fix.ok) {
      clearInterval(timer);
      setPhase("idle");
      setMessage(fix.failure === "denied" ? i18n.t("addVenue.locationDenied") : i18n.t("addVenue.locationUnavailable"));
      return;
    }
    try {
      const answer = await checkIn(venueId, fix.fix, isPrivate);
      // The verdict animation plays on the server's answer, never on the tap (SYNC-02).
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, STEP_MS * 3 - 200)));
      clearInterval(timer);
      setResult(answer);
      setPhase("done");
      if (answer.verdict === "accepted") haptic.confirmed();
      else haptic.error();
      if (crewId) void refreshVenues(crewId).catch(() => undefined);
      void refreshCrews().catch(() => undefined);
    } catch (error) {
      clearInterval(timer);
      setPhase("idle");
      haptic.error();
      setMessage(error instanceof ApiError && error.failure.kind === "http" ? serverMessage(error.failure.code, i18n) : i18n.t("crew.offline"));
    }
  };

  const verdictText = (() => {
    if (!result) return null;
    if (result.verdict === "accepted") return i18n.t("checkin.accepted");
    if (result.verdict === "unverified") return result.reason === "imprecise" ? i18n.t("checkin.imprecise") : i18n.t("checkin.unverified");
    if (result.verdict === "rejected") return i18n.t("checkin.rejected");
    return i18n.t("checkin.notHere", { venue: venueName });
  })();

  const tookIt = result?.verdict === "accepted" && result.takeover?.bossId === me;

  return (
    <Screen back title={venueName || i18n.t("checkin.title")} withToasts>
      {tookIt ? <Takeover venue={venueName} /> : null}

      {phase !== "idle" ? (
        <Panel>
          {(["checkin.stepLocation", "checkin.stepCrew", "checkin.stepServer"] as const).slice(0, steps).map((key) => (
            <Animated.View key={key} entering={FadeIn.duration(duration.enter)} style={styles.step}>
              <Icon name={phase === "done" ? "check" : "clock"} size={18} color={phase === "done" ? theme.ok : theme.textMuted} />
              <Text>{i18n.t(key)}</Text>
            </Animated.View>
          ))}
        </Panel>
      ) : null}

      {verdictText && !tookIt ? (
        <Panel tint={result?.verdict === "accepted" ? "ok" : result?.verdict === "rejected" ? "danger" : "amber"}>
          <Text variant="h3" color={result?.verdict === "rejected" ? palette.tint.dangerTextStrong : undefined}>
            {verdictText}
          </Text>
        </Panel>
      ) : null}

      {message ? <Text color={theme.danger}>{message}</Text> : null}

      {phase === "idle" && !alreadyHere ? (
        <>
          <Panel>
            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <Text variant="h3">{i18n.t("checkin.private")}</Text>
                <Text variant="small">{i18n.t("checkin.privateHint")}</Text>
              </View>
              <Switch value={isPrivate} onValueChange={setPrivate} accessibilityLabel={i18n.t("checkin.private")} />
            </View>
          </Panel>
          <Button label={i18n.t("checkin.go")} icon="pin" height={64} onPress={() => void run()} />
        </>
      ) : null}

      {(alreadyHere && phase === "idle") || (phase === "done" && (result?.verdict === "accepted" || result?.verdict === "unverified")) ? (
        <View style={styles.actions}>
          <Button
            label={i18n.t("checkin.stillHere")}
            variant="secondary"
            height={52}
            style={styles.flex}
            onPress={() =>
              void currentFix().then(async (fix) => {
                if (fix.ok && (await stillHere(fix.fix).catch(() => false))) {
                  haptic.confirmed();
                  showToast({ message: i18n.t("checkin.stillHereDone") });
                }
              })
            }
          />
          <Button
            label={i18n.t("checkin.leave")}
            variant="outline"
            height={52}
            style={styles.flex}
            onPress={() => void leaveVenue().then(() => router.back()).catch(() => undefined)}
          />
        </View>
      ) : null}

      {phase === "done" ? <Button label={i18n.t("checkin.done")} variant="secondary" height={48} onPress={() => router.back()} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 32 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
  actions: { flexDirection: "row", gap: 10 },
  takeover: { alignItems: "center", gap: 14, paddingVertical: 24, overflow: "visible" },
  wash: { position: "absolute", top: -60 },
});
