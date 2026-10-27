import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState as RNAppState } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { themes } from "@crew/design-tokens";
import { I18nProvider } from "@/i18n";
import { connect } from "@/server/connection";
import { loadSession, useSession } from "@/server/session";
import { useSyncFeedback } from "@/sync/feedback";
import { flush } from "@/sync/engine";
import { useAppStore } from "@/state/store";
import { ThemeProvider } from "@/theme";

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

  useEffect(() => {
    void loadSession();
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
    const subscription = RNAppState.addEventListener("change", (status) => {
      if (status === "active") void flush();
    });
    return () => subscription.remove();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: themes.dark.bg }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider language={language}>
            <StatusBar style="light" />
            <SyncFeedback />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: themes.dark.bg },
                animation: "slide_from_right",
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
              <Stack.Screen name="sos" options={{ presentation: "fullScreenModal", animation: "fade" }} />
            </Stack>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
