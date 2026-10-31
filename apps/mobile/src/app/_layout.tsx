import "@/chat/runtime";
import { getMotionScale, setMotionScale } from "@crew/design-tokens";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import {
  DarkTheme,
  router,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from "expo-router";
import * as SystemUI from "expo-system-ui";
import { HeroOverlay } from "@/motion/hero";
import { AT_LAUNCH_MS, checkAndAnnounce, installLatest, ON_RETURN_MS } from "@/system/updates";
import { showToast } from "@/ui/Toast";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState as RNAppState, Platform, Settings } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  ReducedMotionConfig,
  ReduceMotion,
  useReducedMotion,
} from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { themes } from "@crew/design-tokens";
import { createTranslator, I18nProvider } from "@/i18n";
import { connect } from "@/server/connection";
import { loadSession, useSession } from "@/server/session";
import { refreshCalendarReminders, sendClock, watchCalendarReminders } from "@/server/calendarData";
import { useSyncFeedback } from "@/sync/feedback";
import { useDriverReminder } from "@/party/driverReminder";
import { flush } from "@/sync/engine";
import { followPhoneHourCycle, useAppStore } from "@/state/store";
import { ThemeProvider } from "@/theme";
import { useEco, watchBattery } from "@/power/eco";
import { logWater } from "@/drinks/actions";
import {
  LOG_WATER_ACTION,
  MUTE_ACTION,
  muteUntilMorning,
  refreshReminders,
} from "@/reminders/reminders";
import { flushUploads } from "@/photos/uploads";
import { flushGameResults } from "@/server/gameData";
import { watchWidget } from "@/widgets/sync";
import { CrashScreen } from "@/ui/CrashScreen";
import { LaunchCurtain } from "@/ui/LaunchCurtain";
import { purgePlainFiles } from "@/chat/media";
import { pruneDrinkPhotos } from "@/drinks/drinkPhotos";
import { watchLiveActivity } from "@/system/liveActivity";
import { watchKeptCopy } from "@/system/keptCopy";
import { PrivacyCover } from "@/ui/PrivacyCover";
import { PermissionPrompt } from "@/system/PermissionPrompt";
import { handleNotificationResponse, prepareNotifications } from "@/notify/push";

/** Expo Router shows this instead of a crashed screen (any route below this layout). */
export { CrashScreen as ErrorBoundary };

// MOT-14: the test harness drives the motion time scale in dev builds.
if (__DEV__)
  (globalThis as { __crewMotion?: unknown }).__crewMotion = {
    setScale: setMotionScale,
    getScale: getMotionScale,
  };

void SplashScreen.preventAutoHideAsync();
const hideSplash = () => void SplashScreen.hideAsync().catch(() => undefined);

const fonts = {
  "Archivo-Numeral": require("../../assets/fonts/Archivo-Numeral.ttf"),
  "Archivo-Title": require("../../assets/fonts/Archivo-Title.ttf"),
  "Archivo-Heading": require("../../assets/fonts/Archivo-Heading.ttf"),
  "Archivo-Body": require("../../assets/fonts/Archivo-Body.ttf"),
  "Archivo-Medium": require("../../assets/fonts/Archivo-Medium.ttf"),
  "Archivo-Semibold": require("../../assets/fonts/Archivo-Semibold.ttf"),
  "Archivo-Tag": require("../../assets/fonts/Archivo-Tag.ttf"),
  "Archivo-Bold": require("../../assets/fonts/Archivo-Bold.ttf"),
};

function SyncFeedback() {
  useSyncFeedback();
  useDriverReminder();
  return null;
}

const NAVIGATION_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: themes.dark.bg,
    card: themes.dark.bg,
    border: themes.dark.line,
    primary: themes.dark.amber,
    text: themes.dark.text,
  },
};

