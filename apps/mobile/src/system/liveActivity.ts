import { AppState, Platform } from "react-native";
import { estimateBac } from "@crew/bac";
import { themes } from "@crew/design-tokens";
import { breathRatio, countryRules, formatBacValue } from "@crew/units";
import { createTranslator } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { liveMood, moodColour } from "@/party/mood";
import { useCrewData } from "@/server/crewData";
import { useAppStore } from "@/state/store";

// HUB-02 on iOS: the night on the lock screen and in the Dynamic Island. The countdown to zero
// is drawn by iOS itself from the back-to-zero time, so it stays right with the app closed.
// QOL-27: discreet by default, the time back to zero only; the estimate shows only when the
// person turned on figures on the lock screen.

type LiveActivityModule = typeof import("expo-live-activity");

let module: LiveActivityModule | null | undefined;
function live(): LiveActivityModule | null {
  if (module !== undefined) return module;
  try {
    // Loaded on iOS only: the module has no Android or web side.
    module = Platform.OS === "ios" ? (require("expo-live-activity") as LiveActivityModule) : null;
  } catch {
    module = null;
  }
  return module;
}

/** JOY-04: during a party the bar takes the party's mood colour; otherwise the app's amber. */
function configFor(mood: string | null) {
  return {
    backgroundColor: themes.dark.bg,
    titleColor: themes.dark.text,
    subtitleColor: themes.dark.textMuted,
    progressViewTint: mood ? moodColour(mood) : themes.dark.amber,
    progressViewLabelColor: themes.dark.text,
    deepLinkUrl: "/",
    timerType: "digital" as const,
  };
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** The mood the running activity was started with: colours are set at start only. */
let startedMood: string | null = null;

export function syncLiveActivity(): void {
  const mod = live();
  if (!mod) return;
  const { profile, drinks, preferences, lockScreenNumbers, liveActivityId } = useAppStore.getState();
  const i18n = createTranslator(preferences.language);
  const intakes = drinks
    .filter((d) => d.abv > 0)
    .map((d) => ({ id: d.id, volumeMl: d.volumeMl, abv: d.abv, consumedAt: d.consumedAt, withFood: d.withFood }));
  const now = Date.now();
  const estimate = profile && intakes.length ? estimateBac(intakes, profile, now) : null;
  try {
    if (!estimate || estimate.bac <= 0 || estimate.backToZeroAt === null) {
      if (liveActivityId) {
        mod.stopActivity(liveActivityId, { title: i18n.t("liveActivity.ended") });
        useAppStore.setState({ liveActivityId: null });
      }
      return;
    }
    const clock = (at: number) => formatClock(at, preferences.language, preferences.hourCycle);
    const ratio = breathRatio(countryRules(preferences.legalCountry));
    const value = `${formatBacValue(estimate.bac, preferences.bacUnit, ratio, i18n.locale)} ${i18n.t(`units.${preferences.bacUnit}`)}`;
    const state = {
      title: i18n.t("liveActivity.title", { time: clock(estimate.backToZeroAt) }),
      subtitle: lockScreenNumbers ? i18n.t("reminders.nightTitle", { time: clock(now), value }) : undefined,
      progressBar: { date: estimate.backToZeroAt },
    };
    const mood = liveMood(useCrewData.getState().parties, now);
    if (liveActivityId && mood !== startedMood) {
      // A party started, ended or changed mood: the colours only change with a new activity.
      mod.stopActivity(liveActivityId, state);
      useAppStore.setState({ liveActivityId: null });
    }
    const running = useAppStore.getState().liveActivityId;
    if (running) mod.updateActivity(running, state);
    else {
      const id = mod.startActivity(state, configFor(mood));
      startedMood = mood;
      if (id) useAppStore.setState({ liveActivityId: id });
    }
  } catch {
    // Live Activities turned off for the app, or an iOS older than 16.2: the app works without.
    useAppStore.setState({ liveActivityId: null });
  }
}

/** Follows what is logged, like the Android widget, and catches up when the app comes back. */
export function watchLiveActivity(): void {
  if (Platform.OS !== "ios") return;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(syncLiveActivity, 800);
  };
  schedule();
  AppState.addEventListener("change", (status) => {
    if (status === "active") schedule();
  });
  useAppStore.subscribe((state, previous) => {
    if (state.drinks === previous.drinks && state.profile === previous.profile && state.lockScreenNumbers === previous.lockScreenNumbers && state.preferences === previous.preferences) return;
    schedule();
  });
  useCrewData.subscribe((state, previous) => {
    if (state.parties !== previous.parties) schedule();
  });
}
