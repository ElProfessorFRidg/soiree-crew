import { describe, expect, it } from "vitest";
import { distanceMeters, evaluateCheckIn, verifyDrinks, type CheckInEvaluationInput } from "./anticheat";

const NOW = Date.UTC(2026, 10, 6, 22, 0);
const venue = { id: "zinc", lat: 48.8566, lng: 2.3522, radiusM: 75 };

function input(overrides: Partial<Omit<CheckInEvaluationInput, "fix">> & { fix?: Partial<CheckInEvaluationInput["fix"]> } = {}): CheckInEvaluationInput {
  const { fix, ...rest } = overrides;
  return {
    fix: { lat: 48.85663, lng: 2.35227, accuracy: 12, mocked: false, ...fix },
    venue,
    serverNow: NOW,
    deviceNow: NOW,
    previous: [],
    peersAtVenue: [],
    fixHash: "h-now",
    ...rest,
  };
}

describe("check-in verdicts (research/anticheat.md §2.4 worked examples)", () => {
  it("accepts an honest check-in", () => {
    expect(evaluateCheckIn(input()).verdict).toBe("accepted");
  });

  it("says 'not here' without any shame when the phone is elsewhere", () => {
    const result = evaluateCheckIn(input({ fix: { lat: 48.87, lng: 2.35 } }));
    expect(result).toMatchObject({ verdict: "not_here", reason: "not_here", risk: 0 });
  });

  it("asks a friend to confirm in a basement with a 180 m fix", () => {
    expect(evaluateCheckIn(input({ fix: { accuracy: 180 } }))).toMatchObject({ verdict: "unverified", reason: "imprecise" });
  });

  it("rejects a mock location sitting exactly on the pin: 75 points over two categories", () => {
    const result = evaluateCheckIn(input({ fix: { lat: venue.lat, lng: venue.lng, mocked: true } }));
    expect(result.risk).toBe(75);
    expect(result.verdict).toBe("rejected");
  });

  it("only flags a hidden-flag teleporter as unverified: 70 points in one category", () => {
    const result = evaluateCheckIn(
      input({
        fix: { lat: venue.lat, lng: venue.lng },
        previous: [{ venueId: "lyon", at: NOW - 30 * 60_000, lat: 45.764, lng: 4.8357, fixHash: "h-lyon" }],
      }),
    );
    expect(result.risk).toBe(70);
    expect(result.verdict).toBe("unverified");
  });

  it("lets a friend already checked in vouch for a borderline check-in", () => {
    const result = evaluateCheckIn(
      input({ fix: { lat: venue.lat, lng: venue.lng, mocked: true }, peersAtVenue: [{ at: NOW - 5 * 60_000 }] }),
    );
    expect(result.corroborated).toBe(true);
    expect(result.verdict).toBe("unverified");
  });

  it("flags coordinates repeated to the metre across check-ins", () => {
    const result = evaluateCheckIn(input({ previous: [{ venueId: "zinc", at: NOW - 3 * 3_600_000, lat: 0, lng: 0, fixHash: "h-now" }] }));
    expect(result.signals.map((s) => s.name)).toContain("coords_identical");
  });

  it("computes distances with the haversine formula", () => {
    expect(distanceMeters({ lat: 48.8566, lng: 2.3522 }, { lat: 45.764, lng: 4.8357 }) / 1000).toBeCloseTo(391.5, 0);
  });
});

describe("drink verification (AC-07)", () => {
  const party = { startsAt: NOW - 3_600_000, endsAt: NOW + 4 * 3_600_000 };
  const pint = (id: string, minutes: number, extra: Partial<{ loggedAt: number; confirmed: boolean }> = {}) => ({
    id,
    volumeMl: 500,
    abv: 0.05,
    consumedAt: NOW + minutes * 60_000,
    loggedAt: NOW + minutes * 60_000,
    confirmed: true,
    ...extra,
  });

  it("verifies a drink a friend confirmed", () => {
    expect(verifyDrinks([pint("a", 0)], party).get("a")).toEqual({ status: "verified" });
  });
  it("needs a confirmation", () => {
    expect(verifyDrinks([pint("a", 0, { confirmed: false })], party).get("a")).toMatchObject({ reason: "not_confirmed" });
  });
  it("takes the excess of a 30 min burst off the leaderboard", () => {
    const result = verifyDrinks([pint("a", 0), pint("b", 5), pint("c", 10)], party);
    expect(result.get("a")!.status).toBe("verified");
    expect(result.get("b")!.status).toBe("verified");
    // 3 pints = 59 g > 40 g in 30 min.
    expect(result.get("c")).toMatchObject({ status: "unverified", reason: "burst" });
  });
  it("does not verify late entries or drinks outside the party", () => {
    const late = verifyDrinks([pint("a", 0, { loggedAt: NOW + 60 * 60_000 })], party);
    expect(late.get("a")).toMatchObject({ reason: "late_entry" });
    expect(verifyDrinks([pint("a", 0)], null).get("a")).toMatchObject({ reason: "outside_party" });
  });
});
