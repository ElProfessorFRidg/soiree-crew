import { describe, expect, it } from "vitest";
import { sanitizeRolloverSnapshot, sanitizeScheduledState } from "./liveActivityScheduler";

describe("ActivityKit rollover snapshot safety", () => {
  const now = Date.UTC(2026, 10, 19, 12);

  it("retains recent data without changing the source object", () => {
    const original = { generatedAt: now - 60_000, bac: "0.12", bacForecast: { values: [12, 11] }, party: { endsAt: now + 60_000, alert: "Check in" } };
    expect(sanitizeRolloverSnapshot(original, now)).toEqual(original);
    expect(original.party.alert).toBe("Check in");
  });

  it("keeps the countdown but removes stale measurements and safety alerts", () => {
    const old = {
      generatedAt: now - 8 * 3_600_000,
      zeroAt: now + 2 * 3_600_000,
      bac: "0.42", bacForecast: { values: [42] }, status: "Rising",
      drive: { value: "Safe" }, under: "Drive", bacColor: "#fff", limitFrac: 0.4,
      party: { endsAt: now + 3_600_000, name: "Crew", alert: "All clear" },
    };
    const result = sanitizeRolloverSnapshot(old, now);
    expect(result).toMatchObject({ zeroAt: old.zeroAt, party: { endsAt: old.party.endsAt, name: "Crew" } });
    for (const field of ["bac", "bacForecast", "status", "drive", "under", "bacColor", "limitFrac"]) {
      expect(result).not.toHaveProperty(field);
    }
    expect(result.party).not.toHaveProperty("alert");
    expect(old).toHaveProperty("bac");
  });

  it("treats missing and future timestamps as untrusted", () => {
    expect(sanitizeRolloverSnapshot({ bac: "0.20" }, now)).not.toHaveProperty("bac");
    expect(sanitizeRolloverSnapshot({ generatedAt: now + 5 * 60_000, bac: "0.20" }, now)).not.toHaveProperty("bac");
  });
});

describe("periodic ActivityKit update safety", () => {
  const now = Date.UTC(2026, 10, 20, 12);
  it("does not send stale BAC or driving labels as a fresh APNs update", () => {
    const data = { generatedAt: now - 20 * 60_000, zeroAt: now + 60_000,
      bac: "0.24", status: "Under limit", drive: { value: "Safe" }, bacForecast: { values: [24] } };
    const state = { title: "Night", subtitle: JSON.stringify(data) };
    const result = sanitizeScheduledState(state, now);
    const snapshot = JSON.parse(String(result.subtitle));
    expect(snapshot.zeroAt).toBe(data.zeroAt);
    expect(snapshot).not.toHaveProperty("bac");
    expect(snapshot).not.toHaveProperty("drive");
    expect(snapshot).not.toHaveProperty("status");
    expect(state.subtitle).toContain("0.24");
  });
  it("keeps fresh information and discards invalid JSON safely", () => {
    const fresh = { title: "Night", subtitle: JSON.stringify({ generatedAt: now, bac: "0.10" }) };
    expect(sanitizeScheduledState(fresh, now)).toEqual(fresh);
    expect(sanitizeScheduledState({ title: "Night", subtitle: "not json" }, now)).toEqual({ title: "Night", subtitle: null });
  });
});
