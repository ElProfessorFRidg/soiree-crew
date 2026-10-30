import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { duration, radius, spring } from "@crew/design-tokens";
import { useT, type Translator } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { Confetti } from "@/recap/Podium";
import { fetchCrewStats } from "@/server/statsData";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { Text } from "@/ui/Text";
import { momentToCelebrate, type CrewMoment } from "./celebrate";

/** Moments already celebrated on this phone, per crew (JOY-08: once per milestone). */
const useCelebrated = create<{ seen: Record<string, string[]> }>()(
  persist(() => ({ seen: {} as Record<string, string[]> }), { name: "celebrated-v1", storage: createJSONStorage(() => AsyncStorage) }),
);

export function momentText(moment: CrewMoment, i18n: Translator): string {
  if (moment.kind === "nights") return i18n.plural("crewStats.moment.nights", moment.value ?? 0);
  if (moment.kind === "anniversary") return i18n.plural("crewStats.moment.anniversary", moment.value ?? 0);
  return i18n.t("crewStats.moment.firstConquest", { venue: moment.venueName ?? "", name: moment.name ?? "" });
}

/**
 * JOY-08: the celebration moment. A crew milestone reached in the last two weeks gets one card,
 * with confetti and a heavy haptic, the first time this phone sees it. With Reduce Motion the
 * card fades in, no confetti, same text.
 */
export function Celebration({ crewId, moments }: { crewId: string; moments: readonly CrewMoment[] }) {
  const i18n = useT();
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const seen = useCelebrated((state) => state.seen[crewId]);
  const [moment, setMoment] = useState<CrewMoment | null>(null);
  const [hydrated, setHydrated] = useState(() => useCelebrated.persist.hasHydrated());
  const scale = useSharedValue(reduceMotion ? 1 : 0.85);
  const opacity = useSharedValue(0);

  useEffect(() => (hydrated ? undefined : useCelebrated.persist.onFinishHydration(() => setHydrated(true))), [hydrated]);

  useEffect(() => {
    if (moment || !hydrated) return;
    const next = momentToCelebrate(moments, seen ?? [], Date.now());
    if (!next) return;
    // Every moment known now counts as seen: one celebration, never a queue of them.
    useCelebrated.setState((state) => ({ seen: { ...state.seen, [crewId]: moments.map((m) => m.id) } }));
    setMoment(next);
    haptic.heavy();
  }, [crewId, moments, seen, moment, hydrated]);

  useEffect(() => {
    if (!moment) return;
    opacity.value = withTiming(1, { duration: duration.enter });
    if (!reduceMotion) scale.value = withSpring(1, spring.signature);
  }, [moment, reduceMotion, opacity, scale]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  if (!moment) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={() => setMoment(null)}>
      <View style={[styles.backdrop, { backgroundColor: theme.scrim }]}>
        <Confetti replay={1} delayMs={0} />
        <Animated.View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.amber }, style]} accessibilityViewIsModal accessibilityLiveRegion="polite">
          <Icon name={moment.kind === "firstConquest" ? "crown" : "star"} color={theme.amber} size={40} />
          <Text variant="h1" align="center">
            {momentText(moment, i18n)}
          </Text>
          <Text variant="small" align="center">
            {new Intl.DateTimeFormat(i18n.locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${moment.night}T12:00:00`))}
          </Text>
          <Button label={i18n.t("common.close")} height={52} onPress={() => setMoment(null)} />
        </Animated.View>
      </View>
    </Modal>
  );
}

/** On the Crew tab: looks for a new moment once per visit, so the celebration does not wait for the stats screen. */
export function CrewCelebration({ crewId }: { crewId: string }) {
  const [moments, setMoments] = useState<CrewMoment[] | null>(null);
  useEffect(() => {
    void fetchCrewStats(crewId)
      .then((stats) => setMoments(stats.moments ?? []))
      .catch(() => undefined);
  }, [crewId]);
  return moments?.length ? <Celebration crewId={crewId} moments={moments} /> : null;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 380, borderRadius: radius.card, borderWidth: 2, padding: 24, gap: 14, alignItems: "stretch" },
});
