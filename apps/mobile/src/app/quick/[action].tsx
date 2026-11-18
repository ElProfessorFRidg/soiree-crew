import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { useT } from "@/i18n";
import { runQuickAction } from "@/system/quickActions";
import { isOnboarded, useAppStore } from "@/state/store";

/** QOL-04: soireecrew://quick/again, /quick/water or /quick/home (HUB-02) does the action, then lands on the party screen. */
export default function QuickActionRoute() {
  const { action } = useLocalSearchParams<{ action: string }>();
  const router = useRouter();
  const i18n = useT();
  const onboarded = useAppStore(isOnboarded);
  // Without the health consent there is no drink or water to log: the shortcut only opens the app.
  const canLog = useAppStore((state) => state.profile !== null);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    if (!onboarded) { router.replace("/onboarding"); return; }
    if (action === "home" || (canLog && (action === "again" || action === "water"))) runQuickAction(action, i18n);
    router.replace("/");
  }, [action, i18n, onboarded, canLog, router]);
  // Do not redirect before the effect runs: the route could unmount before logging the action.
  return null;
}
