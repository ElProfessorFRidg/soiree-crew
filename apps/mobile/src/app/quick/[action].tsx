import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { useT } from "@/i18n";
import { runQuickAction } from "@/system/quickActions";
import { isOnboarded, useAppStore } from "@/state/store";

/** QOL-04: soireecrew://quick/again, /quick/water or /quick/home (HUB-02) does the action, then lands on the party screen. */
export default function QuickActionRoute() {
  const { action } = useLocalSearchParams<{ action: string }>();
  const i18n = useT();
  const onboarded = useAppStore(isOnboarded);
  // Without the health consent there is no drink or water to log: the shortcut only opens the app.
  const canLog = useAppStore((state) => state.profile !== null);
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !onboarded) return;
    done.current = true;
    if (action === "home" || (canLog && (action === "again" || action === "water"))) runQuickAction(action, i18n);
  }, [action, i18n, onboarded, canLog]);
  return <Redirect href={onboarded ? "/" : "/onboarding"} />;
}
