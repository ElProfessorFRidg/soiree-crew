import * as Battery from "expo-battery";
import { Platform } from "react-native";
import { create } from "zustand";
import { setPartyStatus, useCrewData } from "@/server/crewData";
import { useAppStore } from "@/state/store";
import { isCharging } from "./reading";
import { loopPlan, savingPower, type PowerReading } from "./saving";

/** QOL-10: under this charge, unplugged, the crew sees "low battery" next to my name. */
const CREW_LOW_LEVEL = 0.1;
/** Refreshes and clocks run this many times less often in eco mode. Essentials and SOS are untouched. */
export const ECO_SLOWDOWN = 4;

/**
 * ADP-08, QOL-24: eco mode is on in Low Power Mode, or on a low battery off the charger, unless the
 * "Économie de batterie" setting is off. Animations stay on: endless loops play a few slow cycles
 * and rest (useEcoLoop), the living background runs lighter, refreshes and clocks slow down, and
 * the background location spaces out (location/outing.ts).
 */
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

function update({ level, charging, lowPowerMode }: PowerReading): void {
  const eco = savingPower({ level, charging, lowPowerMode }, useAppStore.getState().ecoOn);
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
  const reading: PowerReading = { level: null, charging: false, lowPowerMode: false };
  void Battery.getPowerStateAsync()
    .then((state) => {
      reading.level = state.batteryLevel;
      reading.charging = isCharging(state.batteryState);
      reading.lowPowerMode = state.lowPowerMode;
      update(reading);
    })
    .catch(() => undefined);
  Battery.addBatteryLevelListener(({ batteryLevel }) => {
    reading.level = batteryLevel;
    update(reading);
  });
  Battery.addBatteryStateListener(({ batteryState }) => {
    reading.charging = isCharging(batteryState);
    update(reading);
  });
  Battery.addLowPowerModeListener(({ lowPowerMode }) => {
    reading.lowPowerMode = lowPowerMode;
    update(reading);
  });
  // The setting applies at once.
  useAppStore.subscribe((state, before) => {
    if (state.ecoOn !== before.ecoOn) update(reading);
  });
}

/** An interval stretched in eco mode. */
export function useEcoInterval(ms: number): number {
  return useEco((state) => (state.eco ? ms * ECO_SLOWDOWN : ms));
}

/** QOL-24: how an endless `withRepeat` loop runs: forever, or a few slower cycles in eco mode. */
export function useEcoLoop(reverse: boolean): { count: number; slow: number } {
  const eco = useEco((state) => state.eco);
  return loopPlan(eco, reverse);
}
