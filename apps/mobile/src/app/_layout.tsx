import "@/chat/runtime";
import { getMotionScale, setMotionScale } from "@crew/design-tokens";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { HeroOverlay } from "@/motion/hero";
import { checkForUpdate } from "@/system/updates";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState as RNAppState, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ReducedMotionConfig, ReduceMotion, useReducedMotion } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { themes } from "@crew/design-tokens";
import { I18nProvider } from "@/i18n";
import { connect } from "@/server/connection";
import { loadSession, useSession } from "@/server/session";
import { useSyncFeedback } from "@/sync/feedback";
import { flush } from "@/sync/engine";
import { followPhoneHourCycle, useAppStore } from "@/state/store";
import { ThemeProvider } from "@/theme";
import { useEco, watchBattery } from "@/power/eco";
import { logWater } from "@/drinks/actions";
import { LOG_WATER_ACTION, MUTE_ACTION, muteUntilMorning, refreshReminders } from "@/reminders/reminders";
import { flushUploads } from "@/photos/uploads";
import { watchWidget } from "@/widgets/sync";
import { CrashScreen } from "@/ui/CrashScreen";

/** Expo Router shows this instead of a crashed screen (any route below this layout). */
export { CrashScreen as ErrorBoundary };

// MOT-14: the test harness drives the motion time scale in dev builds.
if (__DEV__) (globalThis as { __crewMotion?: unknown }).__crewMotion = { setScale: setMotionScale, getScale: getMotionScale };

void SplashScreen.preventAutoHideAsync();

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
  return null;
}

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
    watchBattery();
    watchWidget();
  }, []);

  useEffect(() => {
    // Server transport, socket and delta sync follow the session (ADR 0002).
    if (hydrated && sessionReady) connect(session);
  }, [hydrated, sessionReady, session]);

  useEffect(() => {
    if (!ready) return;
    void SplashScreen.hideAsync();
    // Whatever was queued before the app was killed goes out now (SYNC-06).
    void flush();
    void checkForUpdate().catch(() => undefined);
    const subscription = RNAppState.addEventListener("change", (status) => {
      if (status === "active") {
        followPhoneHourCycle();
        void checkForUpdate().catch(() => undefined);
        void flush();
        void flushUploads();
        void refreshReminders();
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
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      if (response.actionIdentifier === LOG_WATER_ACTION) {
        logWater();
        return;
      }
      if (response.actionIdentifier === MUTE_ACTION) {
        void muteUntilMorning();
        return;
      }
      const url = response.notification.request.content.data?.url;
      if (typeof url === "string" && url.startsWith("/")) router.push(url as never);
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: themes.dark.bg }}>
      {/* ADP-08: lighter effects on a low battery. Animations jump to their end, nothing else changes. */}
      {eco ? <ReducedMotionConfig mode={ReduceMotion.Always} /> : null}
      <SafeAreaProvider>
        <ThemeProvider>
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
              <Stack.Screen name="onboarding" options={{ animation: "fade", gestureEnabled: false }} />
              <Stack.Screen
                name="add-drink"
                options={{
                  presentation: "formSheet",
                  sheetAllowedDetents: [0.92],
                  sheetGrabberVisible: true,
                  sheetCornerRadius: 26,
                  contentStyle: { backgroundColor: themes.dark.surface },
                }}
              />
              <Stack.Screen name="history" />
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
              <Stack.Screen name="recap" options={{ presentation: "fullScreenModal", animation: "fade" }} />
              <Stack.Screen name="recaps" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="home" />
              <Stack.Screen name="where-to" />
              <Stack.Screen name="join" options={{ animation: "fade" }} />
              {/* MOT-05: screens reached by a shared element fade in, so the element lands where it stays. */}
              <Stack.Screen name="profile" options={{ animation: "fade" }} />
              <Stack.Screen name="games/[gameId]" options={{ animation: "fade" }} />
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
              <Stack.Screen name="morning" options={{ animation: "fade" }} />
              <Stack.Screen name="quick/[action]" options={{ animation: "none" }} />
              <Stack.Screen name="sos" options={{ presentation: "fullScreenModal", animation: "fade" }} />
            </Stack>
            <HeroOverlay />
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
