import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { useT } from "@/i18n";
import { runQuickAction } from "@/system/quickActions";
import { useAppStore } from "@/state/store";

/** QOL-04: soireecrew://quick/again, /quick/water or /quick/home (HUB-02) does the action, then lands on the party screen. */
export default function QuickActionRoute() {
  const { action } = useLocalSearchParams<{ action: string }>();
  const i18n = useT();
  const onboarded = useAppStore((state) => state.ageConfirmedAt !== null && state.profile !== null);
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !onboarded) return;
    done.current = true;
    if (action === "again" || action === "water" || action === "home") runQuickAction(action, i18n);
  }, [action, i18n, onboarded]);
  return <Redirect href={onboarded ? "/" : "/onboarding"} />;
}
