import { describe, expect, it } from "vitest";
import {
  breathRatio,
  convertBac,
  convertVolume,
  countryRules,
  defaultPreferences,
  drivingLimit,
  formatBacValue,
  formatVolume,
  nightKey,
  toMillilitres,
} from "./index";

describe("BAC units (research/bac.md T7, T7b)", () => {
  it("derives the breath ratio from each country's own limits", () => {
    expect(breathRatio(countryRules("FR"))).toBe(2000);
    expect(breathRatio(countryRules("GB"))).toBe(2286);
    expect(breathRatio(countryRules("NL"))).toBe(2273);
    expect(breathRatio(countryRules("PT"))).toBe(2300);
    expect(breathRatio(countryRules("US"))).toBe(2100);
  });

  it("converts 0.50 g/L to every unit", () => {
    expect(convertBac(0.5, "mg_per_l_breath", 2000)).toBeCloseTo(0.25, 6);
    expect(convertBac(0.5, "percent_bac", 2100)).toBeCloseTo(0.05, 6);
    expect(convertBac(0.5, "mg_per_100ml_blood", 2286)).toBeCloseTo(50, 6);
    expect(convertBac(0.5, "ug_per_100ml_breath", 2286)).toBeCloseTo(21.87, 2);
    expect(convertBac(0.5, "ug_per_l_breath", 2000)).toBeCloseTo(250, 6);
    expect(convertBac(0.5, "permille", 2000)).toBeCloseTo(0.5, 6);
  });

  it("makes legal equivalences line up", () => {
    const uk = countryRules("GB");
    expect(convertBac(uk.limitBlood, "ug_per_100ml_breath", breathRatio(uk))).toBeCloseTo(35, 0);
    const fr = countryRules("FR");
    expect(convertBac(fr.limitBlood, "mg_per_l_breath", breathRatio(fr))).toBeCloseTo(0.25, 6);
  });

  it("formats with the locale's decimal separator and never shows a negative zero", () => {
    expect(formatBacValue(0.5, "g_per_l_blood", 2000, "fr-FR")).toBe("0,50");
    expect(formatBacValue(0.5, "g_per_l_blood", 2000, "en-GB")).toBe("0.50");
    expect(formatBacValue(0.8, "percent_bac", 2100, "en-US")).toBe("0.080");
    expect(formatBacValue(0.003, "mg_per_l_breath", 2000, "fr-FR")).toBe("0,00");
  });
});

describe("driving limits", () => {
  it("applies novice and professional limits", () => {
    expect(drivingLimit(countryRules("FR"), "standard")).toBe(0.5);
    expect(drivingLimit(countryRules("FR"), "novice")).toBe(0.2);
    expect(drivingLimit(countryRules("DE"), "novice")).toBe(0);
    expect(drivingLimit(countryRules("IE"), "professional")).toBe(0.2);
  });
  it("treats unverified countries as zero tolerance", () => {
    expect(drivingLimit(countryRules("MA"), "standard")).toBe(0);
    expect(drivingLimit(countryRules("RU"), "standard")).toBe(0);
  });
  it("falls back from a region to its country", () => {
    expect(countryRules("GB-WLS").code).toBe("GB");
    expect(countryRules("US-UT").limitBlood).toBe(0.5);
  });
});

describe("volumes", () => {
  it("knows that a pint is not the same everywhere", () => {
    expect(toMillilitres(1, "uk_pint")).toBeCloseTo(568.261, 3);
    expect(convertVolume(355, "us_fl_oz")).toBeCloseTo(12, 1);
    expect(formatVolume(500, "cl", "fr-FR")).toBe("50");
    expect(formatVolume(355, "us_fl_oz", "en-US")).toBe("12");
  });
});

describe("smart defaults (PREF-02, PREF-04)", () => {
  it("French phone in France", () => {
    expect(defaultPreferences({ languageTags: ["fr-FR"], region: "FR", uses24HourClock: true })).toEqual({
      language: "fr",
      legalCountry: "FR",
      driverCategory: "standard",
      unitSystem: "metric",
      bacUnit: "g_per_l_blood",
      currency: "EUR",
      hourCycle: "h23",
      dayBoundaryHour: 6,
      personalLimit: null,
      warnNearLimit: true,
      waterReminderMinutes: 45,
    });
  });
  it("French speaker living in the US gets French UI with US rules", () => {
    const prefs = defaultPreferences({ languageTags: ["fr-FR"], region: "US", uses24HourClock: null });
    expect(prefs).toMatchObject({ language: "fr", legalCountry: "US", unitSystem: "us_customary", bacUnit: "percent_bac", hourCycle: "h12" });
  });
  it("UK phone", () => {
    expect(defaultPreferences({ languageTags: ["en-GB"], region: "GB", uses24HourClock: true })).toMatchObject({
      language: "en",
      unitSystem: "uk_imperial",
      bacUnit: "mg_per_100ml_blood",
      currency: "GBP",
    });
  });
  it("unknown language falls back to English, unknown region to France", () => {
    expect(defaultPreferences({ languageTags: ["de-AT"], region: "AT", uses24HourClock: true })).toMatchObject({
      language: "en",
      legalCountry: "FR",
    });
  });
});

describe("night boundary (QOL-02)", () => {
  it("counts 2 am on Sunday as Saturday night", () => {
    const saturday23 = Date.UTC(2026, 9, 24, 21, 0); // 23:00 in Paris (UTC+2)
    const sunday02 = Date.UTC(2026, 9, 25, 0, 0); // 02:00 in Paris
    const sunday07 = Date.UTC(2026, 9, 25, 5, 0); // 07:00 in Paris
    expect(nightKey(saturday23, 120, 6)).toBe("2026-10-24");
    expect(nightKey(sunday02, 120, 6)).toBe("2026-10-24");
    expect(nightKey(sunday07, 120, 6)).toBe("2026-10-25");
  });
});