// The native window behind every screen: white by default on iOS, visible in screen transitions.
void SystemUI.setBackgroundColorAsync(themes.dark.bg).catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fonts);
  const hydrated = useAppStore((state) => state.hydrated);
  const language = useAppStore((state) => state.preferences.language);
  const sessionReady = useSession((state) => state.ready);
  const session = useSession((state) => state.session);
  const ready = fontsLoaded && hydrated && sessionReady;

  const eco = useEco((state) => state.eco);
  // MOT-12: with Reduce Motion, screens cross-fade instead of sliding in.
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    void loadSession();
    purgePlainFiles();
    watchBattery();
    watchWidget();
    watchLiveActivity();
    watchKeptCopy(useAppStore);
  }, []);

  useEffect(() => {
    // QOL-03: action buttons and Android channels speak the app's language.
    if (ready) void prepareNotifications().catch(() => undefined);
  }, [ready, language]);

  useEffect(() => {
    // O-21: photos of drinks removed meanwhile (here, on another phone, by another account) go.
    if (hydrated) pruneDrinkPhotos();
  }, [hydrated]);

  useEffect(() => {
    // Server transport, socket and delta sync follow the session (ADR 0002).
    if (hydrated && sessionReady) connect(session);
  }, [hydrated, sessionReady, session]);

  useEffect(() => {
    // QOL-02: the server learns the phone's time zone; N-06, QOL-21: local reminders follow the parties.
    if (!hydrated || !sessionReady || !session) return;
    void sendClock().catch(() => undefined);
    watchCalendarReminders();
    void refreshCalendarReminders();
  }, [hydrated, sessionReady, session]);

  useEffect(() => {
    if (!ready) return;
    // The native splash is hidden by LaunchCurtain, once its copy is on screen (MOT-10).
    // Whatever was queued before the app was killed goes out now (SYNC-06).
    void flush();
    void flushGameResults();
    // O-12: a newer release is looked for at every launch, with nothing to do; found once, said once.
    const announce = (version: string) => {
      const i18n = createTranslator(useAppStore.getState().preferences.language);
      showToast({ message: i18n.t("updates.available", { version }), durationMs: 10_000, action: { label: i18n.t("updates.install"), onPress: () => void installLatest() } });
    };
    void checkAndAnnounce(AT_LAUNCH_MS, announce).catch(() => undefined);
    const subscription = RNAppState.addEventListener("change", (status) => {
      if (status === "active") {
        followPhoneHourCycle();
        void checkAndAnnounce(ON_RETURN_MS, announce).catch(() => undefined);
        void flush();
        void flushUploads();
        void flushGameResults();
        void refreshReminders();
        void sendClock().catch(() => undefined);
        void refreshCalendarReminders();
      }
    });
    return () => subscription.remove();
  }, [ready]);

  useEffect(() => {
    if (!ready || Platform.OS === "web") return;
    // A tapped notification opens the screen it is about (the recap, O-41).
    const open = (response: Notifications.NotificationResponse | null) => {
      // QOL-03: "I had water" right from the reminder logs it, like the in-app button.
      if (!response) return;
      // The last response survives restarts: handle it once, then forget it.
      void Notifications.clearLastNotificationResponseAsync().catch(
        () => undefined,
      );
      if (response.actionIdentifier === LOG_WATER_ACTION) {
        logWater();
        return;
      }
      if (response.actionIdentifier === MUTE_ACTION) {
        void muteUntilMorning();
        return;
      }
      // O-38, QOL-03: crew notifications and their action buttons.
      if (handleNotificationResponse(response)) return;
      const url = response.notification.request.content.data?.url;
      if (typeof url === "string" && url.startsWith("/"))
        router.push(url as never);
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const subscription =
      Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [ready]);

  // CI only: the launch test opens each main screen with `-ciRoute /path` (an iOS launch argument,
  // read from the user defaults); a person launching the app never passes one.
  useEffect(() => {
    if (!ready || Platform.OS !== "ios") return;
    const route = Settings.get("ciRoute") as unknown;
    if (typeof route === "string" && route.startsWith("/")) setTimeout(() => router.push(route as never), 300);
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: themes.dark.bg }}
    >
      {/* ADP-08: lighter effects on a low battery. Animations jump to their end, nothing else changes. */}
      {eco ? <ReducedMotionConfig mode={ReduceMotion.Always} /> : null}
      <SafeAreaProvider>
        <ThemeProvider>
          {/* The navigator's own colours: its default theme is white and showed through while a screen slid back. */}
          <NavigationThemeProvider value={NAVIGATION_THEME}>
            <I18nProvider language={language}>
              <StatusBar style="light" />
              <SyncFeedback />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: themes.dark.bg },
                  animation: reduceMotion ? "fade" : "slide_from_right",
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="onboarding"
                  options={{ animation: "fade", gestureEnabled: false }}
                />
                <Stack.Screen
                  name="add-drink"
                  // A page sheet, not a formSheet: on iOS a fixed-detent formSheet gave its scroll
                  // view no height, so the sheet opened empty except for the add button.
                  options={{
                    presentation: "modal",
                    contentStyle: { backgroundColor: themes.dark.surface },
                  }}
                />
                <Stack.Screen name="history" />
                <Stack.Screen name="edit-drink" />
                <Stack.Screen name="curve" />
                <Stack.Screen name="limits" />
                <Stack.Screen name="new-party" />
                <Stack.Screen name="live" />
                <Stack.Screen name="add-venue" />
                <Stack.Screen name="checkin" />
                <Stack.Screen name="venue" />
                <Stack.Screen name="leaderboard" />
                <Stack.Screen name="money" />
                <Stack.Screen name="pool" />
                <Stack.Screen name="new-expense" />
                <Stack.Screen name="round" />
                <Stack.Screen
                  name="recap"
                  options={{
                    presentation: "fullScreenModal",
                    animation: "fade",
                  }}
                />
                <Stack.Screen name="recaps" />
                <Stack.Screen name="settings" />
                <Stack.Screen name="notifications" />
                <Stack.Screen name="notification-settings" />
                <Stack.Screen name="home" />
                <Stack.Screen name="where-to" />
                <Stack.Screen name="join" options={{ animation: "fade" }} />
                {/* MOT-05: screens reached by a shared element fade in, so the element lands where it stays. */}
                <Stack.Screen name="profile" options={{ animation: "fade" }} />
                <Stack.Screen
                  name="games/[gameId]"
                  options={{ animation: "fade" }}
                />
                <Stack.Screen name="edit-profile" />
                <Stack.Screen name="friends" />
                <Stack.Screen name="reports" />
                <Stack.Screen name="album" />
                <Stack.Screen name="crew-stats" />
                <Stack.Screen name="items" />
                <Stack.Screen name="privacy" />
                <Stack.Screen name="polls" />
                <Stack.Screen name="new-poll" />
                <Stack.Screen name="wrapped" />
                <Stack.Screen name="my-stats" />
                <Stack.Screen name="feed" />
                <Stack.Screen name="search" />
                <Stack.Screen name="photo-strip" />
                <Stack.Screen name="privacy-summary" />
                <Stack.Screen name="bar" />
                <Stack.Screen name="recipe" />
                <Stack.Screen name="mixer" />
                <Stack.Screen name="place" />
                <Stack.Screen name="discover" />
                <Stack.Screen name="estimate" />
                <Stack.Screen name="health-consent" />
                <Stack.Screen name="morning" options={{ animation: "fade" }} />
                <Stack.Screen
                  name="quick/[action]"
                  options={{ animation: "none" }}
                />
                <Stack.Screen
                  name="sos"
                  options={{
                    presentation: "fullScreenModal",
                    animation: "fade",
                  }}
                />
              </Stack>
              <HeroOverlay />
              <PermissionPrompt />
              <PrivacyCover />
            </I18nProvider>
          </NavigationThemeProvider>
        </ThemeProvider>
      </SafeAreaProvider>
      <LaunchCurtain onShown={hideSplash} />
    </GestureHandlerRootView>
  );
}
