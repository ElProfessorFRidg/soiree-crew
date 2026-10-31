import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition, ZoomIn } from "react-native-reanimated";
import { duration } from "@crew/design-tokens";
import { breathRatio, countryRules, drivingLimit, formatBacValue } from "@crew/units";
import { useT } from "@/i18n";
import { easings } from "@/motion/easing";
import { haptic } from "@/motion/haptics";
import { useCrewData } from "@/server/crewData";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Button, IconButton } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { ScalePressable } from "@/ui/Pressable";
import { Text } from "@/ui/Text";
import { checklistDone, type FirstRunCard } from "./flow";
import { dismissFirstRunCard } from "./firstRunMarks";
import { EstimatePreview } from "./ValueCards";

// The first days after the arrival, on the Party screen: the settings guessed from the phone, a
// short checklist that ticks itself, and what the estimate will look like before the first drink.
// All closable, none of them counts drinks or keeps a streak: they go once the app is known.

function useCardShown(card: FirstRunCard): boolean {
  return useAppStore((state) => state.firstRun.active && !state.firstRun.dismissed.includes(card));
}

const enter = FadeIn.duration(duration.enter).easing(easings.out);
const leave = FadeOut.duration(duration.toastIn);

/** PREF-02: "Réglé pour la France · Modifier", one line, opens the region settings. */
export function DetectedSettingsCard() {
  const i18n = useT();
  const theme = useTheme();
  const shown = useCardShown("settings");
  const preferences = useAppStore((state) => state.preferences);
  if (!shown) return null;
  const rules = countryRules(preferences.legalCountry);
  const country = i18n.t(`countries.${preferences.legalCountry}` as "countries.FR");
  const limit = `${formatBacValue(drivingLimit(rules, preferences.driverCategory), preferences.bacUnit, breathRatio(rules), i18n.locale)} ${i18n.t(`units.${preferences.bacUnit}`)}`;
  const change = i18n.t("firstRun.settingsChange");
  return (
    <Animated.View entering={enter} exiting={leave}>
      <Panel style={styles.settings}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${i18n.t("firstRun.settingsLine", { country })}. ${i18n.t("firstRun.settingsDetail", { limit, currency: preferences.currency })}. ${change}`}
          onPress={() => {
            haptic.select();
            router.push({ pathname: "/settings", params: { section: "region" } });
          }}
          style={({ pressed }) => [styles.settingsText, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Icon name="flag" color={theme.textMuted} />
          <View style={styles.flex}>
            <Text variant="h3">
              {i18n.t("firstRun.settingsLine", { country })} <Text color={theme.amber}>· {change}</Text>
            </Text>
            <Text variant="small">{i18n.t("firstRun.settingsDetail", { limit, currency: preferences.currency })}</Text>
          </View>
        </Pressable>
        <IconButton icon="x" accessibilityLabel={i18n.t("common.close")} onPress={() => dismissFirstRunCard("settings")} />
      </Panel>
    </Animated.View>
  );
}

function ChecklistItem({ done, label, onPress }: { done: boolean; label: string; onPress: () => void }) {
  const theme = useTheme();
  const i18n = useT();
  return (
    <ScalePressable
      onPress={onPress}
      pressedScale={0.99}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ checked: done }}
      accessibilityHint={done ? i18n.t("firstRun.done") : undefined}
      style={styles.item}
    >
      <View style={[styles.tick, { borderColor: done ? theme.ok : theme.lineStrong, backgroundColor: done ? theme.ok : "transparent" }]}>
        {done ? (
          <Animated.View entering={ZoomIn.duration(duration.pop).easing(easings.out)}>
            <Icon name="check" size={16} color={theme.onAccent} strokeWidth={2.5} />
          </Animated.View>
        ) : null}
      </View>
      <Text style={[styles.flex, done ? { color: theme.textMuted } : null]}>{label}</Text>
      {done ? null : <Icon name="chev" size={18} color={theme.textMuted} />}
    </ScalePressable>
  );
}

/** Three first things, each ticked by doing it for real (a drink or water logged, a link made, a game opened). */
export function FirstRunChecklist() {
  const i18n = useT();
  const shown = useCardShown("checklist");
  const hasLogged = useAppStore((state) => state.drinks.length + state.water.length > 0);
  const canLog = useAppStore((state) => state.profile !== null);
  const invitedAt = useAppStore((state) => state.firstRun.invitedAt);
  const playedAt = useAppStore((state) => state.firstRun.playedAt);
  const crewHasFriend = useCrewData((state) => state.crews.some((crew) => crew.members.length > 1));
  const state = { hasLogged, invited: invitedAt !== null || crewHasFriend, played: playedAt !== null };
  if (!shown || checklistDone(state)) return null;
  return (
    <Animated.View entering={enter} exiting={leave} layout={LinearTransition.duration(duration.reorder).easing(easings.reorder)}>
      <Panel>
        <View style={styles.head}>
          <Text variant="h3" style={styles.flex}>
            {i18n.t("firstRun.checklistTitle")}
          </Text>
          <IconButton icon="x" accessibilityLabel={i18n.t("common.close")} onPress={() => dismissFirstRunCard("checklist")} />
        </View>
        <ChecklistItem
          done={state.hasLogged}
          label={i18n.t("firstRun.itemDrink")}
          onPress={() => router.push(canLog ? "/add-drink" : "/health-consent")}
        />
        <ChecklistItem done={state.invited} label={i18n.t("firstRun.itemInvite")} onPress={() => router.push("/(tabs)/crew")} />
        <ChecklistItem done={state.played} label={i18n.t("firstRun.itemGame")} onPress={() => router.push("/(tabs)/games")} />
      </Panel>
    </Animated.View>
  );
}

/** Before the first drink: what the estimate will look like, with sample numbers. Gone after the first drink. */
export function FirstNightPreview() {
  const i18n = useT();
  const shown = useCardShown("preview");
  const empty = useAppStore((state) => state.drinks.length === 0);
  if (!shown || !empty) return null;
  return (
    <Animated.View entering={enter} exiting={leave} style={styles.preview}>
      <View style={styles.head}>
        <Text style={styles.flex}>{i18n.t("firstRun.previewLine")}</Text>
        <IconButton icon="x" accessibilityLabel={i18n.t("common.close")} onPress={() => dismissFirstRunCard("preview")} />
      </View>
      <EstimatePreview accent={false} sample />
    </Animated.View>
  );
}

/** The Party screen without the health consent: what the estimate needs, and one button to give it. */
export function NoEstimateCard() {
  const i18n = useT();
  return (
    <Panel>
      <Text variant="h3">{i18n.t("firstRun.noEstimateTitle")}</Text>
      <Text>{i18n.t("firstRun.noEstimateBody")}</Text>
      <Button label={i18n.t("firstRun.noEstimateCta")} height={52} onPress={() => router.push("/health-consent")} />
    </Panel>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  settings: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingRight: 8 },
  settingsText: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  tick: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  preview: { gap: 8 },
});
