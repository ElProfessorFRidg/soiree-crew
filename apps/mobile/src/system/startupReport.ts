import { Platform, Settings } from "react-native";

// A small, fixed vocabulary: no exception messages, URLs, account data or credentials cross here.
export const STARTUP_STEPS = ["entry", "router", "root", "fonts", "storage", "session", "layout", "curtain", "crash"] as const;
export type StartupStep = (typeof STARTUP_STEPS)[number];
export type StartupStatus = "waiting" | "ready" | "fallback" | "failed";
const state: Partial<Record<StartupStep, StartupStatus>> = {};

/** UIKit reads this independently of React, even while the root layout is still waiting. */
export function reportStartup(step: StartupStep, status: StartupStatus): void {
  if (Platform.OS !== "ios" || !STARTUP_STEPS.includes(step) || !["waiting", "ready", "fallback", "failed"].includes(status) || state[step] === status) return;
  state[step] = status;
  try { Settings.set({ CrewStartupState: JSON.stringify(state) }); }
  catch { /* Diagnostics must never prevent the application from starting. */ }
}

export const reportStartupLayout = () => reportStartup("layout", "ready");
export const reportStartupCurtain = () => reportStartup("curtain", "ready");
