import { Accelerometer } from "expo-sensors";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { duration, scaled } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { knock, useCheers } from "@/party/cheers";
import { useCrewData } from "@/server/crewData";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Chip } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { showFailure } from "@/server/errors";

/** A knock is a jolt well above gravity; two in a row closer than this are one knock. */
const KNOCK_G = 2.4;
const KNOCK_GAP_MS = 1500;

/** JOY-01: knock two phones together, both play the clink; at the same bar it also proves you were side by side. */
export default function CheersScreen() {
  const { crewId: param } = useLocalSearchParams<{ crewId?: string }>();
  const i18n = useT();
  const theme = useTheme();
  const crews = useCrewData((s) => s.crews);
  const [crewId, setCrewId] = useState(param ?? crews[0]?.id ?? null);
  const last = useCheers((s) => s.last);
  const [waiting, setWaiting] = useState(false);
  const lastKnock = useRef(0);
  const shownAt = useRef(Date.now());
  const swing = useSharedValue(0);
  const pop = useSharedValue(0);

  const send = () => {
    if (!crewId || Date.now() - lastKnock.current < KNOCK_GAP_MS) return;
    lastKnock.current = Date.now();
    haptic.select();
    setWaiting(true);
    void knock(crewId)
      .catch(showFailure(i18n))
      .finally(() => setTimeout(() => setWaiting(false), KNOCK_GAP_MS));
  };

  // The accelerometer listens only while this screen is open.
  useEffect(() => {
    if (Platform.OS === "web") return;
    Accelerometer.setUpdateInterval(20);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      if (Math.sqrt(x * x + y * y + z * z) > KNOCK_G) send();
    });
    return () => sub.remove();
  });

  // A match (mine or the other phone's): glasses swing in, clink, "Tchin!".
  useEffect(() => {
    if (!last || last.at < shownAt.current) return;
    haptic.cheers();
    swing.value = withSequence(withTiming(1, { duration: scaled(260) }), withSpring(0, { damping: 9 }));
    pop.value = withSequence(withTiming(1, { duration: duration.pop }), withTiming(1, { duration: scaled(1200) }), withTiming(0, { duration: duration.toggle }));
  }, [last, swing, pop]);

  const left = useAnimatedStyle(() => ({ transform: [{ translateX: swing.value * 46 }, { rotate: `${swing.value * 12}deg` }] }));
  const right = useAnimatedStyle(() => ({ transform: [{ translateX: -swing.value * 46 }, { rotate: `${-swing.value * 12}deg` }, { scaleX: -1 }] }));
  const popStyle = useAnimatedStyle(() => ({ opacity: pop.value, transform: [{ scale: 0.8 + pop.value * 0.2 }] }));
  const fresh = last && last.at >= shownAt.current;

  return (
    <Screen back title={i18n.t("cheers.title")} withToasts>
      {crews.length > 1 ? (
        <View style={styles.chips}>
          {crews.map((c) => (
            <Chip key={c.id} label={c.name} selected={c.id === crewId} onPress={() => setCrewId(c.id)} />
          ))}
        </View>
      ) : null}
      <View style={styles.stage}>
        <Animated.View style={left}>
          <Icon name="glass" size={110} color={theme.amber} strokeWidth={1.6} />
        </Animated.View>
        <Animated.View style={right}>
          <Icon name="glass" size={110} color={theme.amber} strokeWidth={1.6} />
        </Animated.View>
      </View>
      <Animated.View style={popStyle}>
        <Text variant="h1" align="center">
          {i18n.t("cheers.clink")}
        </Text>
      </Animated.View>
      <Text align="center">{fresh ? i18n.t("cheers.with", { name: last.withName }) : waiting ? i18n.t("cheers.waiting") : i18n.t("cheers.how")}</Text>
      {fresh && last.proof ? (
        <Text variant="small" align="center">
          {i18n.t("cheers.proof")}
        </Text>
      ) : null}
      {/* Same moment, two taps: for phones without a sensor and for the web preview. */}
      <Button label={i18n.t("cheers.tap")} variant="secondary" height={56} disabled={!crewId} onPress={send} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 24 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
