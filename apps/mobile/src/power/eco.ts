import * as Battery from "expo-battery";
import { Platform } from "react-native";
import { create } from "zustand";
import { setPartyStatus, useCrewData } from "@/server/crewData";

/** ADP-08: under this charge, unplugged, the app goes easy on the battery during a night. */
const LOW_LEVEL = 0.2;
/** QOL-10: under this charge, unplugged, the crew sees "low battery" next to my name. */
const CREW_LOW_LEVEL = 0.1;
/** Refreshes and clocks run this many times less often in eco mode. Essentials and SOS are untouched. */
export const ECO_SLOWDOWN = 4;

interface EcoState {
  eco: boolean;
  level: number | null;
  /** QOL-10: what the crew was last told. */
  toldLow: boolean;
}

export const useEco = create<EcoState>(() => ({ eco: false, level: null, toldLow: false }));

function liveParty() {
  const now = Date.now();
  return useCrewData.getState().parties.find((p) => p.myResponse === "going" && p.closedAt === null && p.startsAt <= now && p.endsAt >= now);
}

function update(level: number | null, charging: boolean, lowPowerMode: boolean): void {
  const eco = lowPowerMode || (level !== null && level >= 0 && level <= LOW_LEVEL && !charging);
  useEco.setState({ eco, level });
  // QOL-10: the crew sees a low battery on the live party, so nobody worries when the phone dies.
  // The server stamps the time and keeps my last shared position for a while (N-07).
  const low = level !== null && level >= 0 && level <= CREW_LOW_LEVEL && !charging;
  const party = liveParty();
  if (party && low !== useEco.getState().toldLow) {
    useEco.setState({ toldLow: low });
    void setPartyStatus(party.id, { batteryLow: low }).catch(() => useEco.setState({ toldLow: !low }));
  }
}

let started = false;

/** Starts once, from the root layout. Does nothing on the web preview. */
export function watchBattery(): void {
  if (started || Platform.OS === "web") return;
  started = true;
  let level: number | null = null;
  let charging = false;
  let lowPower = false;
  void Battery.getPowerStateAsync()
    .then((state) => {
      level = state.batteryLevel;
      charging = state.batteryState === Battery.BatteryState.CHARGING || state.batteryState === Battery.BatteryState.FULL;
      lowPower = state.lowPowerMode;
      update(level, charging, lowPower);
    })
    .catch(() => undefined);
  Battery.addBatteryLevelListener(({ batteryLevel }) => {
    level = batteryLevel;
    update(level, charging, lowPower);
  });
  Battery.addBatteryStateListener(({ batteryState }) => {
    charging = batteryState === Battery.BatteryState.CHARGING || batteryState === Battery.BatteryState.FULL;
    update(level, charging, lowPower);
  });
  Battery.addLowPowerModeListener(({ lowPowerMode }) => {
    lowPower = lowPowerMode;
    update(level, charging, lowPower);
  });
}

/** An interval stretched in eco mode. */
export function useEcoInterval(ms: number): number {
  return useEco((state) => (state.eco ? ms * ECO_SLOWDOWN : ms));
}
