import * as Battery from "expo-battery";
import { Platform } from "react-native";
import { useAppStore } from "@/state/store";
import { savingPower } from "./saving";

export const isCharging = (state: Battery.BatteryState) => state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;

/**
 * QOL-24: the eco mode rule, read straight from the system. The background location task may run
 * with no screen open, so it cannot count on the live state of power/eco.ts.
 */
export async function savingPowerNow(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const state = await Battery.getPowerStateAsync().catch(() => null);
  if (!state) return false;
  return savingPower({ level: state.batteryLevel, charging: isCharging(state.batteryState), lowPowerMode: state.lowPowerMode }, useAppStore.getState().ecoOn);
}
