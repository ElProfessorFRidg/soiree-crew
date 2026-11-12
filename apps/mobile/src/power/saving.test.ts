import { describe, expect, it } from "vitest";
import { themeFor, isDaytime } from "../theme/choice";
import { loopPlan, locationPlan, savingPower } from "./saving";

describe("savingPower", () => {
  it("is on in Low Power Mode, or on a low battery off the charger", () => {
    expect(savingPower({ level: 0.9, charging: false, lowPowerMode: true }, true)).toBe(true);
    expect(savingPower({ level: 0.15, charging: false, lowPowerMode: false }, true)).toBe(true);
    expect(savingPower({ level: 0.15, charging: true, lowPowerMode: false }, true)).toBe(false);
    expect(savingPower({ level: -1, charging: false, lowPowerMode: false }, true)).toBe(false);
  });
  it("is off when the setting is off", () => {
    expect(savingPower({ level: 0.05, charging: false, lowPowerMode: true }, false)).toBe(false);
  });
});

describe("loopPlan", () => {
  it("loops forever normally, a few slower cycles in eco mode, and reversing loops keep an even count", () => {
    expect(loopPlan(false, true)).toEqual({ count: -1, slow: 1 });
    expect(loopPlan(true, false).count).toBe(3);
    expect(loopPlan(true, true).count % 2).toBe(0);
  });
});

describe("locationPlan", () => {
  it("spaces out in saving mode but keeps the driving warning able to read a speed", () => {
    expect(locationPlan(false, false).intervalMinutes).toBe(5);
    expect(locationPlan(false, true).intervalMinutes).toBe(15);
    expect(locationPlan(true, true).intervalMinutes).toBeLessThan(3);
  });
});

describe("themeFor", () => {
  it("keeps the night dark whatever the phone says", () => {
    expect(themeFor("auto", "light", isDaytime(23))).toBe("dark");
    expect(themeFor("auto", "light", isDaytime(12))).toBe("light");
    expect(themeFor("light", "dark", false)).toBe("light");
  });
});
